/* Add or remove the staging <meta name="robots" content="noindex"> on every page.
   node deploy/toggle-noindex.mjs off   -> remove it (do this at launch)
   node deploy/toggle-noindex.mjs on    -> put it back
   Also reminds you about robots.txt. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = (process.argv[2] || '').toLowerCase();
if (mode !== 'on' && mode !== 'off') {
  console.error('usage: node deploy/toggle-noindex.mjs on|off');
  process.exit(1);
}
const META = '<meta name="robots" content="noindex">';

async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name === 'deploy' || e.name.startsWith('.')) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let n = 0;
for (const p of await walk(site)) {
  let html = await readFile(p, 'utf8');
  const has = html.includes(META);
  if (mode === 'off' && has) {
    html = html.replace(new RegExp('\\s*' + META.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
    n++;
  } else if (mode === 'on' && !has) {
    html = html.replace('<meta name="viewport"', META + '\n<meta name="viewport"');
    n++;
  } else {
    continue;
  }
  await writeFile(p, html);
  console.log(mode === 'off' ? 'cleared' : 'added ', relative(site, p));
}
console.log(`\n${n} page(s) changed.`);
console.log(mode === 'off'
  ? 'Now also edit robots.txt: delete the "Disallow: /" line.'
  : 'robots.txt still has "Disallow: /" for staging — leave it.');
