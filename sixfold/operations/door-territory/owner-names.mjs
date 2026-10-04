/* Has the owner on a county record changed hands? (2026-10-03, SX-35)
   Used by build-rounds-data.mjs at each rebuild. A sale counts only when the old and new owner
   share NO name at all, so a spouse added, a move into a family trust, an LLC renamed or a
   record written differently is not a sale. Formats differ by county ("LAST FIRST / LAST FIRST"
   in El Paso, "FIRST M LAST & FIRST LAST" in Douglas), so every name word counts, not only
   the surname; the cost is a few missed sales where a common word survives (measured: 1.4% of
   random owner pairs share a word, mostly common first names).
   ⚑ A first version split on /s+/ instead of /\s+/ (a shell ate the backslash) and every
   change of wording read as a sale. owner-test checks THIS module, not a copy. */
const NOT_A_NAME = new Set(['AND', 'THE', 'TRUST', 'TRUSTS', 'TRUSTEE', 'TRUSTEES', 'LIVING', 'REVOCABLE', 'REV', 'IRREVOCABLE',
  'FAMILY', 'ESTATE', 'OF', 'LLC', 'INC', 'CO', 'CORP', 'LTD', 'JT', 'TEN', 'ET', 'AL', 'UX', 'JR', 'SR', 'II', 'III', 'IV', 'LP',
  'TR', 'DTD', 'DATED', 'AGREEMENT', 'MR', 'MRS', 'MS', 'DR', 'PROPERTIES', 'PROPERTY', 'HOLDINGS', 'HOMES', 'INVESTMENTS',
  'REVOC', 'LIV', 'DECLARATION', 'TTEE', 'TTEES', 'TRS', 'TOD', 'AS', 'FOR', 'FAM', 'LLLP', 'TRST', 'UNDER', 'UTA', 'UDT',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']);
export function ownerNames(o) {
  return new Set(String(o || '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !NOT_A_NAME.has(t)));
}
export function isSale(was, now) {
  const a = ownerNames(was), b = ownerNames(now);
  return a.size > 0 && b.size > 0 && ![...b].some((t) => a.has(t));
}
