// Address check for a follow-up list (22 Nov 2026). Read-only DNS lookups only: no SMTP, no RCPT TO against their servers.
//   node email-check.mjs <in.csv: id,name,trade,city,email,followed_up_8nov> <out.csv: id,company,email,result,reason,followed_up_8nov>
// result: bounce (will bounce), risky (might), fine. Changes nothing on the desk.
import { readFileSync, writeFileSync } from 'node:fs';
import { promises as dns } from 'node:dns';
const [inF, outF] = process.argv.slice(2);
const parse = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const rows = readFileSync(inF, 'utf8').trim().split(/\r?\n/).slice(1).map(parse).map(([id, name, trade, city, email, fu]) => ({ id, name, email, fu }));
const SYNTAX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const TYPO = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.comm': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmeil.com': 'gmail.com', 'gimail.com': 'gmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'comcast.ner': 'comcast.net', 'aol.con': 'aol.com', 'icloud.con': 'icloud.com' };
const BADTLD = /\.(con|cmo|vom|coom|ocm|comm|cim|xom|c0m|cpm|nte|ogr|rog)$/;
const FILEEXT = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i;
const NOREPLY = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon|postmaster|abuse|bounces?|unsubscribe|privacy|legal)$/i;
const PLACEHOLDER = /^(sample|example|test|your[-_]?name|yourname|someone|john\.?doe|johndoe)$/i;
const GENERICLP = /^(name|email|user|username)$/i;
const PLACEDOM = /(^|\.)(example|test|domain|yourdomain|email|sentry|wixpress|sentry-next)\.(com|org|net|io)$/i;
const tryIt = async (fn, d) => { for (let i = 0; i < 3; i++) { try { return { ok: await fn(d) }; } catch (e) { if (['ENOTFOUND', 'ENODATA'].includes(e.code)) return { err: e.code }; if (e.code === 'ESERVFAIL' && i === 2) return { err: e.code }; await new Promise((r) => setTimeout(r, 1500)); } } return { err: 'TIMEOUT' }; };
const dom = new Map();
const checkDom = async (d) => {
  const mx = await tryIt((x) => dns.resolveMx(x), d);
  if (mx.ok && mx.ok.length) {
    const h = mx.ok.sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
    if (h.length === 1 && (h[0] === '' || h[0] === '.')) return { s: 'bounce', w: 'null MX: domain takes no mail' };
    return { s: 'ok', w: 'MX ' + h[0] };
  }
  const a = await tryIt((x) => dns.resolve4(x), d), a6 = a.ok && a.ok.length ? a : await tryIt((x) => dns.resolve6(x), d);
  if (a6.ok && a6.ok.length) return { s: 'weak', w: 'no MX, only an address record (mail may go to the web host)' };
  if (mx.err === 'ESERVFAIL' || mx.err === 'TIMEOUT' || a.err === 'TIMEOUT' || a.err === 'ESERVFAIL') return { s: 'unsure', w: 'DNS did not answer (' + (mx.err || '') + '/' + (a.err || '') + ')' };
  return { s: 'dead', w: 'domain does not exist or has no mail server (' + (mx.err || '') + '/' + (a.err || '') + ')' };
};
const doms = [...new Set(rows.map((r) => (r.email.split('@')[1] || '').toLowerCase().trim()).filter((d) => d && !TYPO[d]))];
let i = 0; const work = async () => { while (i < doms.length) { const d = doms[i++]; dom.set(d, await checkDom(d)); } };
await Promise.all(Array.from({ length: 8 }, work));
const byAddr = new Map(); for (const r of rows) { const k = r.email.toLowerCase().trim(); if (!byAddr.has(k)) byAddr.set(k, []); byAddr.get(k).push(r); }
const out = ['id,company,email,result,reason,followed_up_8nov'];
const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const counts = {};
for (const r of rows) {
  const em = r.email.trim(), low = em.toLowerCase(), [lp, dm = ''] = low.split('@');
  let res = 'fine', why = 'syntax ok; ' + ((dom.get(dm) || {}).w || '');
  const set = (s, w) => { res = s; why = w; };
  if (!SYNTAX.test(em) || /\.\./.test(em) || /\s|%[0-9a-f]{2}/i.test(em)) set('bounce', 'bad syntax (' + (/%[0-9a-f]{2}/i.test(em) ? 'encoded characters in the address' : /\s/.test(em) ? 'space in the address' : 'not a valid address') + ')');
  else if (PLACEHOLDER.test(lp) || PLACEDOM.test(dm) || FILEEXT.test(dm)) set('bounce', 'placeholder or scraped junk address');
  else if (TYPO[dm]) set('bounce', 'domain looks mistyped: ' + dm + ' (probably ' + TYPO[dm] + ')');
  else if (BADTLD.test(dm)) set('bounce', 'domain ends in a mistyped extension (' + dm + ')');
  else {
    const d = dom.get(dm);
    if (d.s === 'bounce' || d.s === 'dead') set('bounce', d.w);
    else if (d.s === 'weak' || d.s === 'unsure') set('risky', d.w);
    else if (GENERICLP.test(lp)) set("risky", "placeholder-looking local part (" + lp + "@): may be a website template address");
    else if (NOREPLY.test(lp.replace(/\+.*/, ''))) set('risky', 'role or no-reply address (' + lp + '@): nobody reads it');
    else if (byAddr.get(low).length > 1) set('risky', 'same address on ' + byAddr.get(low).length + ' companies (' + byAddr.get(low).map((x) => x.name).join(' / ').slice(0, 120) + ')');
    else if (/^\d{6,}@/.test(low) || lp.length > 40) set('risky', 'odd local part (looks scraped)');
  }
  counts[res] = (counts[res] || 0) + 1;
  out.push([r.id, q(r.name), em, res, q(why), r.fu].join(','));
}
writeFileSync(outF, out.join('\n') + '\n');
console.log('rows', rows.length, 'domains', doms.length, counts);
