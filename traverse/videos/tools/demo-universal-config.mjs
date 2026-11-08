// Where the ONE local demo copy for the demo-universal video lives (7 Nov 2026). A scratch copy outside the repo, made by
// demo-universal-copy.sh from traverse/editions/dist: the Roofing edition's code with one town of data, and the Lawn & Landscape and
// Solar editions' per-door layers for the same town added, so one house card can show every fact (Matthew 7 Nov: every plan gets every
// feature). Never a live install. Override the folder with DEMO_DIR. The local test codes (admin 333333 and the people setup makes) stay
// in that folder's demo.json, never in the repo.
export const DEMO_DIR = process.env.DEMO_DIR || 'C:/Users/MATTHE~1/AppData/Local/Temp/claude/d618e1691dcd477f/b259fcaf-1649-4c4d-a6e7-c9e75e729c70/scratchpad/demo2';
export const ADMIN = '333333';   /* local test code only */
export const TOWN = 'highlands-ranch';   /* hail, roofs, re-roofs, new owners, lawns with their outline, sun, solar already, watering days */
/* one copy; the record and story scripts still say which ("one") so a screen's key stays the same shape as v1's */
export const ED = { one: { app: 'tr-cb2e8587', api: 'traverse-rounds.php', data: 'traverse-data', port: 8811, name: 'Example Co' } };
export const origin = (e) => 'http://127.0.0.1:' + ED[e].port;
export const local = (u) => { if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(u)) throw new Error('local test copies only: ' + u); return u; };
