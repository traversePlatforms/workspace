// Start a client install (2026-10-08): writes ./clients/<slug>.json for clients.cjs and build-editions.cjs.
//   node new-client.cjs --name "Acme Roofing" --trade roofing --color "#1f6feb" [--short Acme] [--phone "(719) 555-0100"]
//                       [--email office@acme.example] [--site acme.example] [--tagline "..."] [--market dfw]
//   --market: a market outside Colorado, from data-pipeline/door-territory/metros/<market>.json (2026-10-11). Without it: Colorado.
// Then: node build-editions.cjs c-acme-roofing     (the packs land in dist/upload/c-acme-roofing/)
const fs = require('fs');
const path = require('path');
const { palette, contrast } = require('./clients.cjs');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const name = arg('name'), trade = arg('trade') || 'roofing', color = arg('color');
if (!name || !color) { console.error('usage: node new-client.cjs --name "Company Name" --trade roofing --color "#1f6feb" [--short --phone --email --site --tagline]'); process.exit(1); }
if (!['roofing', 'yards', 'solar', 'pest', 'security'].includes(trade)) { console.error('trade must be roofing, yards, solar, pest or security'); process.exit(1); }
const market = arg('market') || null;
if (market && !fs.existsSync(path.join(__dirname, '..', 'data-pipeline', 'door-territory', 'metros', market + '.json'))) { console.error('no such market: ' + market + ' (data-pipeline/door-territory/metros/' + market + '.json)'); process.exit(1); }
const slug = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const dir = path.join(__dirname, 'clients'), file = path.join(dir, slug + '.json');
fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(file)) { console.error('already there: clients/' + slug + '.json'); process.exit(1); }
const C = { trade, name, short: arg('short') || name.split(/\s+/)[0], color, tagline: arg('tagline') || '', phone: arg('phone') || '', email: arg('email') || '', site: arg('site') || '', towns: null, host: null, ...(market ? { market } : {}) };
const pal = palette(color);
fs.writeFileSync(file, JSON.stringify(C, null, 2) + '\n');
console.log(`clients/${slug}.json written (${trade}${market ? ', market ' + market : ''}). Bar ${pal.bar}, accent ${pal.accent} (white on it ${contrast(pal.accent, '#ffffff').toFixed(1)}:1).`);
console.log(`Next: node build-editions.cjs c-${slug}`);
