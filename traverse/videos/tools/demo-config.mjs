// Where the LOCAL demo copies for the demo-editions video live (2 Nov 2026). They are scratch copies outside the repo, made by
// make-copies.sh in that folder from traverse/editions/dist (today's code + one town of data each). Never a live install.
// Override the folder with DEMO_DIR. The local test codes (admin 333333 and the crew codes setup-demo.mjs makes) stay in that
// folder's demo.json, never in the repo.
export const DEMO_DIR = process.env.DEMO_DIR || 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/0ebd7c3b-c808-4999-85da-c5cba31374c1/scratchpad/demo';
export const ADMIN = '333333';   /* local test code only */
export const ED = {
  roofing: { app: 'tr-cb2e8587', api: 'traverse-rounds.php', data: 'traverse-data', port: 8801, name: 'TraverseRoofing' },
  yards: { app: 'ty-25604fff', api: 'traverse-yards-rounds.php', data: 'traverse-yards-data', port: 8802, name: 'Lawn & Landscape' },
  solar: { app: 'ts-016064fc', api: 'traverse-solar-rounds.php', data: 'traverse-solar-data', port: 8803, name: 'TraverseSolar' },
};
export const origin = (e) => 'http://127.0.0.1:' + ED[e].port;
export const local = (u) => { if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(u)) throw new Error('local test copies only: ' + u); return u; };
