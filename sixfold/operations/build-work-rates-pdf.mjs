/*
  Builds the FILLABLE "What the work takes" sheet — a real AcroForm PDF that Brad
  or Brandon fills in on a phone or laptop and sends back, with no account and no
  signal needed.

  Why generated rather than printed from the HTML: Chrome's printToPDF flattens
  an <input> into a picture of a box. Form fields have to be authored as PDF
  objects. Same reason as build-walk-form-pdf.mjs, which this follows closely.

  Run:  node operations/build-work-rates-pdf.mjs
  Out:  operations/Sixfold-What-The-Work-Takes-FILLABLE.pdf

  TWO FILES CARRY THESE ROWS and they are hand-kept in step:
    - operations/work-rates.src.html   the paper sheet
    - this script                      the fillable PDF
  A row added, dropped or reordered has to change in both.

  Differences from the paper sheet, deliberately — this is a different artifact,
  not a copy (see [[print-fill-in-geometry]]):
    - No leading tick box per row. On paper it marks "covered this"; in a form an
      empty field already says that, and it would be a third of the taps on the
      sheet for no information.
    - 30pt row pitch and 22pt fields, sized for a fingertip rather than a pen.
*/
import { PDFDocument, StandardFonts, rgb, PDFName, PDFBool } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* ---- palette: the agreed five, in PDF colour space ---- */
const PINE   = rgb(0.055, 0.082, 0.071);
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
const LABEL_X = ML;
const HRS_X   = ML + 292;               // man-hours field
const HRS_W   = 96;
const CONF_X  = ML + 402;               // first of the three confidence boxes
const CONF_PITCH = 30;
const CBOX = 15;
const ROW_H = 30;
const ROW_GAP = 5;

const S1 = [
  ['Take one down — under 30 ft', ''],
  ['Take one down — 30 to 60 ft', ''],
  ['Take one down — 60 to 80 ft', ''],
  ['Limb or trim one, not removing it', ''],
  ["Buck one tree's worth of logs", 'OR PER ROUND'],
  ['Grind one stump', 'SAY WHAT DIAMETER'],
];
const S2 = [
  ['Clear one pile of dead fall', ''],
  ['Clear one pile of brush, branches, twigs', ''],
  ['Build one slash pile', ''],
  ['Load the truck or trailer to full', ''],
  ['One dump run — drive, unload, get back', ''],
  ['Setup and pack-down, per day', ''],
];
const S3 = [
  ['Mow a quarter acre', ''],
  ['Trim and edge 100 ft', ''],
  ['Clear one bed', 'SAY ROUGH SQ FT'],
  ['Plant one shrub', ''],
];
const S4 = [
  ['Coming down over a roof, fence, line or drive — how much longer than an open fell?', '× HOW MANY TIMES'],
  ['Bad access — long drag to the truck, steep slope', '× HOW MANY TIMES'],
  ['A chain, and a sharpening', 'DOLLARS EACH'],
  ['A gallon of two-stroke mix, and of bar oil', 'DOLLARS'],
  ['One round trip in the truck, in fuel', 'DOLLARS'],
];

const doc = await PDFDocument.create();
doc.setTitle('Sixfold — What the work takes (fillable)');
doc.setSubject('How long each job takes, in man-hours, with how confident we are in each number.');
doc.setCreator('Sixfold LLC');

const body  = await doc.embedFont(StandardFonts.Helvetica);
const bold  = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);

const form = doc.getForm();
/* Readers differ on whether they generate appearances themselves. Ask them to,
   AND bake them below — between the two, typed text shows up everywhere. */
form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);

let page, y;

function newPage() {
  page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  y = H - 40;
  return page;
}

function drawMark(x, yTop, size) {
  const s = size / 116;
  const P = (pts, op = 1) => page.drawSvgPath(pts, {
    x, y: yTop, scale: s, color: EMBINK, opacity: op, borderWidth: 0,
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
}

function textField(name, x, yBase, w, h, { multiline = false, size = 11 } = {}) {
  const f = form.createTextField(name);
  if (multiline) f.enableMultiline();
  f.setText('');
  f.addToPage(page, {
    x, y: yBase, width: w, height: h,
    textColor: PINE, backgroundColor: FIELDBG,
    borderColor: LINE, borderWidth: 1, font: body,
  });
  f.setFontSize(size);
  return f;
}

function checkBox(name, x, yBase, size = CBOX) {
  const c = form.createCheckBox(name);
  c.addToPage(page, {
    x, y: yBase, width: size, height: size,
    backgroundColor: WHITE, borderColor: MUTE, borderWidth: 1,
  });
  return c;
}

function sectionHead(num, title, answerLabel) {
  y -= 38;
  page.drawText(`${num}`, { x: ML, y, size: 14, font: serif, color: EMBINK });
  page.drawText(title, { x: ML + 15, y, size: 14, font: serif, color: PINE });
  y -= 9;
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
  page.drawText('THE WORK', { x: LABEL_X, y: y - 12, size: 6.5, font: bold, color: MUTE });
  page.drawText(answerLabel, { x: HRS_X, y: y - 12, size: 6.5, font: bold, color: MUTE });
  ['T', 'D', 'G'].forEach((t, i) => {
    page.drawText(t, { x: CONF_X + i * CONF_PITCH + 4, y: y - 12, size: 6.5, font: bold, color: MUTE });
  });
  y -= 22;
}

function rows(list, prefix) {
  list.forEach(([label, unit], i) => {
    y -= ROW_H;

    /* Wrap by measurement so a long label never runs under the field. */
    const maxW = HRS_X - LABEL_X - 14;
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
      page.drawText(unit, {
        x: LABEL_X, y: startY - lines.length * 10.5 + 0.5, size: 6.5, font: bold, color: EMBINK,
      });
    }

    textField(`${prefix}_${i + 1}`, HRS_X, y + 2, HRS_W, 22);
    ['T', 'D', 'G'].forEach((t, k) => {
      checkBox(`${prefix}_${i + 1}_${t}`, CONF_X + k * CONF_PITCH, y + 5, CBOX);
    });

    y -= ROW_GAP + (lines.length > 1 ? 8 : 0) + (unit ? 4 : 0);
  });
}

/* ---------- page 1 ---------- */
newPage();
drawMark(ML, y, 30);
page.drawText('Sixfold', { x: ML + 34, y: y - 20, size: 20, font: serif, color: PINE });
page.drawText('LAND & FIRE  ·  MONUMENT, CO', { x: ML + 34, y: y - 30, size: 6.5, font: body, color: MUTE });
page.drawText('INTERNAL', { x: W - MR - 52, y: y - 8, size: 7, font: bold, color: EMBINK });
{
  const t = 'WHAT THE WORK TAKES';
  page.drawText(t, { x: W - MR - bold.widthOfTextAtSize(t, 7.5), y: y - 20, size: 7.5, font: bold, color: PINE });
  const s = 'Fill in what you know. A marked guess beats a blank.';
  page.drawText(s, { x: W - MR - body.widthOfTextAtSize(s, 7), y: y - 31, size: 7, font: body, color: MUTE });
}

y -= 44;
page.drawRectangle({ x: ML, y, width: CW, height: 2, color: EMBINK });

y -= 26;
page.drawText('How long does one of these take?', { x: ML, y, size: 17, font: serif, color: PINE });

y -= 16;
page.drawText('MAN-HOURS, NOT CLOCK TIME', { x: ML, y, size: 7.5, font: bold, color: EMBINK });
page.drawText('— two people for one hour is two man-hours.', {
  x: ML + bold.widthOfTextAtSize('MAN-HOURS, NOT CLOCK TIME', 7.5) + 4, y, size: 8, font: body, color: PINE });
y -= 11;
page.drawText('Tick how sure you are:   T = timed it    D = done it often    G = best guess', {
  x: ML, y, size: 8, font: body, color: PINE });

/* header fields */
y -= 40;
const hw = (CW - 12) / 2;
[['filled_in_by', 'FILLED IN BY'], ['date', 'DATE']].forEach(([n, l], i) => {
  const x = ML + i * (hw + 12);
  page.drawText(l, { x, y: y + 28, size: 7, font: bold, color: MUTE });
  textField(n, x, y, hw, 24);
});

sectionHead('1', 'Tree work — one tree, start to cleared', 'MAN-HOURS');
rows(S1, 'tree');

sectionHead('2', 'Clearing and hauling', 'MAN-HOURS');
rows(S2, 'clear');

if (y < 20) throw new Error(`page 1 ran past the bottom margin (y = ${y.toFixed(1)}pt)`);
const p1Left = y;

/* ---------- page 2 ---------- */
newPage();
page.drawText('Sixfold  ·  What the work takes', { x: ML, y: y - 8, size: 9, font: serif, color: MUTE });
{
  const t = 'PAGE 2 OF 2';
  page.drawText(t, { x: W - MR - bold.widthOfTextAtSize(t, 7), y: y - 8, size: 7, font: bold, color: MUTE });
}
y -= 16;
page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
y += 4;

sectionHead('3', 'Landscaping — we sell this and have never priced it', 'MAN-HOURS');
rows(S3, 'land');

sectionHead('4', 'What makes a job slower, and what small stuff costs', 'ANSWER');
rows(S4, 'factor');

/* notes */
y -= 32;
page.drawText('5', { x: ML, y, size: 14, font: serif, color: EMBINK });
page.drawText('Anything we have not asked about', { x: ML + 15, y, size: 14, font: serif, color: PINE });
y -= 12;
page.drawText('Work we do that is not on this sheet · anything that always takes longer than people expect.', {
  x: ML, y, size: 8, font: body, color: MUTE });
y -= 74;
textField('notes', ML, y, CW, 68, { multiline: true, size: 10 });

/* foot */
y -= 20;
page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
y -= 15;
page.drawText('Save the file when you are done and send it back.', { x: ML, y, size: 8.5, font: bold, color: PINE });
y -= 12;
page.drawText('Rename it with your name first, or every one that comes back is called the same thing.', {
  x: ML, y, size: 8.5, font: body, color: PINE });
y -= 12;
/* (303) 915-1045 is the current SixfoldColorado number. (720) 772-6146 is
   superseded and still sits in other files in this repo — do not copy a contact
   line out of a neighbouring file without checking it. */
page.drawText('Sixfold LLC   ·   Contact@SixfoldColorado.com   ·   (303) 915-1045', {
  x: ML, y, size: 8, font: body, color: MUTE });
y -= 13;
page.drawText('On a phone: save it first, then open it in a PDF app. Filling it inside an email preview does not save.', {
  x: ML, y, size: 7.5, font: body, color: EMBINK });

if (y < 20) {
  throw new Error(`content ran past the bottom margin (final y = ${y.toFixed(1)}pt). ` +
    `Cut a line, or shorten ROW_H, before shipping this.`);
}

form.updateFieldAppearances(body);

const out = join(here, 'Sixfold-What-The-Work-Takes-FILLABLE.pdf');
writeFileSync(out, await doc.save({ updateFieldAppearances: false }));

const f = form.getFields();
console.log(`wrote ${out}`);
console.log(`bottom margin left — page 1: ${p1Left.toFixed(1)}pt, page 2: ${y.toFixed(1)}pt`);
console.log(`${doc.getPageCount()} pages, ${f.length} fields ` +
  `(${f.filter(x => x.constructor.name === 'PDFCheckBox').length} checkboxes, ` +
  `${f.filter(x => x.constructor.name === 'PDFTextField').length} text)`);
console.log(`read-only fields: ${f.filter(x => x.isReadOnly()).length}  (must be 0)`);
