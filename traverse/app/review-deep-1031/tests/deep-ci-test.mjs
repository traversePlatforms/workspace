/* 31 Oct deep review, client installs: the welcome page's brand step needs the payment seen (an unpaid visitor knows the link: the session id
   is in Stripe's own checkout address), the area step too; a stale (inactive) price answers a plain error. Stripe TEST account; the session
   made here is expired afterwards. Never prints a key. */
import { t, done, start, pend, stripe, CL } from './lib.mjs';
import { readdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
const plans = await start('plans');
t(plans.ok && plans.plans.crew && plans.plans.crew.month, 'plans answer');
const co = await start('checkout', { edition: 'roofing', plan: 'crew', iv: 'month', seats: 5, agree: true, terms: plans.terms, agreement: plans.agreement });
t(co.ok && /checkout\.stripe\.com/.test(co.url || ''), 'a checkout opens: ' + (co.error || 'ok'));
const cs = (co.url.match(/\/(cs_test_[A-Za-z0-9]+)/) || [])[1];
/* the pending record names the client id for this session */
const cid = readdirSync(CL + '/pending').filter((f) => /^c[0-9a-f]{8}\.json$/.test(f)).map((f) => f.slice(0, -5)).find((c) => pend(c).cs === cs);
t(!!cid, 'the pending record is there for the session');
const q = (a, b) => start(a, b, '&c=' + cid + '&cs=' + encodeURIComponent(cs));
const w = await q('welcome');
t(w._status === 200 && w.paid === false, 'welcome: not paid yet (' + w._status + ')');
const br = await q('brand', { color: '#336699' });
t(br._status === 402 && !br.ok && /payment/.test(br.error || ''), 'brand before paying is refused with 402 (' + br._status + ': ' + (br.error || '').slice(0, 50) + ')');
t(!existsSync(CL + '/pending/' + cid + '-logo.png'), 'no logo file was parked');
const ar = await q('area', { mode: 'radius', address: '1 Test Way, Englewood, CO 80110', miles: 25 });
t(ar._status === 402, 'area before paying is refused with 402 (' + ar._status + ')');
const p = pend(cid);
t(!p.brand && !p.area, 'the pending record kept neither step');
await stripe('/v1/checkout/sessions/' + cs + '/expire', 'POST', {});
try { unlinkSync(CL + '/pending/' + cid + '.json'); unlinkSync(CL + '/pending/' + cid + '.json.lock'); } catch {}
done();
