import { loadWorld, loadDetail, loadRegions, loadDistricts, contains, atDetail } from './world.js';

const HOME = [-35, 24];
const MARGIN = 28;
const DETAIL_ZOOM = 1.7;
const THEME_KEYS = ['ocean', 'ocean-edge', 'land', 'land-line', 'land-dim', 'grat', 'tracked', 'tracked-dim', 'tracked-soon',
  'tracked-live', 'hover', 'uncalled', 'hatch-bg', 'hatch-line', 'shade-mid', 'shade-lo', 'fg', 'bg'];

const clampLat = v => Math.max(-80, Math.min(80, v));
const clampK = v => Math.max(0.85, Math.min(24, v));
const wrap = d => ((((d % 360) + 540) % 360) - 180);

// One canvas globe for the whole app. Views swap its handlers and ask it to
// focus a country; it owns rotation, zoom, inertia, hit-testing and the
// state/province layer. Everything is redrawn per frame, so shapes are culled
// to the visible cap and the light 110m outline is used until zoomed in.
export async function createGlobe(pane, { countries }) {
  const canvas = pane.querySelector('canvas.globe');
  const ctx = canvas.getContext('2d');
  const tip = pane.querySelector('.tooltip');
  const markerLayer = pane.querySelector('.markers');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byAtlas = new Map(countries.map(c => [c.atlasId, c]));

  const coarse = await loadWorld();
  let detail = null;

  let W = 800, H = 800, R = 372, dpr = 1;
  let rot = [-HOME[0], -HOME[1]];
  let k = 1;
  let zoomTarget = null;
  let vel = [0, 0];
  let fly = null;
  let dragging = false;
  let pointerInside = false;
  let lastInput = -Infinity;
  let lastFrame = performance.now();
  let dirty = true;
  let handlers = {};
  let statuses = new Map();
  let highlightCode = null;
  let focus = null;
  let focusToken = null;
  let regionStyle = () => ({});
  let selected = null;
  let hover = null;
  let hoverRegionAbbr = null;
  let theme = {};
  let hatch = null;

  const projection = d3.geoOrthographic().clipAngle(90).precision(0);
  const path = d3.geoPath(projection, ctx);
  // Most shapes sit wholly on the visible side, where horizon clipping does
  // nothing but cost time; they go through a projection without it.
  const open = d3.geoOrthographic().preclip(stream => stream).precision(0);
  const openPath = d3.geoPath(open, ctx);
  const graticule = d3.geoGraticule10();
  // The grid is cheap, so it keeps adaptive resampling and stays curved when zoomed.
  const gridProjection = d3.geoOrthographic().clipAngle(90).precision(0.3);
  const gridPath = d3.geoPath(gridProjection, ctx);

  const markers = countries.map(c => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = '<i class="ring"></i><i class="dot"></i>';
    markerLayer.appendChild(el);
    return { c, el, shown: true };
  });

  readTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

  function readTheme() {
    const cs = getComputedStyle(pane);
    theme = Object.fromEntries(THEME_KEYS.map(key => [key, cs.getPropertyValue(`--${key}`).trim()]));
    const tile = document.createElement('canvas');
    tile.width = tile.height = 8;
    const t = tile.getContext('2d');
    t.fillStyle = theme['hatch-bg'];
    t.fillRect(0, 0, 8, 8);
    t.strokeStyle = theme['hatch-line'];
    t.lineWidth = 2;
    t.beginPath();
    t.moveTo(-2, 10); t.lineTo(10, -2);
    t.moveTo(-2, 2); t.lineTo(2, -2);
    t.moveTo(6, 10); t.lineTo(10, 6);
    t.stroke();
    hatch = ctx.createPattern(tile, 'repeat');
    dirty = true;
  }

  function landColor(meta) {
    if (meta.code === highlightCode || (hover?.type === 'country' && hover.meta === meta)) return theme.hover;
    if (focus) return meta.code === focus.code ? theme.uncalled : theme['tracked-dim'];
    const kind = statuses.get(meta.code)?.kind;
    if (kind === 'live') return theme['tracked-live'];
    if (kind === 'soon' || kind === 'today') return theme['tracked-soon'];
    return theme.tracked;
  }

  // The focused country is drawn either by state/province or by district.
  const keyOf = s => s.key ?? s.abbr;
  function activeShapes() {
    if (!focus) return [];
    return focus.layer === 'districts' && focus.districts?.length ? focus.districts : focus.regions;
  }

  // A party colour at partial strength over the "uncalled" base, as one solid
  // colour, so each shape is filled once.
  const blends = new Map();
  function blend(color, alpha) {
    const id = `${color}|${alpha.toFixed(2)}|${theme.uncalled}`;
    if (blends.has(id)) return blends.get(id);
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [a, b] = [rgb(color), rgb(theme.uncalled)];
    const out = `rgb(${a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha))).join(',')})`;
    blends.set(id, out);
    return out;
  }

  function visibleCap() {
    return Math.asin(Math.min(1, Math.hypot(W, H) / 2 / (R * k)));
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    projection.translate([W / 2, H / 2]).scale(R * k).rotate(rot);
    open.translate([W / 2, H / 2]).scale(R * k).rotate(rot);
    const center = [-rot[0], -rot[1]];
    const cap = visibleCap();
    const seen = s => d3.geoDistance(center, s.c) - s.r < cap;
    const tolerance = 0.5 / Math.pow(R * k * dpr, 2);
    const shape = s => atDetail(s, tolerance);
    // d3 caches its projection pipeline per output target, so shapes are
    // drawn in batches that share a target instead of switching per shape.
    const into = target => {
      path.context(target);
      openPath.context(target);
    };
    const put = s => (d3.geoDistance(center, s.c) + s.r < Math.PI / 2 - 0.02 ? openPath : path)(shape(s));
    const world = k >= DETAIL_ZOOM && detail?.length ? detail : coarse;

    ctx.beginPath();
    path.context(ctx)({ type: 'Sphere' });
    ctx.fillStyle = theme.ocean;
    ctx.fill();

    // Grid and shading belong to the whole-planet view; both fade out as you
    // zoom into a country, where they read as stray lines and banding.
    const planet = Math.max(0, Math.min(1, (5 - k) / 3.5));
    if (planet > 0) {
      gridProjection.translate(projection.translate()).scale(R * k).rotate(rot);
      ctx.globalAlpha = planet;
      ctx.beginPath();
      gridPath(graticule);
      ctx.strokeStyle = theme.grat;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const base = new Path2D();
    const trackedShapes = [];
    into(base);
    for (const s of world) {
      if (!seen(s)) continue;
      const meta = byAtlas.get(s.id);
      // A focused country is drawn from its own state shapes; its coarser
      // outline underneath would show as slivers along the coast.
      if (meta && focus?.code === meta.code && activeShapes().length) continue;
      if (meta) trackedShapes.push([meta, s]);
      else put(s);
    }
    const tracked = trackedShapes.map(([meta, s]) => {
      const p = new Path2D();
      into(p);
      put(s);
      return [meta, p];
    });
    ctx.fillStyle = focus ? theme['land-dim'] : theme.land;
    ctx.fill(base);
    for (const [meta, p] of tracked) {
      ctx.fillStyle = landColor(meta);
      ctx.fill(p);
    }
    ctx.strokeStyle = theme['land-line'];
    ctx.lineWidth = 0.6;
    ctx.stroke(base);
    for (const [, p] of tracked) ctx.stroke(p);

    let hoverShape = null;
    let selectedShape = null;
    if (focus) {
      const shapes = activeShapes();
      const fine = shapes !== focus.regions;
      // One path per fill colour: a few hundred districts become a handful of fills.
      const groups = new Map();
      for (const s of shapes) {
        if (!seen(s)) continue;
        const key = keyOf(s);
        const st = regionStyle(key) ?? {};
        const fill = st.notUp ? 'hatch' : st.fill ? blend(st.fill, st.opacity ?? 1) : theme.uncalled;
        if (!groups.has(fill)) groups.set(fill, []);
        groups.get(fill).push(s);
        if (key === hoverRegionAbbr || (hover?.type === 'region' && hover.abbr === key)) hoverShape = s;
        if (key === selected) selectedShape = s;
      }
      const outlines = new Path2D();
      for (const [fill, list] of groups) {
        const p = new Path2D();
        into(p);
        list.forEach(put);
        ctx.fillStyle = fill === 'hatch' ? hatch : fill;
        ctx.fill(p);
        outlines.addPath(p);
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = theme.bg;
      ctx.lineWidth = fine ? 0.45 : 0.9;
      ctx.stroke(outlines);
      // With districts showing, state lines on top keep the map readable.
      if (fine) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        into(ctx);
        for (const r of focus.regions) if (seen(r)) put(r);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const outline = (s, width, alpha) => {
      const p = new Path2D();
      into(p);
      put(s);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = theme.fg;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke(p);
      ctx.globalAlpha = 1;
    };
    if (hoverShape) outline(hoverShape, 1.3, 0.6);
    if (selectedShape) outline(selectedShape, 2.2, 1);
    path.context(ctx);

    // Edge darkening only, centred on the globe. An off-centre highlight read
    // as a lighter circle, and a two-centre gradient draws as a cone.
    const r = R * k;
    ctx.beginPath();
    path({ type: 'Sphere' });
    if (planet > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
      g.addColorStop(0, theme['shade-mid']);
      g.addColorStop(0.62, theme['shade-mid']);
      g.addColorStop(1, theme['shade-lo']);
      ctx.globalAlpha = planet;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = theme['ocean-edge'];
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const m of markers) {
      const show = (!focus || focus.code !== m.c.code) && d3.geoDistance(m.c.marker, center) < Math.PI / 2 - 0.06;
      if (show !== m.shown) {
        m.el.style.display = show ? '' : 'none';
        m.shown = show;
      }
      if (show) {
        const [x, y] = projection(m.c.marker);
        m.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }
  }

  // One animation step at time t: flights, inertia, idle spin, zoom easing.
  function step(t) {
    const dt = Math.min(50, t - lastFrame);
    lastFrame = t;
    if (fly) {
      const p = Math.max(0, Math.min(1, (t - fly.start) / fly.dur));
      rot = fly.rot(d3.easeCubicInOut(p));
      k = fly.k(p);
      dirty = true;
      if (p === 1) {
        const done = fly.done;
        fly = null;
        done();
      }
    } else if (!dragging && Math.abs(vel[0]) + Math.abs(vel[1]) > 0.0008) {
      rot = [rot[0] + vel[0] * dt, clampLat(rot[1] + vel[1] * dt)];
      const decay = Math.pow(0.994, dt);
      vel = [vel[0] * decay, vel[1] * decay];
      dirty = true;
    } else if (!dragging && !pointerInside && !focus && !highlightCode && !reduce && t - lastInput > 5000) {
      rot = [rot[0] + 0.004 * dt, rot[1]];
      dirty = true;
    }
    if (zoomTarget != null && !fly) {
      const next = k + (zoomTarget - k) * (1 - Math.exp(-dt / 70));
      k = Math.abs(zoomTarget - next) < 0.001 ? zoomTarget : next;
      if (k === zoomTarget) zoomTarget = null;
      dirty = true;
    }
    if (k >= DETAIL_ZOOM && !detail) {
      detail = [];
      loadDetail().then(d => { detail = d; dirty = true; }).catch(() => { detail = null; });
    }
    if (dirty) {
      render();
      dirty = false;
    }
  }
  function loop(t) {
    requestAnimationFrame(loop);
    step(t);
  }
  requestAnimationFrame(loop);

  function interact() {
    lastInput = performance.now();
    handlers.interact?.();
  }

  // Long hops pull back a little mid-flight so the move reads as travel.
  let landing = Promise.resolve();
  // lock: a flight to a country, which country clicks may not interrupt.
  function flyTo(lonlat, { zoom = zoomTarget ?? k, duration, lock = false } = {}) {
    return (landing = new Promise(resolve => {
      const to = [rot[0] + wrap(-lonlat[0] - rot[0]), clampLat(-lonlat[1])];
      const dist = Math.hypot(to[0] - rot[0], to[1] - rot[1]);
      const k0 = k;
      const k1 = clampK(zoom);
      const low = Math.min(k0, k1, Math.max(1, Math.max(k0, k1) / (1 + dist / 25)));
      const ease = d3.easeCubicInOut;
      vel = [0, 0];
      zoomTarget = null;
      fly = {
        start: performance.now(),
        dur: reduce ? 1 : duration ?? Math.max(700, Math.min(1600, 600 + dist * 9)),
        rot: d3.interpolate([...rot], to),
        k: p => (p < 0.5 ? k0 + (low - k0) * ease(p * 2) : low + (k1 - low) * ease((p - 0.5) * 2)),
        lock,
        done: resolve
      };
    }));
  }

  const zoomFor = span => (0.46 * Math.min(W, H)) / (R * Math.sin((span * Math.PI) / 180));

  // Throw speed comes from the last ~80 ms of movement, not the last event,
  // so a release after a pause doesn't fling and a jittery mouse doesn't stutter.
  // A press only becomes a drag once it moves a few pixels, so a quick click
  // never stops a flight that is under way.
  let samples = [];
  let travel = 0;
  d3.select(canvas).call(d3.drag()
    .clickDistance(5)
    .on('start', () => {
      travel = 0;
      samples = [];
      interact();
    })
    .on('drag', e => {
      if (!dragging) {
        travel += Math.hypot(e.dx, e.dy);
        if (travel < 4) return;
        dragging = true;
        fly = null;
        zoomTarget = null;
        vel = [0, 0];
        canvas.classList.add('grabbing');
        setHover(null);
        hideTip();
      }
      const s = 180 / Math.PI / (R * k);
      const dl = e.dx * s;
      const dp = -e.dy * s;
      rot = [rot[0] + dl, clampLat(rot[1] + dp)];
      const now = performance.now();
      samples.push([now, dl, dp]);
      while (samples.length && now - samples[0][0] > 80) samples.shift();
      dirty = true;
      interact();
    })
    .on('end', () => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('grabbing');
      const now = performance.now();
      samples = samples.filter(x => now - x[0] < 80);
      if (samples.length > 1) {
        const span = Math.max(16, now - samples[0][0]);
        const cap = v => Math.max(-0.25, Math.min(0.25, v));
        vel = [cap(d3.sum(samples, x => x[1]) / span), cap(d3.sum(samples, x => x[2]) / span)];
      }
      interact();
    }));

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    fly = null;
    zoomTarget = clampK((zoomTarget ?? k) * Math.exp(-e.deltaY * 0.0016));
    interact();
  }, { passive: false });

  function pick(x, y) {
    const ll = projection.invert([x, y]);
    if (!ll || d3.geoDistance(ll, [-rot[0], -rot[1]]) > Math.PI / 2) return null;
    if (focus) {
      const r = activeShapes().find(s => contains(s, ll));
      if (r) return { type: 'region', abbr: keyOf(r) };
    }
    const world = k >= DETAIL_ZOOM && detail?.length ? detail : coarse;
    const s = world.find(w => contains(w, ll));
    return s ? { type: 'country', meta: byAtlas.get(s.id) ?? null, feature: s.feature } : null;
  }

  const sameTarget = (a, b) => a?.type === b?.type && (a?.type === 'region' ? a.abbr === b.abbr : a?.feature === b?.feature);

  function setHover(next, event) {
    if (sameTarget(hover, next)) return;
    const prev = hover;
    hover = next;
    dirty = true;
    if (prev?.type === 'region' && next?.type !== 'region') handlers.regionHover?.(null);
    if (prev?.type === 'country' && next?.type !== 'country') handlers.countryHover?.(null);
    if (next?.type === 'region') handlers.regionHover?.(next.abbr, event);
    if (next?.type === 'country') handlers.countryHover?.(next.meta, next.feature, event);
    const clickable = next?.type === 'region' || (next?.type === 'country' && next.meta);
    canvas.classList.toggle('pointing', Boolean(clickable));
  }

  canvas.addEventListener('pointermove', e => {
    if (dragging) return;
    const [x, y] = d3.pointer(e, canvas);
    setHover(pick(x, y), e);
    if (!tip.hidden) placeTip(e);
  });
  canvas.addEventListener('pointerenter', () => { pointerInside = true; });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    setHover(null);
    hideTip();
  });
  // While the camera flies to a country, others slide past under the cursor, so
  // a click then would land on whatever happened to be there. Country clicks
  // wait for that flight to land; a state click picks from the destination.
  canvas.addEventListener('click', e => {
    const [x, y] = d3.pointer(e, canvas);
    const hit = pick(x, y);
    if (hit?.type === 'region') handlers.regionClick?.(hit.abbr);
    else if (hit?.meta && !fly?.lock) handlers.countryClick?.(hit.meta);
  });

  new ResizeObserver(() => {
    W = Math.max(200, pane.clientWidth);
    H = Math.max(200, pane.clientHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    R = Math.min(W, H) / 2 - MARGIN;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    dirty = true;
  }).observe(pane);

  let tipHTML = '';
  function placeTip(event) {
    const [x, y] = d3.pointer(event, pane);
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x))}px`;
    tip.style.top = `${y}px`;
    tip.classList.toggle('below', y < tip.offsetHeight + 24);
  }
  function showTip(html, event) {
    if (html !== tipHTML) {
      tip.innerHTML = html;
      tipHTML = html;
    }
    tip.hidden = false;
    if (event) placeTip(event);
  }
  function hideTip() {
    tip.hidden = true;
  }

  return {
    flyTo,
    showTip,
    hideTip,
    on(next) {
      handlers = next ?? {};
    },
    setStatuses(map) {
      statuses = map;
      for (const m of markers) m.el.dataset.status = statuses.get(m.c.code)?.kind ?? '';
      dirty = true;
    },
    highlight(code) {
      highlightCode = code;
      dirty = true;
    },
    zoomBy(f) {
      zoomTarget = clampK((zoomTarget ?? k) * f);
      interact();
    },
    reset() {
      if (focus) {
        const meta = countries.find(c => c.code === focus.code);
        return flyTo(meta.view.center, { zoom: zoomFor(meta.view.span) });
      }
      return flyTo(HOME, { zoom: 1 });
    },
    focusCountry(meta, style) {
      const token = (focusToken = {});
      regionStyle = style ?? (() => ({}));
      selected = null;
      focus = { code: meta.code, regions: [], districts: null, layer: 'regions' };
      dirty = true;
      loadRegions().then(reg => {
        if (token !== focusToken) return;
        focus.regions = reg.forCountry(meta.code);
        dirty = true;
      });
      return flyTo(meta.view.center, { zoom: zoomFor(meta.view.span), lock: true });
    },
    unfocus() {
      focusToken = null;
      focus = null;
      selected = null;
      dirty = true;
      lastInput = performance.now();
      return flyTo([-rot[0], -rot[1]], { zoom: 1, duration: 900 });
    },
    paintRegions(style) {
      if (style) regionStyle = style;
      dirty = true;
    },
    selectRegion(abbr) {
      selected = abbr;
      dirty = true;
      const s = abbr && activeShapes().find(r => keyOf(r) === abbr);
      if (!s) return;
      const reveal = () => {
        if (selected !== abbr) return;
        const [x, y] = projection(s.c);
        const inView = x > W * 0.15 && x < W * 0.85 && y > H * 0.15 && y < H * 0.85;
        if (!inView || d3.geoDistance(s.c, [-rot[0], -rot[1]]) > Math.PI / 2.4) flyTo(s.c, { duration: 700 });
      };
      if (fly) landing.then(reveal);
      else reveal();
    },
    // Dev helpers: run the animation forward without the browser drawing
    // frames, and read the camera.
    advance(ms, every = 16) {
      const t0 = performance.now();
      for (let e = every; e <= ms; e += every) step(t0 + e);
    },
    state() {
      return { k: Math.round(k * 100) / 100, centre: [-rot[0], -rot[1]].map(v => Math.round(v * 10) / 10), flying: Boolean(fly), selected };
    },
    // Dev check: draws `frames` frames while turning and returns ms per frame.
    benchmark(frames = 60, zoom = k) {
      const start = rot;
      const k0 = k;
      k = zoom;
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        rot = [start[0] + i * 0.75, start[1]];
        render();
      }
      ctx.getImageData(0, 0, 1, 1);
      rot = start;
      k = k0;
      dirty = true;
      return Math.round(((performance.now() - t0) / frames) * 100) / 100;
    },
    // 'regions' or 'districts'. Districts load on first use; resolves to
    // whether the country has a district layer at all.
    async setLayer(layer) {
      if (!focus) return false;
      const target = focus;
      target.layer = layer;
      dirty = true;
      if (layer !== 'districts') return true;
      target.districts ??= await loadDistricts(target.code);
      dirty = true;
      return target.districts.length > 0;
    },
    hoverRegion(abbr) {
      if (abbr === hoverRegionAbbr) return;
      hoverRegionAbbr = abbr;
      dirty = true;
    }
  };
}
