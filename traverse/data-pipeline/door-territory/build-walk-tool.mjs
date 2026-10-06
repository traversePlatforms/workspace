/* Sixfold — builds the published walk-round tool from the neighbourhood
   sidecars. 2026-09-29.

   The printed sheets and this page must name the same pockets, so the
   clustering has ONE implementation (build-walklist-pdf.mjs) and this reads its
   `*-areas.json` output rather than re-deriving anything.

   Run:  node build-walklist-pdf.mjs <each csv>     # writes the sidecars
         node build-walk-tool.mjs                   # writes walk-tool.html     */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = [
  ['monument', 'Monument', 'monument-areas.json'],
  ['castle-rock', 'Castle Rock', 'castle-rock-areas.json'],
  ['woodland-park', 'Woodland Park', 'woodland-park-areas.json'],
];

const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

const regions = [];
for (const [key, label, fileName] of SOURCES) {
  const p = join(HERE, fileName);
  if (!existsSync(p)) { console.log(`skipping ${label} — no ${fileName}`); continue; }
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const seen = new Set();
  regions.push({
    key, label, built: j.built,
    areas: j.areas.map((a) => ({
      n: a.name,
      avg: a.avg ? +a.avg.toFixed(2) : null,
      d: a.doors.map((d) => {
        let id = slug(d.a);
        while (seen.has(id)) id += 'x';
        seen.add(id);
        return { i: id, a: d.a, c: d.ac, o: d.o };
      }),
    })),
  });
}
if (!regions.length) { console.error('no sidecars found — run build-walklist-pdf.mjs first'); process.exit(1); }

const DATA = JSON.stringify(regions);
const totals = regions.map((r) => `${r.label} ${r.areas.reduce((s, a) => s + a.d.length, 0)}`).join(' · ');

const html = `<title>Sixfold Door Rounds</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');

  /* Sixfold's own palette — Pine, Bone, Sage, Moss, Turf — so the tool looks
     like the cards and the sheets it came from. Light is the default because
     this is read on a phone in a driveway, often in sun. */
  :root{
    color-scheme: light;
    --pine:#0E1512; --bone:#EDE7DC; --sage:#A7BE93; --moss:#8AA07A; --turf:#2F7A4F;
    --paper:#F4F2EC; --card:#FFFFFF; --ink:#16201B; --ink-soft:#5A665E;
    --line:#DCD7CB; --line-soft:#E9E4DA;
    --accent:var(--turf); --accent-ink:#FFFFFF;
    --booked:#2F7A4F; --later:#B5761F; --miss:#6E7A72;
    --shadow:0 1px 2px rgba(20,32,27,.06), 0 6px 18px rgba(20,32,27,.05);
    --serif:"Source Serif 4",Palatino,Georgia,serif;
    --sans:Archivo,"Segoe UI",system-ui,sans-serif;
    --mono:"JetBrains Mono",Consolas,ui-monospace,monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      color-scheme: dark;
      --paper:#0E1512; --card:#18221D; --ink:#E9E4DA; --ink-soft:#9AA79E;
      --line:#2A352E; --line-soft:#222C26;
      --accent:#8AA07A; --accent-ink:#0E1512;
      --booked:#8AA07A; --later:#D9A05B; --miss:#8B968E;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.3);
    }
  }
  :root[data-theme="dark"]{
    color-scheme: dark;
    --paper:#0E1512; --card:#18221D; --ink:#E9E4DA; --ink-soft:#9AA79E;
    --line:#2A352E; --line-soft:#222C26;
    --accent:#8AA07A; --accent-ink:#0E1512;
    --booked:#8AA07A; --later:#D9A05B; --miss:#8B968E;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.3);
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
       -webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding-inline:16px;padding-block:0 96px}

  header{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;
         background:var(--paper);border-bottom:1px solid var(--line);
         margin-inline:-16px;padding:14px 16px 10px}
  .brandline{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  h1{font-family:var(--serif);font-size:20px;font-weight:600;margin:0;letter-spacing:-.01em}
  .built{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
  .regions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
  .chip{font-family:var(--sans);font-size:13px;font-weight:500;padding:7px 12px;border-radius:999px;
        border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
  .chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
  .chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .note{margin:14px 0 0;padding:10px 12px;border-radius:8px;border:1px solid var(--line);
        background:var(--card);font-size:13px;line-height:1.5;color:var(--ink-soft)}

  h2{font-family:var(--serif);font-size:15px;font-weight:600;margin:22px 0 8px;letter-spacing:-.005em}

  .area{width:100%;text-align:left;display:grid;grid-template-columns:1fr auto;gap:4px 12px;
        align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;
        padding:13px 14px;margin-bottom:8px;cursor:pointer;color:inherit;font:inherit;
        box-shadow:var(--shadow)}
  .area:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .area .nm{grid-column:1;grid-row:1;min-width:0;font-family:var(--serif);font-size:16px;font-weight:600;overflow-wrap:anywhere}
  .area .sub{grid-column:1;grid-row:2;min-width:0;font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums}
  .area .left{grid-column:2;grid-row:1 / span 2;font-family:var(--mono);font-size:19px;font-weight:600;
              text-align:right;font-variant-numeric:tabular-nums}
  .area .left small{display:block;font-family:var(--sans);font-size:10px;font-weight:400;
                    letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
  .area[data-done="1"]{opacity:.55}
  .area[data-done="1"] .left{color:var(--booked)}

  .bar{height:4px;border-radius:2px;background:var(--line-soft);grid-column:1 / -1;grid-row:3;overflow:hidden}
  .bar i{display:block;height:100%;background:var(--accent);border-radius:2px}

  .back{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--accent);
        font:500 14px var(--sans);padding:6px 0;cursor:pointer}
  .back:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .door{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px 14px;
        margin-bottom:8px;box-shadow:var(--shadow)}
  .door .addr{font-family:var(--serif);font-size:18px;font-weight:600;line-height:1.25}
  .door .meta{font-size:12.5px;color:var(--ink-soft);margin-top:3px;
              font-variant-numeric:tabular-nums}
  .acts{display:flex;gap:6px;margin-top:11px}
  .acts button{flex:1;font:500 12.5px var(--sans);padding:10px 4px;border-radius:8px;
               border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer}
  .acts button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .acts button[data-k="booked"]{color:var(--booked);border-color:color-mix(in srgb,var(--booked) 45%,var(--line))}
  .acts button[data-k="later"]{color:var(--later);border-color:color-mix(in srgb,var(--later) 40%,var(--line))}
  .acts button:active{transform:scale(.98)}

  .done{background:transparent;border:1px dashed var(--line);box-shadow:none;
        display:flex;justify-content:space-between;align-items:center;gap:10px}
  .done .addr{font-size:14px;font-weight:400;color:var(--ink-soft)}
  .tag{font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;
       padding:3px 7px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
  .tag.booked{color:var(--booked)} .tag.later{color:var(--later)} .tag.miss{color:var(--miss)}
  .undo{background:none;border:0;color:var(--accent);font:500 12.5px var(--sans);cursor:pointer;padding:4px}

  .empty{text-align:center;padding:34px 16px;color:var(--ink-soft);font-size:14px;line-height:1.6}
  .empty strong{display:block;font-family:var(--serif);font-size:19px;color:var(--ink);margin-bottom:6px}

  footer{margin-top:26px;padding-top:14px;border-top:1px solid var(--line);
         font-size:11.5px;line-height:1.6;color:var(--ink-soft)}
  @media (prefers-reduced-motion: reduce){*{transition:none !important;animation:none !important}}
</style>

<div class="wrap">
  <header>
    <div class="brandline">
      <h1>Sixfold Door Rounds</h1>
      <span class="built" id="built"></span>
    </div>
    <div class="regions" id="regions"></div>
  </header>

  <div id="view"></div>

  <footer>
    Lot sizes from county assessor public records. Every door listed is one where the owner
    lives at the property. Marks are shared — whoever opens this next sees the same list.
  </footer>
</div>

<script>
(function () {
  var REGIONS = ${DATA};
  var OUTCOMES = { booked: 'Quote booked', later: 'Not now', miss: 'No answer' };

  var view = document.getElementById('view');
  var regionBar = document.getElementById('regions');
  document.getElementById('built').textContent = REGIONS[0] ? 'Built ' + REGIONS[0].built : '';

  var state = { region: REGIONS[0].key, area: null, marks: {}, db: null, canWrite: null, unsub: null };

  function regionOf(k) { return REGIONS.filter(function (r) { return r.key === k; })[0]; }
  function markOf(id) { return state.marks[id]; }

  /* ---------- rendering ---------- */
  function renderRegions() {
    regionBar.textContent = '';
    REGIONS.forEach(function (r) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = r.label;
      b.setAttribute('aria-pressed', String(r.key === state.region));
      b.addEventListener('click', function () {
        if (state.region === r.key) return;
        state.region = r.key; state.area = null; state.marks = {};
        renderRegions(); render(); subscribe();
      });
      regionBar.appendChild(b);
    });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderAreas() {
    var r = regionOf(state.region);
    var h = el('h2', null, r.label + ' — pick a neighbourhood');
    view.appendChild(h);
    r.areas.forEach(function (a) {
      var left = a.d.filter(function (d) { return !markOf(d.i); }).length;
      var pct = a.d.length ? Math.round((a.d.length - left) / a.d.length * 100) : 0;
      var btn = el('button', 'area');
      btn.type = 'button';
      if (left === 0) btn.setAttribute('data-done', '1');
      var nm = el('div', 'nm', a.n);
      var sub = el('div', 'sub', a.d.length + (a.d.length === 1 ? ' door' : ' doors') + (a.avg ? ' · average lot ' + a.avg.toFixed(2) + ' acres' : ''));
      var cnt = el('div', 'left', left === 0 ? 'done' : String(left));
      if (left !== 0) cnt.appendChild(el('small', null, 'to knock'));
      var bar = el('div', 'bar');
      var fill = el('i');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      btn.appendChild(nm); btn.appendChild(cnt); btn.appendChild(sub); btn.appendChild(bar);
      btn.addEventListener('click', function () { state.area = a.n; render(); window.scrollTo(0, 0); });
      view.appendChild(btn);
    });
  }

  function mark(door, kind) {
    if (!state.db) return;
    var prev = state.marks[door.i];
    state.marks[door.i] = { outcome: kind, at: Date.now() };   /* optimistic */
    render();
    var ref = state.db.collection('marks-' + state.region).doc(door.i);
    var p = kind === null ? ref.delete() : ref.set({ outcome: kind, at: Date.now(), address: door.a });
    p.catch(function () {
      if (prev) state.marks[door.i] = prev; else delete state.marks[door.i];
      state.canWrite = false;
      render();
    });
  }

  function renderDoors() {
    var r = regionOf(state.region);
    var a = r.areas.filter(function (x) { return x.n === state.area; })[0];
    if (!a) { state.area = null; return renderAreas(); }

    var back = el('button', 'back', '\\u2190 All neighbourhoods');
    back.type = 'button';
    back.addEventListener('click', function () { state.area = null; render(); window.scrollTo(0, 0); });
    view.appendChild(back);

    var todo = a.d.filter(function (d) { return !markOf(d.i); });
    var done = a.d.filter(function (d) { return markOf(d.i); });

    view.appendChild(el('h2', null, a.n + ' — ' + todo.length + ' to knock'));

    if (!todo.length) {
      var e = el('div', 'empty');
      e.appendChild(el('strong', null, 'Neighbourhood finished'));
      e.appendChild(document.createTextNode('Every door here is marked. Pick another neighbourhood.'));
      view.appendChild(e);
    }

    todo.forEach(function (d) {
      var card = el('div', 'door');
      card.appendChild(el('div', 'addr', d.a));
      card.appendChild(el('div', 'meta', d.c.toFixed(2) + ' acres · ' + d.o));
      var acts = el('div', 'acts');
      ['booked', 'later', 'miss'].forEach(function (k) {
        var b = el('button', null, OUTCOMES[k]);
        b.type = 'button';
        b.setAttribute('data-k', k);
        b.disabled = !state.db;
        b.addEventListener('click', function () { mark(d, k); });
        acts.appendChild(b);
      });
      card.appendChild(acts);
      view.appendChild(card);
    });

    if (done.length) {
      view.appendChild(el('h2', null, 'Marked · ' + done.length));
      done.forEach(function (d) {
        var m = markOf(d.i);
        var row = el('div', 'door done');
        var lhs = el('div');
        lhs.appendChild(el('div', 'addr', d.a));
        var rhs = el('div');
        rhs.style.display = 'flex';
        rhs.style.alignItems = 'center';
        rhs.style.gap = '8px';
        rhs.appendChild(el('span', 'tag ' + m.outcome, OUTCOMES[m.outcome] || m.outcome));
        if (state.db) {
          var u = el('button', 'undo', 'Undo');
          u.type = 'button';
          u.addEventListener('click', function () { mark(d, null); });
          rhs.appendChild(u);
        }
        row.appendChild(lhs); row.appendChild(rhs);
        view.appendChild(row);
      });
    }
  }

  function render() {
    view.textContent = '';
    if (state.db === null && state.canWrite === null) {
      view.appendChild(noteEl('Connecting to the shared list\\u2026'));
    } else if (!state.db) {
      view.appendChild(noteEl('Read-only here \\u2014 marks are not saved. Open this from the Sixfold workspace to mark doors.'));
    } else if (state.canWrite === false) {
      view.appendChild(noteEl('Your account can read this list but not mark doors.'));
    }
    if (state.area) renderDoors(); else renderAreas();
  }

  function noteEl(t) { return el('div', 'note', t); }

  /* ---------- shared state ---------- */
  function subscribe() {
    if (state.unsub) { state.unsub(); state.unsub = null; }
    if (!state.db) return;
    state.unsub = state.db.collection('marks-' + state.region).onSnapshot(function (snap) {
      var next = {};
      snap.docs.forEach(function (doc) {
        var v = doc.data() || {};
        next[doc.id] = { outcome: v.outcome, at: v.at };
      });
      state.marks = next;
      render();
    }, function () { /* listener died; the page still works from what it has */ });
  }

  render();
  renderRegions();

  if (window.claude && window.claude.use) {
    window.claude.use('db').then(function (db) {
      state.db = db || false;
      render();
      subscribe();
    }).catch(function () { state.db = false; render(); });
    window.claude.use('user').then(function (u) {
      if (!u || !u.can) return;
      Promise.resolve(u.can('data.write')).then(function (ok) {
        if (ok === false) { state.canWrite = false; render(); }
      }).catch(function () {});
    }).catch(function () {});
  } else {
    state.db = false;
    render();
  }
})();
</script>
`;

const out = join(HERE, 'walk-tool.html');
writeFileSync(out, html, 'utf8');
const doors = regions.reduce((s, r) => s + r.areas.reduce((t, a) => t + a.d.length, 0), 0);
console.log(`walk-tool.html  ${(html.length / 1024).toFixed(0)} KB`);
console.log(`  ${regions.length} regions · ${regions.reduce((s, r) => s + r.areas.length, 0)} neighbourhoods · ${doors} doors`);
console.log(`  ${totals}`);
