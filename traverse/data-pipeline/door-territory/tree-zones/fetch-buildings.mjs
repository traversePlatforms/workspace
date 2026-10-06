/* Downloads the Microsoft building-outline tiles that cover the door lists, once.
   Source: Microsoft Global ML Building Footprints (ODbL), indexed at
   minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv.
   Files land in ./buildings/ (gitignored). Re-run to pick up a newer release. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quadkey } from './zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const OUT = join(HERE, 'buildings');
mkdirSync(OUT, { recursive: true });

const need = new Map();
for (const f of readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const r = JSON.parse(readFileSync(join(DATA, f), 'utf8'));
  for (const a of r.areas) for (const d of a.doors) if (typeof d.lat === 'number') {
    const k = quadkey(d.lon, d.lat, 9); need.set(k, (need.get(k) || 0) + 1);
  }
}
const idx = await (await fetch('https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv')).text();
const rows = idx.split('\n').filter((l) => l.startsWith('UnitedStates,'));
for (const [qk, doors] of need) {
  const out = join(OUT, `${qk}.geojsonl.gz`);
  const row = rows.find((l) => l.split(',')[1] === qk);
  if (!row) { console.log(`${qk}: no file in the index (${doors} doors)`); continue; }
  const [, , url, size, uploaded] = row.split(',');
  if (existsSync(out)) { console.log(`${qk}: have it (${doors} doors)`); continue; }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${qk}: HTTP ${r.status}`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`${qk}: ${size} uploaded ${uploaded.trim()} (${doors} doors)`);
}
