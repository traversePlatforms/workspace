/* utility-figures.json (2026-10-07, TraverseSolar): what each Colorado power company's homes pay, how many already have solar
 * and batteries, how long their power was out, and whether they are on time-of-use pricing. Read by build-solar.mjs, which puts
 * the figures for each door's power company on the card.
 *
 * Sources (both the U.S. Energy Information Administration):
 *   - Form EIA-861, 2025 final data, released 2026-10-07 (https://www.eia.gov/electricity/data/eia861/). Downloaded once into
 *     eia861/ beside this file (gitignored); a later year: change YEAR and run again.
 *       Sales_Ult_Cust: residential revenue, kWh sold and customers -> average price (cents a kWh) and average monthly bill
 *       Net_Metering:   residential solar installations, and batteries paired with solar
 *       Reliability:    minutes without power per customer in the year (SAIDI), with and without major event days, and how often
 *       Dynamic_Pricing: residential customers on time-of-use pricing
 *   - EIA's open data API (api.eia.gov, the api.data.gov key): Colorado's average home price, latest month and a year before.
 *
 *   node utility-figures.mjs
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readXlsx } from './xlsx-read.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const YEAR = 2025, RELEASED = '2026-10-07';
const RAW = join(HERE, 'eia861'), ZIP = join(RAW, `f861${YEAR}.zip`), X = join(RAW, String(YEAR));
const KEYF = join(HERE, '..', 'data-gov-key.txt');
const KEY = process.env.DATA_GOV_KEY || (existsSync(KEYF) ? readFileSync(KEYF, 'utf8').trim() : '') || 'DEMO_KEY';
const n = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };

if (!existsSync(join(X, `Sales_Ult_Cust_${YEAR}.xlsx`))) {
  mkdirSync(X, { recursive: true });
  if (!existsSync(ZIP)) {
    const r = await fetch(`https://www.eia.gov/electricity/data/eia861/zip/f861${YEAR}.zip`);
    if (!r.ok) throw new Error('EIA-861 download: ' + r.status);
    writeFileSync(ZIP, Buffer.from(await r.arrayBuffer()));
  }
  execFileSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', ZIP, '-C', X]);
}
const rows = (f) => readXlsx(join(X, `${f}_${YEAR}.xlsx`)).slice(3);
const u = {};
/* the power companies themselves: a solar lease company also files sales (to its own customers) but has no service territory */
for (const r of rows('Sales_Ult_Cust')) {
  if (r[6] !== 'CO' || r[4] !== 'Bundled' || String(r[1]) === '99999') continue;
  const rev = n(r[9]), mwh = n(r[10]), homes = n(r[11]);
  if (!rev || !mwh || !homes) continue;
  const id = String(r[1]), o = u[id] || (u[id] = { name: r[2], rev: 0, mwh: 0, homes: 0 });
  o.rev += rev; o.mwh += mwh; o.homes += homes;
}
for (const o of Object.values(u)) { o.cents = Math.round(o.rev * 10000 / o.mwh) / 100; o.bill = Math.round(o.rev * 1000 / o.homes / 12); delete o.rev; delete o.mwh; }
for (const r of rows('Net_Metering')) {
  const o = r[1] === 'CO' && u[String(r[2])]; if (!o) continue;
  const pv = n(r[11]), bat = n(r[46]);
  if (pv) o.solar = (o.solar || 0) + pv;
  if (bat) o.batt = (o.batt || 0) + bat;
}
for (const r of rows('Reliability')) {
  const o = r[3] === 'CO' && u[String(r[1])]; if (!o) continue;
  const all = n(r[5]), calm = n(r[8]), times = n(r[6]);
  if (all != null) { o.out = Math.round(all); o.outCalm = calm != null ? Math.round(calm) : null; o.outTimes = times != null ? Math.round(times * 100) / 100 : null; }
}
for (const r of rows('Dynamic_Pricing')) {
  const o = r[4] === 'CO' && u[String(r[1])]; if (!o) continue;
  const tou = n(r[6]); if (tou) o.tou = tou;
}
for (const o of Object.values(u)) if (o.solar) o.pct = Math.round(o.solar * 1000 / o.homes) / 10;

/* Colorado's average home price, the latest month and the same month a year before */
let co = null;
try {
  const q = `frequency=monthly&data[0]=price&facets[stateid][]=CO&facets[sectorid][]=RES&sort[0][column]=period&sort[0][direction]=desc&length=13`;
  const j = await (await fetch(`https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${KEY}&${q}`)).json();
  const d = j.response.data;
  if (d.length >= 13) co = { month: d[0].period, cents: +d[0].price, yearAgo: +d[12].price };
} catch (e) { console.log('Colorado monthly price not fetched: ' + e.message); }

const out = { source: `U.S. Energy Information Administration, Form EIA-861 ${YEAR} (released ${RELEASED}); Colorado monthly price from EIA open data`, year: YEAR, co, u };
writeFileSync(join(HERE, 'utility-figures.json'), JSON.stringify(out, null, 1));
console.log(`${Object.keys(u).length} Colorado power companies; Colorado ${co ? co.cents + ' cents in ' + co.month + ' (a year before ' + co.yearAgo + ')' : 'monthly price missing'}`);
for (const [id, o] of Object.entries(u).sort((a, b) => b[1].homes - a[1].homes).slice(0, 8))
  console.log(`  ${id.padStart(6)} ${o.name.padEnd(36)} ${o.cents}c  $${o.bill}/mo  solar ${o.pct ?? 0}%  batteries ${o.batt || 0}  out ${o.out ?? '?'} min (${o.outCalm ?? '?'} without storms)  time-of-use ${o.tou || 0}`);
