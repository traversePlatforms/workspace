/* How many El Paso County aerial tiles (2024, 4000 ft square) our El Paso doors fall in, and what the county's licence
   would cost (2026-10-05). Prices from https://admin.elpasoco.com/digital-strategy-and-technology/licensed-gis-data/ :
   three-year licence, 6-inch $100/tile, 1-foot $50/tile. Tile grid: the county's open "Aerial Delivery Tiles" layer. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const SVC = 'https://gisservices.elpasoco.com/arcgis2/rest/services/HubPublic/Aerial_Delivery_Tiles/MapServer/0/query';
const GRID = join(HERE, 'tiles.json');
if (!existsSync(GRID)) {
  /* the server does not page (and answers 2,000 at most), so ask in ID ranges */
  const tiles = [];
  for (let k = 0, empty = 0; empty < 2 && k < 100000; k += 1000) {
    const q = new URLSearchParams({ where: `OBJECTID >= ${k} AND OBJECTID < ${k + 1000}`, outFields: 'TILE_NAME,RESOLUTION,SQ_MILES', returnGeometry: 'true', outSR: '4326', f: 'json' });
    const j = await (await fetch(SVC + '?' + q)).json();
    if (j.error) throw new Error(j.error.message);
    for (const f of j.features || []) tiles.push({ name: f.attributes.TILE_NAME, res: f.attributes.RESOLUTION, sq: f.attributes.SQ_MILES, rings: f.geometry.rings });
    empty = (j.features || []).length ? 0 : empty + 1;
  }
  writeFileSync(GRID, JSON.stringify(tiles));
}
const tiles = JSON.parse(readFileSync(GRID, 'utf8'));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
for (const t of tiles) { const xs = t.rings.flat().map((p) => p[0]), ys = t.rings.flat().map((p) => p[1]); t.bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
console.log(`${tiles.length} tiles in the county grid; resolutions: ${JSON.stringify(tiles.reduce((o, t) => (o[t.res] = (o[t.res] || 0) + 1, o), {}))}`);
const used = new Map(), perTown = {}; let doors = 0, miss = 0;
for (const town of ['monument', 'palmer-lake', 'black-forest']) {
  const d = JSON.parse(readFileSync(join(DATA, `${town}.json`), 'utf8')); const set = new Set();
  for (const a of d.areas) for (const x of a.doors) {
    doors++;
    const t = tiles.find((t) => x.lon >= t.bb[0] && x.lon <= t.bb[2] && x.lat >= t.bb[1] && x.lat <= t.bb[3] && t.rings.some((r) => inRing(x.lon, x.lat, r)));
    if (!t) { miss++; continue; }
    set.add(t.name); used.set(t.name, { t, n: (used.get(t.name)?.n || 0) + 1 });
  }
  perTown[town] = set.size;
}
const list = [...used.values()].sort((a, b) => b.n - a.n);
const price = (t) => (/6/.test(String(t.res)) ? 100 : 50);
const cost = (arr) => arr.reduce((s, x) => s + price(x.t), 0);
console.log(`${doors} El Paso doors (${miss} outside the grid) fall in ${list.length} tiles; by town ${JSON.stringify(perTown)}`);
console.log(`resolution of those tiles: ${JSON.stringify(list.reduce((o, x) => (o[x.t.res] = (o[x.t.res] || 0) + 1, o), {}))}`);
console.log(`all of them: $${cost(list).toLocaleString('en-US')} for three years (6-inch $100, 1-foot $50)`);
let acc = 0;
for (const share of [0.5, 0.75, 0.9]) {
  let k = 0; acc = 0; while (acc < share * (doors - miss)) acc += list[k++].n;
  console.log(`  the busiest ${k} tiles cover ${Math.round(100 * acc / (doors - miss))}% of the doors: $${cost(list.slice(0, k)).toLocaleString('en-US')}`);
}
