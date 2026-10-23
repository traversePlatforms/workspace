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
  /* 2026-10-23 (Sixfold 365 rebrand): the jobs for the door hanger, door flyers, the Sept flyers, launch flyers, aeration ad kit, content set,
     planning sheets and the old Sixfold business cards were removed with their sources, which moved to sixfold/_archive-2026-10-23-rebrand/. */
  /* Path corrected 2026-09-14 — the review page is generated into `out/`, and the
     stale path here threw on job #1 and so blocked every other job in the list. */
  { src: 'brand/social/out/review.html',        out: 'brand/social/review.pdf',                   mode: 'dark'  },
  { src: 'brand/ridge-lineage.html',            out: 'brand/ridge-lineage.pdf',                   mode: 'light' },
  { src: 'brand/ridge-mark.html',               out: 'brand/ridge-mark.pdf',                      mode: 'light' },
  /* The rebrand concept board. Printed light so it can go on a table in front of
     the team; the mark tiles carry their own grounds, so the Pine tiles stay dark
     on the page and the backgrounds must print. */
  { src: 'brand/rebrand-2026-09/concepts.html', out: 'brand/rebrand-2026-09/Sixfold-Rebrand-Concepts.pdf', mode: 'light', scale: 0.76,
    css: '.concept, .palcard, .small-test, .lock { break-inside: avoid-page; }' },
  /* The tagline decision sheet for the same meeting. Light, because it goes on the
     table beside the concept board; it carries its own @page rule and print sizing,
     so it does not want the default 0.8 shrink on top. FIVE pages — four tables and
     the fact-check log. Sections are deliberately NOT held whole: the first render
     did that and lost 40% of page 1 keeping one section together. */
  { src: 'brand/tagline-2026-09/tagline.html', out: 'brand/tagline-2026-09/Sixfold-Tagline-Decision.pdf', mode: 'light', scale: 1 },
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
  /* Three Letter flyers, one message each, NO offer on any of them — which is why
     they are not blocked the way launch-flyers.html is. scale 1: each page is a full
     8.5x11 sheet with its own @page, and 0.8 would float a shrunken flyer on a page. */
  /* Door hanger, 4.25x11, front and back. Its own @page size, so scale MUST be 1.
     The top 2.6in is a keep-out for the vendor's die-cut hole. */
  /* The door-to-door leave-behind. TWO per Letter sheet, cut across the middle —
     ONE page, two identical 8.5x5.5 flyers. Own @page, so scale MUST be 1.

     Printed on Sixfold's own printer in volume, so it is built to be cheap: no
     background fills, no photographs, one accent in hairlines and the mark.

     MONO IS THE ONE TO PRINT. The accent lives in a single CSS custom property
     precisely so the mono build can flatten it to black in one override, rather
     than the file being maintained twice and drifting. */
  /* The mono build also swaps the QR. CSS cannot recolour a raster, so the branded
     code's green centre mark would survive into a mono print as a grey halftone —
     the one thing on the page that would not have gone black. `content:url()` swaps
     it for sixfold-qr-print-black.png, which is pure black on white and the
     maximum-reliability variant. So mono is now cheaper AND scans better. */
  /* The index that sits at the top of the Google Drive team folder. TWO pages by
     content, not by overflow: page 1 is what is in the folder, page 2 is what is
     deliberately not and why. Page 2 is the one that matters — it carries the
     Englewood cancellation-notice warning and the no-launch-offer rule. */
  { src: 'team-share/index-sheet.html',         out: 'team-share/index-sheet.pdf',                mode: 'light' },
  /* Named for sending, like the rate sheets — this one goes to a person
     rather than sitting beside its source for reference. */
  { src: 'marketing/ad-script-kit.html',        out: 'marketing/Sixfold-Ad-Script-Kit.pdf',       mode: 'light' },
  /* The aeration companion to the kit above. Same style sheet, same light print
     register, and it goes to Brad the same way. */
  /* The homeowner content set, six posts. Added 2026-09-25 — it had no PDF job
     before, only the designed HTML and its artifact. */
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
  /* The two Sedalia quotes and the Sedalia agreement were archived 2026-09-30 to
     _archive/sedalia-job-2026-09-30/ — job closed. Their JOBS entries went with
     them; restore from the manifest there if the job ever reopens. */

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

  /* Kara, aeration job, 12 October 2026. Same two-render arrangement as job 2
     above: the _part- file goes behind the agreement in the DocuSign packet and
     says "follows overleaf"; the sendable one stands alone and does not. Keep the
     two `scale` values in step or the packet will not match the standalone. */
  { src: 'quotes/kara-aeration.html', out: 'quotes/_part-quote-aeration.pdf', mode: 'light', scale: 0.84,
    css: '.ifsolo { display: none; }' },
  { src: 'quotes/kara-aeration.html', out: 'quotes/Sixfold-Quote-Aeration-Kara-Rosenstrauch.pdf', mode: 'light', scale: 0.84,
    css: '.ifpacket { display: none; }' },

  /* Kara, the twelve-month maintenance agreement. Same two-render arrangement.
     Its agreement is SIX pages, so the packet is seven, not six. */
  { src: 'quotes/kara-maintenance.html', out: 'quotes/_part-quote-maintenance.pdf', mode: 'light', scale: 0.84,
    css: '.ifsolo { display: none; }' },
  { src: 'quotes/kara-maintenance.html', out: 'quotes/Sixfold-Quote-Maintenance-Kara-Rosenstrauch.pdf', mode: 'light', scale: 0.84,
    css: '.ifpacket { display: none; }' },

  /* Brian Skelton, aeration job, 2026-10-05. Packet only: no standalone quote (Matthew opened the standalone and found no agreement). */
  { src: 'quotes/brian-aeration.html', out: 'quotes/_part-quote-brian.pdf', mode: 'light', scale: 0.84,
    css: '.ifsolo { display: none; }' },

  /* The Sixfold Field Guide (2026-10-13): built from the training lessons; the app serves the PDF to signed-in crew. Internal. */
  { src: 'training/field-guide.html', out: 'training/Sixfold-Field-Guide.pdf', mode: 'light', scale: 1, margin: 0.45 },

  /* Joe Willis, tree removal + haul-off, 2026-10-12. Standalone only: no agreement built yet. NOT SENT. */
  { src: 'quotes/joe-willis-tree-removal.html', out: 'quotes/Sixfold-Quote-Tree-Removal-Joe-Willis.pdf', mode: 'light', scale: 0.84 },

  /* Field sheets. Internal, printed and written on with a pen, so they want the
     light print register like everything else in the binder. Four sheets, one
     printed page each — count them after any edit. */
  { src: 'operations/quote-walk-sheet.html',    out: 'operations/quote-walk-sheet.pdf',           mode: 'light' },
  { src: 'operations/job-closeout.html',        out: 'operations/job-closeout.pdf',               mode: 'light' },
  { src: 'operations/invoice-example.html',    out: 'operations/invoice-example.pdf',            mode: 'light' },
  { src: 'operations/work-rates.html',          out: 'operations/work-rates.pdf',                 mode: 'light' },
  /* added 2026-10-23 (Sixfold 365 rebrand): one sheet here; a plain chrome --print-to-pdf gives it two */
  { src: 'agreements/remote-signing.html',      out: 'agreements/remote-signing.pdf',             mode: 'light' },
  /* Event sign-up sheet. scale: 1 and ONE page are both the spec — the row height is
     0.54in on purpose (13.7mm, larger than wide-rule paper) because it is filled in
     standing up. If it ever renders at 2 pages, something grew; do not fix it by
     shrinking the rows. */
  { src: 'operations/event-signup-sheet.html',  out: 'operations/Sixfold-Event-Signup-Sheet.pdf',  mode: 'light', scale: 1 },
  /* Discussion piece for the 2026-09-29 team meeting, not a finished system —
     the gaps are on the sheet on purpose. scale 1: it is written to one page. */
  { src: 'operations/door-territory.html',      out: 'operations/Sixfold-Door-Territory.pdf',     mode: 'light', scale: 1 },
  /* The crew walk list. Generated by traverse/data-pipeline/door-territory/build-walklist-pdf.mjs (the app moved out of sixfold/ 2026-10-04), which
     spawns this tool itself — the HTML filename is fixed so this entry can be. */
  { src: '../traverse/data-pipeline/door-territory/walklist-print.html', out: '../traverse/data-pipeline/door-territory/Sixfold-Walk-List.pdf', mode: 'light', scale: 1 },
  /* Two pages by content, not by overflow — 0.68 did not save it, so the scale is
     back near the default for readable type. */
  { src: 'operations/crew-shirt-spec.html',     out: 'operations/crew-shirt-spec.pdf',            mode: 'light', scale: 0.78 },
  /* The FedEx print file: two pages at exactly 3.75 x 2.25 in (trim + bleed), Pine
     bleeding to the edge. scale: 1 is the whole point — 0.8 would print the card at
     80% inside a full page. The @page rule in the source sets the size. */
  /* Four options as of 2026-09-28 pm — two palettes across two grounds — so the
     crew can pick. All from build-cards.mjs; the hand-written single card is gone. */
  /* THE CHOSEN CARD, 2026-09-29 — the cascading mark (casc-2-wide), the lockup
     grown, and the QR on the back. From build-card-final.mjs. This is the one to
     give a printer; the four above are the options it was chosen from. */
  /* ONE CARD PER PERSON, 2026-10-01 (SX-4b). From build-card-person.mjs, which is
     the card above with the name, number and colourway lifted out. Brandon's is
     regenerated only as a regression check — his cards are printed. ⚑ Matthew's is
     the first card on a LIGHT ground, so it prints mode 'light'; giving it 'dark'
     renders Bone-on-Bone and the card comes out blank. */
  /* Vehicle magnets, 2026-09-16 — each page carries its own @page size (24.25 x
     12.25 / 18.25 in with bleed), which preferCSSPageSize honours; scale must be
     1 so an inch is an inch. Print-ready: the vendor gets the PDF as is. */
  { src: 'brand/vehicle/magnet-24x12.html',       out: 'brand/vehicle/magnet-24x12.pdf',           mode: 'dark',  scale: 1 },
  { src: 'brand/vehicle/magnet-24x18.html',       out: 'brand/vehicle/magnet-24x18.pdf',           mode: 'dark',  scale: 1 },
  { src: 'brand/vehicle/magnet-24x12-light.html', out: 'brand/vehicle/magnet-24x12-light.pdf',     mode: 'light', scale: 1 },
  /* The ember family, 2026-09-28: the pre-rebuild fire-mitigation artwork kept as
     parallel files so the crew can choose between the two layouts. Same sizes, same
     print spec; only the palette and the copy differ. */
  { src: 'brand/vehicle/magnet-24x12-fire.html',       out: 'brand/vehicle/magnet-24x12-fire.pdf',       mode: 'dark',  scale: 1 },
  { src: 'brand/vehicle/magnet-24x18-fire.html',       out: 'brand/vehicle/magnet-24x18-fire.pdf',       mode: 'dark',  scale: 1 },
  { src: 'brand/vehicle/magnet-24x12-fire-light.html', out: 'brand/vehicle/magnet-24x12-fire-light.pdf', mode: 'light', scale: 1 },
  { src: 'research/crew-safety-and-compliance.html', out: 'research/Sixfold-Crew-Safety-and-Compliance.pdf', mode: 'light' },
  /* Water restrictions across the towns on the walk lists. Internal — it names
     what we have not checked, which is the point of it. Tables carry the content,
     so the shared table break hygiene below matters more than usual. */
  { src: 'research/water-restrictions-2026.html', out: 'research/Sixfold-Water-Restrictions-2026.pdf', mode: 'light' },
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
  /* scale: 1 explicitly, and it must stay. 16 CFR 429.1 sets a TEN POINT floor on the
     bold statutory statement and on the Notice of Cancellation. The stylesheet sets both
     at 10.5pt, which leaves only half a point of headroom. Measured 2026-09-18: the
     widest ruled box renders 7.400in on paper, exactly the CSS content width, so nothing
     is being scaled today and 10.5pt is what prints. But the default in this tool is 0.8,
     and 10.5 x 0.8 = 8.4pt would be a defective notice. Pin it. */
  { src: 'agreements/service-agreement.html',        out: 'agreements/service-agreement.pdf',              mode: 'light', scale: 1 },
  /* The landscaping twin. Same five pages, same statutory pages 3-5 verbatim — only
     sections 2 and 3 and clauses 1, 2, 3, 5 differ. scale: 1 for the same reason as
     above: the ten point floor applies to this document identically. */
  { src: 'agreements/landscaping-agreement.html',    out: 'agreements/landscaping-agreement.pdf',          mode: 'light', scale: 1 },
  { src: 'agreements/field-instructions.html',       out: 'agreements/field-instructions.pdf',             mode: 'light' },
  /* Companion to the door crib sheet, for when the agreement is emailed instead.
     ONE page is the spec. */
  { src: 'agreements/remote-signing.html',           out: 'agreements/remote-signing.pdf',                 mode: 'light' },
  { src: 'agreements/service-agreement-tablet.html', out: 'agreements/service-agreement-tablet.pdf',       mode: 'light' },
  /* Kara, 2026-09-25. Two documents: the aeration job and the twelve-month
     maintenance agreement. FIVE pages each — re-count after any edit, and note the
     maintenance one carries four more clauses than the template, which is the thing
     most likely to push sheet 3 onto a sixth page.

     scale: 1 for the same reason as service-agreement above, and it is not optional:
     .legal10 and .noticeform p are 10.5pt, the statutory floor is 10pt, and this
     tool's default 0.8 would print them at 8.4pt — a defective notice, which under
     C.R.S. 5-3-403(3) leaves the sale cancellable for three years rather than three
     days. */
  { src: 'agreements/kara-aeration-agreement.html',   out: 'agreements/kara-aeration-agreement.pdf',   mode: 'light', scale: 1 },
  { src: 'agreements/kara-maintenance-agreement.html', out: 'agreements/kara-maintenance-agreement.pdf', mode: 'light', scale: 1 },
  /* Brian Skelton, 2026-10-05. Same statutory reason for scale 1. FIVE pages. */
  { src: 'agreements/brian-aeration-agreement.html', out: 'agreements/_part-agreement-brian.pdf', mode: 'light', scale: 1 },
  /* The short lawn forms, 2026-09-28. Same statutory reason for scale 1 as the two
     Kara documents above — both carry .legal10 and the duplicate .noticeform.
     THREE pages each and that is the floor: one side of agreement, then the Notice
     of Cancellation twice, which 16 CFR 429.1(b) requires in duplicate at ten point
     and which will not fit two-to-a-side at a conformant size. If either comes out
     at four, sheet 1 has spilled — cut scope text, do not reduce the scale. */
  { src: 'agreements/lawn-job-sheet.html',        out: 'agreements/lawn-job-sheet.pdf',        mode: 'light', scale: 1, margin: 0.32 },
  { src: 'agreements/lawn-monthly-agreement.html', out: 'agreements/lawn-monthly-agreement.pdf', mode: 'light', scale: 1, margin: 0.32 },
  { src: 'marketing/home-wildfire-pamphlet.html', out: 'marketing/Sixfold-Home-Wildfire-Pamphlet.pdf', mode: 'light' },
  /* scale 1.0, not the default 0.8: at 0.8 the card comes out 7 pages instead of
     9 and the internal band stops starting its own page. Found by comparing
     against the pre-sweep file rather than by reading it. */
  /* The four rate/service sheets A-D and the internal rate card were archived
     2026-09-30 to _archive/pricing-sheets-2026-09-30/. A, B and C carried prices
     off the rate card that lost money on Sedalia, plus stump grinding, crew time
     and the old county line; D carried no prices but its service list predates
     the aeration-led rebrand and omits the lead service. pricing-guide.md and
     services-onesheet-d.md stayed put as the records of both. */
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
    /* Per-job margins, defaulting to the 0.4in every document here was built
       against — omit `margin` and nothing changes. Needed because a document's
       own @page margin rule is NOT honoured: preferCSSPageSize takes the page
       SIZE from CSS and leaves these margins in charge, so an @page override in
       the source is silently a no-op and the only real control is here. */
    marginTop: job.margin ?? 0.4, marginBottom: job.margin ?? 0.4,
    marginLeft: job.marginX ?? job.margin ?? 0.4, marginRight: job.marginX ?? job.margin ?? 0.4,
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
