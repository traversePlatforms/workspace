/* Which USGS 3DEP laser surveys (the Entwine copy on AWS, s3 usgs-lidar-public) hold points at the Group 2 targets (2026-10-28,
   stage B). The boundary list on usgs.entwine.io misses some surveys, so this lists the bucket's CO_ surveys, reads each ept.json and,
   for each target's centre and four points around it, walks the survey's hierarchy down to its ~1 m depth (tiles ~90-180 m wide) and
   counts the points in the tiles over that spot. Usage (on the VM): node probe-lidar-g2.mjs [targets.json] */
import { readFileSync } from 'node:fs';
const T = JSON.parse(readFileSync(process.argv[2] || new URL('./targets.json', import.meta.url), 'utf8'));
const BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch {} await new Promise((ok) => setTimeout(ok, 800 * (i + 1))); } return null; };
const list = await (await fetch(BASE + '?list-type=2&delimiter=/&prefix=CO_')).text();
const surveys = [...list.matchAll(/<Prefix>(CO_[^<]+)\/<\/Prefix>/g)].map((m) => m[1]);
const merc = (lo, la) => [lo * 20037508.34 / 180, Math.log(Math.tan((90 + la) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180];
const pts = [];
for (const t of T) {
  const dl = (t.radius || 3) / 69 * 0.6, P = [[t.lon, t.lat]];
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.push([t.lon + a * dl / Math.cos(t.lat * Math.PI / 180), t.lat + b * dl]);
  pts.push({ t, P: P.map(([lo, la]) => merc(lo, la)) });
}
const hit = {};   /* key -> survey -> [points found per spot] */
for (const s of surveys) {
  const e = await get(BASE + s + '/ept.json'); if (!e) { console.log(s, 'no ept.json'); continue; }
  const b = e.boundsConforming || e.bounds, root = e.bounds, w = root[3] - root[0]; let D = 0; while (w / 2 ** D > 180) D++;
  const srs = e.srs && e.srs.horizontal;
  if (srs !== '3857') { console.log(s, 'srs', srs, '(skipped: the scripts read 3857 only)'); continue; }
  const H = new Map(); const hier = async (k) => { if (!H.has(k)) H.set(k, (await get(BASE + s + '/ept-hierarchy/' + k + '.json')) || {}); return H.get(k); };
  const top = await hier('0-0-0-0');
  async function at(X, Y) {
    if (X < b[0] || X > b[3] || Y < b[1] || Y > b[4]) return 0;
    let keys = [['0-0-0-0', top]], total = 0;
    for (let d = 0; d <= D; d++) {
      const next = []; total = 0;
      for (const [k, h] of keys) {
        let c = h[k]; let hh = h; if (c === -1) { hh = await hier(k); c = hh[k]; }
        if (!c) continue; total += c;
        if (d === D) continue;
        const [, x, y, z] = k.split('-').map(Number), cw = w / 2 ** (d + 1);
        const cx = Math.floor((X - root[0]) / cw), cy = Math.floor((Y - root[1]) / cw);
        if (cx >> 1 !== x || cy >> 1 !== y) continue;
        for (const dz of [0, 1]) next.push([`${d + 1}-${cx}-${cy}-${2 * z + dz}`, hh]);
      }
      if (d < D) keys = next;
      if (!keys.length) return 0;
    }
    return total;
  }
  let any = 0;
  for (const { t, P } of pts) { const r = []; for (const [X, Y] of P) r.push(await at(X, Y)); if (r.some((n) => n > 0)) { (hit[t.key] ||= {})[s] = r; any++; } }
  console.log(`${s}: depth ${D} (${Math.round(w / 2 ** D)} m tiles), ${any} targets with points`);
}
for (const { t } of pts) console.log(t.key.padEnd(34), t.county.padEnd(8), Object.entries(hit[t.key] || {}).map(([s, r]) => `${s} [${r.map((n) => n > 0 ? 'y' : '-').join('')}]`).join('  ') || 'NONE');
