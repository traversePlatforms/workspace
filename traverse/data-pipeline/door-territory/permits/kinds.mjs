/* Permit kinds beyond re-roof and solar (2026-10-29, Matthew: permits per trade in the editions). Each source's own type field is
 * used where it has one (fetch-*.mjs); this reads the free-text description a department files the permit with, for the rest.
 *   new    a new building: a new house where the source says so (Pikes Peak's census code 101, Aurora's Single-Family Detached,
 *          Douglas's stock and custom houses, Boulder's single-family New); Denver's class "New Building" can also be a garage
 *   add    an addition to the house
 *   pool   a swimming pool
 *   fence  a fence (or Boulder's fence-and-wall permit)
 *   deck   a deck or a patio cover
 *   irr    a lawn irrigation system (never a fire sprinkler)
 *   land   landscaping
 * The door files keep the latest month of each kind under a short key (DOOR_KEY). */
export const DOOR_KEY = { new: 'n', add: 'a', pool: 'pl', fence: 'f', deck: 'd', irr: 'ir', land: 'ld' };

export function textKind(desc) {
  const d = String(desc || '').toUpperCase();
  if (/\bPOOL\b/.test(d) && !/POOL\s*TABLE|CAR\s*POOL/.test(d)) return 'pool';
  if (/\bFENC(E|ES|ING)\b/.test(d)) return 'fence';
  if (/\bDECKS?\b|PATIO\s+COVER/.test(d)) return 'deck';
  if (/\bADDITION\b/.test(d) && !/\bIN ADDITION\b/.test(d)) return 'add';
  if (/IRRIGATION|LAWN\s+SPRINKLER|SPRINKLER\s+SYSTEM/.test(d) && !/FIRE|NFPA|13D|13R/.test(d)) return 'irr';
  if (/LANDSCAP/.test(d)) return 'land';
  return null;
}
