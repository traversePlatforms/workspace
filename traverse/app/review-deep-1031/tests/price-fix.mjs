// the harness's shared Stripe TEST config was made on 29 Oct: put the current (active) team yearly prices in it. Prints ids only.
import { readFileSync, writeFileSync } from 'node:fs';
const H = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-cideep';
const KEY = JSON.parse(readFileSync('C:/Users/Surge Inc/.ssh/stripe-test.json', 'utf8')).secret;
const F = JSON.parse(readFileSync('C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-ad69e4f291364bf2e/traverse/ops/stripe-founding-prices.test.json', 'utf8'));
const f = H + '/traverse-shared/clients/billing-config.php'; let txt = readFileSync(f, 'utf8');
const r = await (await fetch('https://api.stripe.com/v1/prices?active=true&lookup_keys[]=traverse_v2_team_year', { headers: { Authorization: 'Bearer ' + KEY } })).json();
const list = r.data?.[0]; if (!list) throw new Error('no active traverse_v2_team_year');
console.log('list team year ->', list.id, '$' + list.unit_amount / 100, '| founding team year ->', F.team.year);
txt = txt.split('price_1UUqJkDLDMv66YmBQdCnNbBI').join(list.id).split('price_1UW8uSDLDMv66YmBr8otho61').join(F.team.year);
writeFileSync(f, txt); console.log('written');
