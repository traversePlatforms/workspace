/*
  Inlines _style.css into each .src.html at the <!--STYLE--> marker and writes
  the standalone .html beside it.

  Why a build step at all: these two documents share one print register and the
  folder convention here is that every .html is standalone and double-clickable.
  Rather than keep two divergent copies of the same 400 lines, _style.css is the
  single source and this splices it in. Edit the .src.html or _style.css, never
  the generated .html.

  Run:  node build.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '_style.css'), 'utf8');

for (const name of ['service-agreement', 'field-instructions', 'service-agreement-tablet']) {
  const src = readFileSync(join(here, `${name}.src.html`), 'utf8');
  if (!src.includes('<!--STYLE-->')) throw new Error(`${name}: no <!--STYLE--> marker`);
  const out = src.replace('<!--STYLE-->', `<style>\n${css}</style>`);
  writeFileSync(join(here, `${name}.html`), out, 'utf8');
  console.log(`${name}.html  ${(out.length / 1024).toFixed(1)} KB`);
}
