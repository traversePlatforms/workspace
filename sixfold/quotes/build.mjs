/*
  Inlines _style.css into each .src.html at the <!--STYLE--> marker and writes
  the standalone .html beside it.

  Same pattern and same print register as ../agreements/build.mjs — these quotes
  are handed to the same customer as the agreement, often in the same visit, and
  a quote that does not look like the contract it turns into is a quote the
  customer reads twice. _style.css here is a copy of the agreements stylesheet
  with one appended block for quote furniture. Extend that block; do not restyle.

  Run:  node build.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '_style.css'), 'utf8');

for (const name of ['job2-yard-clearance', 'kara-aeration', 'kara-maintenance']) {
  const src = readFileSync(join(here, `${name}.src.html`), 'utf8');
  if (!src.includes('<!--STYLE-->')) throw new Error(`${name}: no <!--STYLE--> marker`);
  const out = src.replace('<!--STYLE-->', `<style>\n${css}</style>`);
  writeFileSync(join(here, `${name}.html`), out, 'utf8');
  console.log(`${name}.html  ${(out.length / 1024).toFixed(1)} KB`);
}
