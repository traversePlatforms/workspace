// Contacts for the 152 companies new on the register since 11 Oct (Matthew 6 Nov: "start with the 152 new ones").
// websites.json already holds each one's site and phone where find-websites.mjs found them. This reads each site's home and
// contact pages for a business email (mailto links and plain addresses on the company's own domain or a common mailbox),
// asks Hunter's domain search when the site shows none, then verifies every address with Hunter. Business contacts only.
//   node traverse/research/prospects/new152-contacts.mjs   -> new152-contacts.csv (gitignored with the list)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HUNTER = JSON.parse(readFileSync('C:/Users/Surge Inc/.ssh/hunter.json', 'utf8'));
const KEY = HUNTER.api_key || HUNTER.key || HUNTER.apiKey;
const parse = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const lines = readFileSync(join(HERE, 'prospects-new-since-20261011.csv'), 'utf8').trim().split(/\r?\n/);
const head = parse(lines[0]);
const rows = lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const sites = JSON.parse(readFileSync(join(HERE, 'websites.json'), 'utf8'));
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JUNK = /\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|godaddy|domain\.com|yourdomain|email\.com$|@sentry/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TraverseSiteCheck/1.0)' } }); return r.ok ? await r.text() : ''; } catch { return ''; }
}
async function siteEmails(site) {
  const host = new URL(site).hostname.replace(/^www\./, '');
  const found = new Set();
  for (const p of ['', 'contact', 'contact-us', 'about']) {
    const html = await get(new URL(p, site.endsWith('/') ? site : site + '/').href);
    for (const m of html.matchAll(EMAIL)) { const e = m[0].toLowerCase(); if (!JUNK.test(e)) found.add(e); }
    if (found.size) break;
  }
  const own = [...found].filter((e) => e.endsWith('@' + host));
  return own.length ? own : [...found];
}
async function hunter(path) {
  const r = await fetch(`https://api.hunter.io/v2/${path}&api_key=${KEY}`); await sleep(1200);
  return r.ok ? (await r.json()).data : null;
}

const out = [['company', 'trade', 'city', 'formed', 'website', 'phone', 'email', 'email_from', 'verified']];
let n = 0;
for (const x of rows) {
  const w = sites[x.record] || {};
  let email = '', from = '', ver = '';
  if (w.website) {
    const list = await siteEmails(w.website);
    if (list.length) { email = list[0]; from = 'website'; }
    else {
      const d = await hunter(`domain-search?domain=${encodeURIComponent(new URL(w.website).hostname.replace(/^www\./, ''))}&limit=5`);
      const best = (d?.emails || []).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
      if (best?.value) { email = best.value.toLowerCase(); from = 'hunter'; }
    }
    if (email) { const v = await hunter(`email-verifier?email=${encodeURIComponent(email)}`); ver = v?.status || v?.result || ''; }
  }
  out.push([x.company, x.trade, x.city, x.formed, w.website || '', w.phone || '', email, from, ver]);
  if (++n % 25 === 0) console.log(n, 'done');
}
const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
writeFileSync(join(HERE, 'new152-contacts.csv'), out.map((r) => r.map(q).join(',')).join('\n') + '\n');
const body = out.slice(1);
console.log(`152 companies: website ${body.filter((r) => r[4]).length}, phone ${body.filter((r) => r[5]).length}, email ${body.filter((r) => r[6]).length} (valid ${body.filter((r) => r[8] === 'valid').length}, accept-all ${body.filter((r) => r[8] === 'accept_all').length})`);
