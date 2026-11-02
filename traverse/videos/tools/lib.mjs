// Shared bits for the app walkthrough videos: headless Chrome over CDP, the API as a person, and helpers.
import { spawn, spawnSync } from 'node:child_process'; import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* every throwaway Chrome profile is deleted when the process ends (2026-10-25: 208 GB of cdp-* folders had piled up) */
const cdpDirs = [], chromes = [];
export const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
/* the whole Chrome tree is ended first (its helper processes hold the profile open; a plain kill left the folder behind), then the folder goes */
process.on('exit', () => {
  for (const p of chromes) try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL'); } catch {}
  /* a Chrome helper can hold a file a few seconds after the tree is ended: try again for up to 15 s (a real wait, not a busy loop) */
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (const d of cdpDirs) for (let i = 0; i < 50; i++) { try { rmSync(d, { recursive: true, force: true }); break; } catch { Atomics.wait(nap, 0, 0, 300); } }
});
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(130));
export function chrome(port) {
  const p = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--disable-breakpad', '--disable-crash-reporter', `--remote-debugging-port=${port}`, `--user-data-dir=${cdpDir()}`, 'about:blank'], { stdio: 'ignore' });
  chromes.push(p); return p;
}
export async function attach(port, match) {
  for (let i = 0; i < 80; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(match); if (p) return p; } catch {} await sleep(250); }
  return null;
}
export function session(url) {
  const ws = new WebSocket(url); let id = 0; const pend = new Map(), errors = [], handlers = [];
  const ready = new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x.result || x.error); pend.delete(x.id); } if (x.method === 'Runtime.exceptionThrown') errors.push(x.params.exceptionDetails.exception?.description || x.params.exceptionDetails.text); for (const h of handlers) h(x); };
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); return r.exceptionDetails ? 'ERR ' + (r.exceptionDetails.exception?.description || '') : r.result?.value; };
  const until = async (e, ms = 20000) => { for (let k = 0; k < ms / 250; k++) { if ((await js(e)) === true) return true; await sleep(250); } return false; };
  return { ready, send, js, until, errors, ws, on: (h) => handlers.push(h) };
}
export function api(API) {
  const jar = {};
  return async function call(who, action, params = {}, body) {
    let u = `${API}?action=${action}`; for (const [k, v] of Object.entries(params)) u += `&${k}=${encodeURIComponent(v)}`;
    const r = await fetch(u, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jar[who] ? { Cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    return { status: r.status, j };
  };
}
