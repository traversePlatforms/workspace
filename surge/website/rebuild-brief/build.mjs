/* Inlines _doc.css into each .src.html at the <!--STYLE--> marker and writes the
   standalone .html beside it. Same arrangement as sixfold/operations/build.mjs:
   the .html here is generated and double-clickable, _doc.css is the single
   source for the print register. Edit the .src.html or _doc.css, never the
   generated .html.

   Then:  node ../../../shared/tools/Print-Pdf.mjs <fileUrl> <out.pdf> "<footer>"

   Run:  node build.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '_doc.css'), 'utf8');

for (const name of ['rebuild-brief', 'seo-explained']) {
  const src = readFileSync(join(here, `${name}.src.html`), 'utf8');
  if (!src.includes('<!--STYLE-->')) throw new Error(`${name}: no <!--STYLE--> marker`);
  const out = src.replace('<!--STYLE-->', `<style>\n${css}</style>`);
  writeFileSync(join(here, `${name}.html`), out, 'utf8');
  console.log(`${name}.html  ${(out.length / 1024).toFixed(1)} KB`);
}
