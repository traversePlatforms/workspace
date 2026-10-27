/* Which laser survey each town's doors are read from (2026-10-26): the map sample-trees.mjs keeps (every town, kept up to date there),
   read from its source so the roof and solar scripts can take every town with --all-towns instead of their own shorter lists.
   Values are lidar.mjs PROJECT keys (elpaso, douglas, drcog1, drcog2, eastern-b1, teller); a town with no laser survey (elbert) has
   no PROJECT entry and is skipped by the callers. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sample-trees.mjs'), 'utf8');
const body = src.slice(src.indexOf('const TOWNS = {'), src.indexOf('};', src.indexOf('const TOWNS = {')));
export const SURVEY = Object.fromEntries([...body.matchAll(/'?([a-z0-9-]+)'?:\s*'([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]));
