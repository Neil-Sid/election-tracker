// Prints Wikipedia's colour for each party article, from {{party color|Article}}.
// "&#35;" in the output means "#"; #F8F9FA means the template has no colour.
//   node scripts/wiki/colors.mjs "Liberal Party (Brazil, 2006)" "Workers' Party (Brazil)"
import { UA } from './page.mjs';

const names = process.argv.slice(2);
const text = names.map(n => `{{party color|${n}}}`).join('\n');
const url = 'https://en.wikipedia.org/w/api.php?action=expandtemplates&prop=wikitext&format=json&text=' + encodeURIComponent(text);
const res = await fetch(url, { headers: { 'User-Agent': UA } });
const out = (await res.json()).expandtemplates.wikitext.split('\n');
names.forEach((n, i) => console.log(out[i].padEnd(9), n));
