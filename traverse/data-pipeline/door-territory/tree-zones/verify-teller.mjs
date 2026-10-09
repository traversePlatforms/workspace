/* Check the downloaded Teller tiles against USGS's copies (2026-10-09). A right size did not prove a good file: one tile matched
   the server's length but its bytes differed from about halfway on (two downloads had written into the same part file), and
   the LAZ decoder stopped there. USGS publishes no checksums, so this asks the server for 16 slices of 4 KB spread through each
   file and compares them with the same slices on disk.
     node verify-teller.mjs            lists every tile that differs
     node verify-teller.mjs --delete   also deletes those tiles and their grids, so fetch-teller.sh fetches them again */
import { readFileSync, openSync, readSync, closeSync, statSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'lidar-cache', 'teller-laz'), GRID = join(HERE, 'lidar-cache', 'teller-grid');
const tiles = JSON.parse(readFileSync(join(HERE, 'teller-tiles.json'), 'utf8'));
const DEL = process.argv.includes('--delete'), SLICES = 16, LEN = 4096, CONC = 6;

async function slice(url, off) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${off}-${off + LEN - 1}` }, signal: AbortSignal.timeout(60000) });
      if (r.status === 206) return Buffer.from(await r.arrayBuffer());
    } catch {}
    await new Promise((res) => setTimeout(res, 3000 * (t + 1)));
  }
  return null;
}
async function check(t) {
  const name = t.url.split('/').pop(), f = join(SRC, name);
  if (!existsSync(f)) return { name, state: 'missing' };
  const size = statSync(f).size, fd = openSync(f, 'r');
  try {
    for (let i = 0; i < SLICES; i++) {
      const off = Math.max(0, Math.floor((size - LEN) * i / (SLICES - 1)));
      const srv = await slice(t.url, off);
      if (!srv) return { name, state: 'no answer' };
      const loc = Buffer.alloc(srv.length); readSync(fd, loc, 0, srv.length, off);
      if (!loc.equals(srv)) return { name, state: 'differs', at: Math.round(100 * off / size) + '%' };
    }
    return { name, state: 'ok' };
  } finally { closeSync(fd); }
}
const out = []; let k = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (k < tiles.length) { const t = tiles[k++]; out.push(await check(t)); } }));
const bad = out.filter((r) => r.state === 'differs');
for (const r of out.filter((r) => r.state !== 'ok')) console.log(r.state.padEnd(10), r.name, r.at || '');
console.log(`${out.filter((r) => r.state === 'ok').length} ok, ${bad.length} differ, ${out.filter((r) => r.state === 'missing').length} missing, ${out.filter((r) => r.state === 'no answer').length} unanswered`);
if (DEL && bad.length) {
  const idxF = join(GRID, 'index.json'), idx = existsSync(idxF) ? JSON.parse(readFileSync(idxF, 'utf8')) : {};
  for (const r of bad) {
    const n = r.name.replace(/\.laz$/, '');
    unlinkSync(join(SRC, r.name)); if (existsSync(join(GRID, n + '.grid'))) unlinkSync(join(GRID, n + '.grid')); delete idx[n];
  }
  writeFileSync(idxF, JSON.stringify(idx));
  console.log(`deleted ${bad.length} tiles and their grids; run fetch-teller.sh again`);
}
