/*
  Generates summit-de59ae83/quote.html from the Claude artifact source.

  WHY A GENERATOR AND NOT A COPY: the pricing logic is 1,400 lines and it is the
  thing nobody should be hand-editing twice. ../quotes/quote-engine.artifact.html
  stays the single source; this script changes only what has to change to run on
  a web server instead of inside the artifact viewer:

    claude.use("db")         -> api/quote.php           (rates + saved jobs)
    claude.use("downloads")  -> an ordinary <a download> (artifacts block those;
                                a real site does not, so this is a straight win)

  Everything else — every rate, every flag, the calibration, the market check —
  is copied through untouched. If the two ever disagree, this file is the bug.

  ⚑ RUN THIS AFTER ANY REPRICE, or the site keeps quoting the old numbers. That
  is the v2/v3 trap in a new place: the file was ahead of the published artifact
  for two days and every quote in between was 43% low on labour.

  Run:  node sixfold/site/build-quote-page.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../quotes/quote-engine.artifact.html');
const OUT = join(here, 'summit-de59ae83/quote.html');

let s = readFileSync(SRC, 'utf8');
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error('MISS in the artifact source: ' + a.slice(0, 80));
  if (s.split(a).length > 2) throw new Error('DUPE: ' + a.slice(0, 50));
  s = s.replace(a, b);
};

/* ---- 1 · the whole db/downloads init block becomes the site's own ---- */
rep(`  try { downloads = await claude.use("downloads"); } catch(e){ downloads = null; }
  if (!downloads){ $("bScope").disabled = true; $("bCsv").disabled = true; }

  try { db = await claude.use("db"); } catch(e){ db = null; }
  if (!db){ $("bSave").disabled = true; $("jobEmpty").textContent = "Not connected — jobs cannot be saved in this view."; return; }

  let firstRates = true;
  db.doc("config/" + RATES_V).onSnapshot(snap => {
    ratesDocReady = true;
    if (!snap.exists){ firstRates = false; return; }
    const d = snap.data() || {};
    if (d.rates) Object.keys(d.rates).forEach(k => { if (rates[k] != null){ rates[k] = d.rates[k]; const el = $("r_" + k); if (el) el.value = d.rates[k]; } });
    if (d.rates) storedRates = {...rates};
    if (d.cfg) storedCfg = {...d.cfg};
    /* The standing rates apply once, on open. After that a job you have loaded
       keeps its own figures rather than being stomped by a later write. */
    if (firstRates && d.cfg){
      firstRates = false;
      Object.keys(d.cfg).forEach(k => { if (cfg[k] != null){ cfg[k] = d.cfg[k]; const el = $("g_" + k); if (el) el.value = d.cfg[k]; } });
    }
    if (d.confirmed){
      confirmed = d.confirmed;
      LINES.forEach(l => { const b = badgeFor(l), el = $("b_" + l.id);
        if (el && l.src !== "stop"){ el.className = "badge " + b.cls; el.textContent = b.txt; el.title = b.title; } });
    }
    render();
  }, () => { ratesDocReady = false; });

  db.collection("jobs").orderBy("savedAt", "desc").limit(40).onSnapshot(snap => {
    jobs = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderJobs();
  }, () => { $("jobEmpty").textContent = "Saved jobs could not be loaded."; });
})();`,
`  /* The site has no realtime store, so the rate table is read once on open —
     which is what the artifact did anyway: "the standing rates apply once, on
     open", so a job you have loaded is never stomped by someone else's write. */
  const gate = await api("me");
  if (!gate.ok){
    document.querySelector(".wrap").innerHTML =
      '<div class="notice warn" style="margin-top:40px"><span class="mk">' +
      (gate._status === 403 ? "NOT ALLOWED" : "SIGN IN") + '</span><div>' +
      (gate._status === 403
        ? "Your code opens door rounds but not the quote build. This tool is admin-only while it is being tested."
        : 'Your session has expired. <a href="./">Sign in again</a>, then come back.') +
      "</div></div>";
    return;
  }
  $("whoAmI").textContent = gate.name;

  const r = await api("rates");
  if (r.ok && r.rates && Object.keys(r.rates).length){
    const d = r.rates;
    /* ⚑ review 2026-10-03: rates.json had no version, so after a reprice the old stored table
       went straight back over the new figures. A table from another version is ignored (the
       badges still apply). The first save under the new version replaces it. */
    const current = d.v === RATES_V;
    if (current && d.rates) Object.keys(d.rates).forEach(k => { if (rates[k] != null){ rates[k] = d.rates[k]; const el = $("r_" + k); if (el) el.value = d.rates[k]; } });
    if (current && d.cfg) Object.keys(d.cfg).forEach(k => { if (cfg[k] != null){ cfg[k] = d.cfg[k]; const el = $("g_" + k); if (el) el.value = d.cfg[k]; } });
    storedRates = current && d.rates ? {...rates} : null; storedCfg = current && d.cfg ? {...d.cfg} : null;
    if (d.confirmed){
      confirmed = d.confirmed;
      LINES.forEach(l => { const b = badgeFor(l), el = $("b_" + l.id);
        if (el && l.src !== "stop"){ el.className = "badge " + b.cls; el.textContent = b.txt; el.title = b.title; } });
    }
  }
  ratesDocReady = true;
  render();

  const j = await api("jobs");
  if (j.ok){ jobs = j.jobs || []; renderJobs(); }
  else { $("jobEmpty").textContent = "Saved jobs could not be loaded."; }
})();`);

/* ---- 2 · saving the rate table ---- */
rep(`    db.doc("config/" + RATES_V).set(p).catch(() => {});`,
    `    api("rates", {rates: p}).catch(() => {});`);
rep('function saveRates(what){\n  if (!db || !ratesDocReady) return;',
    'function saveRates(what){\n  if (!ratesDocReady) return;');

/* ---- 3 · saving a job ---- */
rep(`  if (!db){ toast("Not connected — the local draft is still kept in this browser"); return; }
  const m = compute();
  const st = snapshot();
  try {
    await db.collection("jobs").add({...st, price:m.price, costUp:m.costUp, hours:m.hours,
      margin:m.margin, savedAt:new Date().toISOString()});
    toast("Saved " + name);
  } catch(err){
    toast(err && err.code === "quota_exceeded" ? "The store is full — delete an old job first" : "Could not save — try again");
  }`,
`  const m = compute();
  const st = snapshot();
  const res = await api("save", {job:{...st, price:m.price, costUp:m.costUp, hours:m.hours, margin:m.margin}});
  if (res.ok){
    const list = await api("jobs");
    if (list.ok){ jobs = list.jobs || []; renderJobs(); }
    toast("Saved " + name);
  } else {
    toast(res.error || "Could not save — try again");
  }`);

/* ---- 4 · exports become ordinary downloads ---- */
rep(`async function offer(filename, data){
  if (!downloads){ toast("Downloads are not available in this view"); return; }
  try { await downloads.save({filename, data}); toast("Saved " + filename); }
  catch(err){
    const c = err && err.code;
    if (c === "declined") return;
    toast(c === "rate_limited" ? "A save prompt is already open — try again in a moment" : "Could not save the file");
  }
}`,
`/* A real page can just hand the browser a file. The artifact could not —
   its sandbox blocks every download the page starts itself — which is why the
   downloads capability existed at all. */
function offer(filename, data){
  try {
    const blob = new Blob([data], {type:"text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Saved " + filename);
  } catch(e){ toast("Could not save the file"); }
}`);

/* ---- 5 · the fetch helper, and drop the now-unused capability vars ---- */
rep('let db = null, downloads = null, jobs = [], ratesDocReady = false;',
`let jobs = [], ratesDocReady = false;

/* same shape as the doors app's helper, same cookie, same origin */
function api(action, body){
  return fetch("../api/quote.php?action=" + encodeURIComponent(action), {
    method: body ? "POST" : "GET",
    headers: body ? {"Content-Type":"application/json"} : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin"
  }).then(r => r.json().catch(() => ({ok:false, error:"The server did not answer properly."}))
                .then(j => { j._status = r.status; return j; }))
    .catch(() => ({ok:false, error:"No connection."}));
}`);

/* ---- 6 · a way back to the tools menu, and who is signed in ---- */
rep('  <div class="stamp">Internal · draft only · no price on the property</div>',
`  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
    <div class="stamp">Internal · draft only · no price on the property</div>
    <div style="font-family:var(--f-data);font-size:10.5px;color:var(--ink-soft)">
      <a href="./" style="color:var(--accent)">&larr; Tools</a> ·
      <span id="whoAmI">&hellip;</span>
    </div>
  </div>`);

/* ---- 7 · a real page needs its own document shell ---- */
const head = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="robots" content="noindex, nofollow">',
  '<!-- GENERATED by sixfold/site/build-quote-page.mjs from quotes/quote-engine.artifact.html.',
  '     Do not edit this file. Edit the artifact source and re-run the generator. -->',
  '',
].join('\n');
s = head + s + '\n</body>\n</html>\n';

writeFileSync(OUT, s, 'utf8');
console.log('wrote summit-de59ae83/quote.html  ' + (s.length / 1024).toFixed(1) + ' KB');
