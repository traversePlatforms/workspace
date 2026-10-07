/* Sixfold — turn a walk-list CSV into a clipboard sheet. 2026-09-29.

   A spreadsheet is the wrong object to hand someone in a truck. This makes the
   printable version: grouped by region, biggest lots first, with somewhere to
   write down what happened at the door.

   ORDERING, as asked for: region first, then lot size largest to smallest.
   ⚑ That is a PRIORITY order, not a ROUTE — sorted purely by size, a rep drives
   across town between doors. `--by-street` gives the walking order instead:
   streets ranked by their biggest lot, then addresses in number order down the
   street. Both are on the sheet's own footer so the crew knows which they hold.

   The three tick boxes are the point of printing it at all. A walk list that
   comes back blank taught us nothing; one that comes back marked tells us the
   knock-to-quote rate, which nothing else in the business currently measures.

   Run:  node build-walklist-pdf.mjs monument-test.csv
         node build-walklist-pdf.mjs monument-test.csv --by-street              */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIXFOLD = join(HERE, '..', '..', '..', 'sixfold');   // the walk list is printed with Sixfold's style and PDF tool (app moved out of sixfold/ 2026-10-04)

const file = process.argv[2];
if (!file) { console.error('usage: node build-walklist-pdf.mjs <walklist.csv> [--by-street]'); process.exit(1); }
const byStreet = process.argv.includes('--by-street');
const bySize = process.argv.includes('--by-size');

/* ---- read the csv -------------------------------------------------------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const raw = parseCSV(readFileSync(join(HERE, file), 'utf8'));
const head = raw.shift().map((h) => h.trim());
const col = (n) => head.indexOf(n);
const all = raw.filter((r) => r.length > 2).map((r) => ({
  knock: r[col('knock')], address: r[col('address')], city: r[col('city')],
  zip: r[col('zip')], acres: Number(r[col('acres')]) || 0,
  owner: r[col('owner')], why: r[col('why')],
  lat: Number(r[col('lat')]), lon: Number(r[col('lon')]),
}));

/* ⚑ NON-RESIDENTIAL OWNERS, and why this filter exists.

   The owner-occupancy test asks whether the owner's address is AT the parcel.
   A church, a water district or a restaurant passes that test perfectly — the
   entity really is based there. So the first render put a water district, two
   churches and half a dozen LLCs at the top of the biggest-lots page, which is
   the worst possible opening for a lawn-care route.

   Filtered on the owner NAME, because that is the only signal in this data.
   TRUST and FAMILY are deliberately KEPT — a family trust is a normal way to
   hold a lived-in home. --include-business turns the filter off.              */
const NON_RESIDENTIAL = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|RESTURANTS|RESTAURANTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION)\b/i;

const keepBusiness = process.argv.includes('--include-business');

/* only the doors worth walking go on a walking sheet */
let doors = all.filter((d) => d.knock === 'YES');
const beforeBiz = doors.length;
if (!keepBusiness) doors = doors.filter((d) => !NON_RESIDENTIAL.test(d.owner));
const droppedBiz = beforeBiz - doors.length;

/* the same owner can hold two touching parcels; one address is one door */
const seen = new Set();
doors = doors.filter((d) => {
  const k = d.address.toUpperCase().replace(/\s+/g, ' ').trim();
  if (seen.has(k)) return false;
  seen.add(k); return true;
});
const droppedDup = beforeBiz - droppedBiz - doors.length;
if (!doors.length) { console.error('no rows marked YES in that file'); process.exit(1); }

/* ---- group by region ----------------------------------------------------- */
const regions = new Map();
for (const d of doors) {
  const key = (d.city || 'UNKNOWN').trim().toUpperCase();
  if (!regions.has(key)) regions.set(key, []);
  regions.get(key).push(d);
}
const streetOf = (a) => a.replace(/^\s*\d+\s+/, '').trim();
const numOf = (a) => Number((a.match(/^\s*(\d+)/) || [])[1] || 0);

/* ---- neighbourhoods ------------------------------------------------------

   Sorting purely by lot size sends a rep across town between doors. Sorting
   purely by street ignores that the best lots are worth reaching first. The
   middle ground is to find the NEIGHBOURHOODS, rank those by how good their
   lawns are, and walk each one whole.

   Method: single-link clustering on the parcel centroids at 250 m. Houses in a
   subdivision chain together door to door, while arterials, open land and the
   interstate leave gaps wider than the threshold, so the clusters come out as
   actual pockets rather than arbitrary boxes. Union-find, so it is one pass.

   ⚑ Single-link CHAINS: a continuous ribbon of houses will merge into one large
   cluster, which is correct — that really is one walkable area — but it means
   cluster size is not bounded. Sheets paginate, so a 60-door neighbourhood is
   simply three sheets of the same place.

   Each cluster is named after its most common street, because "McShane Dr area"
   is something a crew can find and "Cluster 3" is not.                        */
const CLUSTER_M = Number((process.argv.find((a) => a.startsWith('--cluster-metres=')) || '').split('=')[1] || 250);

function clusterRaw(list, CLUSTER_M) {
  const parent = list.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  /* bucket by a ~250 m grid so each door only tests its own and adjacent cells */
  const latM = 111320, cell = CLUSTER_M;
  const lonM = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  const key = (d) => `${Math.floor(d.lat * latM / cell)},${Math.floor(d.lon * lonM(d.lat) / cell)}`;
  const grid = new Map();
  list.forEach((d, i) => {
    const k = key(d);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const dist = (a, b) => {
    const lat0 = (a.lat + b.lat) / 2;
    return Math.hypot((a.lat - b.lat) * latM, (a.lon - b.lon) * lonM(lat0));
  };
  for (const [k, idxs] of grid) {
    const [gy, gx] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const near = grid.get(`${gy + dy},${gx + dx}`);
      if (!near) continue;
      for (const i of idxs) for (const j of near) {
        if (i < j && dist(list[i], list[j]) <= CLUSTER_M) union(i, j);
      }
    }
  }
  const groups = new Map();
  list.forEach((d, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(d);
  });

  return [...groups.values()];
}

/* ⚑ SINGLE-LINK CHAINS, AND IN A TOWN IT SWALLOWS EVERYTHING.
   Woodland Park is continuous housing, so at 250 m the whole town merged into
   one "neighbourhood" of 1,143 doors across 44 sheets — technically true and
   completely useless. So an oversized cluster is re-clustered at a tighter
   threshold, repeatedly, until the pockets are a size a person can actually be
   sent to walk. MAX_DOORS is about two full sheets. */
const MAX_DOORS = Number((process.argv.find((a) => a.startsWith('--max-area=')) || '').split('=')[1] || 55);

/* ⚑ HOW A BIG CLUSTER GETS SPLIT — four attempts, and why each was replaced.

   1. Re-cluster at a tighter distance, recursively. Shattered Woodland Park into
      334 sheets of about three doors: single-link at a small threshold breaks
      into per-street crumbs.
   2. Grid split, ONCE. Cut the bounding box into ~doors/MAX_DOORS cells. Never
      re-checked the pieces, and folded every crumb into the BIGGEST one — so where
      doors bunched into one corner it stayed huge. Left 76 neighbourhoods over
      100 doors, Wolf Village Dr at 404.
   3. Grid split, recursive (2026-10-01 morning). Fixed the giants, but an n x n
      grid OVER-splits: a 60-door area became four pieces of 15. Median fell from
      29 to 19 and the list doubled to ~1,500 — a mild relapse of attempt 1.
   4. NOW: halve along the longer side at the median, repeat until walkable.
      Every piece lands between about MAX_DOORS/2 and MAX_DOORS, so nothing
      shatters and nothing stays huge; a long street splits into stretches.

   ⚑ Splitting alone was never enough — see uniqueNames(): pieces sharing a street
   name were being glued back together by the sidecar. */
const centreOf = (p) => [p.reduce((s, d) => s + d.lat, 0) / p.length, p.reduce((s, d) => s + d.lon, 0) / p.length];
function splitBig(doors, depth = 0) {
  /* Halve along the longer side at the median, and repeat until every piece is
     walkable. Replaced a grid split the same day: an n x n grid over-splits (a 60-door
     area became four pieces of 15), whereas halving lands every piece between about
     MAX_DOORS/2 and MAX_DOORS. A long street gets cut into stretches, which is what
     the house-number names describe. No crumbs to fold — halves are equal. */
  if (doors.length <= MAX_DOORS || depth > 12) return [doors];
  const [la0] = centreOf(doors);
  const kx = Math.cos(la0 * Math.PI / 180);
  const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon);
  const spanY = Math.max(...lats) - Math.min(...lats);
  const spanX = (Math.max(...lons) - Math.min(...lons)) * kx;
  if (spanY === 0 && spanX === 0) return [doors];          /* every door on one spot: cannot split */
  const byY = spanY >= spanX;
  const sorted = doors.slice().sort((a, b) => (byY ? a.lat - b.lat : a.lon - b.lon));
  const mid = Math.ceil(sorted.length / 2);
  return [...splitBig(sorted.slice(0, mid), depth + 1), ...splitBig(sorted.slice(mid), depth + 1)];
}

function describe(list) {
  return list.map((doors) => {
    const counts = new Map();
    for (const d of doors) {
      const s = streetOf(d.address);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const name = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const avg = doors.reduce((s, d) => s + d.acres, 0) / doors.length;
    /* walkable inside the pocket: street, then house number */
    doors.sort((a, b) => {
      const s = streetOf(a.address).localeCompare(streetOf(b.address));
      return s !== 0 ? s : numOf(a.address) - numOf(b.address);
    });
    return { name, doors, avg, best: Math.max(...doors.map((d) => d.acres)) };
  });
}

/* ⚑ Neighbourhood names must be UNIQUE ACROSS THE WHOLE TOWN. The sidecar groups
   sheets by name, so two different pockets that shared a dominant street were
   silently glued back into one — which is how splitting could still end in a
   404-door "WOLF VILLAGE DR". A clashing name becomes the street plus its house-
   number range ("WOLF VILLAGE DR 2100–2490"), which tells a crew exactly which
   stretch they are on. Names that do not clash are left alone, so crews keep the
   names they already know. Door ids are untouched: marks, numbers and notes are
   keyed on the door, never on the neighbourhood. */
function uniqueNames(areas) {
  const count = new Map();
  for (const a of areas) count.set(a.name, (count.get(a.name) || 0) + 1);
  const used = new Set(areas.filter((a) => count.get(a.name) === 1).map((a) => a.name));
  for (const a of areas) {
    if (count.get(a.name) === 1) continue;
    const base = a.name;
    const nums = a.doors.filter((d) => streetOf(d.address) === base).map((d) => numOf(d.address)).filter((n) => n > 0);
    let name = base;
    if (nums.length) {
      const lo = Math.min(...nums), hi = Math.max(...nums);
      name = lo === hi ? `${base} ${lo}` : `${base} ${lo}–${hi}`;
    }
    if (used.has(name)) { let k = 2; while (used.has(`${name} · ${k}`)) k++; name = `${name} · ${k}`; }
    used.add(name);
    a.name = name;
  }
}

function clusterDoors(list) {
  return describe(clusterRaw(list, CLUSTER_M).flatMap((c) => splitBig(c)));
}

/* ---- paginate ------------------------------------------------------------ */
/* Measured by rendering, not estimated: 26 rows plus the masthead fills a
   Letter sheet inside the 0.5 x 0.55in page margins the house style sets. */
const PER_PAGE = 26;
const pages = [];

if (!byStreet && !bySize) {
  /* DEFAULT: neighbourhoods, ranked by how good their lawns are, walked whole */
  const regionsRanked = [...regions.entries()].sort((a, b) => b[1].length - a[1].length);
  /* every pocket in the town first, so names can be made unique town-wide */
  const pockets = [];
  for (const [region, list] of regionsRanked) {
    const areas = clusterDoors(list)
      .sort((a, b) => b.avg - a.avg || b.doors.length - a.doors.length);
    for (const area of areas) pockets.push({ region, area });
  }
  uniqueNames(pockets.map((x) => x.area));
  for (const { region, area } of pockets) {
    {
      const parts = Math.ceil(area.doors.length / PER_PAGE);
      for (let i = 0; i < area.doors.length; i += PER_PAGE) {
        pages.push({
          region, area: area.name, avg: area.avg, best: area.best,
          rows: area.doors.slice(i, i + PER_PAGE),
          part: Math.floor(i / PER_PAGE) + 1, parts, total: area.doors.length,
        });
      }
    }
  }
}

for (const [, list] of regions) {
  if (byStreet) {
    /* streets ranked by their best lot, then walked in number order */
    const best = new Map();
    for (const d of list) {
      const s = streetOf(d.address);
      best.set(s, Math.max(best.get(s) ?? 0, d.acres));
    }
    list.sort((a, b) => {
      const s = (best.get(streetOf(b.address)) ?? 0) - (best.get(streetOf(a.address)) ?? 0);
      if (s !== 0) return s;
      const n = streetOf(a.address).localeCompare(streetOf(b.address));
      return n !== 0 ? n : numOf(a.address) - numOf(b.address);
    });
  } else {
    list.sort((a, b) => b.acres - a.acres);      /* biggest lots first */
  }
}
/* biggest regions first */
const ordered = [...regions.entries()].sort((a, b) => b[1].length - a[1].length);

if (byStreet || bySize) {
  for (const [region, list] of ordered) {
    for (let i = 0; i < list.length; i += PER_PAGE) {
      pages.push({ region, rows: list.slice(i, i + PER_PAGE), part: Math.floor(i / PER_PAGE) + 1,
                   parts: Math.ceil(list.length / PER_PAGE), total: list.length });
    }
  }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const title = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const sheets = pages.map((p, i) => `
<div class="sheet">
  <div class="masthead">
    <div>
      <h1>${p.area ? esc(title(p.area)) + ' area' : esc(title(p.region)) + ' — walk list'}</h1>
      <p class="sub">${p.area ? esc(title(p.region)) + ' · ' : ''}${p.total} doors${p.parts > 1 ? ` · sheet ${p.part} of ${p.parts}` : ''}${
        p.avg ? ` · average lot ${p.avg.toFixed(2)} acres, best ${p.best.toFixed(2)}` : ''} ·
        ${byStreet ? 'walking order' : bySize ? 'biggest lots first' : 'whole neighbourhood, street by street'}</p>
    </div>
    <div class="internalflag">Crew</div>
  </div>

  <table class="tbl walk">
    <thead>
      <tr>
        <th class="w-addr">Address</th>
        <th class="w-lot">Lot</th>
        <th class="w-own">Owner</th>
        <th class="w-out">No answer</th>
        <th class="w-out">Not now</th>
        <th class="w-out">Quote booked</th>
      </tr>
    </thead>
    <tbody>
      ${p.rows.map((d) => `<tr>
        <td class="addr">${esc(d.address)}</td>
        <td class="num">${d.acres.toFixed(2)}</td>
        <td class="own">${esc(title(d.owner.split(' / ')[0]))}</td>
        <td class="bx"></td><td class="bx"></td><td class="bx"></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <p class="foot-note">Lot size in acres, from county assessor public records. Every door here is
  one where <strong>the owner lives at the property</strong> — renters and absentee owners are
  already filtered out. ${byStreet
    ? 'Sorted as a walking route: best streets first, then house numbers in order.'
    : bySize
      ? 'Sorted biggest lot first — that is a priority order, not a route.'
      : 'This is one neighbourhood, listed street by street. Neighbourhoods with the biggest lawns come first, so finish the sheet before moving on.'}
  <strong>Mark every door, including the misses.</strong> Sixfold Colorado · internal ·
  sheet ${i + 1} of ${pages.length}</p>
</div>`).join('\n');

const css = readFileSync(join(SIXFOLD, 'operations', '_style.css'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold — walk list</title>
<style>
${css}
/* ---- walk sheet ---- */
table.walk { margin-top: 6px; }
table.walk th { font-size: 7.4pt; letter-spacing: .06em; }
table.walk td { padding: 0; height: 26px; vertical-align: middle;
  border-bottom: 0.6pt solid var(--tint-edge); }
table.walk td.addr { font-size: 10pt; font-weight: 600; padding-right: 8px; }
table.walk td.num  { font-size: 10pt; font-family: var(--f-data); text-align: right; padding-right: 14px; }
/* ⚑ One line per row, always. A wrapped owner name ("DOUGLAS W MANTELLI &
   HILLARY MANTELLI") makes that row taller than the 26px the pagination is
   sized against, and the sheet silently spills onto a second page — Castle Rock
   rendered 59 sheets as 62 pages before this. Clipping the name costs nothing:
   the address and the lot size are what the door is chosen on. */
table.walk td.own  { font-size: 8.2pt; color: var(--ink-soft); padding-right: 8px;
  max-width: 1.85in; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table.walk td.bx   { width: 0.62in; }
/* the box is drawn inside the cell so the rule under it stays unbroken */
table.walk td.bx::before { content: ""; display: block; width: 15px; height: 15px;
  border: 0.9pt solid var(--ink-soft); border-radius: 2px; margin: 0 auto; }
table.walk .w-addr { width: auto; }
table.walk .w-lot  { width: 0.6in; text-align: right; padding-right: 14px; }
table.walk .w-own  { width: 1.85in; }
table.walk .w-out  { width: 0.62in; text-align: center; }
</style>
</head>
<body>
${sheets}
</body>
</html>
`;

const outHtml = join(HERE, 'walklist-print.html');
writeFileSync(outHtml, html, 'utf8');

/* A sidecar of the same neighbourhoods, for build-walk-tool.mjs. The digital
   tool and the printed sheet must name the same pockets, so the clustering has
   one implementation and this is its output rather than a second copy of it. */
const areaSlug = basename(file).replace(/\.csv$/i, '').replace(/-test$/i, '');
writeFileSync(join(HERE, `${areaSlug}-areas.json`), JSON.stringify({
  source: basename(file),
  built: new Date().toISOString().slice(0, 10),
  ordering: byStreet ? 'street' : bySize ? 'size' : 'neighbourhood',
  areas: [...new Map(pages.map((p) => [p.area ?? p.region, p])).keys()].map((name) => {
    const ps = pages.filter((p) => (p.area ?? p.region) === name);
    return {
      name, region: ps[0].region, avg: ps[0].avg ?? null,
      /* la/lo added 2026-10-01 for the satellite link. They were already parsed for the
         clustering and then dropped right here. Parcel centroid, not a geocoded guess. */
      doors: ps.flatMap((p) => p.rows).map((d) => ({
        a: d.address, ac: +d.acres.toFixed(2), o: d.owner,
        la: Number.isFinite(d.lat) ? +d.lat.toFixed(6) : null,
        lo: Number.isFinite(d.lon) ? +d.lon.toFixed(6) : null,
      })),
    };
  }),
}), 'utf8');
console.log(`${pages.length} sheets · ${doors.length} doors · ${regions.size} region(s)`);
for (const [r, l] of ordered) console.log(`   ${String(l.length).padStart(4)}  ${title(r)}`);
if (droppedBiz || droppedDup) {
  console.log(`   filtered out: ${droppedBiz} non-residential owners, ${droppedDup} duplicate addresses`);
}

/* --no-pdf (2026-10-07): the neighbourhood sidecar only. The Traverse editions' towns need no printed book, and that book is
   Sixfold's (its name is on every sheet). */
if (process.argv.includes('--no-pdf')) { console.log(`written ${areaSlug}-areas.json (no PDF)`); process.exit(0); }

/* ---- render, and assert the page count ----------------------------------- */
const run = spawnSync('node', [join(SIXFOLD, 'tools', 'html-to-pdf.mjs'), 'Sixfold-Walk-List'],
  { cwd: SIXFOLD, encoding: 'utf8' });
process.stdout.write(run.stdout ?? '');
if (run.status !== 0) { console.error(run.stderr); process.exit(1); }

const rendered = join(HERE, 'Sixfold-Walk-List.pdf');
const pdf = readFileSync(rendered).toString('latin1');
const got = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`\nsheets ${pages.length} · pdf pages ${got} · ${got === pages.length ? 'OK' : '** MISMATCH **'}`);

/* ⚑ One PDF per area, named after its CSV — otherwise each run overwrites the
   last and there is only ever one county's book on disk. The renderer's job
   entry has a fixed output name, so the rename happens here. */
const slug = basename(file).replace(/\.csv$/i, '').replace(/-test$/i, '')
  .split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('-');
const finalPath = join(HERE, `Sixfold-Walk-List-${slug}.pdf`);
renameSync(rendered, finalPath);
console.log(`written: ${basename(finalPath)}`);
