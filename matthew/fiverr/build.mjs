// Builds the Fiverr preview from gigs.mjs (2026-11-01):
//   covers/<slug>.html + covers/<slug>.png   1280x769 gig images (Fiverr's recommended size), rendered with headless Chrome
//   preview.html                             the profile and all seven gigs, the way a buyer would read them, with length checks
// Run: node matthew/fiverr/build.mjs        (add --no-png to skip the Chrome step)
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { profile, gigs } from './gigs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const descText = (g) => g.description.join('\n');
// Limits from Fiverr's help centre (see the fact-check log in fiverr-gigs-draft.md).
const LIM = { title: 80, titleCard: 50, desc: 1200 };

const C = { ink: '#13202F', ink2: '#1D2E42', paper: '#F6F3EC', amber: '#F0A63A', teal: '#3BA99C', soft: '#9FB0C2', line: '#2C405A' };
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// ---- the right-hand pictures on the covers: drawn with CSS, no photos, no people ----
const mocks = {
  checks: () => `
    <div class="card" style="width:430px;padding:30px 32px">
      <div class="lbl">Domain check</div><div class="dom">yourbusiness.com</div>
      ${['SPF', 'DKIM', 'DMARC'].map((k) => `<div class="row"><b>${k}</b><span class="pass">&#10003; Pass</span></div>`).join('')}
      <div class="foot">Test send delivered</div>
    </div>`,
  email: () => `
    <div class="card" style="width:420px;padding:0;overflow:hidden">
      <div style="background:${C.teal};height:70px;display:flex;align-items:center;padding:0 26px"><div class="logo"></div></div>
      <div style="padding:26px">
        <div class="bar" style="width:72%;height:20px;background:${C.ink}"></div>
        <div class="bar"></div><div class="bar"></div><div class="bar" style="width:60%"></div>
        <div class="btn">Book your next visit</div>
        <div style="display:flex;gap:10px;margin-top:22px">${'<i class="dot"></i>'.repeat(3)}</div>
      </div>
    </div>`,
  site: () => `
    <div style="position:relative;width:470px;height:420px">
      <div class="card" style="position:absolute;left:0;top:20px;width:420px;height:300px;padding:0;overflow:hidden">
        <div style="height:30px;background:#E6E1D6;display:flex;gap:7px;align-items:center;padding:0 12px"><i class="tl"></i><i class="tl"></i><i class="tl"></i></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px"><div class="logo" style="background:${C.ink}"></div><div style="display:flex;gap:12px">${'<div class="bar" style="width:40px;margin:0"></div>'.repeat(3)}</div></div>
        <div style="margin:4px 20px;height:120px;border-radius:10px;background:linear-gradient(135deg,${C.teal},#2B7F75);display:flex;flex-direction:column;justify-content:center;padding:0 22px">
          <div class="bar" style="width:62%;height:16px;background:#fff;margin:0 0 10px"></div><div class="bar" style="width:40%;background:rgba(255,255,255,.7);margin:0 0 14px"></div>
          <div style="width:110px;height:26px;border-radius:13px;background:${C.amber}"></div></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 20px">${'<div style="height:70px;border-radius:8px;background:#F1EDE4;padding:10px"><div class="bar" style="margin:0 0 8px;width:60%;background:#CFC8BA"></div><div class="bar" style="margin:0;width:85%"></div></div>'.repeat(3)}</div>
      </div>
      <div class="card" style="position:absolute;right:0;top:130px;width:140px;height:270px;padding:12px;border-radius:24px">
        <div class="logo" style="background:${C.ink};width:50px;height:12px"></div>
        <div style="margin-top:12px;height:92px;border-radius:10px;background:linear-gradient(135deg,${C.teal},#2B7F75)"></div>
        <div class="bar"></div><div class="bar"></div><div class="bar" style="width:55%"></div>
        <div style="height:24px;border-radius:12px;background:${C.amber};margin-top:14px"></div>
      </div>
    </div>`,
  print: () => `
    <div style="position:relative;width:480px;height:430px">
      <div class="card" style="position:absolute;left:10px;top:10px;width:270px;height:350px;transform:rotate(-5deg);padding:22px">
        <div style="height:120px;border-radius:8px;background:linear-gradient(135deg,${C.teal},#2B7F75)"></div>
        <div class="bar" style="width:80%;height:18px;background:${C.ink};margin-top:18px"></div><div class="bar"></div><div class="bar" style="width:70%"></div>
        <div style="display:flex;justify-content:space-between;align-items:end;margin-top:24px"><div class="bar" style="width:90px;height:14px;background:${C.amber}"></div><div class="qr"></div></div>
      </div>
      <div class="card" style="position:absolute;left:250px;top:40px;width:150px;height:360px;transform:rotate(4deg);padding:16px;border-radius:12px">
        <div style="width:56px;height:56px;border-radius:50%;border:8px solid ${C.paper};background:${C.ink2};margin:0 auto 14px;box-shadow:inset 0 0 0 2px #CFC8BA"></div>
        <div class="bar" style="width:85%;height:14px;background:${C.ink};margin:0 auto 10px"></div><div class="bar"></div><div class="bar"></div>
        <div style="height:90px;border-radius:6px;background:${C.amber};margin-top:16px"></div>
      </div>
      <div class="card" style="position:absolute;left:300px;top:300px;width:180px;height:104px;transform:rotate(-2deg);padding:16px">
        <div class="logo" style="background:${C.ink};width:60px"></div><div class="bar" style="width:70%;margin-top:14px"></div><div class="bar" style="width:50%"></div>
      </div>
    </div>`,
  chat: () => `
    <div class="card" style="width:430px;padding:0;overflow:hidden">
      <div style="background:${C.ink2};color:#fff;padding:16px 22px;font:700 19px ${FONT};display:flex;align-items:center;gap:10px"><i class="dot" style="background:${C.teal}"></i>Ask us anything</div>
      <div style="padding:22px;display:grid;gap:14px;background:#FBFAF6">
        <div class="bub me">What are your hours on Saturday?</div>
        <div class="bub them">We're open 8 to 2 on Saturdays. Want our number to book a time?</div>
        <div class="bub me">Do you cover the north side of town?</div>
        <div class="bub them"><span class="typing"><i></i><i></i><i></i></span></div>
      </div>
    </div>`,
  sheet: () => `
    <div class="card" style="width:470px;padding:0;overflow:hidden">
      <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;background:${C.ink2};color:#fff;font:700 15px ${FONT}">
        ${['Company', 'Website', 'Phone', 'Email'].map((h) => `<div style="padding:12px 12px">${h}</div>`).join('')}
      </div>
      ${Array.from({ length: 7 }, (_, i) => `<div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;border-top:1px solid #E4DED1;background:${i % 2 ? '#FBFAF6' : '#fff'}">
        ${[78, 64, 70, 82].map((w, j) => `<div style="padding:12px"><div class="bar" style="margin:0;width:${w - ((i * 7 + j * 11) % 25)}%;${j === 0 ? `background:${C.ink};opacity:.75` : ''}"></div></div>`).join('')}</div>`).join('')}
      <div style="padding:12px 14px;border-top:1px solid #E4DED1;font:600 14px ${FONT};color:${C.teal}">&#10003; Email domains checked &middot; duplicates removed</div>
    </div>`,
  docs: () => `
    <div style="position:relative;width:440px;height:430px">
      <div class="card" style="position:absolute;left:70px;top:0;width:290px;height:380px;transform:rotate(6deg)"></div>
      <div class="card" style="position:absolute;left:40px;top:14px;width:290px;height:380px;transform:rotate(2deg)"></div>
      <div class="card" style="position:absolute;left:10px;top:30px;width:300px;height:390px;padding:28px">
        <div class="bar" style="width:40%;height:10px;background:${C.teal};margin:0 0 14px"></div>
        <div class="bar" style="width:85%;height:20px;background:${C.ink};margin:0 0 20px"></div>
        <div class="bar"></div><div class="bar"></div><div class="bar" style="width:75%"></div>
        <div style="margin-top:22px;display:grid;gap:12px">
          ${['Name', 'Date', 'Signature'].map((f) => `<div style="display:flex;align-items:end;gap:10px;font:600 13px ${FONT};color:#5B6878"><span style="width:70px">${f}</span><span style="flex:1;border-bottom:2px solid #C9C1B2;height:16px"></span></div>`).join('')}
        </div>
        <div style="position:absolute;right:20px;bottom:20px;background:${C.amber};color:${C.ink};font:800 14px ${FONT};padding:6px 12px;border-radius:6px">PDF</div>
      </div>
    </div>`,
};

const coverCss = `
  *{box-sizing:border-box;margin:0}
  html,body{width:1280px;height:769px;overflow:hidden}
  body{background:${C.ink};color:#fff;font-family:${FONT};position:relative}
  .wrap{position:absolute;inset:0;display:grid;grid-template-columns:640px 1fr;align-items:center;padding:0 70px}
  .glow{position:absolute;right:-120px;top:-160px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,${C.ink2} 0%,${C.ink} 70%)}
  .rule{position:absolute;left:70px;right:70px;bottom:64px;height:2px;background:${C.line}}
  .kicker{display:inline-block;font:700 22px ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.amber};margin-bottom:26px}
  h1{font:800 56px/1.08 ${FONT};letter-spacing:-.01em}
  h1 span{display:block;white-space:nowrap}
  .sub{margin-top:28px;font:500 28px/1.35 ${FONT};color:${C.soft};max-width:540px}
  .sig{position:absolute;left:70px;bottom:22px;font:700 20px ${FONT};color:#fff;letter-spacing:.02em}
  .sig em{font-style:normal;color:${C.soft};font-weight:500;margin-left:12px}
  .art{position:relative;display:flex;justify-content:center;align-items:center;height:100%}
  .card{background:#fff;color:${C.ink};border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative}
  .lbl{font:700 14px ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#7A8796}
  .dom{font:700 24px ${FONT};margin:6px 0 18px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-top:1px solid #E6E1D6;font:700 24px ${FONT}}
  .pass{background:#E1F3EE;color:#1E7A6C;font:800 18px ${FONT};padding:6px 14px;border-radius:999px}
  .foot{margin-top:12px;font:600 16px ${FONT};color:${C.teal}}
  .bar{height:12px;border-radius:6px;background:#E3DED3;margin:12px 0;width:100%}
  .logo{width:90px;height:18px;border-radius:5px;background:#fff}
  .btn{display:inline-block;margin-top:20px;background:${C.amber};color:${C.ink};font:800 17px ${FONT};padding:12px 22px;border-radius:999px}
  .dot{display:inline-block;width:22px;height:22px;border-radius:50%;background:#D9D3C6}
  .tl{display:inline-block;width:11px;height:11px;border-radius:50%;background:#C9C2B4}
  .qr{width:62px;height:62px;background:conic-gradient(${C.ink} 25%,#fff 0 50%,${C.ink} 0 75%,#fff 0) 0 0/16px 16px;border:5px solid ${C.ink};border-radius:4px}
  .bub{max-width:82%;padding:12px 16px;border-radius:16px;font:500 18px/1.35 ${FONT}}
  .bub.me{justify-self:end;background:${C.teal};color:#fff;border-bottom-right-radius:5px}
  .bub.them{justify-self:start;background:#fff;border:1px solid #E1DBCF;border-bottom-left-radius:5px}
  .typing{display:inline-flex;gap:6px}.typing i{width:9px;height:9px;border-radius:50%;background:#B8B1A3}
`;

function coverHtml(g) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(g.cover.kicker)}</title><style>${coverCss}</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    <div><div class="kicker">${esc(g.cover.kicker)}</div><h1>${g.cover.h.map((l) => `<span>${esc(l)}</span>`).join('')}</h1><div class="sub">${esc(g.cover.sub)}</div></div>
    <div class="art">${mocks[g.cover.mock]()}</div>
  </div>
  <div class="rule"></div><div class="sig">${esc(profile.name)}<em>${esc(profile.headline)}</em></div>
</body></html>`;
}

// ---- covers ----
mkdirSync(join(HERE, 'covers'), { recursive: true });
for (const g of gigs) writeFileSync(join(HERE, 'covers', g.slug + '.html'), coverHtml(g));
if (!process.argv.includes('--no-png')) {
  const prof = mkdtempSync(join(tmpdir(), 'fvr-'));
  try {
    for (const g of gigs) {
      execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${prof}`,
        `--screenshot=${join(HERE, 'covers', g.slug + '.png')}`, '--window-size=1280,769', '--virtual-time-budget=2000',
        pathToFileURL(join(HERE, 'covers', g.slug + '.html')).href], { stdio: 'pipe', timeout: 60000 });
    }
  } finally { rmSync(prof, { recursive: true, force: true }); }
}

// ---- checks ----
const checks = gigs.map((g) => {
  const t = g.title.length, d = descText(g).length;
  return { slug: g.slug, t, d, ok: t <= LIM.title && d <= LIM.desc && g.tags.length <= 5 && g.tags.every((x) => x.length <= 20), tCard: t <= LIM.titleCard };
});

// ---- preview ----
const money = (n) => '$' + n;
const pill = (ok, txt) => `<span class="ck ${ok ? 'ok' : 'no'}">${esc(txt)}</span>`;
const st = (s) => /ready|mine/.test(s) && !/OK/.test(s) ? 'ok' : /OK|ask/.test(s) ? 'wait' : 'todo';

const gigCard = (g) => `
  <a class="gcard" href="#${g.slug}">
    <img src="covers/${g.slug}.png" alt="">
    <div class="gc-b"><div class="gc-s"><span class="av">MS</span>${esc(profile.name)}</div>
    <div class="gc-t">${esc(g.title)}</div>
    <div class="gc-p">From <b>${money(g.packages[0].price)}</b></div></div>
  </a>`;

const gigDetail = (g, c) => `
  <section class="gig" id="${g.slug}">
    <h2>${esc(g.title)}</h2>
    <div class="checks">${pill(c.t <= LIM.title, `Title ${c.t}/${LIM.title}`)} ${pill(c.tCard, c.tCard ? 'fits on the gig card' : 'may be cut on the gig card (over 50)')} ${pill(c.d <= LIM.desc, `Description ${c.d}/${LIM.desc}`)} ${pill(g.tags.length <= 5 && g.tags.every((x) => x.length <= 20), `${g.tags.length} tags, each 20 or under`)}</div>
    <div class="cols">
      <div class="main">
        <img class="hero" src="covers/${g.slug}.png" alt="">
        <h3>About this gig</h3>
        <div class="desc">${esc(descText(g))}</div>
        <h3>Questions for the buyer</h3>
        <ol class="req">${g.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
        <h3>FAQ</h3>
        <div class="faq">${g.faq.map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      </div>
      <aside>
        <div class="pk">
          ${g.packages.map((p, i) => `
          <div class="pkc">
            <div class="pkh"><span>${['Basic', 'Standard', 'Premium'][i]}</span><b>${money(p.price)}</b></div>
            <div class="pkn">${esc(p.name)}</div>
            <div class="pkd">${esc(p.desc || '')} <span class="ck ${(p.desc || '').length <= 100 ? 'ok' : 'no'}">${(p.desc || '').length}/100</span></div>
            <div class="pkm">${p.days}-day delivery &middot; ${p.revisions} revision${p.revisions > 1 ? 's' : ''}</div>
            <ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            <div class="pkfee">You receive about ${money(Math.round(p.price * 0.8))} after Fiverr's 20%</div>
          </div>`).join('')}
        </div>
        <div class="side">
          <h4>Extras</h4>
          <ul>${g.extras.map((x) => `<li><b>+${money(x.price)}</b> ${esc(x.name)} <small>${esc(x.note)}</small></li>`).join('')}</ul>
          <h4>Tags</h4><div class="tags">${g.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
          <h4>Category</h4><p class="small">${esc(g.category)} &rsaquo; ${esc(g.subcategory)}</p>
          <h4>Service type</h4><p class="small">${esc(g.serviceType)}</p>
          <h4>Gig metadata</h4><ul>${g.metadata.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
          <h4>Gallery (up to 3 images)</h4>
          <ul class="samp">${g.samples.map(([s, w]) => `<li class="${st(w)}"><span>${esc(s)}</span><small>${esc(w)}</small></li>`).join('')}</ul>
        </div>
      </aside>
    </div>
  </section>`;

const css = `
  :root{--ink:${C.ink};--soft:#5D6B7B;--line:#E2DDD2;--bg:#F7F5F0;--card:#fff;--teal:${C.teal};--amber:${C.amber}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ${FONT}}
  .note{background:#FFF4DA;border-bottom:1px solid #EBD9AE;padding:10px 24px;font-size:14px}
  header.pro{background:${C.ink};color:#fff;padding:36px 24px}
  .w{max-width:1160px;margin:0 auto}
  .pro .w{display:grid;grid-template-columns:110px 1fr;gap:24px;align-items:center}
  .bigav{width:110px;height:110px;border-radius:50%;background:${C.teal};display:grid;place-items:center;font:800 40px ${FONT}}
  .pro h1{margin:0;font-size:30px}.pro .hl{color:${C.amber};font-weight:600;margin:2px 0 10px}.pro .about{color:#C9D3DE;max-width:760px;margin:0}
  .pro .meta{color:${C.soft};font-size:14px;margin-top:10px}
  h2.sec{font-size:22px;margin:34px 0 14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
  .gcard{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;color:inherit;text-decoration:none;display:block}
  .gcard img{width:100%;display:block;aspect-ratio:1280/769}
  .gc-b{padding:12px 14px}.gc-s{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px}
  .av{width:26px;height:26px;border-radius:50%;background:${C.teal};color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800}
  .gc-t{margin:8px 0 10px;font-size:15.5px;line-height:1.35;min-height:42px}.gc-p{font-size:14px;color:var(--soft);text-align:right}.gc-p b{color:var(--ink);font-size:17px}
  .gig{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px;margin:26px 0}
  .gig h2{margin:0 0 8px;font-size:26px}
  .checks{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}.ck{font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px}.ck.ok{background:#E1F3EE;color:#1E6B5F}.ck.no{background:#FBE3DD;color:#9B2F1C}
  .cols{display:grid;grid-template-columns:1fr 360px;gap:28px}
  @media (max-width:900px){.cols{grid-template-columns:1fr}}
  .hero{width:100%;border-radius:10px;border:1px solid var(--line)}
  .desc{white-space:pre-wrap}
  h3{margin:24px 0 8px;font-size:18px}.req{padding-left:20px;margin:0}.req li{margin:4px 0}
  details{border-top:1px solid var(--line);padding:10px 0}summary{font-weight:700;cursor:pointer}details p{margin:6px 0 0;color:var(--soft)}
  .pk{display:grid;gap:12px}.pkc{border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .pkh{display:flex;justify-content:space-between;align-items:baseline}.pkh span{font-weight:800;color:var(--soft);text-transform:uppercase;font-size:13px;letter-spacing:.06em}.pkh b{font-size:24px}
  .pkn{font-weight:700;margin-top:2px}.pkd{font-size:14px;margin:4px 0 2px}.pkm{font-size:13.5px;color:var(--soft);margin:2px 0 6px}
  .pkc ul{margin:0;padding-left:18px;font-size:14.5px}.pkfee{margin-top:8px;font-size:12.5px;color:var(--soft)}
  .side h4{margin:18px 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--soft)}
  .side ul{margin:0;padding-left:18px;font-size:14.5px}.side small{display:block;color:var(--soft)}.small{font-size:14px;margin:0}
  .tags{display:flex;flex-wrap:wrap;gap:6px}.tags span{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:13px}
  .samp{list-style:none;padding:0!important}.samp li{border-left:4px solid #ccc;padding:4px 10px;margin:6px 0;background:var(--bg);border-radius:0 6px 6px 0}
  .samp li.ok{border-color:${C.teal}}.samp li.todo{border-color:${C.amber}}.samp li.wait{border-color:#C0392B}
  .sum{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:15px}
  .sum th,.sum td{padding:10px 12px;border-top:1px solid var(--line);text-align:left}.sum th{background:${C.ink};color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:.05em}
  footer{color:var(--soft);font-size:13px;padding:30px 24px 60px}
`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fiverr gigs preview: ${esc(profile.name)}</title><style>${css}</style></head><body>
<div class="note"><b>Preview only, not posted.</b> This is how the seven gigs read to a buyer. Words live in <code>gigs.mjs</code>; rebuild with <code>node matthew/fiverr/build.mjs</code>. Prices are starting prices, to raise after about 10 good reviews.</div>
<header class="pro"><div class="w"><div class="bigav">MS</div><div>
  <h1>${esc(profile.name)}</h1><div class="hl">${esc(profile.headline)}</div><p class="about">${esc(profile.about)}</p>
  <div class="meta">${esc(profile.location)} &middot; ${esc(profile.languages)} &middot; About: ${profile.about.length} characters</div></div></div></header>
<main class="w" style="padding:0 24px">
  <h2 class="sec">Gigs</h2>
  <div class="grid">${gigs.map(gigCard).join('')}</div>
  <h2 class="sec">Prices at a glance</h2>
  <table class="sum"><tr><th>Gig</th><th>Basic</th><th>Standard</th><th>Premium</th></tr>
  ${gigs.map((g) => `<tr><td><a href="#${g.slug}">${esc(g.cover.kicker)}</a></td>${g.packages.map((p) => `<td><b>${money(p.price)}</b> <small style="color:var(--soft)">${p.days}d</small></td>`).join('')}</tr>`).join('')}
  </table>
  ${gigs.map((g, i) => gigDetail(g, checks[i])).join('')}
</main>
<footer class="w">Built ${new Date().toISOString().slice(0, 10)}. Gallery key: green = ready or his own work, amber = still to make, red = needs someone's OK first.</footer>
</body></html>`;
writeFileSync(join(HERE, 'preview.html'), html);

// ---- listing sheet: every field, in the order Fiverr's gig form asks for it (paste from here) ----
const L = [];
L.push('# Fiverr listing sheet (generated by build.mjs from gigs.mjs; edit gigs.mjs, not this)', '');
L.push('Limits used: title 80 (under 50 shows in full on the card), description 1,200, package description 100, 5 tags of 20 or fewer.');
L.push("Category, service type and metadata are the closest names found; Fiverr's dropdowns may word them slightly differently, so pick the nearest.", '');
L.push('## Profile', '', '- **Name:** ' + profile.name, '- **Description (' + profile.about.length + '/600):**', '', '> ' + profile.about, '');
for (const g of gigs) {
  const d = descText(g);
  L.push('---', '', '## ' + g.cover.kicker, '');
  L.push('### 1. Overview', '');
  L.push('- **Title (' + g.title.length + '/80):** ' + g.title);
  L.push('- **Category:** ' + g.category, '- **Subcategory:** ' + g.subcategory, '- **Service type:** ' + g.serviceType);
  L.push('- **Gig metadata:**'); for (const m of g.metadata) L.push('  - ' + m);
  L.push('- **Search tags (5):** ' + g.tags.map((t) => t + ' (' + t.length + ')').join(' · '), '');
  L.push('### 2. Pricing', '', '| | Basic | Standard | Premium |', '|---|---|---|---|');
  L.push('| Name | ' + g.packages.map((p) => p.name).join(' | ') + ' |');
  L.push('| Description | ' + g.packages.map((p) => p.desc + ' (' + p.desc.length + '/100)').join(' | ') + ' |');
  L.push('| Delivery | ' + g.packages.map((p) => p.days + ' day' + (p.days > 1 ? 's' : '')).join(' | ') + ' |');
  L.push('| Revisions | ' + g.packages.map((p) => p.revisions).join(' | ') + ' |');
  L.push('| Price | ' + g.packages.map((p) => '$' + p.price).join(' | ') + ' |', '');
  L.push('**Extras:** ' + g.extras.map((x) => x.name + ' +$' + x.price).join(' · '), '');
  L.push('### 3. Description and FAQ', '', '**Description (' + d.length + '/1200):**', '', '```', d, '```', '');
  for (const [qq, aa] of g.faq) L.push('- **' + qq + '** ' + aa);
  L.push('', '### 4. Requirements (questions for the buyer)', '');
  g.requirements.forEach((r, i) => L.push((i + 1) + '. ' + r));
  L.push('', '### 5. Gallery', '', '- Image 1: covers/' + g.slug + '.png', '- Then the samples in gallery/ and pdf/ that start with ' + g.slug, '');
}
writeFileSync(join(HERE, 'listing-sheet.md'), L.join('\n'));

for (const c of checks) console.log(`${c.ok ? 'ok ' : 'BAD'} ${c.slug.padEnd(16)} title ${c.t}${c.tCard ? '' : ' (over 50)'}  description ${c.d}`);
console.log(`about ${profile.about.length} characters`);
