/*
  Inlines _style.css into gear-checklist.src.html at the <!--STYLE--> marker and
  writes the standalone gear-checklist.html beside it.

  Same arrangement as agreements/build.mjs and tax-credit-notebook/build.mjs:
  the .html in this folder is generated and double-clickable, _style.css is the
  single source for the print register. Edit the .src.html or _style.css,
  never the generated .html.

  _style.css here is a copy of agreements/_style.css, which is the per-folder
  convention in this project. It carries furniture this sheet does not use
  (cancellation notices, signature rows); that is deliberate, so the two
  folders stay diffable rather than diverging into two dialects.

  Run:  node build.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '_style.css'), 'utf8');

for (const name of ['gear-checklist', 'quote-walk-sheet', 'job-closeout', 'work-rates', 'event-signup-sheet', 'invoice-example']) {
  const src = readFileSync(join(here, `${name}.src.html`), 'utf8');
  if (!src.includes('<!--STYLE-->')) throw new Error(`${name}: no <!--STYLE--> marker`);
  const out = src.replace('<!--STYLE-->', `<style>\n${css}</style>`);
  writeFileSync(join(here, `${name}.html`), out, 'utf8');
  console.log(`${name}.html  ${(out.length / 1024).toFixed(1)} KB`);
}
