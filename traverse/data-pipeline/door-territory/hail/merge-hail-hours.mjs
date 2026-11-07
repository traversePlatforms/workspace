// Adds the extra hours of a --hours run (e.g. 10 am and 11 pm, stage hail1023, 6 Nov 2026) to the main hail-hours.json.
//   node merge-hail-hours.mjs <main hail-hours.json> <extra hail-hours.json> <out.json>
// Union per date and town: every hour already in the main file stays; the extra file can only add. A date or town only in the extra
// file is added. The main file's source and days with no hours are kept. Prints what it added; refuses to write if anything is lost.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const [mainF, extraF, outF] = process.argv.slice(2);
if (!outF) { console.error('usage: merge-hail-hours.mjs <main> <extra> <out>'); process.exit(2); }
const main = JSON.parse(readFileSync(mainF, 'utf8')), extra = JSON.parse(readFileSync(extraF, 'utf8'));
const out = JSON.parse(JSON.stringify(main)); out.days = out.days || {};
let hoursAdded = 0, townDaysAdded = 0, datesAdded = 0;
for (const [date, towns] of Object.entries(extra.days || {})) {
  if (!out.days[date]) { out.days[date] = {}; datesAdded++; }
  for (const [town, hrs] of Object.entries(towns)) {
    const had = out.days[date][town] || [];
    if (!had.length) townDaysAdded++;
    const set = new Set(had);
    for (const h of hrs) if (!set.has(h)) { set.add(h); hoursAdded++; }
    out.days[date][town] = [...set].sort((a, b) => a - b);
  }
}
/* nothing lost: every main hour still there */
let lost = 0;
for (const [date, towns] of Object.entries(main.days || {})) for (const [town, hrs] of Object.entries(towns)) for (const h of hrs) if (!(out.days[date]?.[town] || []).includes(h)) lost++;
if (lost) { console.error(`STOP: ${lost} hours of the main file would be lost`); process.exit(1); }
if (extra.built) out.built = extra.built > (main.built || '') ? extra.built : main.built;
out.hoursRead = '10 am to midnight, Colorado time';
writeFileSync(outF + '.tmp', JSON.stringify(out)); renameSync(outF + '.tmp', outF);
console.log(`merged: ${hoursAdded} hours added, ${townDaysAdded} new town-days with hours, ${datesAdded} new dates; nothing lost`);
