/* Minimal .xlsx reader (2026-10-07): a workbook is a zip of XML. Windows tar unpacks it into a temporary folder; the rows of one
   sheet come back as arrays (shared strings resolved, numbers left as text). Enough for the EIA's survey files; no formulas, dates
   or styles. */
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const TAR = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const col = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

export function readXlsx(file, sheet = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'xl-'));
  try {
    execFileSync(TAR, ['-xf', file, '-C', dir]);
    const ssf = join(dir, 'xl', 'sharedStrings.xml');
    const ss = existsSync(ssf) ? [...readFileSync(ssf, 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))) : [];
    const xml = readFileSync(join(dir, 'xl', 'worksheets', `sheet${sheet}.xml`), 'utf8');
    const rows = [];
    for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/), inl = (c[3] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/);
        row[col(c[1])] = /t="s"/.test(c[2]) && v ? ss[+v[1]] : v ? dec(v[1]) : inl ? dec(inl[1]) : '';
      }
      rows.push(row);
    }
    return rows;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
