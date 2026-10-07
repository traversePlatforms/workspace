/* How long a storm stays on the doors (Matthew 2026-10-06): two years, or five for a major one. A storm day is kept whole or
 * dropped whole, so a door's list and the storm list always agree: a major day keeps every door it reached, not just the
 * worst-hit ones. Used by hail/build-hail.mjs and wind/build-wind.mjs; the app's server refresh (api/rounds.php,
 * stormRefresh) applies the same numbers, so change them in both places. */
export const KEEP_YEARS = 2, MAJOR_YEARS = 5;
export const MAJOR_HAIL_IN = 2;      /* hail 2 in or more anywhere on our doors that day */
export const MAJOR_WIND_MPH = 75;    /* a gust of 75 mph or more */

const yearsBack = (n, today) => { const d = new Date(today); d.setUTCFullYear(d.getUTCFullYear() - n); return d.toISOString().slice(0, 10); };
export function cutoffs(today = new Date()) { return { keep: yearsBack(KEEP_YEARS, today), major: yearsBack(MAJOR_YEARS, today) }; }
export const keepHailDay = (day, maxInch, c) => day >= c.keep || (maxInch >= MAJOR_HAIL_IN && day >= c.major);
export const keepWindDay = (day, maxMph, c) => day >= c.keep || ((maxMph || 0) >= MAJOR_WIND_MPH && day >= c.major);
