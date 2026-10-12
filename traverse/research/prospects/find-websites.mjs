// Websites and phone numbers for the prospect list, where a company's own website shows them (2026-10-12, Matthew: "numbers and
// websites attached where visible"). The state register has neither, and no free directory covers these companies (OpenStreetMap
// lists 55). So: from each company's name, the few web addresses it would most likely use (frontrangeroofing.com, ...co.com,
// ...colorado.com, front-range-roofing.com); each candidate's home page is fetched once. A site counts only when its page names the
// company (every distinctive word of the name) and shows it is in Colorado or the trade; parked "domain for sale" pages are
// refused. The phone is the first Colorado-area-code number on that page. In-our-towns companies first.
// Writes websites.json here (gitignored with the list). Resumable: companies already tried are skipped.
//   node traverse/research/prospects/find-websites.mjs [--conc=20] [--limit=N]
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const CONC = +arg('conc', 20), LIMIT = +arg('limit', 1e9);
const OUT = join(HERE, 'websites.json');
const got = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const save = () => { writeFileSync(OUT + '.tmp', JSON.stringify(got)); for (let i = 0; ; i++) { try { renameSync(OUT + '.tmp', OUT); return; } catch (e) { if (i > 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } } };
/* the list */
const csv = readFileSync(join(HERE, 'prospects.csv'), 'utf8').trim().split('\n'); const head = csv.shift().split(',');
const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const rows = csv.map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const order = { 'in our towns': 0, 'next to our towns': 1, 'elsewhere in Colorado': 2 };
rows.sort((a, b) => order[a.where] - order[b.where]);
const SUFFIX = /\b(l\.?l\.?c|inc|incorporated|corp|corporation|co|company|ltd|limited|pllc|llp|lp|the|dba)\b\.?/g;
const TRADE = /^(roofing|roofers?|roof|lawn|lawns|landscaping|landscape|landscapes|landscaper|turf|sprinkler|sprinklers|irrigation|aeration|tree|trees|arbor|arborist|pest|control|exterminating|exterminators?|termite|mosquito|solar|energy|power|alarm|alarms|security|systems?|smart|home|homes|services?|solutions?|care|pro|pros|group|and|of|colorado|co|construction|contracting|contractors?|exteriors?|restoration|maintenance|management|enterprises?|works)$/;
const PARKED = /domain (is )?for sale|buy this domain|parked free|hugedomains|this domain may be for sale|godaddy\.com\/domain|sedo|dan\.com|afternic|domain parking/i;
const AREA = /\(?\b(303|719|720|970)\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/;
function candidates(name) {
  const w = name.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(SUFFIX, ' ').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return { list: [], key: [] };
  const base = w.join(''), noAnd = w.filter((x) => x !== 'and').join('');
  const list = [...new Set([base, noAnd, base + 'co', base + 'colorado', w.join('-'), noAnd + 'llc'])].filter((d) => d.length >= 4 && d.length <= 40).map((d) => d + '.com');
  return { list, key: w.filter((x) => !TRADE.test(x) && x.length > 1) };
}
async function fetchPage(url) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Traverse-research/1.0; +mailto:M.Sharpe@TraversePlatforms.com)', Accept: 'text/html' } });
    if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) return null;
    const html = (await r.text()).slice(0, 300000); return { html, final: r.url };
  } catch (e) { return null; } finally { clearTimeout(t); }
}
async function find(row) {
  const { list, key } = candidates(row.company);
  for (const d of list) {
    const p = await fetchPage('https://' + d) || await fetchPage('http://' + d);
    if (!p || p.html.length < 400 || PARKED.test(p.html)) continue;
    const text = p.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();
    const title = ((p.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    const nameOk = key.length ? key.every((k) => text.includes(k)) : text.includes(row.company.toLowerCase().split(/\s+/)[0]);
    const placeOk = /colorado|\bco\b \d{5}|\b8[01]\d{3}\b/.test(text) || AREA.test(text) || text.includes(String(row.city || '').toLowerCase());
    if (!nameOk || !placeOk) continue;
    const ph = (text.match(AREA) || [])[0] || '';
    return { website: p.final.replace(/\/$/, ''), phone: ph.replace(/[^\d]/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3'), title };
  }
  return { none: 1 };
}
const todo = rows.filter((r) => !got[r.record]).slice(0, LIMIT);
console.log(todo.length + ' companies to try (' + Object.keys(got).length + ' done before)');
let i = 0, n = 0, found = 0; const started = Date.now();
async function worker() {
  while (i < todo.length) {
    const r = todo[i++]; const res = await find(r); got[r.record] = res; n++; if (res.website) found++;
    if (n % 100 === 0) { save(); console.log('  ' + n + ' tried · ' + found + ' sites found · ' + (n / ((Date.now() - started) / 1000)).toFixed(1) + '/s'); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save(); console.log('done: ' + n + ' tried, ' + found + ' with a website (' + Object.values(got).filter((x) => x.website).length + ' in all)');
