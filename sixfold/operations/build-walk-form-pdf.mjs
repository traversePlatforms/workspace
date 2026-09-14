/*
  Builds the FILLABLE quote walk sheet — a real AcroForm PDF that a crew fills in
  on a phone, tablet or laptop and saves, without a signal and without an account.

  Why this is generated rather than printed from the HTML: Chrome's printToPDF
  flattens `<input>` into a picture of a box. There is no route from the print
  sheet to a fillable PDF; the form fields have to be authored as PDF objects,
  which is what this does.

  Run:  node operations/build-walk-form-pdf.mjs
  Out:  operations/Sixfold-Quote-Walk-Sheet-FILLABLE.pdf

  THREE FILES NOW CARRY THESE FIELDS and they are hand-kept in step:
    - operations/quote-walk-sheet.src.html   the paper sheet
    - operations/quote-walk-form.artifact.html  the web form
    - this script                            the fillable PDF
  A field added, dropped or reordered has to change in all three.

  Deliberately NOT on it: any price, rate or total. Same rule as the paper sheet —
  counts come back, the estimate goes out in writing.
*/
import { PDFDocument, StandardFonts, rgb, PDFName, PDFBool } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* ---- palette: the agreed five, in PDF colour space ---- */
const PINE   = rgb(0.055, 0.082, 0.071);
const EMBER  = rgb(0.894, 0.439, 0.227);
const EMBINK = rgb(0.722, 0.298, 0.082);
const PAPER  = rgb(0.949, 0.929, 0.890);
const WHITE  = rgb(1, 1, 1);
const LINE   = rgb(0.847, 0.820, 0.765);
const MUTE   = rgb(0.373, 0.416, 0.380);
const FIELDBG= rgb(0.996, 0.988, 0.972);

/* ---- page geometry ---- */
const W = 612, H = 792;
const ML = 38, MR = 38;
const CW = W - ML - MR;                 // 536
const LABEL_X = ML + 26;                // after the checkbox
const FIELD_X = ML + 322;
const FIELD_W = CW - 322;               // 214
const ROW_H = 30;                       // tap target — comfortably over the 24pt guideline
const ROW_GAP = 5;

const SECTION_1 = [
  ['Trees to take down — under 30 ft', ''],
  ['Trees to take down — 30 to 60 ft', ''],
  ['Trees to take down — 60 to 80 ft', ''],
  ['Trees to take down — over 80 ft', 'CALL IN FIRST'],
  ['Of those, how many come down over a roof, fence, line or drive', ''],
  ['Trees to limb or trim, not remove', ''],
  ['Logs to be bucked — and the length they want', 'ROUNDS · INCHES'],
  ['Dead fall already on the ground', 'PILES'],
  ['Brush, branches, twigs', 'PILES, OR TRUCK LOADS'],
  ['Material to run through the chipper', 'HOURS OF FEEDING'],
  ['Slash piles to build, and where', 'COUNT'],
  ['Stumps to grind — measured at the ground', 'COUNT + DIAMETER INCHES'],
  ['Loads to haul off — count the pile twice', 'LOADS · BOTH COUNTS'],
  ['What stays on site instead', 'CHIPS · ROUNDS · SLASH'],
];

const SECTION_2 = [
  ['Crew — people on site, and days', 'PEOPLE × DAYS'],
  ['Chains — how many on the job, and sharpenings', ''],
  ['Gas, two-stroke mix and bar oil', 'GALLONS'],
  ['Chipper — ours, or rented?', 'DAYS · RENTAL COST'],
  ['Trailer — ours, or rented?', 'DAYS · RENTAL COST'],
  ['Stump grinder', 'DAYS · RENTAL COST'],
  ['Anything else hired or bought for this job', ''],
  ['Dump fees — call and confirm today’s figure', 'PER LOAD × LOADS'],
  ['Truck fuel — round trips the job needs', 'TRIPS'],
  ['Second trip needed?', '811 LOCATE FIRST — 3 DAYS'],
];

const doc = await PDFDocument.create();
doc.setTitle('Sixfold — Quote walk sheet (fillable)');
doc.setSubject('Internal site-walk capture sheet. No prices. Fill in on site and send back.');
doc.setCreator('Sixfold LLC');

const body = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);

const form = doc.getForm();
/* Mobile readers vary in whether they generate field appearances themselves.
   Setting NeedAppearances makes the reader draw them, and we also bake
   appearances in below — between the two, the text shows up everywhere. */
form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);

let page, y;

function newPage() {
  page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  y = H - 40;
  return page;
}

/* The Ridge mark, scaled from its 100x116 viewBox. Fills only — the root
   strokes are dropped at this size, where they would close up into a blob. */
function drawMark(x, yTop, size) {
  const s = size / 116, ox = x, oy = yTop - size;
  const P = (pts, op = 1) => page.drawSvgPath(pts, {
    x: ox, y: yTop, scale: s, color: EMBINK, opacity: op, borderWidth: 0,
  });
  P('M18 84 L36 48 L54 84 Z', 0.42);
  P('M30 84 L50 38 L70 84 Z', 0.55);
  P('M44 84 L66 26 L88 84 Z', 0.70);
  P('M60 84 L79 14 L98 84 Z', 0.85);
  P('M22 69 L9.5 81.5 L34.5 81.5 Z', 1);
  P('M22 62 L12 74 L32 74 Z', 1);
  P('M22 55.5 L14.5 66.5 L29.5 66.5 Z', 1);
  P('M20.4 77 L23.6 77 L23.6 84 L20.4 84 Z', 1);
  P('M4 86 L96 86 L96 91 L4 91 Z', 1);
  return oy;
}

function textField(name, x, yBase, w, h, { multiline = false, size = 11 } = {}) {
  const f = form.createTextField(name);
  if (multiline) f.enableMultiline();
  f.setText('');
  f.addToPage(page, {
    x, y: yBase, width: w, height: h,
    textColor: PINE, backgroundColor: FIELDBG,
    borderColor: LINE, borderWidth: 1,
    font: body,
  });
  f.setFontSize(size);
  return f;
}

function checkBox(name, x, yBase, size = 14) {
  const c = form.createCheckBox(name);
  c.addToPage(page, {
    x, y: yBase, width: size, height: size,
    backgroundColor: WHITE, borderColor: MUTE, borderWidth: 1,
  });
  return c;
}

/* ---------- page 1 ---------- */
newPage();

const markBottom = drawMark(ML, y, 30);
page.drawText('Sixfold', { x: ML + 34, y: y - 20, size: 20, font: serif, color: PINE });
page.drawText('LAND & FIRE  ·  MONUMENT, CO', {
  x: ML + 34, y: y - 30, size: 6.5, font: body, color: MUTE,
});
page.drawText('INTERNAL', { x: W - MR - 52, y: y - 8, size: 7, font: bold, color: EMBINK });
page.drawText('QUOTE WALK SHEET', {
  x: W - MR - bold.widthOfTextAtSize('QUOTE WALK SHEET', 7.5), y: y - 20, size: 7.5,
  font: bold, color: PINE,
});
page.drawText('Fill in on site. No price is given on the property.', {
  x: W - MR - body.widthOfTextAtSize('Fill in on site. No price is given on the property.', 7),
  y: y - 31, size: 7, font: body, color: MUTE,
});

y -= 44;
page.drawRectangle({ x: ML, y, width: CW, height: 2, color: EMBINK });

/* header fields */
y -= 46;   // clear of the ember rule — at 34 the JOB/DATE captions sat on it
const hw = (CW - 24) / 3;
[['job', 'JOB'], ['date', 'DATE'], ['walked_by', 'WALKED BY']].forEach(([n, l], i) => {
  const x = ML + i * (hw + 12);
  page.drawText(l, { x, y: y + 30, size: 7, font: bold, color: MUTE });
  textField(n, x, y, hw, 26);
});

/* section heading */
function sectionHead(num, title) {
  y -= 40;
  page.drawText(`${num}`, { x: ML, y, size: 15, font: serif, color: EMBINK });
  page.drawText(title, { x: ML + 16, y, size: 15, font: serif, color: PINE });
  y -= 10;
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
  page.drawText('WHAT IS THERE', { x: LABEL_X, y: y - 13, size: 6.5, font: bold, color: MUTE });
  page.drawText('HOW MANY / HOW MUCH', { x: FIELD_X, y: y - 13, size: 6.5, font: bold, color: MUTE });
  y -= 24;
}

function rows(list, prefix) {
  list.forEach(([label, unit], i) => {
    y -= ROW_H;
    checkBox(`${prefix}_check_${i + 1}`, ML, y + 6, 14);

    /* Label, wrapped by measurement so it never runs under the field. */
    const maxW = FIELD_X - LABEL_X - 12;
    let line = '', lines = [];
    for (const word of label.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (body.widthOfTextAtSize(t, 9) > maxW && line) { lines.push(line); line = word; }
      else line = t;
    }
    if (line) lines.push(line);

    const startY = lines.length > 1 ? y + 15 : y + 9;
    lines.forEach((ln, k) => {
      page.drawText(ln, { x: LABEL_X, y: startY - k * 10.5, size: 9, font: body, color: PINE });
    });
    if (unit) {
      const uy = startY - lines.length * 10.5 + 0.5;
      page.drawText(unit, { x: LABEL_X, y: uy, size: 6.5, font: bold, color: EMBINK });
    }

    textField(`${prefix}_${i + 1}`, FIELD_X, y + 2, FIELD_W, 22);
    y -= ROW_GAP + (lines.length > 1 ? 8 : 0) + (unit ? 4 : 0);
  });
}

sectionHead('1', 'The work — what gets counted and charged');
rows(SECTION_1, 'work');

/* ---------- page 2 ---------- */
newPage();
page.drawText('Sixfold  ·  Quote walk sheet', { x: ML, y: y - 8, size: 9, font: serif, color: MUTE });
page.drawText('PAGE 2 OF 2', {
  x: W - MR - bold.widthOfTextAtSize('PAGE 2 OF 2', 7), y: y - 8, size: 7, font: bold, color: MUTE,
});
y -= 16;
page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
y += 4;

sectionHead('2', 'What it takes — the cost of doing it');
rows(SECTION_2, 'cost');

/* notes */
y -= 34;
page.drawText('3', { x: ML, y, size: 15, font: serif, color: EMBINK });
page.drawText('Additional notes', { x: ML + 16, y, size: 15, font: serif, color: PINE });
y -= 13;
page.drawText(
  'Access, slope, drag to the truck, power lines, septic, neighbours, what was asked for, what was promised.',
  { x: ML, y, size: 8, font: body, color: MUTE });
y -= 104;
textField('notes', ML, y, CW, 96, { multiline: true, size: 10 });

/* foot */
y -= 22;
page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
y -= 16;
page.drawText('No price is given on the property — not a figure, not a range.', {
  x: ML, y, size: 8.5, font: bold, color: PINE });
y -= 12;
page.drawText('Counts come back, the estimate goes out in writing. Stop and call in if anything is over', {
  x: ML, y, size: 8.5, font: body, color: PINE });
y -= 12;
page.drawText('80ft, on a structure, under tension, or near a line.', {
  x: ML, y, size: 8.5, font: body, color: PINE });
y -= 22;
/* (303) 915-1045 is the current SixfoldColorado number, given by Matthew 2026-09-08.
   (720) 772-6146 is superseded and still sitting in 57 other files in this repo —
   including the paper walk sheet this form mirrors. Do not copy a contact line
   out of a neighbouring file here without checking it first. */
page.drawText('Sixfold LLC   ·   Contact@SixfoldColorado.com   ·   (303) 915-1045', {
  x: ML, y, size: 8, font: body, color: MUTE });
y -= 12;
page.drawText('Save this file when you are done and send it back — do not read a price off it on site.', {
  x: ML, y, size: 8, font: body, color: EMBINK });

/* A row or a line added later must not silently walk off the bottom of the page.
   Nothing in a PDF complains when it does — it simply is not there. */
if (y < 20) {
  throw new Error(`content ran past the bottom margin (final y = ${y.toFixed(1)}pt). ` +
    `Cut a line, or shorten ROW_H, before shipping this.`);
}

/* Bake appearances as well as asking the reader to, so the typed text is visible
   in readers that honour neither one alone. */
form.updateFieldAppearances(body);

const out = join(here, 'Sixfold-Quote-Walk-Sheet-FILLABLE.pdf');
writeFileSync(out, await doc.save({ updateFieldAppearances: false }));

const f = form.getFields();
console.log(`wrote ${out}`);
console.log(`bottom margin left on page 2: ${y.toFixed(1)}pt`);
console.log(`${doc.getPageCount()} pages, ${f.length} fields ` +
  `(${f.filter(x => x.constructor.name === 'PDFCheckBox').length} checkboxes, ` +
  `${f.filter(x => x.constructor.name === 'PDFTextField').length} text)`);
