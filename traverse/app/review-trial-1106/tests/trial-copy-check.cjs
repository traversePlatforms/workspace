// The free trial (2026-11-06): no customer-facing copy promises money back any more, and the trial lines are where they should be.
// Reads the sources and the built pages (run after build-editions.cjs, build-legal/preview/site.cjs).
//   node traverse/app/review-trial-1106/tests/trial-copy-check.cjs
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..'), T = path.join(R, 'traverse');
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
const read = (p) => fs.readFileSync(path.join(T, p), 'utf8');
/* comments may still say what the trial replaced: only what a customer can see is checked */
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
const NO = /money-back|money back|garant[ií]a de devoluci[oó]n|refund (?:that|your) first payment/i;
const pages = ['app/summit-de59ae83/index.html', 'app/i18n/es.json', 'app/summit-de59ae83/es.json',
  'marketing-site/project/Main.dc.html', 'marketing-site/preview/tp-5ea36a05/index.html',
  'marketing-site/site-src/demo/index.html', 'marketing-site/site-src/start/index.html', 'marketing-site/site-src/start/welcome/index.html', 'marketing-site/site-src/cancellation/index.html', 'marketing-site/site-src/terms/index.html',
  'marketing-site/site/public_html/index.html', 'marketing-site/site/public_html/demo/index.html', 'marketing-site/site/public_html/start/index.html', 'marketing-site/site/public_html/cancellation/index.html', 'marketing-site/site/public_html/terms/index.html'];
const ed = path.join(T, 'editions', 'dist', 'public_html');
if (fs.existsSync(ed)) for (const d of fs.readdirSync(ed)) if (fs.existsSync(path.join(ed, d, 'index.html'))) { pages.push('editions/dist/public_html/' + d + '/index.html'); pages.push('editions/dist/public_html/' + d + '/es.json'); }
const ct = path.join(T, 'editions', 'dist', 'client-templates');
if (fs.existsSync(ct)) for (const d of fs.readdirSync(ct)) pages.push('editions/dist/client-templates/' + d + '/index.html');
for (const p of pages) t(!NO.test(bare(read(p))), 'no money-back wording: ' + p);
/* the customer-facing strings the PHP sends (comments may still say what the trial replaced) */
const strings = (src) => (src.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || []).join('\n');
for (const p of ['app/api/billing.php', 'app/api/rounds.php', 'app/api/traverse-clients-lib.php', 'app/api/traverse-start.php', 'ops/billing-mark-live.php']) t(!NO.test(strings(bare(read(p)))), 'no money-back in the strings of ' + p);
const ag = read('business/client-agreement.md'), cp = read('business/cancellation-policy-DRAFT.md');
t(!NO.test(ag) && /\*\*9\.3 Setup and the free trial\.\*\*/.test(ag) && /version 4, dated 6 November 2026/.test(ag), 'agreement: §9.3 is the free trial; version 4, 6 November 2026');
t(/expressly provides \(§2\.6, §10\.4, §14\.1\)/.test(ag), 'agreement §9.7: §9.3 is no longer a refund case');
t(/### Setup and the 7-day free trial/.test(cp) && !/money-back guarantee below|In your first 7 days live, under the money-back/.test(cp), 'cancellation policy: the free trial section, no guarantee bullet');
const home = read('marketing-site/site/public_html/index.html');
t(home.includes('7 days free once your app is live: card at signup, cancel before day 7 and you pay nothing.'), 'homepage pricing line');
t(home.includes('25% off your first 12 months, starting with your first bill after the 7 free days'), 'homepage founding paragraph');
t(home.includes('enter your card (nothing is charged yet)') && home.includes('your 7 free days start that day'), 'homepage setup FAQ');
t(home.includes('starts with 7 days free from the day your app is live: cancel before day 7 and you pay nothing.'), 'homepage cancel FAQ');
t(read('marketing-site/site/public_html/demo/index.html').includes('Every plan starts with 7 days free once your app is live.'), 'demo page');
const st = read('marketing-site/site/public_html/start/index.html');
t(st.includes("P.freeDays ? '$0' : first") && st.includes(" days free once your app is live. Cancel before day "), 'checkout page: $0 due today, the first charge after the trial, the trial line');
t(read('marketing-site/site/public_html/cancellation/index.html').includes('Last updated: 6 November 2026'), 'cancellation page dated 6 November 2026');
const rounds = read('app/api/rounds.php');
t(/const AGREEMENT_VERSION = '2026-11-06';/.test(rounds) && read('app/api/traverse-start.php').includes("'agreement' => '2026-11-06'"), 'the agreement version admins accept is 2026-11-06 (app and website)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
