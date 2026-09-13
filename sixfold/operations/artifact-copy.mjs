/*
  The artifact publisher supplies its own <head>/<body> skeleton, so an
  artifact takes an UNWRAPPED copy of the built page: <title>, <style>, and
  the sheet markup, with the document scaffolding stripped. Same convention
  as the other sixfold/marketing sheets. Regenerate after any rebuild.
*/
import { readFileSync, writeFileSync } from 'node:fs';

for (const n of ['gear-checklist', 'quote-walk-sheet']) {
  const h = readFileSync(`${n}.html`, 'utf8');
  const title = h.match(/<title>(.*?)<\/title>/)[1];
  const style = h.match(/<style>[\s\S]*?<\/style>/g).join('\n');
  const body = h.match(/<body>([\s\S]*)<\/body>/)[1].trim();
  writeFileSync(`${n}.artifact.html`, `<title>${title}</title>\n${style}\n\n${body}\n`);
  console.log(`${n}.artifact.html`);
}
