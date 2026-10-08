// Fetches a Wikipedia article's wikitext with its revision id, so every figure
// can cite the exact revision it was read from.
//   node scripts/wiki/page.mjs "2026 Brazilian general election" out.txt
// Prints the resolved title, revision id and size, then every {{Election results}}
// template and wikitable with its line number and the section heading above it.
import fs from 'node:fs';

export const UA = 'election-tracker/1.0 (results refresh script)';

export async function page(title) {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content|ids&rvslots=main&redirects=1&format=json&formatversion=2&titles=' + encodeURIComponent(title);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && attempt < 5) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const json = await res.json();
    const p = json.query.pages[0];
    if (p.missing) throw new Error(`No article titled "${title}"`);
    return { title: p.title, revid: p.revisions[0].revid, text: p.revisions[0].slots.main.content };
  }
}

if (process.argv[1]?.endsWith('page.mjs')) {
  const [title, out] = process.argv.slice(2);
  const p = await page(title);
  if (out) fs.writeFileSync(out, p.text);
  console.log(`${p.title} | revid ${p.revid} | ${p.text.length} chars`);
  let heading = '';
  p.text.split('\n').forEach((line, i) => {
    const h = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line);
    if (h) heading = h[2];
    if (/\{\{\s*Election results/i.test(line)) console.log(`  line ${i + 1}: {{Election results}} under "${heading}"`);
    else if (/^\{\|\s*class="?wikitable/.test(line)) console.log(`  line ${i + 1}: wikitable under "${heading}"`);
  });
}
