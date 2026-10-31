// node ed-mode.cjs <roofing|yards|solar|pest|security|sixfold>
// Puts the harness install into one edition (its built page from build-editions.cjs page(), its company.json fields and features)
// or back into Sixfold (the source page and company-sixfold.json). The page keeps calling ../api/rounds.php so the one harness API serves it.
const fs = require('fs'), path = require('path'), vm = require('vm');
const D = __dirname;
const WT = 'C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-ab973d12f98fa6dba';
const ED = path.join(WT, 'traverse/editions');
const SRCPAGE = path.join(WT, 'traverse/app/summit-de59ae83/index.html');
const PAGE = path.join(D, 'www/summit-de59ae83/index.html');
const CO = path.join(D, 'sixfold-data/rounds/company.json');
const six = JSON.parse(fs.readFileSync(path.join(D, 'company-sixfold.json'), 'utf8'));
const which = process.argv[2];
if (which === 'sixfold') {
  fs.copyFileSync(SRCPAGE, PAGE);
  fs.writeFileSync(CO, JSON.stringify(Object.assign({}, six, { oneDevice: false })));
  console.log('sixfold'); process.exit(0);
}
let src = fs.readFileSync(path.join(ED, 'build-editions.cjs'), 'utf8');
src = src.slice(0, src.indexOf('\n(async () => {'));
src = src.replace('function coloradoGroups() {', 'function coloradoGroups() { return null;');
src += '\nmodule.exports = { EDITIONS, page };';
const mod = { exports: {} };
const MAIN_ED = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/editions';
const req = (p) => require(p === './minify-page.cjs' ? path.join(MAIN_ED, p) : p.startsWith('.') ? path.join(ED, p) : p);
vm.runInThisContext('(function (require, module, exports, __dirname, __filename) {' + src + '\n})', { filename: 'build-editions.cjs' })(req, mod, mod.exports, ED, path.join(ED, 'build-editions.cjs'));
const { EDITIONS, page } = mod.exports;
const E = EDITIONS[which]; if (!E) throw new Error('no edition ' + which);
let html = page(E);
html = html.split('../api/' + E.api + '-rounds.php').join('../api/rounds.php');
fs.writeFileSync(PAGE, html);
{ const st = /B1D:([0-9a-f]{12})/.exec(html); if (st) fs.writeFileSync(path.join(D, 'www/summit-de59ae83/version.txt'), st[1]); }   /* the page's own stamp, so the harness does not show "There's been an update" */
const ec = E.company(); delete ec.townGroups;
const c = JSON.parse(JSON.stringify(six)); delete c.a365;
Object.assign(c, ec, { name: ec.name || E.name });
c.features = Object.assign({}, ec.features, { crew: true, company: true, walkdesk: true, billexempt: true });
c.oneDevice = false;
fs.writeFileSync(CO, JSON.stringify(c));
console.log(which + ' (' + c.name + ', best ' + c.best + ', page ' + Math.round(html.length / 1024) + ' KB)');
