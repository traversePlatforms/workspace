// count coloured radar pixels in one z9 tile over Parker for a run of archive times
const sharp = require('C:/Users/Surge Inc/Desktop/claude test 2/node_modules/sharp');
const [layerT, from, to, step] = process.argv.slice(2);   // e.g. USCOMP-N0Q 2026090620 2026090623 10
async function count(url) {
  const r = await fetch(url); if (!r.ok) return 'http ' + r.status;
  const buf = Buffer.from(await r.arrayBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, hot = 0; for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 0) { n++; if (data[i] > 200 && data[i + 1] < 120) hot++; } }
  return n + ' px, ' + hot + ' red/magenta';
}
(async () => {
  const d = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), 0));
  for (let t = d(from); t <= d(to); t = new Date(t.getTime() + (+step) * 60000)) {
    const ts = t.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const url = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${layerT}-${ts}/9/" + (process.env.TX || 107) + "/" + (process.env.TY || 194) + ".png`;
    console.log(ts, await count(url));
  }
})();
