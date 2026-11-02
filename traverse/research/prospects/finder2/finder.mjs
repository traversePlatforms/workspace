// Website finder v2: guess company domains, DNS first, fetch only resolving ones, accept only if page names company + Colorado signal.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import dns from 'node:dns/promises';
const IN = process.argv[2] || 'in.csv', OUT = process.argv[3] || 'found-sites.csv', LOG = 'finder.log', CONC = +(process.env.CONC || 12);
const parse = (line) => { const o = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const rows = readFileSync(IN, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(parse).map(([record, company, trade, city]) => ({ record, company, trade, city }));
const seen = new Set(existsSync('done.txt') ? readFileSync('done.txt', 'utf8').split(/\r?\n/).filter(Boolean) : []);
if (!existsSync(OUT)) appendFileSync(OUT, 'record,company,city,site,why\n');
const log = (m) => appendFileSync(LOG, new Date().toISOString() + ' ' + m + '\n');
const SUFFIX = /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|company|ltd|limited|llp|pllc|pc)\b\.?/gi;
const GENERIC = new Set(['roofing','roof','roofs','lawn','lawns','landscaping','landscape','landscapes','care','services','service','solutions','pest','control','construction','contractors','contracting','exteriors','and','the','of','by','co','colorado','enterprises','group','holdings','sprinklers','irrigation','tree','pros','mosquito','sprinkler','yard','yards','solar','security','systems','home','homes','design','designs','builders']);
const norm = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function coreWords(company) { const s = norm(company.replace(SUFFIX, ' ')); return s.split(' ').filter(Boolean); }
function guesses(r) {
  const w = coreWords(r.company); if (!w.length) return [];
  const cityJ = norm(r.city).replace(/ /g, '');
  const noAnd = w.filter((x) => x !== 'and');
  const full = w.join(''), full2 = noAnd.join('');
  const strip = noAnd.filter((x) => !GENERIC.has(x)).join('');
  const bases = [];
  const add = (b) => { if (b && b.length >= 4 && b.length <= 40 && !bases.includes(b)) bases.push(b); };
  add(full2); add(full); add(strip && strip.length >= 5 ? strip : '');
  add(full2 + 'co'); add(full2 + 'colorado');
  if (cityJ) add(full2 + cityJ);
  add(full2 + 'llc'); add(full2 + 'inc');
  const out = [];
  for (const b of bases) out.push(b + '.com');
  for (const b of bases.slice(0, 2)) { out.push(b + '.net'); out.push(b + '.co'); }
  return [...new Set(out)].slice(0, 12);
}
async function resolves(d) { try { await dns.resolve4(d); return true; } catch (e) { if (e.code === 'ENODATA') { try { await dns.resolve6(d); return true; } catch { } } return false; } }
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(url) { try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(10000) }); if (!r.ok) return null; const ct = r.headers.get('content-type') || ''; if (!/html|text/.test(ct)) return null; return { html: (await r.text()).slice(0, 600000), url: r.url }; } catch { return null; } }
const PARKED = /domain (is )?(for sale|may be for sale|available)|buy this domain|this domain (is|has been) (parked|registered)|sedo\.com|hugedomains|dan\.com\/|afternic|godaddy\.com\/domainsearch|parked (free|domain)|under construction|website coming soon|coming soon|account suspended|default web site page|welcome to nginx|apache2 (ubuntu )?default|related searches|sponsored listings|domain.{0,20}registrar/i;
const DIRECT = /yelp\.|angi\.|angieslist|homeadvisor|thumbtack|facebook\.com|nextdoor|bbb\.org|yellowpages|mapquest|manta\.com|porch\.com|houzz|buildzoom|linkedin/i;
const COSIG = /\bcolorado\b|,\s*CO\b|\(?\b(303|719|720|970)\)?[\s.\-)]/i;
function text(html) { return html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' '); }
function judge(r, html, finalUrl) {
  const h = new URL(finalUrl).hostname; if (DIRECT.test(h)) return null;
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]; const t = text(html);
  const visible = norm(title + ' ' + t.slice(0, 20000));
  if (t.length < 300) return null;
  if (PARKED.test(title) || (PARKED.test(t.slice(0, 4000)) && t.length < 2500)) return null;
  const w = coreWords(r.company).filter((x) => x !== 'and'); if (!w.length) return null;
  const phrase = w.join(' '); const phraseAnd = coreWords(r.company).join(' ');
  const sig = [];
  if (visible.includes(phrase) || visible.includes(phraseAnd)) sig.push('full name "' + phrase + '"');
  if (!sig.length) return null;
  const cityN = norm(r.city); let co = null;
  const m = t.match(COSIG); if (m) co = 'CO signal "' + m[0].trim() + '"';
  if (!co && cityN && visible.includes(cityN)) co = 'city "' + r.city + '"';
  if (!co) return null;
  return `${sig[0]}; ${co}; title="${title.replace(/\s+/g, ' ').trim().slice(0, 70)}"`;
}
async function one(r) {
  const gs = guesses(r); const ok = [];
  for (const d of gs) if (await resolves(d)) ok.push(d);
  for (const d of ok.slice(0, 6)) {
    let p = await get('https://' + d); if (!p) p = await get('http://' + d); if (!p) continue;
    const why = judge(r, p.html, p.url); if (why) return [p.url, why];
  }
  return null;
}
const todo = rows.filter((r) => !seen.has(r.record)); let i = 0, done = 0, found = 0, buf = []; const t0 = Date.now();
log(`start ${rows.length} rows, ${todo.length} to do, conc ${CONC}`);
function flush() { if (buf.length) { appendFileSync(OUT, buf.map((x) => x.line).join('')); appendFileSync('done.txt', buf.map((x) => x.rec + '\n').join('')); buf = []; } }
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < todo.length) {
    const r = todo[i++]; let h = null; try { h = await one(r); } catch (e) { log('err ' + e.message); }
    buf.push({ rec: r.record, line: h ? [r.record, r.company, r.city, h[0], h[1]].map(q).join(',') + '\n' : '' }); done++; if (h) found++;
    if (done % 100 === 0) { flush(); log(`${done}/${todo.length} checked, ${found} sites found, ${((done / ((Date.now() - t0) / 60000))).toFixed(1)}/min`); }
  }
}));
flush(); log(`finder done: ${done} checked, ${found} sites`);
