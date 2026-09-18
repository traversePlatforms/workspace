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
     leading "00". Page 2 of it is the one that matters — the Englewood
     cancellation-notice warning and the no-launch-offer rule. Rebuild it with
     `node tools/html-to-pdf.mjs index-sheet` after editing index-sheet.html. */
  ['team-share/index-sheet.pdf',
   '',
   '00 START HERE - what is in this folder.pdf'],

  // ---- 01 What we do -----------------------------------------------------
  ['marketing/Sixfold-Services-Sheet-D.pdf',
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
  ['agreements/field-instructions.pdf',
   '03 Forms for a job',
   'Signing at the door - crib sheet (INTERNAL, do not hand over).pdf'],

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
  ['marketing/Sixfold-Services-Sheet-D.pdf',
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

  // ---- 06 Look it up ------------------------------------------------------
  ['research/Sixfold-Debris-Disposal-Directory.pdf',
   '06 Look it up',
   'Debris disposal directory - where to dump, cheapest first.pdf'],
  ['research/Sixfold-Mitigation-Funding-Directory.pdf',
   '06 Look it up',
   'Mitigation funding directory - the programmes, by county.pdf'],
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

  ['service-agreement.pdf and service-agreement-tablet.pdf (the blank templates)',
   'BLOCKED, not an oversight. Both print the Englewood address as the seller\'s place ' +
   'of business, including on the Notice of Cancellation. Under 16 CFR 429 and ' +
   'C.R.S. 5-3-401 a defective notice leaves the job voidable for THREE YEARS. They ' +
   'cannot be corrected until the Monument street address exists, and they must not be ' +
   'part-changed. Putting them where someone could print one is the risk. The crib ' +
   'sheet in folder 03 explains the rules without being a signable form.'],

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

  ['brand/ files — marks, magnets, business cards, social review sheets',
   'Ordering and proofing artefacts, not things a crew member needs on a job. Worth a ' +
   'separate brand folder later if anyone asks.'],
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
