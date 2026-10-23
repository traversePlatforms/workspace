/* Sixfold — build the team share folder.

   Copies the PDFs the crew actually needs into `sixfold/team-share/files/`,
   renamed to something readable and grouped into numbered folders, ready to drag
   into the Google Drive shared folder.

     node sixfold/team-share/build-team-share.mjs

   WHY A SCRIPT AND NOT A ONE-OFF COPY. The originals keep moving — a source .html
   gets corrected, html-to-pdf rebuilds the PDF, and a hand-made copy in a share
   folder silently becomes the stale one that everybody reads. Re-run this after
   any PDF rebuild and the share folder is current again. It also fails loudly if
   a source has disappeared, which a drag-and-drop never does.

   The originals are NOT moved. Every file below exists in both places, which is
   what was asked for.

   WHAT IS DELIBERATELY NOT IN HERE — see EXCLUDED at the foot of this file. That
   list is the important half of this script: it is the reasoning for why a file
   a crew member might expect to find is missing, so nobody re-adds it by
   accident.
*/
import { mkdir, copyFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIXFOLD = resolve(HERE, '..');
const OUT = join(HERE, 'files');

/* [ source relative to sixfold/ , destination folder ('' = top level) , destination name ] */
const FILES = [
  /* Sorts above the numbered folders in Drive, which is the whole reason for the
     leading "00". Page 2 of it is the one that matters — what is deliberately NOT
     in the folder, the blank-cancellation-date warning, and the no-launch-offer rule.
     Rebuild it with
     `node tools/html-to-pdf.mjs index-sheet` after editing index-sheet.html. */
  ['team-share/index-sheet.pdf',
   '',
   '00 START HERE - what is in this folder.pdf'],
  /* The field guide (2026-10-13): built from sixfold/training, the same lessons as the app's Training. Top level, beside START
     HERE, because it is the first thing new crew should read. Rebuild: node training/build-field-guide.mjs, then
     node tools/html-to-pdf.mjs Field-Guide. */
  ['training/Sixfold-Field-Guide.pdf',
   '',
   '00 FIELD GUIDE - how we knock, what we say, what we never say (INTERNAL).pdf'],

  // ---- 01 What we do -----------------------------------------------------
  ['../_archive/pricing-sheets-2026-09-30/Sixfold-Services-Sheet-D.pdf',   /* archived 2026-09-30 (d232333) but still shared; Matthew to decide (flagged 2026-10-13) */
   '01 What we do',
   'What Sixfold does - services, no prices.pdf'],

  // ---- 02 Safety and compliance -----------------------------------------
  ['research/Sixfold-Crew-Safety-and-Compliance.pdf',
   '02 Safety and compliance',
   'Crew safety and compliance - OSHA, licences, certs.pdf'],
  ['operations/gear-checklist.pdf',
   '02 Safety and compliance',
   'Gear checklist.pdf'],
  ['operations/crew-shirt-spec.pdf',
   '02 Safety and compliance',
   'Crew shirt spec.pdf'],

  // ---- 03 Forms you fill in on a job ------------------------------------
  ['operations/Sixfold-Quote-Walk-Sheet-FILLABLE.pdf',
   '03 Forms for a job',
   'Quote walk sheet - fill in on screen.pdf'],
  ['operations/quote-walk-sheet.pdf',
   '03 Forms for a job',
   'Quote walk sheet - print and write on.pdf'],
  ['operations/job-closeout.pdf',
   '03 Forms for a job',
   'Job close-out sheet - fill in the day the job ends.pdf'],
  ['operations/Sixfold-What-The-Work-Takes-FILLABLE.pdf',
   '03 Forms for a job',
   'What the work takes - fill in on screen.pdf'],
  ['operations/Sixfold-What-Things-Cost-FILLABLE.pdf',
   '03 Forms for a job',
   'What things cost us - fill in on screen (internal).pdf'],

  // ---- 04 Hand to the customer -------------------------------------------
  ['marketing/Sixfold-Home-Wildfire-Pamphlet.pdf',
   '04 Hand to the customer',
   'Preparing your home for wildfire - pamphlet.pdf'],
  ['marketing/funding-one-pager.pdf',
   '04 Hand to the customer',
   'Who pays for wildfire mitigation - funding sheet.pdf'],
  ['marketing/Sixfold-Referral-Packet-TEMPLATE.pdf',
   '04 Hand to the customer',
   'Referral packet - blank template for the end of a job.pdf'],
  ['../_archive/pricing-sheets-2026-09-30/Sixfold-Services-Sheet-D.pdf',   /* archived 2026-09-30 (d232333) but still shared; Matthew to decide (flagged 2026-10-13) */
   '04 Hand to the customer',
   'What Sixfold does - services, no prices.pdf'],

  // ---- 05 Talking about money --------------------------------------------
  ['tax-credit-notebook/reference-notebook.pdf',
   '05 Talking about money',
   'Tax credit - reference notebook (what to say).pdf'],
  ['tax-credit-notebook/client-forms.pdf',
   '05 Talking about money',
   'Tax credit - forms the customer needs.pdf'],
  ['marketing/Sixfold-Ad-Script-Kit.pdf',
   '05 Talking about money',
   'Script kit - what to say and what never to say.pdf'],

  // ---- 07 Agreements ------------------------------------------------------
  // Added 2026-09-18. These were excluded while their Notice of Cancellation still
  // carried the Englewood address; that was corrected the same day, so the reason is
  // gone and the crew needs them. Both crib sheets ship beside them on purpose.
  ['agreements/service-agreement.pdf',
   '07 Agreements',
   'Service agreement - FIRE MITIGATION (5 pages, print all of them).pdf'],
  ['agreements/landscaping-agreement.pdf',
   '07 Agreements',
   'Service agreement - LANDSCAPING (5 pages, print all of them).pdf'],
  ['agreements/service-agreement-tablet.pdf',
   '07 Agreements',
   'Service agreement - tablet version, pages 1-3 only.pdf'],
  ['agreements/field-instructions.pdf',
   '07 Agreements',
   'Crib sheet - signing at the DOOR (INTERNAL).pdf'],
  ['agreements/remote-signing.pdf',
   '07 Agreements',
   'Crib sheet - EMAILING an agreement to sign (INTERNAL).pdf'],
  // Added 2026-09-28. The short forms, for the small recurring lawn work the
  // five-page packet is the wrong shape for. Blank templates, no price printed
  // and no customer named, so they clear both standing exclusions.
  ['agreements/lawn-job-sheet.pdf',
   '07 Agreements',
   'Lawn job sheet - ONE JOB (3 pages, print all of them).pdf'],
  ['agreements/lawn-monthly-agreement.pdf',
   '07 Agreements',
   'Lawn care agreement - MONTHLY rolling (4 pages, print all of them).pdf'],
  // ---- 08 Events ----------------------------------------------------------
  ['operations/Sixfold-Event-Signup-Sheet.pdf',
   '08 Events',
   'Event sign-up sheet - print one per 13 people.pdf'],
  // ---- 06 Look it up ------------------------------------------------------
  ['research/Sixfold-Debris-Disposal-Directory.pdf',
   '06 Look it up',
   'Debris disposal directory - where to dump, cheapest first.pdf'],
  ['research/Sixfold-Mitigation-Funding-Directory.pdf',
   '06 Look it up',
   'Mitigation funding directory - the programmes, by county.pdf'],
  // ---- 09 Pick the look ---------------------------------------------------
  // Added 2026-09-28. The brand exclusion below said a separate brand folder was
  // worth doing "later if anyone asks" — this is that. These are PROOFS, not
  // print files: the crew is being asked to choose, and the print PDFs stay out
  // so nobody can order straight from the share.
  /* the old Sixfold business-card proof came out 2026-10-23: the cards were chosen long ago and replaced by the Sixfold 365 cards
     (brand/combined-365-2026-10/print-ready/); the old sources are in _archive-2026-10-23-rebrand/ */
  ['brand/vehicle/proof.png',
   '09 Pick the look',
   'Vehicle magnets - GREEN set (aeration-led).png'],
  ['brand/vehicle/proof-fire.png',
   '09 Pick the look',
   'Vehicle magnets - EMBER set (the original).png'],
  ['brand/vehicle/season-study.png',
   '09 Pick the look',
   'Mark colour - season study, NOTHING APPLIED.png'],
];

/* Kept here rather than in a note, so that anyone reading the build list also
   reads the reasons. Each entry: what, and why it is out. */
const EXCLUDED = [
  ['Rate card, rate sheets A/B/C, work-rates, cost-rates',
   'Matthew, 2026-09-18. The card is named INTERNAL, two pricing files have carried ' +
   'do-not-quote banners since 2026-09-16, and the Sedalia job lost money. A crew with ' +
   'rates in a shared Drive will quote from them.'],

  ['Every file naming a real customer — the Kara and Sedalia quotes and agreements, ' +
   'and both _part-*.pdf',
   'Matthew, 2026-09-18. Real names, real addresses, real prices. Nobody needs them to ' +
   'do the job, and _part-* files are never-send by construction.'],

  ['The blank service agreements — NO LONGER EXCLUDED, they are in folder 07',
   'They were blocked while their Notice of Cancellation still printed the Englewood ' +
   'address, which under 16 CFR 429 and C.R.S. 5-3-401 would have left a job voidable ' +
   'for THREE YEARS. Corrected 2026-09-18 to 17890 Sierra Way, Monument, CO 80132, so ' +
   'the reason is gone. Both crib sheets ship in the same folder on purpose: the ' +
   'three-year exposure comes from a blank date on a cancellation form, not from the ' +
   'contract wording, and no amount of correct drafting protects against that.'],

  ['launch-flyers.pdf',
   'The two flyers carry different, incompatible launch offers and Brandon has not ' +
   'picked one; the minimum job size is not set for either. A flyer in a shared folder ' +
   'gets printed. The script kit in folder 05 states the same position and deliberately ' +
   'leaves the offer out.'],

  ['marketing-plan.pdf, minimum-viable-start.pdf, platform-sheet.pdf',
   'Business planning, not crew material — competitor analysis, exposure, channel ' +
   'strategy. Also the register in the project notes: internal docs for the wider team ' +
   'stay lean and non-alarming.'],

  ['The two Sedalia agreement PDFs still carrying (720) 772-6146',
   'Excluded as customer files anyway, so the stale number does not reach anyone. They ' +
   'stay stale on purpose — rebuilding the fillable one loses 30 form fields and the ' +
   'DocuSign one has no generator. See agreements/README.md.'],

  ['brand/ PRINT files — the magnet and business-card PDFs themselves',
   'Still out, and deliberately. Folder 09 carries the PROOFS so the crew can choose; ' +
   'the print-ready PDFs stay with Matthew so nobody orders straight from the share. ' +
   'Nothing in 09 is ordered, and the descriptor on it still needs Brandon.'],

  ['⚑ STALE, and not fixed here: Services Sheet D leads with fire mitigation',
   'It is in folders 01 and 03 and it is the front-of-house sheet, but the company now ' +
   'leads with aeration. Replacing it is a copy job, not a share job, so it ships as it ' +
   'is and this line is the flag. Do not let the share be the reason nobody notices.'],
];

/* ------------------------------------------------------------------------- */

const missing = FILES.filter(([src]) => !existsSync(join(SIXFOLD, src)));
if (missing.length) {
  console.error('Source PDFs missing — build them first:\n');
  for (const [src] of missing) console.error('  ' + src);
  process.exit(1);
}

/* Rebuild from scratch so a file removed from FILES actually disappears from the
   share folder, instead of lingering as the copy nobody meant to keep. */
if (existsSync(OUT)) await rm(OUT, { recursive: true });

let bytes = 0;
for (const [src, folder, name] of FILES) {
  const destDir = join(OUT, folder);
  await mkdir(destDir, { recursive: true });
  const from = join(SIXFOLD, src);
  await copyFile(from, join(destDir, name));
  bytes += (await stat(from)).size;
}

const folders = [...new Set(FILES.map(f => f[1]))].filter(Boolean);
console.log(`Team share built — ${FILES.length} files in ${folders.length} folders, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
for (const f of folders) {
  const n = FILES.filter(x => x[1] === f).length;
  console.log(`  ${f.padEnd(26)} ${n}`);
}
console.log(`\nDeliberately excluded (${EXCLUDED.length} groups) — reasons in this script and in README.md.`);
console.log(`Drag sixfold/team-share/files/* into the Drive folder.`);
