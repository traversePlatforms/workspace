// Copies i18n/es.json and i18n/engine.js into the app page, between <!-- i18n:start --> and <!-- i18n:end --> (inserted before
// the first script the first time). Run after editing either:  node traverse/app/i18n/sync-es.cjs
const fs = require('fs'), path = require('path');
const PAGE = path.join(__dirname, '..', 'summit-de59ae83', 'index.html');
const dict = JSON.parse(fs.readFileSync(path.join(__dirname, 'es.json'), 'utf8'));
const engine = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const block = '<!-- i18n:start -->\n<script type="application/json" id="i18n-es">' + JSON.stringify(dict).replace(/<\//g, '<\/') + '</script>\n<script>\n' + engine + '</script>\n<!-- i18n:end -->\n';
let s = fs.readFileSync(PAGE, 'utf8');
const a = s.indexOf('<!-- i18n:start -->'), b = s.indexOf('<!-- i18n:end -->');
if (a >= 0 && b > a) s = s.slice(0, a) + block + s.slice(b + '<!-- i18n:end -->\n'.length);
else { const i = s.indexOf('<script>'); if (i < 0) throw new Error('no script'); s = s.slice(0, i) + block + s.slice(i); }
fs.writeFileSync(PAGE, s); console.log('synced', Object.keys(dict).length, 'phrases into', path.basename(PAGE));
