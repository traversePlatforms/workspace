// End-of-day reports: the shared look and plumbing (2026-11-23). Used by daily.mjs (the Changes report) and weekly.mjs (Business numbers).
// The look is the one the daily reports have used since 27 Oct (Brandon's end-of-day picture): navy header band, number tiles, sections
// in white cards, Outfit + DM Sans from traverse/app/tools/eod-assets (Open Font License). Font paths stay relative
// (url('../traverse/...')) because the laptop's sync (traverse/ops/jarvis-cloud-sync.sh vm_eod) rewrites exactly that prefix.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..', '..');
export const OUTDIR = process.env.EOD_OUTDIR || path.join(REPO, 'changelog');   // EOD_OUTDIR: a trial render somewhere else
export const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.HOME || '.', 'jarvis', 'localappdata');
export const SNAPDIR = path.join(LOCALAPPDATA, 'ProjectBackup', 'eod');

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Colorado dates: every report day is Mountain time
export function denverDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function longDay(s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(s + 'T12:00:00Z'));
}
export const shortDay = (s) => longDay(s, { weekday: 'short', day: 'numeric', month: 'short' });

export const CSS = `
@font-face{font-family:Outfit;font-weight:800;src:url('../traverse/app/tools/eod-assets/Outfit-ExtraBold.ttf')}
@font-face{font-family:Outfit;font-weight:600;src:url('../traverse/app/tools/eod-assets/Outfit-SemiBold.ttf')}
@font-face{font-family:'DM Sans';font-weight:400;src:url('../traverse/app/tools/eod-assets/DMSans-Regular.ttf')}
@font-face{font-family:'DM Sans';font-weight:600;src:url('../traverse/app/tools/eod-assets/DMSans-SemiBold.ttf')}
@font-face{font-family:'DM Sans';font-weight:700;src:url('../traverse/app/tools/eod-assets/DMSans-Bold.ttf')}
:root{--navy:#13294b;--navyd:#0d1d36;--ink:#16202e;--soft:#56627a;--line:#e3e7ee;--bg:#f4f6f9;--card:#fff;--orange:#d6400c;--good:#2f7a3a;--goodbg:#e4f2e3;--warn:#a85d00;--warnbg:#fff2dc}
@page{size:Letter;margin:0.45in}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 'DM Sans',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:860px;margin:0 auto;padding:24px 16px 48px}
.head{background:var(--navy);color:#fff;border-radius:16px;padding:26px 28px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.head h1{font:800 30px/1.1 Outfit,sans-serif;margin:0}
.head .d{color:#c9d5e6;margin-top:6px;font-size:15px}
.head .tag{font:600 13px Outfit,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#ffb38f}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0 8px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi b{display:block;font:800 40px/1 Outfit,sans-serif;color:var(--navy)}
.kpi span{display:block;font-weight:600;margin-top:6px}
.kpi small{color:var(--soft);font-size:13px}
.kpi.warn b{color:var(--orange)}
h2{font:600 20px Outfit,sans-serif;margin:26px 0 10px;color:var(--navy);display:flex;align-items:center;gap:10px}
h2 .n{font:700 12px 'DM Sans',sans-serif;background:var(--navy);color:#fff;border-radius:999px;padding:2px 9px}
h3{font:600 14px 'DM Sans',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);margin:14px 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.sec{break-inside:avoid;page-break-inside:avoid}
.row{break-inside:avoid}h2{break-after:avoid}
.row{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:11px 18px;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row .k{font-weight:700;color:var(--ink)}
.row .k i{display:block;font-style:normal;font-weight:400;color:var(--soft);font-size:12px}
.row .v{color:#2a3446}
.row .v em{font-style:normal;color:var(--soft)}
.pill{display:inline-block;font:700 11px 'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:1px 8px;margin-right:6px;vertical-align:1px}
.live{background:var(--goodbg);color:var(--good)}
.off{background:#eef0f4;color:var(--soft)}
.posted{background:#e6ecfb;color:#2b4fa8}
.run{background:var(--warnbg);color:var(--warn)}
.wait .row .k{color:var(--orange)}
.mrow{display:grid;grid-template-columns:1fr 120px 120px 110px;gap:12px;padding:10px 18px;border-top:1px solid var(--line);align-items:baseline}
.mrow:first-child{border-top:0}
.mrow.th{background:#f8f9fb;font:700 11.5px 'DM Sans',sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--soft);padding-top:7px;padding-bottom:7px}
.mrow .m{font-weight:700}
.mrow .m i{display:block;font-style:normal;font-weight:400;color:var(--soft);font-size:12px;line-height:1.35}
.mrow .n{text-align:right;font-variant-numeric:tabular-nums}
.mrow .n.this{font-weight:700;color:var(--navy)}
.mrow .na{grid-column:2 / 5;color:var(--soft);font-style:italic;text-align:right}
.mrow .txt{grid-column:2 / 5;text-align:right;color:#2a3446}
.chg{display:inline-block;font:700 12.5px 'DM Sans',sans-serif;border-radius:999px;padding:1px 9px;background:#eef0f4;color:var(--soft)}
.chg.up{background:var(--goodbg);color:var(--good)}
.chg.down{background:var(--warnbg);color:var(--warn)}
.dash{color:#9aa3b2}
.foot{color:var(--soft);font-size:12.5px;margin-top:28px;border-top:1px solid var(--line);padding-top:12px}
@media print{body{font-size:12px;line-height:1.36}.page{padding:0 4px 8px}.head{padding:14px 22px}.head h1{font-size:26px}.kpis{margin:12px 0 4px;gap:10px}.kpi{padding:8px 14px}.kpi b{font-size:28px}.kpi small{font-size:11.5px}h2{font-size:16px;margin:10px 0 5px}h3{margin:8px 0 4px}.row{padding:4px 14px;grid-template-columns:140px 1fr}.mrow{padding:4px 14px}.mrow .m i{font-size:10.5px}.foot{margin-top:6px;padding-top:6px;font-size:11px}.sec{break-inside:auto;page-break-inside:auto}}
@media (max-width:620px){.row{grid-template-columns:1fr;gap:2px}.head{flex-direction:column;align-items:flex-start}.mrow{grid-template-columns:1fr 70px 70px 70px}}
`;

export function page({ title, comment = '', tag, h1, sub, right = '', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<!-- ${esc(comment)} Made by shared/tools/eod (README.md there). Fonts: Outfit + DM Sans from traverse/app/tools/eod-assets (Open Font License). -->
<style>${CSS}</style>
</head>
<body>
<div class="page">
<div class="head">
  <div><div class="tag">${esc(tag)}</div><h1>${esc(h1)}</h1><div class="d">${esc(sub)}</div></div>
  <div class="d">${esc(right)}</div>
</div>
${body}
</div>
</body>
</html>
`;
}

export function tiles(list) {
  if (!list || !list.length) return '';
  return `<div class="kpis">\n${list.map((t) => `  <div class="kpi${t.warn ? ' warn' : ''}"><b>${esc(t.n)}</b><span>${esc(t.label)}</span><small>${esc(t.sub || '')}</small></div>`).join('\n')}\n</div>`;
}

// the PDF, with the same headless Chrome the daily reports have used
export function pdf(htmlFile) {
  const out = htmlFile.replace(/\.html$/, '.pdf');
  const chrome = process.env.CHROME || 'google-chrome';
  const prof = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'eod-chrome-'));
  try {
    execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${prof}`, `--print-to-pdf=${out}`, 'file://' + htmlFile], { stdio: 'ignore', timeout: 120000 });
  } finally { fs.rmSync(prof, { recursive: true, force: true }); }
  return out;
}
