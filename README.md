# Election Tracker

A draggable globe of national elections in 23 countries: the US, Canada, Brazil,
Argentina, the UK, Spain, France, Germany, Australia, India, Japan, Mexico, Italy,
South Korea, Indonesia, South Africa, Türkiye, Poland, the Netherlands, Sweden,
Portugal, Ireland and Austria. Pick a country and the globe flies in and colours it by
who won, shaded by margin: by state, province or region, and for chambers elected in
single-member seats, by official district (US congressional districts, UK and French
constituencies, Canadian ridings, Australian divisions, German Wahlkreise, Indian Lok
Sabha seats and Japanese districts). The side panel shows the national result, the
breakdown, the closest races, past results and how the system works. Results are as of
the date at the top of `data/index.json` (`asOf`), shown on the home page.

![The 2024 US House of Representatives: seats by party, and the map by congressional district](docs/screenshot.png)

National totals are official results in all 23 countries, and the page names the
source under each one. Each lists every party that won a seat, took at least 1% of the
vote or lost five or more seats, and sums the rest into Others. Where the source says
who won each state or region, the map uses it and the page says so. For the US House
and the UK, Canadian, Australian and Spanish lower houses, the seats each party took in
each state, nation, province or community are real too. The rest of the state, region
and district detail is sample data. No API is used for results or race calls.

The tracker also has every national election since 1948 for each office it shows, in
all 23 countries. See [Past elections](#past-elections).

## Run it

```
python -m http.server 5280
```

Then open http://localhost:5280. Any static file server works. There's no build step
for local use. D3, TopoJSON and the world outline are copies in `js/vendor/` and
`data/`, so the page makes no requests to other hosts (licences in
`js/vendor/LICENSES.md`). If you change a JS file while the page is open, hard refresh,
because the Python server lets the browser cache modules. The scripts in `scripts/`
need Node 22 or later.

## Deploying

`vercel.json` deploys the site to Vercel as static files. Its build command,
`npm run build`, runs `scripts/stamp.mjs`. That script copies the site into `dist/` and
adds a hash of each file's contents to the file's URL (`js/app.js?v=dfbfec6dd7`).
Browsers cache those URLs for a year, so a returning visitor downloads only the code,
maps and results that changed since their last visit. A changed file gets a new hash,
so no one keeps an old copy. `index.html` and `data/live/` are checked on every
request. To try a build locally, run `npm run build` and open
http://localhost:5280/dist/.

Link previews use `img/og.png`. Their image URL has to be absolute, so the build fills
in the production domain from Vercel's `VERCEL_PROJECT_PRODUCTION_URL`. `vercel.json`
also sets a few security headers: no MIME sniffing, a referrer policy, and no
embedding in frames.

Vercel serves static files, so nothing there writes `data/live/`. A deployed copy shows
the results as of `asOf` until you update the data and redeploy. Live counts need a host
where the cron below can write files.

## Live updates

The page reads `data/live/index.json` once when it opens. After that it checks for
results only on election night:

- **When:** from the time polls close in that country (`pollsClose` in the schedule,
  in the election's own time zone) for as long as the count runs.
- **How often:** every two minutes.
- **Which country:** only the country on screen; from the home page, each country that
  is counting.

On other days, on other countries' pages and in hidden tabs it makes no requests.
When a live file disappears, the page reloads that country's file to pick up the
final result.

## Layout

```
index.html                  shell: top bar, side panel, globe pane
css/style.css               all styling, light and dark
img/og.png                  link preview image
js/app.js                   boot, hash router (#/, #/US, #/US/us-senate-2024), live polling
js/globe.js                 canvas orthographic globe: drag, inertia, zoom, fly-to, hit-testing, layers
js/world.js                 loads outlines, regions and districts, with level-of-detail copies
js/home.js                  home panel: next vote, calendar, roster, latest results
js/country.js               country panel: results, regions and districts, history, simulation
js/charts.js                seat chamber, head-to-head bar, history bars, polling chart
js/data.js                  loaders; overlays data/live onto data/countries
js/status.js                live / today / soon / scheduled per country
js/vendor/                  D3 and TopoJSON, with their licences
data/index.json             tracked countries, globe camera, region and district wording
data/schedule.json          upcoming elections; the cron reads this
data/countries/*.json       parties, results, regions, districts, system facts
data/regions.topo.json      state/province shapes keyed like "US-OH"
data/districts/*.topo.json  single-member districts keyed like "US-CA-12"
data/world-coarse.topo.json world-atlas 110m, the zoomed-out globe
data/world-detail.topo.json lighter cut of world-atlas 50m for country zoom
data/sources.json           official results authority and district map source per country
data/live/index.json        which countries have a live file (kept by the cron)
data/live/*.json            written by the cron on election day only
data/history/*.json         past elections with illustrative results by region (built)
scripts/history/*.json      past national results, read from Wikipedia's results tables
scripts/check-history.mjs   checks scripts/history before a build
scripts/build-history.mjs   builds data/history from scripts/history
scripts/regions.mjs         region results and regional-party rules, shared by mock-data and build-history
scripts/update-results.mjs  cron entry point
scripts/stamp.mjs           deploy build: dist/ with content-hashed URLs
vercel.json                 Vercel build settings, cache and security headers
scripts/calls.mjs           the tracker's call rules
scripts/adapters/mock.mjs   the feed in use: replays the last result as a live count
scripts/adapters/ap.mjs     Associated Press client, kept but not connected
scripts/adapters/tse.mjs    Brazil electoral court client, kept but not connected
scripts/build-regions.mjs   rebuilds regions.topo.json from Natural Earth
scripts/build-districts.mjs rebuilds data/districts from each country's boundary file
scripts/build-world.mjs     rebuilds world-detail.topo.json from world-atlas 50m
scripts/seeds.mjs           national figures for the countries and chambers added later
scripts/districts.mjs       sample district results that add up to the national seats
scripts/mock-data.mjs       regenerates all sample detail
```

## Data shape

An election in `data/countries/<CODE>.json`:

```json
{
  "id": "us-house-2024",
  "office": "House of Representatives",
  "kind": "presidential | legislative | gubernatorial",
  "date": "2024-11-05",
  "status": "final | live",
  "reporting": 100,
  "totalSeats": 435, "majority": 218, "seatLabel": "Seats",
  "candidates": [{ "name", "party", "votes", "pct", "seats", "change", "winner", "advanced", "short" }],
  "call": { "status": "runoff", "parties": ["pl", "pt"], "by": "the Superior Electoral Court" },
  "regions": [{
    "name": "Ohio", "abbr": "OH", "contested": true, "winner": "gop",
    "margin": 17.7, "turnout": 54.1, "votes": 2097363, "seats": 15,
    "results": [{ "party": "gop", "pct": 58.3, "votes": 1222763, "seats": 10 }]
  }],
  "districts": [{
    "abbr": "OH-9", "name": "Ohio 9th", "region": "OH", "winner": "dem", "margin": 0.6,
    "results": [{ "party": "dem", "pct": 48.3, "votes": 152114 }]
  }],
  "rounds": [{ "label", "date", "candidates", "regions" }],
  "history": [{ "year": 2022, "winner": "gop", "results": [{ "party", "pct", "seats" }] }],
  "cite": { "name": "the Clerk of the House (Election Statistics)", "url": "https://en.wikipedia.org/wiki/…" },
  "statesFrom": "https://en.wikipedia.org/wiki/…",
  "chamberSize": 257
}
```

A first round whose run-off is still to come has `call.status` "runoff", with the two
candidates going through flagged `advanced` (`short` is an optional short name, such as
"Lula"). `cite` names the source of the national figures. `statesFrom` is set when region
winners come from a source rather than the sample generator. `chamberSize` is set when
`totalSeats` counts only the seats that were up (Argentina's half renewals).

A region's `abbr` matches the suffix of its shape id in `regions.topo.json`, and a
district's `abbr` the suffix of its id in `data/districts/<CODE>.topo.json`. When
`contested` is false the globe hatches the region as having no race. During a live
count a region or district has a `leader` but no `winner` until it is called. The
country file also carries `about` (system facts per office), and `polls` only for real
polling series, each with a `source`.

A live file (`data/live/US.json`) is `{ code, updatedAt, elections: [...] }` in the
same shape. The page overlays it by election id, so it can update an existing race or
add this year's race on top of the last one.

## The cron job

`scripts/update-results.mjs` is meant to run every two minutes, every day, to match
the page. It reads `data/schedule.json`, works out today's date in each election's own
time zone, and exits at once unless something is scheduled for today or a count that
began on an earlier day is still running. On election day it asks the feed for results
and writes `data/live/<CODE>.json` and the manifest. Once every race in the file is
final, it folds the result into `data/countries/<CODE>.json` and removes the live file.
From then on the page shows it as the previous result, and the older result moves into
"Past results".

```
*/2 * * * * cd /path/to/election-tracker && node scripts/update-results.mjs
```

On Windows, Task Scheduler with the same command and a two-minute repeat does the same
job.

```
node scripts/update-results.mjs --date=2026-11-03                     pretend it is another day
node scripts/update-results.mjs --force --country=US --reporting=70   write a live file now
node scripts/update-results.mjs --country=US --force --dry-run        print, write nothing
node scripts/update-results.mjs --reset                               remove live files
```

`npm run cron:demo` and `npm run cron:reset` wrap the force and reset commands. Every
country page also has an "Election night preview" button that replays the last result
as a live count without touching any files.

## Race calls

No API is used for race calls. The feed in use is the mock in
`scripts/adapters/mock.mjs`, and the tracker calls races itself with
`scripts/calls.mjs`: a region or district is called when it has finished counting, or
when the leader's margin is larger than every vote left to count. A legislature is
called when a party's called seats reach a majority. Exit polls and media projections
are never used. Regions and districts that are leading but not called are drawn pale
on the globe and listed as "leads" in the panel.

`data/sources.json` names the official results authority for each country, for
reference. The AP and TSE clients in `scripts/adapters/` are kept for later but are not
connected; switching one on means routing a country to it in
`scripts/adapters/index.mjs`. An adapter receives `{ entry, country, reporting, now }`
and returns an election in the shape above, with `winner` set only on called regions
and districts. Schedule rows can carry `holdovers` (seats not up) and `contested`
(regions voting).

## District maps

| Country | Districts | Source | Licence |
|---|---|---|---|
| US | 435 | US Census Bureau, 119th Congress cartographic boundaries | Public domain |
| UK | 650 | ONS, Westminster constituencies (July 2024) | Open Government Licence v3.0 |
| Canada | 343 | Elections Canada, 2023 Representation Order | Open Government Licence – Canada |
| Australia | 150 | ABS, Commonwealth Electoral Divisions 2025 | CC BY 4.0 |
| Germany | 299 | Die Bundeswahlleiterin, Wahlkreise 2025 | dl-de/by-2-0 |
| France | 539 | data.gouv.fr circonscriptions (metropolitan) | Licence Ouverte 2.0 |
| India | 543 | DataMeet parliamentary constituencies | CC0 |
| Japan | 289 | japan-choropleth, 2022 districts | Public-domain source data |

Ireland is broken down by its 43 Dáil constituencies rather than counties, since that
is where votes are counted (Tailte Éireann, Constituency Boundaries 2023, CC BY 4.0).

Notes: the US file predates the 2025 mid-decade redraws used for 2026. France's
overseas and expatriate seats aren't drawn. India's Assam and Jammu and Kashmir show
boundaries from before the 2023 delimitation. Japan has no official government
download, so its file is a compilation of public-domain data. Country and state
outlines come from Natural Earth and world-atlas (public domain).

Sample district results are fitted so every party's districts add up to its national
seat total, state by state. For the US House and the UK, Canadian and Australian
chambers, each state's, nation's or province's seats by party are the real ones
(`SEAT_SPLITS` in `scripts/mock-data.mjs`), and only which districts they fall in is
sample data. Regional parties only win where they stand (the SNP in Scotland, the Bloc
in Quebec, India's state parties, Katter's in Queensland, the SVP in South Tyrol and so
on; the list is `REGIONAL` in `scripts/regions.mjs`), and each party's seats cluster
geographically.

## Past elections

Every country has every national election since 1948 for each office it shows, 845 in
all. On a country page, pick a year on the rail under the office tabs (each year is marked
in the winner's colour), or a row under Past results. A past election opens like the
current one, with its seat chart, full results and the globe painted by region, at its
own address (`#/IT/it-chamber-1948`).

**National results** are in `scripts/history/<CODE>.json`: each party's votes, share,
seats and seat change, read from the results table in the election's Wikipedia article,
which reproduces the official results. Each election records the article and the
revision it was read from. `scripts/check-history.mjs` checks that seats add up to the
chamber, shares to about 100%, that there is one winner, and that every party and
region exists. Each party's vote count was also found digit for digit in the cited
revision, apart from rows the tracker sums itself (Australia's Coalition, Canada's
independents, a few merged rows) and Others.

**Results by region** are illustrative. Borders and units have changed since 1948, so
`scripts/build-history.mjs` draws each region's result from the national split on
today's map. Where the source has a results-by-region table that matches today's units,
the real winner of each region is used (`regionWinners`), and the page says so.
Regional parties are kept to the regions they stood in (`RULES` in the same script).
Regions show a winner and shares only, with no vote counts, so nothing generated looks
like a real count.

Where a source covers less than the whole chamber (France in 1958, metropolitan seats
only) or the franchise was different (South Africa before 1994, white voters only), a
note under the election's title says so. Elections without real competition (Poland
1952–1985, Portugal's Estado Novo) are included with a note too. Regions that didn't
vote show no race (`partial` or `voted`): East Germany before 1990, most states in a
US Senate year. When a source gives only the seats won in a partial renewal
(Argentina), the chart reads "127 of 257 seats were up" instead of a majority line
(`chamberSize`). Rebuild after editing a history file:

```
npm run history
```

## Rebuilding generated data

```
npm install
npm run regions -- path/to/ne_10m_admin_1_states_provinces.geojson --replace=IE=path/to/dail_constituencies_2023.geojson
npm run districts -- US path/to/cb_2025_us_cd119_20m.zip
npm run world -- path/to/countries-50m.json
npm run mock
npm run history
```

`districts` takes a country code and that country's boundary file from the table
above (shapefile zip or GeoJSON); the field mapping for each lives in
`scripts/build-districts.mjs`. `mock` rewrites all sample results and system
facts, adds sample past results only for offices without real ones, and leaves alone
any election that carries a `source`. One run is enough: each election is rebuilt until
the district maps stop changing its region winners.

## Performance

The globe is one canvas redrawn per frame. Shapes outside the visible cap are skipped,
shapes wholly on the visible side skip horizon clipping, each layer keeps
level-of-detail copies so only about half a pixel of error is drawn, and shapes are
filled in batches by colour. Open the page with `?debug` and run `globe.benchmark()`
in the console for milliseconds per frame.

## Licence

The code is MIT licensed; see [LICENSE](LICENSE). The data keeps its sources' terms.

National results are the electoral authorities' official figures, read from the
results tables in Wikipedia's election articles. Each election links its article and
the revision it was read from.

District and constituency boundaries are under the licences in the
[District maps](#district-maps) table. Their attribution statements:

- UK: Source: Office for National Statistics licensed under the Open Government Licence
  v.3.0. Contains OS data © Crown copyright and database right 2024.
- Canada: Contains information licensed under the Open Government Licence – Canada.
- Australia: Based on Australian Bureau of Statistics data, licensed under CC BY 4.0.
- Germany: © Die Bundeswahlleiterin, Wiesbaden, Datenlizenz Deutschland – Namensnennung –
  Version 2.0.
- France: data.gouv.fr, Licence Ouverte 2.0.
- Ireland: © Tailte Éireann, licensed under CC BY 4.0.

Country and state outlines come from Natural Earth and world-atlas (public domain).
