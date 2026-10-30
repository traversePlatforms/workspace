// Sign in with Google / Microsoft for Setup › Email (2026-10-30): the server's keys, from the files Matthew saved.
//   node traverse/ops/mail-oauth-keys.mjs            checks both files and says what it would send (never a secret)
//   node traverse/ops/mail-oauth-keys.mjs --upload   sends ~/www/traverseplatforms.com/traverse-shared/mail-oauth.json (chmod 600) and makes
//                                                    traverse-shared/mail-oauth.key once (32 random bytes as hex, chmod 600; never replaced:
//                                                    a new key would make every saved connection unreadable)
// Reads ~/.ssh/google-mail-oauth.json (Google's download: {"web": {client_id, client_secret, redirect_uris, ...}}) and, when it exists,
// ~/.ssh/microsoft-mail-oauth.json ({client_id, client_secret}). Run again with --upload when the Microsoft file arrives: Microsoft switches on.
// Shape on the server: {"google": {"client_id", "client_secret"}, "microsoft": {"client_id", "client_secret"}} (api/mail-oauth-lib.php moApps).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
const REDIRECT = 'https://traverseplatforms.com/api/mail-oauth.php';
const G = homedir() + '/.ssh/google-mail-oauth.json', M = homedir() + '/.ssh/microsoft-mail-oauth.json';
const out = {}; let bad = false;
const tail = (s) => '...' + String(s).slice(-6);
if (existsSync(G)) {
  const j = JSON.parse(readFileSync(G, 'utf8')); const w = j.web || j;
  const ok = /\.apps\.googleusercontent\.com$/.test(w.client_id || '') && typeof w.client_secret === 'string' && w.client_secret.length > 10;
  const red = !w.redirect_uris || w.redirect_uris.includes(REDIRECT);
  console.log('google: client id ' + tail(w.client_id) + ', secret ' + (w.client_secret ? 'present' : 'MISSING') + (j.web ? ', a Web client' : ', NOT a Web client') + (red ? ', redirect URI registered' : ', redirect URI ' + REDIRECT + ' NOT in the file'));
  if (ok && j.web && red) out.google = { client_id: w.client_id, client_secret: w.client_secret }; else bad = true;
} else console.log('google: no file at ' + G);
if (existsSync(M)) {
  const j = JSON.parse(readFileSync(M, 'utf8'));
  const ok = /^[0-9a-f-]{36}$/i.test(j.client_id || '') && typeof j.client_secret === 'string' && j.client_secret.length > 10;
  console.log('microsoft: client id ' + tail(j.client_id) + ', secret ' + (j.client_secret ? 'present' : 'MISSING') + (ok ? '' : ' (client_id should be the Application (client) ID, a GUID)'));
  if (ok) out.microsoft = { client_id: j.client_id, client_secret: j.client_secret }; else bad = true;
} else console.log('microsoft: no file yet (' + M + '): Sign in with Microsoft stays off');
if (bad || !Object.keys(out).length) { console.log('nothing sent: fix the file(s) above first'); process.exit(1); }
if (!process.argv.includes('--upload')) { console.log('would send: ' + Object.keys(out).join(' + ') + ' (add --upload)'); process.exit(0); }
const cmd = 'umask 077; d=~/www/traverseplatforms.com/traverse-shared; cat > $d/mail-oauth.json.tmp && mv $d/mail-oauth.json.tmp $d/mail-oauth.json && chmod 600 $d/mail-oauth.json'
  + ' && { [ -s $d/mail-oauth.key ] || { od -An -tx1 -N32 /dev/urandom | tr -d " \\n" > $d/mail-oauth.key; echo "key made"; }; } && chmod 600 $d/mail-oauth.key'
  + ' && php -r \'$j=json_decode(file_get_contents(getenv("HOME")."/www/traverseplatforms.com/traverse-shared/mail-oauth.json"),true);$k=trim(file_get_contents(getenv("HOME")."/www/traverseplatforms.com/traverse-shared/mail-oauth.key"));echo "on the server: ",implode(" + ",array_keys($j)),", key ",preg_match("/^[0-9a-f]{64}$/",$k)?"ok":"BAD","\\n";\'';
const r = spawnSync('bash', ['/c/Users/SURGEI~1/.ssh/sg.sh', 'trav', cmd], { input: JSON.stringify(out), encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
process.exit(r.status || 0);
