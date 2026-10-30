// The example end-of-day email as a PDF (2026-10-30): eod-example.php draws it with the app's own code (made-up numbers, a sample roofing
// company), headless Chrome prints it as one tall page the width of the email. Writes traverse/business/eod-report-example.pdf and checks how many pages it came to.
//   node traverse/business/eod-example-pdf.mjs [copy-to.pdf]
import { spawn, execFileSync } from 'node:child_process'; import { writeFileSync, mkdtempSync, copyFileSync } from 'node:fs'; import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)); const out = join(here, 'eod-report-example.pdf');
const html = execFileSync('php', [join(here, 'eod-example.php')], { encoding: 'utf8' });
const dir = mkdtempSync(join(tmpdir(), 'eodpdf-')); const htmlFile = join(dir, 'eod.html'); writeFileSync(htmlFile, html);
const port = 9950 + Math.floor(Math.random() * 40);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${join(dir, 'p')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let w = null; for (let i = 0; i < 60 && !w; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((x) => x.type === 'page'); if (p) w = p.webSocketDebuggerUrl; } catch (e) {} if (!w) await sleep(200); }
const ws = new WebSocket(w); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x.result); pend.delete(x.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Page.enable'); await send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') }); await sleep(1500);
/* one tall page the width of the email, as it scrolls on a screen: an email split across Letter pages breaks mid-section */
await send('Emulation.setDeviceMetricsOverride', { width: 680, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
const lm = await send('Page.getLayoutMetrics'); const hPx = Math.ceil((lm.cssContentSize || lm.contentSize).height) + 4;
const pdf = await send('Page.printToPDF', { printBackground: true, displayHeaderFooter: false, paperWidth: 680 / 96, paperHeight: hPx / 96, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
const buf = Buffer.from(pdf.data, 'base64'); writeFileSync(out, buf);
const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log('wrote ' + out + ' (' + Math.round(buf.length / 1024) + ' KB, ' + pages + (pages === 1 ? ' page)' : ' pages)'));
if (process.argv[2]) { copyFileSync(out, process.argv[2]); console.log('copied to ' + process.argv[2]); }
ws.close(); chrome.kill();
