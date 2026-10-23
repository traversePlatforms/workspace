/*
  Builds the FILLABLE "What things cost us" sheet — the price companion to
  build-work-rates-pdf.mjs. Same layout, same confidence idea, but every answer
  is a dollar figure instead of a man-hour figure.

  Run:  node operations/build-cost-rates-pdf.mjs
  Out:  operations/Sixfold-What-Things-Cost-FILLABLE.pdf

  Scope: JOB-ATTRIBUTABLE costs only — the things a quote has to pass through.
  Deliberately NOT on it, per Matthew 2026-09-15 ("I dont need the information in
  regards to the financial structure of the company"): wages, payroll burden,
  employee-vs-1099, insurance, phone, software, rent, vehicle payments. Those
  answer "what is our margin", not "what does this job cost", and asking makes
  the sheet read as an audit.

  Also not on it: anything we CHARGE. Same rule as every other sheet in this
  family — costs come back, the price goes out in writing.

  Confidence marks differ from the work-rates sheet on purpose:
    R = have a receipt   M = from memory   G = best guess
  "Have a receipt" is the distinction that matters for money, and it is exactly
  what was missing when the haul rate turned out to be built on a homeowner fee
  Sixfold cannot use.
*/
import { PDFDocument, StandardFonts, rgb, PDFName, PDFBool } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const PINE   = rgb(0.055, 0.082, 0.071);
const EMBINK = rgb(0.722, 0.298, 0.082);
const PAPER  = rgb(0.949, 0.929, 0.890);
const WHITE  = rgb(1, 1, 1);
const LINE   = rgb(0.847, 0.820, 0.765);
const MUTE   = rgb(0.373, 0.416, 0.380);
const FIELDBG= rgb(0.996, 0.988, 0.972);

const W = 612, H = 792;
const ML = 38, MR = 38;
const CW = W - ML - MR;
const LABEL_X = ML;
const ANS_X   = ML + 280;
const ANS_W   = 108;
const CONF_X  = ML + 402;
const CONF_PITCH = 30;
const CBOX = 15;
const ROW_H = 30;
const ROW_GAP = 5;

/* Disposal first: it is the line currently losing money, and the only one with
   a receipt already contradicting the rate card. */
const S1 = [
  ['The yard we use most — what they charge per load', 'NAME IT · $ PER LOAD'],
  ['Any other yard we use, and what it charges', 'NAME IT · $ PER LOAD'],
  ['Which of them take commercial haulers, not just homeowners', 'THIS ONE MATTERS'],
  ['What actually fits in one load', 'CU YD, OR "A FULL TRAILER"'],
  ['Green waste vs mixed — is it a different price?', '$'],
];
const S2 = [
  ['Gas, per gallon', '$'],
  ['Diesel, per gallon', '$'],
  ['Two-stroke mix, per gallon', '$'],
  ['Bar and chain oil, per gallon', '$'],
  ['What the truck burns on one round trip', '$ OR GALLONS'],
];
const S3 = [
  ['A new chain', '$ EACH'],
  ['A sharpening', '$ EACH'],
  ['Chains a typical job goes through', 'HOW MANY'],
  ['A new bar', '$'],
  ['Sprocket, air filter, spark plug', '$ EACH'],
  ['Stump grinder teeth', '$ EACH · HOW OFTEN'],
];
const S4 = [
  ['Mower and edger blades', '$ EACH · HOW OFTEN'],
  ['Trimmer line, per spool', '$'],
  ['Mulch, per bag or per yard', '$'],
  ['Topsoil or compost, per yard', '$'],
  ['A shrub like the ones we plant', '$ EACH'],
  ['Fertiliser, weed barrier, anything else we buy in', '$'],
];
const S5 = [
  ['Chipper', 'OURS? OR $ PER DAY'],
  ['Stump grinder', 'OURS? OR $ PER DAY'],
  ['Trailer', 'OURS? OR $ PER DAY'],
  ['Skid steer or mini excavator', 'OURS? OR $ PER DAY'],
  ['Lift or bucket truck', 'OURS? OR $ PER DAY'],
  ['Mower', 'OURS? OR $ PER DAY'],
  ['Delivery or pickup fee on a rental', '$'],
];
const S6 = [
  ['Chaps', '$ · HOW OFTEN REPLACED'],
  ['Helmet, face shield, ear protection', '$ · HOW OFTEN'],
  ['Gloves and boots', '$ · HOW OFTEN'],
  ['Tarps, straps, ratchets, first aid', '$'],
];

const doc = await PDFDocument.create();
doc.setTitle('Sixfold — What things cost us (fillable)');
doc.setSubject('Job-attributable costs — disposal, fuel, consumables, rentals, gear. No wages, no overhead, no prices we charge.');
doc.setCreator('Sixfold LLC');

const body  = await doc.embedFont(StandardFonts.Helvetica);
const bold  = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);

const form = doc.getForm();
form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);

let page, y;

function newPage() {
  page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  y = H - 40;
}

function drawMark(x, yTop, size) {
  const s = size / 116;
  const P = (pts, op = 1) => page.drawSvgPath(pts, { x, y: yTop, scale: s, color: EMBINK, opacity: op, borderWidth: 0 });
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
    textColor: PINE, backgroundColor: FIELDBG, borderColor: LINE, borderWidth: 1, font: body,
  });
  f.setFontSize(size);
  return f;
}

function checkBox(name, x, yBase, size = CBOX) {
  const c = form.createCheckBox(name);
  c.addToPage(page, { x, y: yBase, width: size, height: size, backgroundColor: WHITE, borderColor: MUTE, borderWidth: 1 });
  return c;
}

function runningHead(n) {
  page.drawText('Sixfold  ·  What things cost us', { x: ML, y: y - 8, size: 9, font: serif, color: MUTE });
  const t = `PAGE ${n} OF 3`;
  page.drawText(t, { x: W - MR - bold.widthOfTextAtSize(t, 7), y: y - 8, size: 7, font: bold, color: MUTE });
  y -= 16;
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
  y += 4;
}

function sectionHead(num, title) {
  y -= 36;
  page.drawText(`${num}`, { x: ML, y, size: 14, font: serif, color: EMBINK });
  page.drawText(title, { x: ML + 15, y, size: 14, font: serif, color: PINE });
  y -= 9;
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
  page.drawText('WHAT IT IS', { x: LABEL_X, y: y - 12, size: 6.5, font: bold, color: MUTE });
  page.drawText('WHAT IT COSTS', { x: ANS_X, y: y - 12, size: 6.5, font: bold, color: MUTE });
  ['R', 'M', 'G'].forEach((t, i) => {
    page.drawText(t, { x: CONF_X + i * CONF_PITCH + 4, y: y - 12, size: 6.5, font: bold, color: MUTE });
  });
  y -= 22;
}

function rows(list, prefix) {
  list.forEach(([label, unit], i) => {
    y -= ROW_H;
    const maxW = ANS_X - LABEL_X - 14;
    let line = '', lines = [];
    for (const word of label.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (body.widthOfTextAtSize(t, 9) > maxW && line) { lines.push(line); line = word; }
      else line = t;
    }
    if (line) lines.push(line);

    const startY = lines.length > 1 ? y + 15 : y + 9;
    lines.forEach((ln, k) => page.drawText(ln, { x: LABEL_X, y: startY - k * 10.5, size: 9, font: body, color: PINE }));
    if (unit) page.drawText(unit, { x: LABEL_X, y: startY - lines.length * 10.5 + 0.5, size: 6.5, font: bold, color: EMBINK });

    /* 9.5pt not 11: several rows want a short phrase rather than a number
       ("Only the Monument yard", "Rented, /day") and at 11pt those clip at
       rest. The value is never lost — the field scrolls — but a form you cannot
       read back is a form people distrust. */
    textField(`${prefix}_${i + 1}`, ANS_X, y + 2, ANS_W, 22, { size: 9.5 });
    ['R', 'M', 'G'].forEach((t, k) => checkBox(`${prefix}_${i + 1}_${t}`, CONF_X + k * CONF_PITCH, y + 5, CBOX));

    y -= ROW_GAP + (lines.length > 1 ? 8 : 0) + (unit ? 4 : 0);
  });
}

function guard(n) {
  if (y < 20) throw new Error(`page ${n} ran past the bottom margin (y = ${y.toFixed(1)}pt). Cut a row or shorten ROW_H.`);
  return y;
}

/* ---------- page 1 ---------- */
newPage();
drawMark(ML, y, 30);
page.drawText('Sixfold', { x: ML + 34, y: y - 20, size: 20, font: serif, color: PINE });
page.drawText('LAND & FIRE  ·  MONUMENT, CO', { x: ML + 34, y: y - 30, size: 6.5, font: body, color: MUTE });
page.drawText('INTERNAL', { x: W - MR - 52, y: y - 8, size: 7, font: bold, color: EMBINK });
{
  const t = 'WHAT THINGS COST US';
  page.drawText(t, { x: W - MR - bold.widthOfTextAtSize(t, 7.5), y: y - 20, size: 7.5, font: bold, color: PINE });
  const s = 'Fill in what you know. A marked guess beats a blank.';
  page.drawText(s, { x: W - MR - body.widthOfTextAtSize(s, 7), y: y - 31, size: 7, font: body, color: MUTE });
}

y -= 44;
page.drawRectangle({ x: ML, y, width: CW, height: 2, color: EMBINK });

y -= 26;
page.drawText('What do these cost us?', { x: ML, y, size: 17, font: serif, color: PINE });

y -= 16;
page.drawText('WHAT WE PAY, NOT WHAT WE CHARGE', { x: ML, y, size: 7.5, font: bold, color: EMBINK });
page.drawText('— the price goes out in writing, same as always.', {
  x: ML + bold.widthOfTextAtSize('WHAT WE PAY, NOT WHAT WE CHARGE', 7.5) + 4, y, size: 8, font: body, color: PINE });
y -= 11;
page.drawText('Tick how sure you are:   R = have a receipt    M = from memory    G = best guess', {
  x: ML, y, size: 8, font: body, color: PINE });

y -= 40;
const hw = (CW - 12) / 2;
[['filled_in_by', 'FILLED IN BY'], ['date', 'DATE']].forEach(([n, l], i) => {
  const x = ML + i * (hw + 12);
  page.drawText(l, { x, y: y + 28, size: 7, font: bold, color: MUTE });
  textField(n, x, y, hw, 24);
});

sectionHead('1', 'Dumping and disposal');
rows(S1, 'dump');
sectionHead('2', 'Fuel and fluids');
rows(S2, 'fuel');
const p1 = guard(1);

/* ---------- page 2 ---------- */
newPage();
runningHead(2);
sectionHead('3', 'Saws and cutting');
rows(S3, 'saw');
sectionHead('4', 'Mowing, trimming and planting');
rows(S4, 'land');
const p2 = guard(2);

/* ---------- page 3 ---------- */
newPage();
runningHead(3);
sectionHead('5', 'Machines — do we own it, or rent it?');
rows(S5, 'kit');
sectionHead('6', 'Safety gear and the rest');
rows(S6, 'gear');

y -= 22;
page.drawText('7', { x: ML, y, size: 14, font: serif, color: EMBINK });
page.drawText('Anything else we pay for on a job', { x: ML + 15, y, size: 14, font: serif, color: PINE });
y -= 12;
page.drawText('Anything we buy or hire that is not on this sheet — and anything here that varies a lot.', {
  x: ML, y, size: 8, font: body, color: MUTE });
y -= 46;
textField('notes', ML, y, CW, 40, { multiline: true, size: 10 });

y -= 20;
page.drawRectangle({ x: ML, y, width: CW, height: 1, color: LINE });
y -= 15;
page.drawText('Save the file when you are done and send it back.', { x: ML, y, size: 8.5, font: bold, color: PINE });
y -= 12;
page.drawText('Rename it with your name first, or every one that comes back is called the same thing.', {
  x: ML, y, size: 8.5, font: body, color: PINE });
y -= 12;
page.drawText('Sixfold LLC   ·   contact@365aeration.com   ·   (720) 830-4553', {
  x: ML, y, size: 8, font: body, color: MUTE });
y -= 13;
page.drawText('On a phone: save it first, then open it in a PDF app. Filling it inside an email preview does not save.', {
  x: ML, y, size: 7.5, font: body, color: EMBINK });
const p3 = guard(3);

form.updateFieldAppearances(body);

const out = join(here, 'Sixfold-What-Things-Cost-FILLABLE.pdf');
writeFileSync(out, await doc.save({ updateFieldAppearances: false }));

const f = form.getFields();
console.log(`wrote ${out}`);
console.log(`bottom margin left — p1: ${p1.toFixed(1)}pt, p2: ${p2.toFixed(1)}pt, p3: ${p3.toFixed(1)}pt`);
console.log(`${doc.getPageCount()} pages, ${f.length} fields ` +
  `(${f.filter(x => x.constructor.name === 'PDFCheckBox').length} checkboxes, ` +
  `${f.filter(x => x.constructor.name === 'PDFTextField').length} text)`);
console.log(`read-only fields: ${f.filter(x => x.isReadOnly()).length}  (must be 0)`);
