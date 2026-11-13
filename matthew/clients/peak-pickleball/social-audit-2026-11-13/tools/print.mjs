// Print an HTML file to PDF with headless Chrome (CSS @page size), and report clipping per .page.
// Usage: node tools/print.mjs <in.html> <out.pdf>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [inp, out] = process.argv.slice(2);
const PORT = 9241;
const profile = mkdtempSync(join(tmpdir(), 'peak-print-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl; for (let i = 0; i < 60 && !wsUrl; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); wsUrl = l.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(250); }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pend.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable');
await send('Emulation.setEmulatedMedia', { media: 'print' });
await send('Page.navigate', { url: pathToFileURL(resolve(inp)).href });
await sleep(2000);
const chk = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify([...document.querySelectorAll('.page')].map((p,i)=>{const r=p.getBoundingClientRect(); const kids=[...p.querySelectorAll('*')]; const over=kids.filter(k=>{const b=k.getBoundingClientRect(); return b.bottom>r.bottom+0.5 || b.right>r.right+0.5}).map(k=>k.tagName+'.'+k.className+':'+(k.innerText||'').slice(0,40)); const foot=p.querySelector('.foot'); const last=[...p.children].filter(c=>c!==foot).pop(); return {page:i+1, h:Math.round(r.height), spare: foot? Math.round(foot.getBoundingClientRect().top - last.getBoundingClientRect().bottom):null, overflow: over.slice(0,5)}}))` });
console.log(chk.result.value);
const pdf = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
writeFileSync(out, Buffer.from(pdf.data, 'base64'));
try { await send('Browser.close'); } catch {}
await sleep(1000); try { chrome.kill(); } catch {}
await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log('pdf', out);
