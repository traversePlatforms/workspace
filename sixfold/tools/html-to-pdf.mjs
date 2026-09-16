/*
  Prints the sixfold HTML documents to PDF with headless Chrome over CDP.

  Why CDP and not `chrome --print-to-pdf`: the flag gives no control over
  background printing or the emulated colour scheme, and every document in this
  project is dark-first. Backgrounds must print (the brand proofs are bone text
  on pine — without backgrounds they come out invisible), and the colour scheme
  has to be chosen per document rather than inherited from whatever the machine
  is set to.

  No dependencies. Node 24 has a global WebSocket, which is all CDP needs.

  Run:  node tools/html-to-pdf.mjs            # every job in JOBS
        node tools/html-to-pdf.mjs ridge-mark # jobs whose out name matches

  After any edit to a source .html, re-run this and LOOK at the PDF. Screen
  height does not predict page fit.
*/
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/* mode: which colour scheme the document is printed in.
   'light' — the document defines light tokens or a print register; print light.
   'dark'  — the document has no light palette, or is a proof of assets that
             only make sense on the dark ground. */
const JOBS = [
  /* Path corrected 2026-09-14 — the review page is generated into `out/`, and the
     stale path here threw on job #1 and so blocked every other job in the list. */
  { src: 'brand/social/out/review.html',        out: 'brand/social/review.pdf',                   mode: 'dark'  },
  { src: 'brand/ridge-lineage.html',            out: 'brand/ridge-lineage.pdf',                   mode: 'light' },
  { src: 'brand/ridge-mark.html',               out: 'brand/ridge-mark.pdf',                      mode: 'light' },
  /* scale: the one-pager carries its own @page rule and an 8.5in sheet. At the
     default 0.8 it spills its footer disclaimer onto a second page, which
     defeats the point of a one-pager. 0.76 lands it on one, checked by
     counting pages, not by eye. */
  { src: 'marketing/funding-one-pager.html',    out: 'marketing/funding-one-pager.pdf',           mode: 'light', scale: 0.76 },
  /* Named for sending — a personalised cost-recovery guide for one property
     owner (Lonnie, Sedalia), handed on by Brandon. Full light print register in
     the source; program cards carry the structure, so the shared
     `.prog { break-inside: avoid }` hygiene below matters. */
  { src: 'marketing/sedalia-owner-funding-guide.html', out: 'marketing/Sixfold-Sedalia-Mitigation-Funding-Guide.pdf', mode: 'light', scale: 0.9,
    css: '.prog, .callout { break-inside: avoid-page; }' },
  /* css: document-specific print rules, injected on top of the shared block
     below. A flyer proof cut across a page break is worse than a short page —
     the whole point of the page is what the flyer looks like whole. */
  { src: 'marketing/launch-flyers.html',        out: 'marketing/launch-flyers.pdf',               mode: 'light',
    css: '.flyer, .board-col { break-inside: avoid-page; }' },
  { src: 'marketing/marketing-plan.html',       out: 'marketing/marketing-plan.pdf',              mode: 'light' },
  /* Named for sending, like the rate sheets — this one goes to a person
     rather than sitting beside its source for reference. */
  { src: 'marketing/ad-script-kit.html',        out: 'marketing/Sixfold-Ad-Script-Kit.pdf',       mode: 'light' },
  { src: 'marketing/minimum-viable-start.html', out: 'marketing/minimum-viable-start.pdf',        mode: 'light' },
  { src: 'marketing/platform-sheet.html',       out: 'marketing/platform-sheet.pdf',              mode: 'light' },
  /* css: `ol.next li` is a two-column grid (number, text). A grid item that
     lands on a page boundary collapses its 1fr column to one word per line in
     Chrome's print layout — the last two pages came out as a ribbon of single
     words. Blocking the item out for print keeps the numbers and reads fine. */
  { src: 'research/logo-prior-use-screen.html', out: 'research/logo-prior-use-screen.pdf',        mode: 'light',
    css: 'ol.next li { display: block; }' },
  /* The disposal directory. Named for sending — this goes to the Sixfold crew,
     not into a reference binder. It carries its own @page rule and a full light
     print register; it is table-heavy, so the shared `tr { break-inside: avoid }`
     hygiene below matters. Long by design (13 regions + ranking + fact-check) —
     check it reads cleanly, don't count on a target page number. */
  { src: 'research/debris-disposal-directory.html', out: 'research/Sixfold-Debris-Disposal-Directory.pdf', mode: 'light' },
  /* The mitigation-funding reference — every way a Colorado owner gets money
     back on the work, for the office and crew (not a customer handout). Own
     @page rule + full light print register; program cards and the eligibility
     matrix carry the structure, so the shared `tr { break-inside: avoid }` and
     `.prog { break-inside: avoid }` hygiene matter. Long by design. */
  { src: 'research/mitigation-funding-directory.html', out: 'research/Sixfold-Mitigation-Funding-Directory.pdf', mode: 'light' },
  /* Customer quotes. Named for sending, like the rate sheets and the ad script
     kit — these go to a homeowner, not into a binder. Both must come out at
     exactly TWO pages (they were one until the 2026-08-28 reprice, which added
     the documentation service and the fuller breakdowns).

     The rule that mattered is about WHERE the conditions sit, not the count:
     the price must never be on one sheet with the terms it is conditional on
     on another, which is the arrangement every complaint starts with. So page
     1 carries scope, price, exclusions and every term, and page 2 carries only
     the paperwork block and the other option — neither of which changes what
     she pays. If an edit pushes anything off page 1, trim page 1; do not let
     it spill.

     Check the page count after any edit, do not eyeball the screen height — an
     overflowing sheet pushes its footer alone onto a page of its own, which
     looks like a two-page quote until you count. */
  { src: 'quotes/sedalia-haul-off.html',        out: 'quotes/Sixfold-Quote-Sedalia-A-Hauled-Away.pdf',    mode: 'light' },
  { src: 'quotes/sedalia-chip-on-site.html',    out: 'quotes/Sixfold-Quote-Sedalia-B-Chipped-On-Site.pdf', mode: 'light' },

  /* Job 2 — yard clearance, trimming and planting. Walked by Brandon 2026-09-14.
     Quote is ONE page and the agreement is FIVE; re-count after any edit. */
  /* The two quote renders below share ONE source and differ only in their closing
     sentence — see the comment on .ifpacket/.ifsolo in the quote source. This one
     is bound behind the agreement, so "follows overleaf" is true here. */
  { src: 'quotes/job2-yard-clearance.html',     out: 'quotes/_part-quote-only.pdf',           mode: 'light', scale: 0.84,
    css: '.ifsolo { display: none; }' },  /* 0.86 spills to 2 pages once the walk-round note is in — 0.84 is the ceiling */
  { src: 'agreements/job2-service-agreement.html', out: 'agreements/_part-service-agreement.pdf', mode: 'light' },
  /* Same source again under a sendable name. Added 2026-09-15: Matthew asked for a
     standalone quote he can send on its own, separate from the DocuSign packet. It
     cannot be the _part- file — that prefix means "intermediate, never send", and
     the one time a _part- file looked like a deliverable the quote went out without
     its agreement. Nothing follows this one, so it hides the overleaf sentence.
     Keep `scale` in step with the render above or the two will not match. */
  { src: 'quotes/job2-yard-clearance.html',     out: 'quotes/Sixfold-Quote-Kara-Rosenstrauch.pdf', mode: 'light', scale: 0.84,
    css: '.ifpacket { display: none; }' },

  /* Field sheets. Internal, printed and written on with a pen, so they want the
     light print register like everything else in the binder. Four sheets, one
     printed page each — count them after any edit. */
  { src: 'operations/quote-walk-sheet.html',    out: 'operations/quote-walk-sheet.pdf',           mode: 'light' },
  { src: 'operations/job-closeout.html',        out: 'operations/job-closeout.pdf',               mode: 'light' },
  { src: 'operations/work-rates.html',          out: 'operations/work-rates.pdf',                 mode: 'light' },
  /* Two pages by content, not by overflow — 0.68 did not save it, so the scale is
     back near the default for readable type. */
  { src: 'operations/crew-shirt-spec.html',     out: 'operations/crew-shirt-spec.pdf',            mode: 'light', scale: 0.78 },
  { src: 'operations/business-cards.html',      out: 'operations/business-cards.pdf',             mode: 'light', scale: 1 },
  { src: 'research/crew-safety-and-compliance.html', out: 'research/Sixfold-Crew-Safety-and-Compliance.pdf', mode: 'light' },
  { src: 'marketing/referral-packet.html',       out: 'marketing/Sixfold-Referral-Packet-TEMPLATE.pdf', mode: 'light', scale: 1 },

  /* ---- added 2026-09-14 ----------------------------------------------------
     These thirteen PDFs already existed but had no job here, so they could not be
     rebuilt from their sources — which came to light during the phone-number
     sweep, when every one of them was carrying a superseded number.

     EXPECTED PAGE COUNTS, verified against the files as they stood before the
     sweep. These are contracts, rate sheets and binder sheets where the count is
     part of the document — if a rebuild changes one of these numbers, something
     else changed too. Do not ship it; find out what.
       service-agreement 5 · field-instructions 2 · service-agreement-tablet 3
       sedalia-A-service-agreement 5 · pamphlet 2 · rate card 9
       rate sheets A/B/C 1 each · services sheet D 1 · gear checklist 7
       reference notebook 7 · client forms 4                                   */
  { src: 'agreements/service-agreement.html',        out: 'agreements/service-agreement.pdf',              mode: 'light' },
  { src: 'agreements/field-instructions.html',       out: 'agreements/field-instructions.pdf',             mode: 'light' },
  { src: 'agreements/service-agreement-tablet.html', out: 'agreements/service-agreement-tablet.pdf',       mode: 'light' },
  { src: 'agreements/sedalia-A-service-agreement.html', out: 'agreements/sedalia-A-service-agreement.pdf', mode: 'light' },
  { src: 'marketing/home-wildfire-pamphlet.html', out: 'marketing/Sixfold-Home-Wildfire-Pamphlet.pdf', mode: 'light' },
  /* scale 1.0, not the default 0.8: at 0.8 the card comes out 7 pages instead of
     9 and the internal band stops starting its own page. Found by comparing
     against the pre-sweep file rather than by reading it. */
  { src: 'marketing/pricing-guide.html',         out: 'marketing/Sixfold-Rate-Card-INTERNAL.pdf',     mode: 'light', scale: 1.0 },
  { src: 'marketing/pricing-onesheet.html',      out: 'marketing/Sixfold-Rate-Sheet-A.pdf',          mode: 'light' },
  { src: 'marketing/pricing-onesheet-b.html',    out: 'marketing/Sixfold-Rate-Sheet-B.pdf',          mode: 'light' },
  { src: 'marketing/pricing-onesheet-c.html',    out: 'marketing/Sixfold-Rate-Sheet-C.pdf',          mode: 'light' },
  { src: 'marketing/services-onesheet-d.html',   out: 'marketing/Sixfold-Services-Sheet-D.pdf',      mode: 'light' },
  { src: 'operations/gear-checklist.html',       out: 'operations/gear-checklist.pdf',               mode: 'light' },
  { src: 'tax-credit-notebook/reference-notebook.html', out: 'tax-credit-notebook/reference-notebook.pdf', mode: 'light' },
  { src: 'tax-credit-notebook/client-forms.html',      out: 'tax-credit-notebook/client-forms.pdf',       mode: 'light' },

  /* NOT here, deliberately: `agreements/sedalia-A-service-agreement-fillable.pdf`
     carries **30 AcroForm fields** and printing it from HTML would flatten every
     one of them. It has no generator in this repo. See the sweep note in
     agreements/README.md. */
];

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!CHROME) throw new Error('No Chrome or Edge found');

const profile = mkdtempSync(join(tmpdir(), 'sixfold-pdf-'));
const PORT = 9333;

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('Chrome never opened its debugging port');
}

/* Minimal CDP client: send(method, params) over one socket, sessions addressed
   by sessionId so we can drive a page target through the browser socket. */
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const waiters = [];
  let id = 0;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      for (const w of waiters.splice(0)) w(msg);
    }
  });
  const ready = new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', bad, { once: true });
  });
  return {
    ready,
    close: () => ws.close(),
    send(method, params = {}, sessionId) {
      const msgId = ++id;
      return new Promise((ok, bad) => {
        pending.set(msgId, { resolve: ok, reject: bad });
        ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
      });
    },
    event(method, timeout = 30000) {
      return new Promise((ok, bad) => {
        const t = setTimeout(() => bad(new Error(`timeout waiting for ${method}`)), timeout);
        const tick = (msg) => {
          if (msg.method === method) { clearTimeout(t); ok(msg.params); }
          else waiters.push(tick);
        };
        waiters.push(tick);
      });
    },
  };
}

const filter = process.argv.slice(2);
const jobs = filter.length
  ? JOBS.filter((j) => filter.some((f) => j.out.includes(f)))
  : JOBS;
if (!jobs.length) throw new Error(`No jobs matched ${filter.join(', ')}`);

const cdp = connect(await endpoint());
await cdp.ready;

for (const job of jobs) {
  const src = join(root, job.src);
  if (!existsSync(src)) throw new Error(`missing source: ${job.src}`);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);

  await S('Page.enable');
  await S('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: job.mode }],
  });
  /* A wide viewport so `clamp()` type and any max-width grid land at their
     intended desktop size rather than the mobile fallback. */
  await S('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  const loaded = cdp.event('Page.loadEventFired');
  await S('Page.navigate', { url: pathToFileURL(src).href });
  await loaded;
  await sleep(900); // let webfonts, SVG and any layout settle

  /* Print hygiene, injected rather than written into the sources: these are
     screen documents and none of them should grow print furniture it does not
     use elsewhere. Kept deliberately conservative — headings stay with what
     follows them, and only small blocks are held whole. Telling a big card or
     a whole section not to break leaves half-empty pages. */
  await S('Runtime.evaluate', {
    expression: `(() => {
      const s = document.createElement('style');
      s.textContent = \`@media print {
        h1, h2, h3, h4, .eyebrow, .kicker, .label { break-after: avoid-page; }
        figure, tr, li, dt, dd, blockquote { break-inside: avoid-page; }
        img, svg { break-inside: avoid-page; }
        p { orphans: 3; widows: 3; }
        ${job.css ?? ''}
      }\`;
      document.head ? document.head.appendChild(s) : document.body.appendChild(s);
    })()`,
  });

  const { data } = await S('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.5,
    paperHeight: 11,
    marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4,
    scale: job.scale ?? 0.8,
  });

  const out = join(root, job.out);
  writeFileSync(out, Buffer.from(data, 'base64'));
  const pages = (readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`${job.out.padEnd(42)} ${job.mode.padEnd(5)} ${(data.length / 1365).toFixed(0).padStart(5)} KB  ${pages} pages`);

  await S('Page.close').catch(() => {});
}

cdp.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
