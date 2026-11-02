// Fiverr gig gallery images 2 and 3 (image 1 is the cover from build.mjs), 1280x769, from real work (2026-11-01).
// Traverse work is Matthew's; Sixfold work shown with Brandon's OK (Matthew, 1 Nov). Nothing from Surge or other clients.
// Customer data never appears: the lead sheet shows grey bars where names and contacts are, and the emails use a sample name.
//   node matthew/fiverr/gallery.mjs            (fetches live sites + DNS, so it needs the internet)
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'gallery'), SHOTS = join(HERE, 'gallery', 'src');
mkdirSync(SHOTS, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = mkdtempSync(join(tmpdir(), 'fvg-'));
const shot = (url, png, w, h, extra = []) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--allow-file-access-from-files', `--user-data-dir=${prof}`, `--screenshot=${png}`, `--window-size=${w},${h}`, '--virtual-time-budget=6000', ...extra, url],
  { stdio: 'pipe', timeout: 90000 });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rel = (p) => relative(OUT, p).split('\\').join('/');
const C = { ink: '#13202F', ink2: '#1D2E42', amber: '#F0A63A', teal: '#3BA99C', soft: '#9FB0C2', line: '#2C405A' };
const FONT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ---- source pictures ----
const SCR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/0ebd7c3b-c808-4999-85da-c5cba31374c1/scratchpad/review';
for (const f of ['nl.png', 'aftercare.png']) if (existsSync(join(SCR, f))) copyFileSync(join(SCR, f), join(SHOTS, f));   // email renders, sample customer "Alex"
for (const [site, name] of [['https://365aeration.com/', 's365'], ['https://traverseplatforms.com/', 'trav']]) {
  shot(site, join(SHOTS, name + '-desk.png'), 1440, 900);
  shot(site, join(SHOTS, name + '-phone.png'), 390, 844, [`--user-agent=${PHONE_UA}`]);
}
shot(pathToFileURL(join(ROOT, 'sixfold', 'marketing', 'funding-one-pager.html')).href, join(SHOTS, 'onepager.png'), 900, 1165);   // customer-facing; the Traverse Manual and field crib sheet are marked internal, so never shown
shot(pathToFileURL(join(ROOT, 'sixfold', 'agreements', 'lawn-job-sheet.html')).href, join(SHOTS, 'jobsheet.png'), 900, 1165);

// ---- live DNS for the pass report ----
const doh = (name, type = 'TXT') => JSON.parse(execFileSync('curl', ['-s', `https://dns.google/resolve?name=${name}&type=${type}`], { encoding: 'utf8' })).Answer || [];
const D = 'traverseplatforms.com';
const txt = (a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, '');
const spf = doh(D).map(txt).find((t) => /^v=spf1/.test(t)) || '';
const dmarc = doh('_dmarc.' + D).map(txt).find((t) => /^v=DMARC1/.test(t)) || '';
const dkim = doh('google._domainkey.' + D).map(txt).find((t) => /v=DKIM1|p=/.test(t)) || '';
const checked = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---- frame ----
const css = `*{box-sizing:border-box;margin:0}html,body{width:1280px;height:769px;overflow:hidden}
body{background:${C.ink};color:#fff;font-family:${FONT};position:relative}
.glow{position:absolute;right:-160px;top:-200px;width:820px;height:820px;border-radius:50%;background:radial-gradient(circle,${C.ink2} 0%,${C.ink} 70%)}
.txt{position:absolute;left:60px;top:0;bottom:0;width:340px;display:flex;flex-direction:column;justify-content:center}
.k{font:700 17px ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.amber};margin-bottom:16px}
h1{font:800 38px/1.12 ${FONT}}.cap{margin-top:16px;font:500 19px/1.45 ${FONT};color:${C.soft}}
.tag{display:inline-block;margin-top:22px;font:700 13px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${C.ink};background:${C.teal};padding:6px 12px;border-radius:999px;align-self:flex-start}
.art{position:absolute;left:440px;right:40px;top:40px;bottom:40px;display:flex;align-items:center;justify-content:center;gap:24px}
.shot{background:#fff;border-radius:12px;box-shadow:0 22px 60px rgba(0,0,0,.4);overflow:hidden;display:block}
.shot img{display:block;width:100%}
.phone{border-radius:28px;border:8px solid #0B141F;box-shadow:0 22px 60px rgba(0,0,0,.45);overflow:hidden;background:#fff}
.phone img{display:block;width:100%}
.browser{border-radius:12px;overflow:hidden;box-shadow:0 22px 60px rgba(0,0,0,.4);background:#fff}
.browser .bar{height:28px;background:#E6E1D6;display:flex;gap:7px;align-items:center;padding:0 12px}.browser .bar i{width:10px;height:10px;border-radius:50%;background:#C6BFB1}
.browser .bar span{margin-left:10px;font:600 12px ${FONT};color:#6B6457;background:#F4F1EA;border-radius:6px;padding:3px 10px}
.browser img{display:block;width:100%}`;
const frame = (k, h, cap, tag, art) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="glow"></div>
<div class="txt"><div class="k">${esc(k)}</div><h1>${h}</h1><div class="cap">${esc(cap)}</div>${tag ? `<div class="tag">${esc(tag)}</div>` : ''}</div>
<div class="art">${art}</div></body></html>`;
const crop = (src, w, h, pos = 'top') => `<div style="width:${w}px;height:${h}px;overflow:hidden"><img src="${rel(src)}" style="width:100%;display:block;object-position:${pos}"></div>`;
const browser = (src, url, w, h) => `<div class="browser" style="width:${w}px"><div class="bar"><i></i><i></i><i></i><span>${esc(url)}</span></div>${crop(src, w, h)}</div>`;
const phone = (src, w, h) => `<div class="phone" style="width:${w}px">${crop(src, w - 16, h)}</div>`;

const pages = {};

// 1. SPF, DKIM, DMARC: live pass report for Matthew's own domain
const row = (k, ok, v, why) => `<div style="padding:14px 0;border-top:1px solid #E6E1D6"><div style="display:flex;justify-content:space-between;align-items:center">
  <b style="font:800 22px ${FONT}">${k}</b><span style="font:800 15px ${FONT};padding:5px 12px;border-radius:999px;background:${ok ? '#E1F3EE' : '#FBE3DD'};color:${ok ? '#1E7A6C' : '#9B2F1C'}">${ok ? '&#10003; Pass' : '&#10007; Missing'}</span></div>
  <div style="font:13px/1.4 Consolas,monospace;color:#46525F;margin-top:6px;word-break:break-all">${esc(v.length > 150 ? v.slice(0, 150) + '…' : v)}</div><div style="font:500 13px ${FONT};color:#7A8796;margin-top:4px">${esc(why)}</div></div>`;
pages['email-records-2'] = frame('Real report', 'A live check on my own domain', 'SPF, DKIM and DMARC records as published today, with what each one does. Every order ends with a report like this.', 'traverseplatforms.com',
  `<div class="shot" style="width:640px;padding:26px 30px;color:${C.ink}">
    <div style="font:700 13px ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#7A8796">Domain check &middot; ${esc(checked)}</div>
    <div style="font:800 26px ${FONT};margin:4px 0 12px">${D}</div>
    ${row('SPF', !!spf, spf || 'no record', 'Lists the servers allowed to send as this domain')}
    ${row('DKIM', !!dkim, dkim ? 'google._domainkey: ' + dkim : 'no record', 'Signs each email so it cannot be faked')}
    ${row('DMARC', !!dmarc, dmarc || 'no record', 'Tells inboxes what to do with mail that fails')}
  </div>`);

// 2. Email templates: Sixfold 365 newsletter + aftercare
pages['email-templates-2'] = frame('Real work', 'A monthly customer newsletter', 'One page, three tips, one clear ask. Logo, socials, and an unsubscribe link in the footer.', 'Sixfold 365, lawn care',
  `<div class="shot" style="width:520px">${crop(join(SHOTS, 'nl.png'), 520, 690)}</div>`);
pages['email-templates-3'] = frame('Real work', 'The email after the job', 'Care tips for the new seed, the balance due, and a pay button. Personal details fill in for each customer.', 'Sixfold 365, lawn care',
  `<div class="shot" style="width:520px">${crop(join(SHOTS, 'aftercare.png'), 520, 600)}</div>`);

// 3. Websites
pages['website-2'] = frame('Real work', 'Sixfold 365', 'A lawn care company website: services, area, and a quote form that goes straight to the office.', '365aeration.com',
  `<div style="position:relative;width:780px;height:640px">${browser(join(SHOTS, 's365-desk.png'), '365aeration.com', 680, 425)}
   <div style="position:absolute;right:0;bottom:0">${phone(join(SHOTS, 's365-phone.png'), 210, 420)}</div></div>`);
pages['website-3'] = frame('Real work', 'Traverse', 'The website for my own field-sales app for roofing and lawn companies.', 'traverseplatforms.com',
  `<div style="position:relative;width:780px;height:640px">${browser(join(SHOTS, 'trav-desk.png'), 'traverseplatforms.com', 680, 425)}
   <div style="position:absolute;right:0;bottom:0">${phone(join(SHOTS, 'trav-phone.png'), 210, 420)}</div></div>`);

// 4. Print
const CON = join(ROOT, 'sixfold', 'marketing', 'christmas-concert-ad-2026', 'concert-ad-d.png');
const P365 = join(ROOT, 'sixfold', 'brand', 'combined-365-2026-10', 'print');
pages['print-2'] = frame('Real work', 'A half-page program ad', 'Real job photos, the services, and a QR code tested from the printed file.', 'Sixfold 365',
  `<div class="shot" style="width:760px"><img src="${rel(CON)}"></div>`);
pages['print-3'] = frame('Real work', 'One look, every piece', 'A yard sign and a truck magnet in one matching look, both print-ready.', 'Sixfold 365',
  `<div style="position:relative;width:780px;height:600px">
    <div class="shot" style="position:absolute;left:0;top:0;width:470px;transform:rotate(-2deg)"><img src="${rel(join(P365, 'yard-sign-a.png'))}"></div>
    <div class="shot" style="position:absolute;right:0;bottom:30px;width:480px;transform:rotate(2deg)"><img src="${rel(join(P365, 'magnet-truck-24x12-a.png'))}"></div></div>`);

// 5. AI assistant: J.A.R.V.I.S. as it looks in the app (greeting is the real one; the exchange is an illustration, labelled)
pages['ai-assistant-2'] = frame('Real work', 'An office assistant inside a business app', 'Staff type a request in plain words. It looks things up, does the routine office work, and checks before anything reaches a customer.', 'Built for a lawn care company',
  `<div style="width:400px;height:640px;border-radius:18px;overflow:hidden;background:#fff;color:#1B2720;box-shadow:0 22px 60px rgba(0,0,0,.45);display:flex;flex-direction:column">
    <div style="background:#1F5FAD;color:#fff;padding:14px 16px;font:800 17px ${FONT};display:flex;justify-content:space-between;align-items:center">J.A.R.V.I.S.<span style="font:700 12px ${FONT};background:rgba(255,255,255,.18);padding:5px 10px;border-radius:999px">Clear</span></div>
    <div style="flex:1;background:#F6F4EE;padding:14px;display:flex;flex-direction:column;gap:10px;font:14.5px/1.42 ${FONT}">
      <div style="align-self:flex-start;max-width:86%;background:#fff;border:1px solid #DDD7CB;border-radius:16px;border-bottom-left-radius:5px;padding:9px 12px"><div style="font:800 11px ${FONT};opacity:.7">J.A.R.V.I.S.</div>Good evening. J.A.R.V.I.S. at your service. Tell me what's gone sideways, and I'll see to it. Nothing is too small, though I do have opinions about typos.</div>
      <div style="align-self:center;font:600 11.5px ${FONT};color:#7A7465;border:1px dashed #CFC8BA;border-radius:999px;padding:3px 10px">Example conversation</div>
      <div style="align-self:flex-end;max-width:80%;background:#1F5FAD;color:#fff;border-radius:16px;border-bottom-right-radius:5px;padding:9px 12px">A customer paid the rest by check today, #1042. Can you mark it paid?</div>
      <div style="align-self:flex-start;max-width:86%;background:#fff;border:1px solid #DDD7CB;border-radius:16px;border-bottom-left-radius:5px;padding:9px 12px"><div style="font:800 11px ${FONT};opacity:.7">J.A.R.V.I.S.</div>Done. Check #1042 is recorded for today and the job shows paid in full. Refresh the page to see it.</div>
    </div>
    <div style="padding:10px;border-top:1px solid #DDD7CB;display:flex;gap:8px;align-items:center"><div style="flex:1;border:1px solid #DDD7CB;border-radius:18px;padding:9px 13px;color:#8A8578;font:14px ${FONT}">Type a message</div><div style="width:40px;height:40px;border-radius:50%;background:#1F5FAD"></div></div>
  </div>`);

// 6. Lead list: real column layout from the Colorado prospect build; names and contacts shown as grey bars
const csv = readFileSync(join(ROOT, 'traverse', 'research', 'prospects', 'prospects-step3.csv'), 'utf8').split(/\r?\n/);
const parse = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const H = parse(csv[0]); const ix = (n) => H.indexOf(n);
const rows = csv.slice(1).map(parse).filter((r) => r[ix('trade')] && r[ix('city')] && r[ix('formed')] && (r[ix('found_email')] || r[ix('email')]) && (r[ix('found_site')] || r[ix('website')]))
  .filter((_, i) => i % 97 === 0).slice(0, 11);
const bar = (s, max) => `<span style="display:inline-block;height:10px;border-radius:5px;background:#D5CFC3;width:${Math.min(max, 18 + String(s).length * 4)}px"></span>`;
pages['lead-list-2'] = frame('Real work', 'A Colorado contractor list', 'Built from state business records and company websites: trade, city, year formed, site and email checked. Names and contacts hidden here.', 'Sample rows',
  `<div class="shot" style="width:780px;color:${C.ink};font:13.5px ${FONT}">
    <div style="display:grid;grid-template-columns:1.5fr .9fr 1fr .6fr 1.2fr 1.3fr .7fr;background:${C.ink2};color:#fff;font:700 12.5px ${FONT}">
      ${['Company', 'Trade', 'City', 'Formed', 'Website', 'Email', 'Email ok'].map((h) => `<div style="padding:10px">${h}</div>`).join('')}</div>
    ${rows.map((r, i) => `<div style="display:grid;grid-template-columns:1.5fr .9fr 1fr .6fr 1.2fr 1.3fr .7fr;align-items:center;border-top:1px solid #E4DED1;background:${i % 2 ? '#FBFAF6' : '#fff'}">
      <div style="padding:9px 10px">${bar(r[ix('company')], 150)}</div><div style="padding:9px 10px">${esc(r[ix('trade')]).slice(0, 14)}</div>
      <div style="padding:9px 10px">${esc(r[ix('city')]).slice(0, 16)}</div><div style="padding:9px 10px">${esc(String(r[ix('formed')]).slice(0, 4))}</div>
      <div style="padding:9px 10px">${bar(r[ix('found_site')] || r[ix('website')], 120)}</div><div style="padding:9px 10px">${bar(r[ix('found_email')] || r[ix('email')], 130)}</div>
      <div style="padding:9px 10px;color:${r[ix('email_ok')] === 'no' ? '#9B2F1C' : '#1E7A6C'};font-weight:700">${r[ix('email_ok')] === 'no' ? '&#10007;' : '&#10003;'}</div></div>`).join('')}
  </div>`);

// 7. Documents
pages['documents-2'] = frame('Real work', 'A customer one-pager', 'A homeowner handout that explains a law change in plain words, with every figure sourced.', 'Sixfold 365',
  `<div class="shot" style="width:560px">${crop(join(SHOTS, 'onepager.png'), 560, 680)}</div>`);
pages['documents-3'] = frame('Real work', 'A field job sheet', 'A printable sheet a crew fills in on site: the job, the work done, and sign-off.', 'Sixfold, lawn care',
  `<div class="shot" style="width:540px">${crop(join(SHOTS, 'jobsheet.png'), 540, 690)}</div>`);

try {
  for (const [name, html] of Object.entries(pages)) {
    const f = join(OUT, name + '.html'); writeFileSync(f, html);
    shot(pathToFileURL(f).href, join(OUT, name + '.png'), 1280, 769);
    console.log('made', name);
  }
} finally { rmSync(prof, { recursive: true, force: true }); }
console.log(`DNS ${D}: SPF ${spf ? 'yes' : 'NO'}, DKIM ${dkim ? 'yes' : 'NO'}, DMARC ${dmarc ? 'yes' : 'NO'}; lead rows ${rows.length}`);
