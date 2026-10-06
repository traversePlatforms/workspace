/* HOAs matched to our neighbourhoods, for the door app's Communities view (SX-40, 2026-10-03).
   Reads hoa-sixfold.csv (build-hoa-list.mjs, from the free state HOA roster) and keeps only the
   rows matched to a neighbourhood by subdivision or metro-district name ("match..." in
   why_in_scope). Writes app/data/rounds/hoa-communities.json: place name (lower case) -> the
   HOAs there, with units, how they are managed and the management company. No designated
   agents or addresses: the app needs who to pitch, not a mailing list.
   Run:  node build-hoa-communities.mjs                                                      */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', '..', 'app', 'data', 'rounds', 'hoa-communities.json');

const parse = (l) => { const c = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"' && cur === '') q = true; else if (ch === ',') { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return c; };
const lines = readFileSync(join(HERE, 'hoa-sixfold.csv'), 'utf8').trim().split(/\r?\n/);
const head = parse(lines.shift()), ix = (n) => head.indexOf(n);
const out = {};
let kept = 0;
for (const r of lines.map(parse)) {
  if (!/^match/.test(r[ix('why_in_scope')] || '')) continue;
  const places = String(r[ix('our_neighbourhoods')] || '').split(/;\s*/).map((p) => p.replace(/\s*\(.*\)\s*$/, '').trim()).filter(Boolean);
  for (const p of places) {
    (out[p.toLowerCase()] ||= []).push({ hoa: r[ix('hoa')], units: +r[ix('units')] || null, managed: r[ix('managed')] || '', mgmt: r[ix('management_company')] || '', renewed: r[ix('last_renewed')] || '' });
  }
  kept++;
}
for (const k of Object.keys(out)) out[k].sort((a, b) => (b.units || 0) - (a.units || 0));
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'Colorado Division of Real Estate active-HOA roster, matched by subdivision name', places: out }));
console.log(`${kept} matched HOAs across ${Object.keys(out).length} neighbourhood names -> hoa-communities.json`);
