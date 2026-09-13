/*
  Builds two fillable PDFs from the shared content:
    ../charity-partner-standards-review-fillable.pdf   (detailed)
    ../charity-partner-quick-screen-fillable.pdf       (quick)

  AcroForm text fields, checkboxes and radio groups — fills and saves in any
  PDF reader on phone, tablet or computer. Standard Helvetica (no embedded
  fonts) for maximum mobile-reader compatibility.

  Run:  node build.mjs
*/
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PDFDocument, StandardFonts, rgb, PDFName, PDFBool,
} from 'pdf-lib';
import {
  PARTS, CRITERIA, SCALE_LEGEND, FILL_NOTE, FOOTNOTE,
  RATING_OPTS, OUTCOME_PROSPECTIVE, OUTCOME_CURRENT,
} from './content.mjs';

const OUT = dirname(dirname(fileURLToPath(import.meta.url)));

/* ---- theme -------------------------------------------------------------- */
const INK = rgb(0.11, 0.12, 0.14);
const SOFT = rgb(0.33, 0.38, 0.42);
const FAINT = rgb(0.51, 0.55, 0.60);
const ACCENT = rgb(0.12, 0.24, 0.36);
const RULE = rgb(0.80, 0.82, 0.85);
const RULE2 = rgb(0.68, 0.72, 0.77);
const FIELDBG = rgb(0.975, 0.982, 0.992);
const RED = rgb(0.62, 0.17, 0.17);
const REDBG = rgb(0.97, 0.93, 0.93);
const OPTCOL = {
  pass: rgb(0.16, 0.46, 0.30), minor: rgb(0.56, 0.40, 0.10),
  concern: rgb(0.64, 0.30, 0.16), fail: RED, na: rgb(0.36, 0.40, 0.45),
};

const PAGE_W = 612, PAGE_H = 792;
const M = 52, CW = PAGE_W - M * 2;
const TOP = PAGE_H - 50, BOTTOM = 56;

/* ---- doc state + layout helpers -------------------------------------- */
async function newDoc(label) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(label);
  pdf.setCreator('Charity Partner review');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const form = pdf.getForm();
  const D = { pdf, form, font, bold, ital, label, page: null, y: 0, uid: 0 };
  addPage(D);
  return D;
}
function addPage(D) {
  D.page = D.pdf.addPage([PAGE_W, PAGE_H]);
  D.y = TOP;
}
function ensure(D, h) { if (D.y - h < BOTTOM) addPage(D); }
function gap(D, h) { D.y -= h; }

/* Standard Helvetica is WinAnsi-encoded; map the few glyphs it can't take. */
function san(s) {
  return String(s)
    .replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/⇒/g, '=>').replace(/≤/g, '<=').replace(/≥/g, '>=')
    .replace(/[^\x00-\xFF–—‘’“”•…™]/g, '');
}
function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of san(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t;
      else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out;
}
function para(D, text, { size = 9, font = D.font, color = SOFT, lh = 1.32, indent = 0, gapAfter = 4 } = {}) {
  const lines = wrap(text, font, size, CW - indent);
  ensure(D, lines.length * size * lh + gapAfter);
  for (const ln of lines) {
    if (D.y - size * lh < BOTTOM) addPage(D);
    D.page.drawText(ln, { x: M + indent, y: D.y - size, size, font, color });
    D.y -= size * lh;
  }
  D.y -= gapAfter;
}
function label(D, text, { color = FAINT } = {}) {
  ensure(D, 12);
  D.page.drawText(text.toUpperCase(), { x: M, y: D.y - 7.5, size: 7, font: D.bold, color });
  D.y -= 12;
}
function rule(D, { gapBefore = 4, gapAfter = 8, color = RULE2, thickness = 1 } = {}) {
  D.y -= gapBefore; ensure(D, gapAfter + 2);
  D.page.drawLine({ start: { x: M, y: D.y }, end: { x: M + CW, y: D.y }, thickness, color });
  D.y -= gapAfter;
}

/* checkbox + wrapped label */
function checkItem(D, name, text, { size = 9 } = {}) {
  const box = 9.5, gapX = 7, lx = M + box + gapX, lw = CW - box - gapX;
  const lines = wrap(text, D.font, size, lw);
  const h = Math.max(box + 3, lines.length * size * 1.3) + 4;
  ensure(D, h);
  const top = D.y;
  const cb = D.form.createCheckBox(name);
  cb.addToPage(D.page, {
    x: M, y: top - box - 1, width: box, height: box,
    borderWidth: 1, borderColor: RULE2, backgroundColor: FIELDBG,
  });
  let ly = top - size;
  for (const ln of lines) { D.page.drawText(ln, { x: lx, y: ly, size, font: D.font, color: INK }); ly -= size * 1.3; }
  D.y = top - h;
}

/* rating radio row */
function ratingRow(D, name) {
  ensure(D, 20);
  const top = D.y;
  D.page.drawText('RATING', { x: M, y: top - 9, size: 7, font: D.bold, color: FAINT });
  let x = M + D.bold.widthOfTextAtSize('RATING', 7) + 12;
  const box = 10, tGap = 4, iGap = 13;
  const rg = D.form.createRadioGroup(name);
  for (const [val, lab] of RATING_OPTS) {
    rg.addOptionToPage(val, D.page, {
      x, y: top - box - 0.5, width: box, height: box, borderWidth: 1, borderColor: RULE2,
    });
    D.page.drawText(lab, { x: x + box + tGap, y: top - 9, size: 8, font: D.font, color: OPTCOL[val] });
    x += box + tGap + D.font.widthOfTextAtSize(lab, 8) + iGap;
  }
  D.y = top - 20;
}

/* text field with optional small label above */
function textField(D, name, { labelText = '', h = 15, multiline = false, gapAfter = 8 } = {}) {
  const lh = labelText ? 11 : 0;
  ensure(D, lh + h + gapAfter);
  const top = D.y;
  if (labelText) D.page.drawText(labelText.toUpperCase(), { x: M, y: top - 7.5, size: 7, font: D.bold, color: FAINT });
  const fy = top - lh - h;
  const tf = D.form.createTextField(name);
  if (multiline) tf.enableMultiline();
  tf.addToPage(D.page, {
    x: M, y: fy, width: CW, height: h,
    borderWidth: 1, borderColor: RULE2, backgroundColor: FIELDBG,
  });
  tf.setFontSize(9);
  D.y = fy - gapAfter;
}

/* a row of N text fields with column headers (remediation table) */
function fieldRow(D, names, widths, { h = 15 } = {}) {
  ensure(D, h + 4);
  const top = D.y;
  let x = M;
  names.forEach((nm, i) => {
    const w = widths[i] * CW;
    const tf = D.form.createTextField(nm);
    tf.addToPage(D.page, { x, y: top - h, width: w - 6, height: h, borderWidth: 1, borderColor: RULE2, backgroundColor: FIELDBG });
    tf.setFontSize(9);
    x += w;
  });
  D.y = top - h - 4;
}
function colHeaders(D, labels, widths) {
  ensure(D, 12);
  let x = M;
  labels.forEach((t, i) => {
    D.page.drawText(t.toUpperCase(), { x, y: D.y - 7.5, size: 6.5, font: D.bold, color: FAINT });
    x += widths[i] * CW;
  });
  D.y -= 12;
}

/* stacked radio options (purpose, outcome) */
function radioStack(D, name, options, { size = 10, indent = 0 } = {}) {
  const rg = D.form.createRadioGroup(name);
  for (const [val, text] of options) {
    const lx = M + indent + size + 7, lw = CW - indent - size - 7;
    const lines = wrap(text, D.font, 8.5, lw);
    const h = Math.max(size + 2, lines.length * 8.5 * 1.3) + 4;
    ensure(D, h);
    const top = D.y;
    rg.addOptionToPage(val, D.page, {
      x: M + indent, y: top - size - 0.5, width: size, height: size, borderWidth: 1, borderColor: RULE2,
    });
    let ly = top - 8.5;
    for (const ln of lines) { D.page.drawText(ln, { x: lx, y: ly, size: 8.5, font: D.font, color: INK }); ly -= 8.5 * 1.3; }
    D.y = top - h;
  }
}

/* red "watch for" panel */
function flagsPanel(D, items) {
  const arr = Array.isArray(items) ? items : [items];
  const size = 8.5, padX = 8, padY = 7, innerW = CW - padX * 2 - 10;
  const blocks = arr.map((t) => wrap((arr.length > 1 ? '• ' : '') + t, D.font, size, innerW));
  const textH = blocks.reduce((s, b) => s + b.length * size * 1.32, 0) + (arr.length - 1) * 3;
  const h = textH + padY * 2 + 11;
  ensure(D, h + 6);
  const top = D.y;
  D.page.drawRectangle({ x: M, y: top - h, width: CW, height: h, color: REDBG, borderColor: RED, borderWidth: 0.75 });
  D.page.drawText('WATCH FOR', { x: M + padX, y: top - padY - 7, size: 6.5, font: D.bold, color: RED });
  let ly = top - padY - 18;
  for (const b of blocks) {
    for (const ln of b) { D.page.drawText(ln, { x: M + padX, y: ly, size, font: D.font, color: RED }); ly -= size * 1.32; }
    ly -= 3;
  }
  D.y = top - h - 6;
}

/* ---- shared header ---------------------------------------------------- */
function header(D, { kicker, title, standfirst }) {
  D.page.drawText(kicker.toUpperCase(), { x: M, y: D.y - 8, size: 7, font: D.bold, color: ACCENT });
  D.y -= 20;
  for (const ln of wrap(title, D.bold, 20, CW)) {
    D.page.drawText(ln, { x: M, y: D.y - 20, size: 20, font: D.bold, color: INK }); D.y -= 24;
  }
  D.y -= 4;
  para(D, standfirst, { size: 9.5, color: SOFT, gapAfter: 8 });
  D.page.drawText('CONFIDENTIAL — INTERNAL USE ONLY', { x: M, y: D.y - 7, size: 6.5, font: D.bold, color: FAINT });
  D.y -= 16;
  rule(D, { color: ACCENT, thickness: 1.5, gapBefore: 2, gapAfter: 12 });
}

function idBlock(D, fields) {
  label(D, 'Organization under review');
  gap(D, 2);
  for (const f of fields) {
    if (f.type === 'purpose') {
      textLabelInline(D, 'Purpose of review');
      radioStack(D, 'purpose', [['prospective', 'Prospective — considering an engagement'], ['current', 'Current — periodic review']]);
      gap(D, 4);
    } else if (f.type === 'activity') {
      textLabelInline(D, 'Fundraising activity in scope');
      const opts = [['d2d', 'Door-to-door'], ['canvass', 'Street / canvassing'], ['events', 'Events & booths'], ['phone', 'Telephone'], ['digital', 'Digital'], ['other', 'Other']];
      let x = M, rowTop = D.y;
      ensure(D, 16);
      rowTop = D.y;
      for (const [v, t] of opts) {
        const w = 10 + 5 + D.font.widthOfTextAtSize(t, 8.5) + 14;
        if (x + w > M + CW) { x = M; rowTop -= 15; D.y = rowTop; }
        const cb = D.form.createCheckBox('act_' + v);
        cb.addToPage(D.page, { x, y: rowTop - 10, width: 9.5, height: 9.5, borderWidth: 1, borderColor: RULE2, backgroundColor: FIELDBG });
        D.page.drawText(t, { x: x + 14, y: rowTop - 9, size: 8.5, font: D.font, color: INK });
        x += w;
      }
      D.y = rowTop - 16;
    } else {
      textField(D, f.k, { labelText: f.label, h: 15, gapAfter: 6 });
    }
  }
  gap(D, 6);
}
function textLabelInline(D, t) {
  ensure(D, 12);
  D.page.drawText(t.toUpperCase(), { x: M, y: D.y - 7.5, size: 7, font: D.bold, color: FAINT });
  D.y -= 13;
}

function partHeading(D, key) {
  ensure(D, 40);
  D.y -= 14;
  D.page.drawText(PARTS[key].toUpperCase(), { x: M, y: D.y - 8, size: 7.5, font: D.bold, color: ACCENT });
  D.y -= 12;
  D.page.drawLine({ start: { x: M, y: D.y }, end: { x: M + CW, y: D.y }, thickness: 1.5, color: ACCENT });
  D.y -= 10;
}

function critHeading(D, c, titleText) {
  ensure(D, 30);
  D.y -= 8;
  D.page.drawLine({ start: { x: M, y: D.y }, end: { x: M + CW, y: D.y }, thickness: 0.75, color: RULE });
  D.y -= 12;
  const numW = D.bold.widthOfTextAtSize(String(c.n), 11) + 10;
  D.page.drawText(String(c.n), { x: M, y: D.y - 11, size: 11, font: D.bold, color: ACCENT });
  for (const ln of wrap(titleText, D.bold, 11.5, CW - numW)) {
    D.page.drawText(ln, { x: M + numW, y: D.y - 11, size: 11.5, font: D.bold, color: INK }); D.y -= 14;
  }
  D.y -= 3;
}

/* ---- page furniture -------------------------------------------------- */
function furniture(D, docLabel) {
  const pages = D.pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(docLabel, { x: M, y: 30, size: 6.5, font: D.font, color: FAINT });
    const t = `${i + 1} / ${pages.length}`;
    p.drawText(t, { x: PAGE_W - M - D.font.widthOfTextAtSize(t, 6.5), y: 30, size: 6.5, font: D.font, color: FAINT });
  });
}
async function finish(D, filename) {
  furniture(D, D.label);
  // NeedAppearances: let mobile readers regenerate field visuals
  D.form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
  try { D.form.updateFieldAppearances(D.font); } catch { /* non-fatal */ }
  const bytes = await D.pdf.save();
  writeFileSync(join(OUT, filename), bytes);
  console.log(`${filename.padEnd(46)} ${D.pdf.getPageCount()} pages  ${(bytes.length / 1024).toFixed(0)} KB`);
}

/* ==================================================================== */
/* QUICK screen                                                          */
/* ==================================================================== */
async function buildQuick() {
  const D = await newDoc('Charity Partner Quick Screen');
  header(D, {
    kicker: 'Nonprofit fundraising partnerships · Quick screen',
    title: 'Charity Partner Quick Screen',
    standfirst: 'The short form of the eleven-criterion review — a fast pass to decide whether a charitable organization clears the bar, before or during a fundraising engagement. Use the full Standards Review when a criterion needs a closer look.',
  });
  para(D, FILL_NOTE, { size: 8, color: SOFT, gapAfter: 8 });
  para(D, 'For each criterion, tick what you can confirm, note anything open, and give it a rating. A single Fails blocks a new engagement or triggers corrective action on a current one. Rate N/A only with a reason.', { size: 9, color: INK, gapAfter: 6 });
  para(D, SCALE_LEGEND, { size: 7.5, color: FAINT, gapAfter: 10 });

  idBlock(D, [
    { k: 'id_name', label: 'Legal name / DBA' },
    { k: 'id_ein', label: 'EIN' },
    { k: 'id_web', label: 'Website' },
    { type: 'purpose' },
    { k: 'id_reviewer', label: 'Reviewer' },
    { k: 'id_date', label: 'Date' },
  ]);

  let curPart = '';
  for (const c of CRITERIA) {
    if (c.part !== curPart) { partHeading(D, c.part); curPart = c.part; }
    critHeading(D, c, c.shortTitle);
    para(D, c.what, { size: 9, color: SOFT, gapAfter: 6 });
    for (let i = 0; i < c.checks.length; i++) checkItem(D, `c${c.n}_chk_${i}`, c.checks[i]);
    flagsPanel(D, c.flags);
    ratingRow(D, `r${c.n}`);
    textField(D, `c${c.n}_note`, { labelText: '', h: 15, gapAfter: 10 });
  }

  closeBlock(D, { detailed: false });
  await finish(D, 'charity-partner-quick-screen-fillable.pdf');
}

/* ==================================================================== */
/* DETAILED review                                                       */
/* ==================================================================== */
async function buildDetailed() {
  const D = await newDoc('Charity Partner Standards Review');
  header(D, {
    kicker: 'Nonprofit fundraising partnerships · Assessment instrument',
    title: 'Charity Partner Standards Review',
    standfirst: 'A structured review of a charitable organization against eleven evidence-based criteria — used to decide whether to begin a fundraising engagement, and to review an organization already under engagement against the same bar.',
  });
  para(D, FILL_NOTE, { size: 8, color: SOFT, gapAfter: 8 });
  para(D, 'Work through every criterion in order. For each one, gather the evidence under Collect, compare it against Meets the standard and Watch for, then record a rating and your findings. The form is not weighted toward either use: for a prospective organization it is a go / no-go screen; for a current one it is a periodic audit against the standard it was accepted on. A single Fails is a blocker. Rate N/A only with a written reason.', { size: 9, color: INK, gapAfter: 6 });
  para(D, SCALE_LEGEND, { size: 7.5, color: FAINT, gapAfter: 10 });

  idBlock(D, [
    { k: 'id_name', label: 'Legal name / DBA' },
    { k: 'id_ein', label: 'EIN' },
    { k: 'id_inc', label: 'State of incorporation / year founded' },
    { k: 'id_addr', label: 'Principal address' },
    { k: 'id_contact', label: 'Primary contact — name & title' },
    { k: 'id_contact2', label: 'Contact email & phone' },
    { k: 'id_web', label: 'Website' },
    { k: 'id_watch', label: 'Charity watchdog profiles seen' },
    { type: 'purpose' },
    { type: 'activity' },
    { k: 'id_juris', label: 'States / localities where solicitation will occur' },
    { k: 'id_reviewer', label: 'Reviewer' },
    { k: 'id_date', label: 'Date of review / period covered' },
  ]);

  let curPart = '';
  for (const c of CRITERIA) {
    if (c.part !== curPart) { partHeading(D, c.part); curPart = c.part; }
    critHeading(D, c, c.title);
    para(D, c.purpose, { size: 9, color: SOFT, font: D.ital, gapAfter: 8 });

    label(D, 'Collect');
    for (let i = 0; i < c.collect.length; i++) checkItem(D, `c${c.n}_col_${i}`, c.collect[i]);
    gap(D, 4);
    label(D, 'Meets the standard');
    for (let i = 0; i < c.standard.length; i++) checkItem(D, `c${c.n}_std_${i}`, c.standard[i]);
    gap(D, 4);
    flagsPanel(D, c.warnings);
    ratingRow(D, `r${c.n}`);
    textField(D, `c${c.n}_note`, { labelText: 'Findings & evidence reviewed', h: 34, multiline: true, gapAfter: 12 });
  }

  closeBlock(D, { detailed: true });
  await finish(D, 'charity-partner-standards-review-fillable.pdf');
}

/* ---- shared close --------------------------------------------------- */
function closeBlock(D, { detailed }) {
  ensure(D, 60);
  D.y -= 16;
  D.page.drawLine({ start: { x: M, y: D.y }, end: { x: M + CW, y: D.y }, thickness: 1.5, color: ACCENT });
  D.y -= 14;
  D.page.drawText(detailed ? 'FINDINGS & DETERMINATION' : 'OUTCOME', { x: M, y: D.y - 11, size: 11, font: D.bold, color: INK });
  D.y -= 20;

  if (detailed) {
    label(D, 'Blockers — every criterion rated "Fails"');
    textField(D, 'close_blockers', { h: 40, multiline: true, gapAfter: 12 });
    label(D, 'Remediation items — "Material concern" and "Minor gaps"');
    const w = [0.44, 0.24, 0.16, 0.16];
    colHeaders(D, ['Item', 'Owner', 'Due', 'Re-check'], w);
    for (let r = 1; r <= 5; r++) fieldRow(D, [`rem_${r}_item`, `rem_${r}_owner`, `rem_${r}_due`, `rem_${r}_recheck`], w);
    gap(D, 8);
  }

  const colW = (CW - 16) / 2;
  ensure(D, 20);
  D.page.drawText('IF PROSPECTIVE', { x: M, y: D.y - 7.5, size: 7, font: D.bold, color: FAINT });
  D.page.drawText('IF CURRENT PARTNER', { x: M + colW + 16, y: D.y - 7.5, size: 7, font: D.bold, color: FAINT });
  D.y -= 14;
  const startY = D.y;
  // left column
  radioStackCol(D, 'out_p', OUTCOME_PROSPECTIVE, M, colW);
  const leftEnd = D.y;
  D.y = startY;
  radioStackCol(D, 'out_c', OUTCOME_CURRENT, M + colW + 16, colW);
  D.y = Math.min(leftEnd, D.y) - 6;

  textField(D, 'close_note', { labelText: detailed ? 'Rationale / conditions' : 'Conditions / notes', h: detailed ? 30 : 16, multiline: detailed, gapAfter: 12 });

  const sw = [0.5, 0.5];
  colHeaders(D, ['Reviewed by / date', 'Approved by / date'], sw);
  fieldRow(D, ['sign_rev', 'sign_app'], sw);
  colHeaders(D, ['Next review', 'File reference'], sw);
  fieldRow(D, ['sign_next', 'sign_ref'], sw);
  gap(D, 10);
  para(D, FOOTNOTE, { size: 7.5, color: FAINT, font: D.ital, gapAfter: 2 });
}

function radioStackCol(D, name, options, x0, colW) {
  const rg = D.form.createRadioGroup(name);
  const size = 10;
  for (const [val, text] of options) {
    const lx = x0 + size + 6, lw = colW - size - 6;
    const lines = wrap(text, D.font, 8.5, lw);
    const h = Math.max(size + 2, lines.length * 8.5 * 1.3) + 5;
    ensure(D, h);
    const top = D.y;
    rg.addOptionToPage(val, D.page, { x: x0, y: top - size - 0.5, width: size, height: size, borderWidth: 1, borderColor: RULE2 });
    let ly = top - 8.5;
    for (const ln of lines) { D.page.drawText(ln, { x: lx, y: ly, size: 8.5, font: D.font, color: INK }); ly -= 8.5 * 1.3; }
    D.y = top - h;
  }
}

/* ---- go ------------------------------------------------------------- */
await buildQuick();
await buildDetailed();
console.log('done →', OUT);
