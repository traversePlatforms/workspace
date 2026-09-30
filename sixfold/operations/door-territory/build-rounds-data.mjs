/* Sixfold — builds the server-side door data for sixfoldcolorado.com/rounds/.
   2026-09-29 (TASKS.md SX-9c, phase 1).

   Reads the SAME neighbourhood sidecars the printed sheets and the Claude
   artifact use, so all three name the same pockets and use the same door ids.
   One clustering implementation, three consumers.

   Writes into sixfold/site/data/rounds/, which the server reads and NEVER
   serves directly — see the .htaccess written beside it.

   Run:  node build-walklist-pdf.mjs <each csv>   # the sidecars
         node build-rounds-data.mjs                                            */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'site', 'data', 'rounds');
const SOURCES = [
  ['monument', 'Monument', 'monument-areas.json'],
  ['palmer-lake', 'Palmer Lake', 'palmer-lake-areas.json'],
  ['black-forest', 'Black Forest', 'black-forest-areas.json'],
  ['castle-rock', 'Castle Rock', 'castle-rock-areas.json'],
  ['larkspur', 'Larkspur', 'larkspur-areas.json'],
  ['sedalia', 'Sedalia', 'sedalia-areas.json'],
  ['franktown', 'Franktown', 'franktown-areas.json'],
  ['woodland-park', 'Woodland Park', 'woodland-park-areas.json'],
  ['divide', 'Divide', 'divide-areas.json'],
  ['florissant', 'Florissant', 'florissant-areas.json'],
  ['cripple-creek', 'Cripple Creek', 'cripple-creek-areas.json'],
];

/* same slug rule as build-walk-tool.mjs, so a door has one id everywhere */
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

mkdirSync(OUT, { recursive: true });

const index = [];
for (const [key, label, fileName] of SOURCES) {
  const p = join(HERE, fileName);
  if (!existsSync(p)) { console.log(`skipping ${label} — no ${fileName}`); continue; }
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const seen = new Set();
  const areas = j.areas.map((a) => ({
    name: a.name,
    avg: a.avg ? +a.avg.toFixed(2) : null,
    doors: a.doors.map((d) => {
      let id = slug(d.a);
      while (seen.has(id)) id += 'x';
      seen.add(id);
      return { id, address: d.a, acres: d.ac, owner: d.o };
    }),
  }));
  writeFileSync(join(OUT, `${key}.json`), JSON.stringify({ key, label, built: j.built, areas }), 'utf8');
  index.push({ key, label, areas: areas.length, doors: areas.reduce((s, a) => s + a.doors.length, 0) });
  console.log(`${key}.json  ${areas.length} areas, ${index[index.length - 1].doors} doors`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ regions: index, built: new Date().toISOString().slice(0, 10) }), 'utf8');

/* Kept only as a second line of defence. ⚑ On 2026-09-29 SiteGround did NOT honour
   this deny — the JSON was served at 200 while the .htaccess itself returned 403.
   The real protection is that these files now live outside the document root. */
writeFileSync(join(OUT, '.htaccess'), `# Door lists and the marks log. Read by api/rounds.php ONLY — never served.
# Each file holds names and home addresses; a directory listing would be worse
# than any single file.
Require all denied
<FilesMatch ".*">
  Require all denied
</FilesMatch>
`, 'utf8');

console.log(`\nwrote ${index.length} region files + index.json + .htaccess into site/data/rounds/`);
console.log('⚑ These go OUTSIDE public_html on the host — see site/rounds/DEPLOY-ROUNDS.md.');
