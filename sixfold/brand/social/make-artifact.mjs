/* Unwrapped, self-contained copy of review.html for the artifact publisher:
   strips the document scaffolding and inlines every PNG as a data: URI, because
   a published artifact cannot fetch sibling files. Re-run after build-social.mjs. */
import { readFileSync, writeFileSync } from 'node:fs';

let h = readFileSync('review.html', 'utf8');
const title = h.match(/<title>(.*?)<\/title>/)[1];
const style = h.match(/<style>[\s\S]*?<\/style>/)[0];
let body = h.match(/<body>([\s\S]*)<\/body>/)[1].trim();

let n = 0;
body = body.replace(/src="([^"]+\.png)"/g, (_, f) => {
  n++;
  return `src="data:image/png;base64,${readFileSync(f).toString('base64')}"`;
});

writeFileSync('review.artifact.html', `<title>${title}</title>\n${style}\n\n${body}\n`);
console.log(`inlined ${n} images -> review.artifact.html ${(readFileSync('review.artifact.html').length/1048576).toFixed(2)} MB`);
