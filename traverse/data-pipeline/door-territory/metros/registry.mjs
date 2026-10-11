// Towns outside the hand-listed Colorado ones (the metro builder, 2026-10-11): every town in metros/<metro>.json, for the
// pipeline steps to add to their own lists. A town counts once its door list has been built (<town>-areas.json exists), so a
// config can name towns ahead of their build without breaking anything.
import { readFileSync, readdirSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
export function metros() {
  return readdirSync(HERE).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(HERE, f), 'utf8'))).filter((m) => m.key && Array.isArray(m.towns));
}
export function metroTowns({ built = true } = {}) {
  const out = [];
  for (const m of metros()) for (const t of m.towns) {
    const areas = `${t.key}-areas.json`;
    if (built && !existsSync(join(ROOT, areas))) continue;
    out.push({ key: t.key, label: t.label, areas, group: m.group || m.key, center: t.center, county: t.county, metro: m.key, state: m.state, stateFips: m.stateFips, timezone: m.timezone });
  }
  return out;
}
export function metroOf(townKey) { for (const m of metros()) if (m.towns.some((t) => t.key === townKey)) return m; return null; }
