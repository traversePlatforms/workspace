// Structural check on the shipped bundle. Written as a file, not `node -e`:
// bash double-quoting eats regex backslashes and the check silently passes.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];

function walk(dir, base = '', acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, `${base}${name}/`, acc);
    else if (name.endsWith('.html')) acc.push(base + name);
  }
  return acc;
}

const pages = walk(root).sort();
let problems = 0;

for (const rel of pages) {
  const html = readFileSync(join(root, rel), 'utf8');
  for (const tag of ['section', 'details', 'summary', 'div', 'ul', 'li']) {
    const open = (html.match(new RegExp(`<${tag}(?=[\\s>])`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) {
      problems++;
      console.log(`UNBALANCED ${rel} <${tag}> ${open}/${close}`);
    }
  }
  if (html.includes('<!--')) {
    problems++;
    console.log(`COMMENT LEFT ${rel}`);
  }
}

console.log(
  problems === 0
    ? `${pages.length} shipped pages: all tags balanced, no comments — OK`
    : `${problems} problem(s)`,
);
