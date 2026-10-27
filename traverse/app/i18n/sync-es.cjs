// Copies i18n/engine.js into the app page, between <!-- i18n:start --> and <!-- i18n:end --> (inserted before the first script
// the first time), and i18n/es.json beside the page as es.json, which the engine fetches only on a Spanish device (2026-10-27,
// code review item 7b: the dictionary was 50 KB of every page load). Run after editing either:  node traverse/app/i18n/sync-es.cjs
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'summit-de59ae83'), PAGE = path.join(DIR, 'index.html');
const dict = JSON.parse(fs.readFileSync(path.join(__dirname, 'es.json'), 'utf8'));
const engine = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const block = '<!-- i18n:start -->\n<script>\n' + engine + '</script>\n<!-- i18n:end -->\n';
let s = fs.readFileSync(PAGE, 'utf8');
const a = s.indexOf('<!-- i18n:start -->'), b = s.indexOf('<!-- i18n:end -->');
if (a >= 0 && b > a) s = s.slice(0, a) + block + s.slice(b + '<!-- i18n:end -->\n'.length);
else { const i = s.indexOf('<script>'); if (i < 0) throw new Error('no script'); s = s.slice(0, i) + block + s.slice(i); }
fs.writeFileSync(PAGE, s);
fs.writeFileSync(path.join(DIR, 'es.json'), JSON.stringify(dict));
console.log('synced the engine into', path.basename(PAGE), 'and', Object.keys(dict).length, 'phrases into es.json');
