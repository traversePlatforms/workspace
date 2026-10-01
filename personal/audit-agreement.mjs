/* Audit of the Tacoma agreement. Checks the things an edit pass breaks:
   stale numbers, dead cross-references, clauses that contradict each other,
   and unbalanced markup. Run from the repo root. */
import { readFileSync } from 'node:fs';

const raw = readFileSync('personal/tacoma-agreement-brandon-long.html', 'utf8');
const h = raw.replace(/<style[\s\S]*?<\/style>/g, '');
/* several checks span a line wrap in the source, so match against a flattened copy */
const flat = h.replace(/\s+/g, ' ');
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + msg); if (!ok) fail++; };

console.log('MONEY AND TERM');
chk(!/\$8,000/.test(h), 'no $8,000 anywhere');
const n7 = (h.match(/\$7,000\.00/g) || []).length;
chk(n7 === 8, `$7,000.00 appears 8 times (got ${n7})`);
chk(!/eight thousand/i.test(h), "no 'eight thousand' spelled out");
chk(/seven thousand/i.test(h), "'seven thousand' spelled out is present");
chk(!/six \(6\) months?/i.test(h) && !/\bsix months\b/i.test(h), "no 'six months' left");
chk(/twelve \(12\)\s*\n?\s*months/.test(h), 'term reads twelve (12) months');

console.log('\nSPELLING (American English)');
for (const w of ['favour', 'licence', 'authorise', 'recognise', 'colour', 'centre', 'organis', 'defence', 'fulfil'])
  chk(!new RegExp(w, 'i').test(h), `no "${w}"`);

console.log('\nCROSS-REFERENCES');
const secs = new Set([...h.matchAll(/<h2[^>]*>(\d+)\./g)].map((m) => m[1]));
const refs = [...new Set([...h.matchAll(/Section (\d+)/g)].map((m) => m[1]))];
const dead = refs.filter((r) => !secs.has(r));
chk(dead.length === 0, `every "Section N" resolves${dead.length ? ' — dead: ' + dead.join(',') : ''}`);
chk(!/Section 12\(b\)\(3\)/.test(h), 'the ambiguous Section 12(b)(3) reference is gone');
const exRef = new Set([...h.matchAll(/Exhibit ([A-E])/g)].map((m) => m[1]));
const exDef = new Set([...h.matchAll(/<h1>Exhibit ([A-E])/g)].map((m) => m[1]));
chk([...exRef].every((e) => exDef.has(e)) && [...exDef].every((e) => exRef.has(e)),
  `Exhibits referenced ${[...exRef].sort().join('')} / defined ${[...exDef].sort().join('')}`);
/* every sub-reference like 6.4 / 14.12 must exist as a top-level item of that section */
function topLevelCount(secNum) {
  const start = h.indexOf(`<h2>${secNum}.`);
  if (start < 0) return 0;
  const end = h.indexOf('<h2', start + 5);
  const chunk = h.slice(start, end < 0 ? undefined : end);
  let depth = 0, count = 0, m;
  const re = /<(\/?)(ol|li)\b/g;
  while ((m = re.exec(chunk))) {
    if (m[2] === 'ol') depth += m[1] ? -1 : 1;
    if (m[2] === 'li' && !m[1] && depth === 1) count++;
  }
  return count;
}
for (const m of new Set([...h.matchAll(/Section (\d+)\.(\d+)/g)].map((x) => x[1] + '.' + x[2]))) {
  const [s, i] = m.split('.').map(Number);
  chk(topLevelCount(s) >= i, `Section ${m} exists (section ${s} has ${topLevelCount(s)} items)`);
}

console.log('\nSURVIVAL AND INTERNAL CONSISTENCY');
chk(/Section 10 and Section 13<\/strong>, which survive/.test(flat), 'Section 8(b) survives s10 AND s13');
chk(/This Section survives the end of this Agreement, however it ends/.test(h), 'Section 13 states its own survival');
chk(/Except for Owner’s ninety-day mechanical responsibility\s+in Section 6\.6/.test(flat),
  'the as-is clause carves out 6.6, so the two do not contradict');
chk(/The two sides are not identical, and this is deliberate/.test(h),
  'the 12(a)/12(b) asymmetry is stated, not contradicted');

console.log('\nTHE NEW CLAUSES');
chk(/Owner remains the owner of the Vehicle and the named\s*\n?owner on the title for the whole Term/.test(h),
  'Section 3 owner-stays-owner is absolute');
chk(/outside this\s*\n?Agreement and Owner does not agree to it/.test(h), 'Section 3 rejects endorse-early escrow');
chk(/C\.R\.S\. 42-3-113\(2\)/.test(h) && /C\.R\.S\. 42-3-113\(6\)/.test(h), 'both statute citations present');
chk(/The fault must <strong>first appear within the ninety \(90\) days<\/strong>/.test(flat),
  'the 6.6 window is unambiguous: the fault must first appear inside the 90 days');
chk(/Mechanical — the baseline for Section 6\.6/.test(h), 'Exhibit A carries a mechanical baseline');
chk(/excluded from Section 6\.6/.test(h), 'Exhibit A says what it excludes');

console.log('\nBLANKS THAT MUST STILL BE FILLED');
console.log(`  fill-in fields: ${(h.match(/class="f /g) || []).length}   checkboxes: ${(h.match(/class="box"/g) || []).length}`);

console.log('\nMARKUP INTEGRITY');
for (const t of ['ol', 'li', 'table', 'tr', 'div']) {
  const o = (h.match(new RegExp('<' + t + '\\b', 'g')) || []).length;
  const c = (h.match(new RegExp('</' + t + '>', 'g')) || []).length;
  chk(o === c, `<${t}> balanced: ${o} open / ${c} close`);
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
