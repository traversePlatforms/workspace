// Address check before sending (CLOUD-PLAN 2026-11, "Address check before sending"; run 6 Nov night on the cloud machine).
//   node mx-check.mjs <in.csv: id,batch,domain> <out.csv>
// For each domain: MX records; if none, an A/AAAA record (mail can still be delivered to the bare host); otherwise dead.
// Read-only DNS lookups. Changes nothing on the desk: the result is a list for Matthew to decide on.
import { readFileSync, writeFileSync } from 'node:fs';
import { promises as dns } from 'node:dns';

const [inF, outF] = process.argv.slice(2);
const rows = readFileSync(inF, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
const domains = [...new Set(rows.map((r) => r[2]).filter(Boolean))];
const res = new Map();
const tryIt = async (fn, d) => { for (let i = 0; i < 3; i++) { try { return { ok: await fn(d) }; } catch (e) { if (['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(e.code) && i === 2) return { err: e.code }; if (['ENOTFOUND', 'ENODATA'].includes(e.code)) return { err: e.code }; await new Promise((r) => setTimeout(r, 1500)); } } return { err: 'TIMEOUT' }; };
const check = async (d) => {
  const mx = await tryIt(dns.resolveMx, d);
  if (mx.ok && mx.ok.length) {
    const hosts = mx.ok.sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
    if (hosts.length === 1 && (hosts[0] === '' || hosts[0] === '.')) return { state: 'dead', why: 'null MX (domain takes no mail)' };
    return { state: 'ok', why: 'MX ' + hosts[0] };
  }
  const a = await tryIt(dns.resolve4, d);
  if (a.ok && a.ok.length) return { state: 'weak', why: 'no MX, has an address record (' + (mx.err || 'empty') + ')' };
  return { state: 'dead', why: 'no MX and no address (' + (mx.err || '') + '/' + (a.err || '') + ')' };
};
let i = 0;
const work = async () => { while (i < domains.length) { const d = domains[i++]; res.set(d, await check(d)); } };
await Promise.all(Array.from({ length: 8 }, work));
const out = ['id,batch,domain,state,why'];
for (const [id, batch, d] of rows) { const r = res.get(d) || { state: 'dead', why: 'no domain' }; out.push([id, batch, d, r.state, '"' + r.why.replace(/"/g, "'") + '"'].join(',')); }
writeFileSync(outF, out.join('\n') + '\n');
const count = (s) => rows.filter(([, , d]) => (res.get(d) || {}).state === s).length;
console.log(`domains ${domains.length}; messages ok ${count('ok')}, weak ${count('weak')}, dead ${count('dead')}`);
