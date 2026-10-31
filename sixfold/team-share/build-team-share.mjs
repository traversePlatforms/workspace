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

   WHAT IS DELIBERATELY NOT IN HERE — see EXCLUDED below the build list. That
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

/* [ source relative to sixfold/ , destination folder ('' = top level) , destination name ]

   REORGANISED 2026-10-31 (Matthew: reorganise the Sixfold Drive). The Drive copy had not been
   refreshed since 2026-09-18, so the crew was reading the pre-Sixfold-365 versions. The folders
   were renumbered in the order the crew reaches for them now that the Sixfold 365 app runs the
   work (schedule, job card, Done with a time, photos, aftercare): agreements first, then the
   paper job forms, then the reference material. The keep / update / archive record, file by
   file, is DRIVE-AUDIT-2026-10-31.md beside this script. */
const FILES = [
  /* Sorts above the numbered folders in Drive, which is the whole reason for the leading "00".
     Page 2 of it is the one that matters: what is deliberately NOT in the folder and why.
     Rebuild it with `node tools/html-to-pdf.mjs index-sheet` after editing index-sheet.html,
     and check it is still exactly 2 pages. */
  ['team-share/index-sheet.pdf',
   '',
   '00 START HERE - what is in this folder.pdf'],
  /* The field guide (2026-10-13): built from sixfold/training, the same lessons as the app's
     Training. Top level, beside START HERE, because it is the first thing new crew should read.
     Rebuild: node training/build-field-guide.mjs, then node tools/html-to-pdf.mjs Field-Guide. */
  ['training/Sixfold-Field-Guide.pdf',
   '',
   '00 FIELD GUIDE - how we knock, what we say, what we never say (INTERNAL).pdf'],

  // ---- 01 Agreements -------------------------------------------------------
  // The short lawn forms lead: aeration and lawn care are most of the work now. Blank
  // templates, no price printed and no customer named. Both crib sheets ship beside the
  // agreements on purpose: the three-year exposure comes from a blank date on a
  // cancellation form, not from the contract wording.
  ['agreements/lawn-job-sheet.pdf',
   '01 Agreements',
   'Lawn job sheet - ONE JOB (3 pages, print all of them).pdf'],
  ['agreements/lawn-monthly-agreement.pdf',
   '01 Agreements',
   'Lawn care agreement - MONTHLY rolling (4 pages, print all of them).pdf'],
  ['agreements/service-agreement.pdf',
   '01 Agreements',
   'Service agreement - FIRE MITIGATION (5 pages, print all of them).pdf'],
  ['agreements/landscaping-agreement.pdf',
   '01 Agreements',
   'Service agreement - LANDSCAPING (5 pages, print all of them).pdf'],
  ['agreements/service-agreement-tablet.pdf',
   '01 Agreements',
   'Service agreement - tablet version, pages 1-3 only.pdf'],
  ['agreements/field-instructions.pdf',
   '01 Agreements',
   'Crib sheet - signing at the DOOR (INTERNAL).pdf'],
  ['agreements/remote-signing.pdf',
   '01 Agreements',
   'Crib sheet - EMAILING an agreement to sign (INTERNAL).pdf'],

  // ---- 02 Job paperwork (walks and bigger jobs; the app holds the everyday job) ----
  ['operations/Sixfold-Quote-Walk-Sheet-FILLABLE.pdf',
   '02 Job paperwork',
   'Quote walk sheet - fill in on screen.pdf'],
  ['operations/quote-walk-sheet.pdf',
   '02 Job paperwork',
   'Quote walk sheet - print and write on.pdf'],
  ['operations/job-closeout.pdf',
   '02 Job paperwork',
   'Job close-out sheet - fill in the day the job ends.pdf'],
  ['operations/Sixfold-What-The-Work-Takes-FILLABLE.pdf',
   '02 Job paperwork',
   'What the work takes - fill in on screen.pdf'],
  ['operations/Sixfold-What-Things-Cost-FILLABLE.pdf',
   '02 Job paperwork',
   'What things cost us - fill in on screen (internal).pdf'],

  // ---- 03 Safety and compliance -----------------------------------------
  ['research/Sixfold-Crew-Safety-and-Compliance.pdf',
   '03 Safety and compliance',
   'Crew safety and compliance - OSHA, licences, certs.pdf'],
  ['operations/gear-checklist.pdf',
   '03 Safety and compliance',
   'Gear checklist.pdf'],

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

  // ---- 07 Events ----------------------------------------------------------
  // Never call anything on it a raffle (Colorado licenses raffles only to qualifying
  // nonprofits). Since 29 Oct the sheet has no drawing column at all: ZIP code + Free quote.
  ['operations/Sixfold-Event-Signup-Sheet.pdf',
   '07 Events',
   'Event sign-up sheet - print one per 13 people.pdf'],
];

/* Kept here rather than in a note, so that anyone reading the build list also
   reads the reasons. Each entry: what, and why it is out. */
const EXCLUDED = [
  ['Rate card, rate sheets A/B/C, work-rates, cost-rates, the invoice example, the yard clean-up price card',
   'Matthew, 2026-09-18: no pricing of any kind in the crew share. Prices come from the office, ' +
   'per job, through the app. The invoice example also still prints the old phone number.'],

  ['Every file naming a real customer: quotes, signed agreements, walk-throughs, both _part-*.pdf, ' +
   'the door-territory sheet',
   'Matthew, 2026-09-18. Real names, real addresses, real prices. Nobody needs them to do the job, ' +
   'and _part-* files are never-send by construction. Job photos go to the separate Photo content ' +
   'dump drive, in folders named by date, street and town (never a house number).'],

  ['Services Sheet D ("What Sixfold does"), REMOVED 2026-10-31',
   'Archived at source on 2026-09-30, fire-led, old Sixfold brand: the last pre-365 handout in the ' +
   'share. Nothing replaces it yet. A new services sheet is a copy job for Matthew; the live site ' +
   '(365aeration.com) is the current statement of services.'],

  ['Crew shirt spec, REMOVED 2026-10-31',
   'Still the old Sixfold mark, Contact@SixfoldColorado.com and (303) 915-1045 (a Phase 4 physical ' +
   'item, not redone). A spec in a shared folder gets ordered from.'],

  ['09 Pick the look (vehicle magnet proofs, season colour study), REMOVED 2026-10-31',
   'The look was chosen: the Sixfold 365 badge, cards and yard signs (brand/combined-365-2026-10/). ' +
   'The proofs show the superseded Sixfold green and ember sets.'],

  ['launch-flyers, door hanger, door flyer, the September ad kits',
   'Archived in the 2026-10-23 rebrand (sixfold/_archive-2026-10-23-rebrand/README.md). The flyers ' +
   'carried launch offers that were never chosen; a flyer in a shared folder gets printed.'],

  ['marketing-plan, minimum-viable-start, platform-sheet',
   'Business planning, not crew material. Archived 2026-10-23.'],

  ['Water restrictions 2026 (research/Sixfold-Water-Restrictions-2026.pdf)',
   'Useful to the crew, but researched 2026-09-30, still prints the old phone and website, and ' +
   'says itself that it goes stale within weeks. Needs a re-check and rebrand before it is shared.'],

  ['brand/ PRINT files: cards, yard signs, magnets',
   'The print-ready PDFs stay with Matthew so nobody orders straight from the share.'],
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
console.log(`Copy sixfold/team-share/files/* into the Sixfold shared drive; see DRIVE-AUDIT-2026-10-31.md.`);
