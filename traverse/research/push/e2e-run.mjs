/* e2e-run.mjs: end-to-end push with headless Chrome and the real push service (Google's FCM), no browser clicking.
 *
 *   node e2e-run.mjs
 *
 * 1. starts `php -S 127.0.0.1:8790 -t e2e` (e2e.php makes a throwaway VAPID key pair in the temp folder);
 * 2. starts Chrome headless (new headless = the full browser) with a fresh profile and the DevTools port;
 * 3. over the DevTools protocol grants the "notifications" permission to http://127.0.0.1:8790 (what a tap on
 *    "Allow" would do), then opens the page with ?auto=1 so it subscribes on load and posts the subscription;
 * 4. asks e2e.php to send a push: PHP encrypts it (webpush.php) and POSTs it to the FCM endpoint Chrome gave;
 * 5. waits for the service worker to report the push arrived (it also shows the notification), with the payload
 *    decrypted by Chrome; then the same with a payload-less push.
 * Needs the internet (FCM) and Chrome on this machine. Prints what happened at every step, and the page's own log
 * if a step times out, so a failure says where. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHP = process.env.PHP || 'C:/Users/Surge Inc/AppData/Local/Microsoft/WinGet/Packages/PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe/php.exe';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = 'http://127.0.0.1:8790';
const CDP_PORT = 9333;
const here = fileURLToPath(new URL('.', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(new Date().toISOString().slice(11, 19) + '  ' + s);
let php, chrome, ws, profile;
const cleanup = async () => {
  try { if (ws && ws.readyState === 1) { cdp('Browser.close').catch(() => {}); await sleep(500); ws.close(); } } catch {}
  try { chrome && chrome.kill(); } catch {}
  try { php && php.kill(); } catch {}
  await sleep(500);
  try { profile && rmSync(profile, { recursive: true, force: true }); } catch {}
};
process.on('SIGINT', async () => { await cleanup(); process.exit(1); });

/* --- minimal DevTools protocol client on Node's built-in WebSocket --- */
let seq = 0; const pending = new Map(); const events = [];
function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
}
async function connectCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
      ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = (m) => {
        const j = JSON.parse(m.data);
        if (j.id && pending.has(j.id)) { const p = pending.get(j.id); pending.delete(j.id); j.error ? p.reject(new Error(p.method + ': ' + JSON.stringify(j.error))) : p.resolve(j.result); }
        else events.push(j);
      };
      return v;
    } catch { await sleep(500); }
  }
  throw new Error('Chrome DevTools port never answered');
}
const state = async () => (await fetch(`${SITE}/e2e.php?action=state`)).json();
async function waitFor(what, test, seconds) {
  for (let i = 0; i < seconds * 2; i++) { const s = await state(); if (test(s)) return s; await sleep(500); }
  throw new Error('timed out waiting for ' + what);
}
async function pageLog(sessionId) {
  try { const r = await cdp('Runtime.evaluate', { expression: "document.getElementById('log').textContent", returnByValue: true }, sessionId); return r.result.value; } catch (e) { return '(no page log: ' + e.message + ')'; }
}

let exitCode = 0;
try {
  say('starting php -S on ' + SITE);
  php = spawn(PHP, ['-S', '127.0.0.1:8790', '-t', join(here, 'e2e')], { stdio: ['ignore', 'ignore', 'pipe'] });
  php.stderr.on('data', (d) => { const s = String(d); if (/error|warning|fatal/i.test(s)) process.stderr.write('  php: ' + s); });
  for (let i = 0; ; i++) { try { await (await fetch(`${SITE}/e2e.php?action=reset`)).json(); break; } catch { if (i > 40) throw new Error('php -S never answered'); await sleep(250); } }
  say('php is up, state reset');

  profile = mkdtempSync(join(tmpdir(), 'push-e2e-chrome-'));
  say('starting Chrome headless (new headless), fresh profile ' + profile);
  chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
                          '--disable-gpu', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
  const v = await connectCdp();
  say('connected: ' + v.Browser);

  await cdp('Browser.grantPermissions', { origin: SITE, permissions: ['notifications'] });
  say('granted "notifications" to ' + SITE + ' over DevTools (what tapping Allow would do)');

  const { targetId } = await cdp('Target.createTarget', { url: `${SITE}/?auto=1` });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  say('page opened: ' + SITE + '/?auto=1');

  let s;
  try { s = await waitFor('the subscription to reach the server', (s) => s.subscriptions >= 1, 40); }
  catch (e) { say('PAGE LOG:\n' + await pageLog(sessionId)); throw e; }
  say('SUBSCRIBED: ' + s.endpoints[0]);

  /* Chrome's subscribe() can resolve before the push service has finished registering the token (seen 2026-10-05:
     FCM answered 410 "unsubscribed or expired" one second after subscribe). Wait, ask Chrome whether IT still holds
     the subscription, and retry the send a few times before calling it a failure. */
  const subInChrome = async () => { try { const r = await cdp('Runtime.evaluate', { expression: "navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(s => s ? s.endpoint.slice(0, 60) : null)", awaitPromise: true, returnByValue: true }, sessionId); return r.result.value; } catch { return '(could not ask)'; } };
  await sleep(5000);
  say('asking e2e.php to send an encrypted push through the push service');
  let sent, r1;
  for (let attempt = 1; attempt <= 4; attempt++) {
    sent = await (await fetch(`${SITE}/e2e.php?action=send`)).json();
    r1 = sent.results[0] ? sent.results[0].result : { ok: false, status: 0, error: 'no subscription left on the server' };
    say(`attempt ${attempt}: push service answered ${r1.status} ${r1.ok ? '(accepted)' : '(' + r1.error + ')'}; Chrome still holds: ${await subInChrome()}`);
    if (r1.ok) break;
    if (r1.gone) { /* re-subscribe in the page, then try again */
      try { await cdp('Runtime.evaluate', { expression: 'enable()', awaitPromise: true }, sessionId); await waitFor('re-subscription', (s) => s.subscriptions >= 1, 40); say('re-subscribed: ' + (await state()).endpoints[0]); } catch (e) { say('re-subscribe: ' + e.message); }
    }
    await sleep(10000);
  }
  if (!r1.ok) throw new Error('push not accepted after retries: ' + JSON.stringify(r1));
  try { s = await waitFor('the service worker to report the push', (s) => s.received.length >= 1, 40); }
  catch (e) { say('PAGE LOG:\n' + await pageLog(sessionId)); throw e; }
  const got = s.received[0].data;
  say('RECEIVED in the service worker: hadPayload=' + got.hadPayload + ' shown="' + got.shown + '"');
  const same = got.raw === sent.results[0].payloadSent;
  say(same ? 'payload decrypted by Chrome is byte-identical to what PHP encrypted' : 'PAYLOAD DIFFERS: ' + got.raw + ' vs ' + sent.results[0].payloadSent);
  if (!same) exitCode = 1;

  say('now a push with no payload');
  const sent2 = await (await fetch(`${SITE}/e2e.php?action=send&bare=1`)).json();
  const r2 = sent2.results[0].result;
  say(`push service answered ${r2.status} ${r2.ok ? '(accepted)' : '(' + r2.error + ')'}`);
  if (r2.ok) {
    try { s = await waitFor('the bare push', (s) => s.received.length >= 2, 40); say('RECEIVED bare push: hadPayload=' + s.received[1].data.hadPayload + ' shown="' + s.received[1].data.shown + '"'); }
    catch (e) { say('bare push: ' + e.message); exitCode = 1; }
  } else exitCode = 1;

  say('PAGE LOG:\n' + await pageLog(sessionId));
  say(exitCode ? 'END-TO-END: FAILED' : 'END-TO-END: PASSED (subscribe in Chrome -> PHP encrypt + VAPID -> FCM -> service worker decrypted and showed it)');
} catch (e) {
  say('FAILED: ' + e.message); exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
