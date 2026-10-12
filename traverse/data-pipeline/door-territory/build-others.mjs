/* Homes that are NOT on a town's door list, for the grey dots on the maps (2026-10-12, Matthew: "make the gray dots ... make sure
   that its visible that they are not owner owned so that theres not mistake in them thinking its an active door card").
   From each town's walk list (the CSV the door list is built from), every row that did not become a door:
     r  the owner lives elsewhere (a rental or a second home)        p  the owner gets mail at a PO box (may or may not live there)
     u  the owner's address could not be checked                       b  owned by a business, trust company, church, district...
   Kept per home: position (5 places, ~1 m), the code and the street address. Never the owner's name or mailing address.
   Writes app/data/rounds/others-<town>.json { doors: [[lat, lon, code, address], ...] } (gitignored, like the door files).
     node build-others.mjs [town ...]      every town in build-rounds-data.mjs when none is named */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, '..', '..', 'app', 'data', 'rounds');
/* keep in step with build-walklist-pdf.mjs NON_RESIDENTIAL: the owners its door lists leave out */
const pdf = readFileSync(join(HERE, 'build-walklist-pdf.mjs'), 'utf8');
const NON_RESIDENTIAL = new RegExp(pdf.match(/const NON_RESIDENTIAL = \/(.+)\/i?;/)[1], 'i');
const src = readFileSync(join(HERE, 'build-rounds-data.mjs'), 'utf8');
const TOWNS = [...src.matchAll(/\['([a-z0-9-]+)', '[^']+', '([a-z0-9-]+)-areas\.json'/g)].map((m) => [m[1], m[2]]);
const want = process.argv.slice(2);
const parse = (l) => l.replace(/^"|"$/g, '').split('","');
const code = (why) => /PO box/i.test(why) ? 'p' : /would not geocode|not be checked|unknown/i.test(why) ? 'u' : 'r';
for (const [town, base] of TOWNS) {
  if (want.length && !want.includes(town)) continue;
  const f = join(HERE, base + '.csv'); if (!existsSync(f)) { console.log(town.padEnd(18), 'no walk list'); continue; }
  const lines = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); const h0 = lines.shift(); const h = h0.startsWith('"') ? parse(h0) : h0.split(',');
  const ix = (k) => h.indexOf(k); const [iK, iA, iO, iW, iLa, iLo] = ['knock', 'address', 'owner', 'why', 'lat', 'lon'].map(ix);
  const out = []; const n = { r: 0, p: 0, u: 0, b: 0 };
  for (const l of lines) {
    const v = parse(l); const la = +v[iLa], lo = +v[iLo]; if (!Number.isFinite(la) || !Number.isFinite(lo) || !la) continue;
    let c = null;
    if (v[iK] !== 'YES') c = code(v[iW] || ''); else if (NON_RESIDENTIAL.test(v[iO] || '')) c = 'b';
    if (!c) continue;
    n[c]++; out.push([+la.toFixed(5), +lo.toFixed(5), c, String(v[iA] || '').slice(0, 60)]);
  }
  writeFileSync(join(OUT, 'others-' + town + '.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), doors: out }));
  console.log(town.padEnd(18), out.length, 'left out · rental/elsewhere', n.r, '· PO box', n.p, '· unchecked', n.u, '· business', n.b);
}
