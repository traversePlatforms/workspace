// Print a local page to PDF over CDP, with a real footer and page numbers.
// Usage: node pdf.mjs <fileUrl> <outPdf> "<footer left text>"
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, footerLeft = ""] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), "cdp-profile-"));
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--remote-debugging-port=9225",
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targetWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:9225/json/list")).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no debug target");
}
const ws = new WebSocket(await targetWs());
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id; pending.set(n, { resolve, reject });
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
// Print the print stylesheet, not the screen one, while the page settles.
await send("Emulation.setEmulatedMedia", { media: "print" });
await send("Page.navigate", { url });
await sleep(3000);

/* Wait for the webfonts before committing to paper. document.fonts.ready only
   covers faces the layout has already asked for, so request each family
   explicitly first. Report what actually loaded — do NOT try to verify the
   result by reading font names back out of the PDF afterwards: Chrome subsets
   its embedded faces in a way neither a /BaseFont scan nor pdfium's name lookup
   reports, so a correct PDF reads as "Archivo missing" and sends you chasing a
   bug that isn't there. Compare a rendered page against the browser instead. */
const FAMILIES = ["Archivo", "Public Sans", "IBM Plex Mono", "Newsreader"];
const check = await send("Runtime.evaluate", {
  expression: `(async () => {
    const fams = ${JSON.stringify(FAMILIES)};
    const specs = [];
    for (const f of fams) for (const w of [400, 500, 600, 700, 800, 900]) {
      specs.push(w + ' 16px "' + f + '"');
    }
    await document.fonts.ready;
    await Promise.all(specs.map(s => document.fonts.load(s).catch(() => null)));
    await document.fonts.ready;
    const loaded = [...document.fonts].filter(f => f.status === 'loaded');
    const byFam = {};
    for (const f of loaded) {
      const k = f.family.replace(/^"|"$/g, '');
      (byFam[k] = byFam[k] || []).push(f.weight);
    }
    const declared = new Set([...document.fonts].map(f => f.family.replace(/^"|"$/g, '')));
    return JSON.stringify({
      loaded: byFam,
      neverDeclared: fams.filter(f => !declared.has(f)),
    });
  })()`,
  awaitPromise: true, returnByValue: true,
});
const fontState = JSON.parse(check.result.value);
for (const [fam, weights] of Object.entries(fontState.loaded)) {
  console.log(`  font ${fam}: ${weights.sort().join(", ")}`);
}
if (fontState.neverDeclared.length) {
  console.log("  NOTE: no @font-face for " + fontState.neverDeclared.join(", ")
    + " (fine if the page does not use it)");
}
await sleep(1500);

const style = "font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#5c665d;width:100%;padding:0 14mm;";
const footer = `<div style="${style}display:flex;justify-content:space-between;">
  <span>${footerLeft}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

const pdf = await send("Page.printToPDF", {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: footer,
  marginTop: 0.59, marginBottom: 0.67, marginLeft: 0.55, marginRight: 0.55,
});
writeFileSync(out, Buffer.from(pdf.data, "base64"));
console.log("wrote " + out);

ws.close(); chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
