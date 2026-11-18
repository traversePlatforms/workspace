<?php
declare(strict_types=1);
/* Post calendar: where LinkedIn sends Matthew's browser back after "Connect LinkedIn" (2026-11-18). Registered in Surge's LinkedIn app as
 * https://traverseplatforms.com/posts-ab8c57/api/linkedin-oauth.php. Works only for the admin sign-in of this calendar (its cookie), and
 * only with a state this server handed out in the last 15 minutes, once. Swaps LinkedIn's code for the tokens (kept sealed on the server,
 * see post-calendar-tools/linkedin.php), lists the Pages he can post for, and lets him pick one. Says LinkedIn's refusal in plain words.
 * Shows no token, ever. */
define('PC', 1);
require (getenv('PC_LIB') ?: dirname(__DIR__, 3) . '/post-calendar-tools/lib.php');

header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY'); header("Content-Security-Policy: frame-ancestors 'none'"); header('X-Robots-Tag: noindex, nofollow'); header('Referrer-Policy: no-referrer');
function h($s): string { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function page(string $kind, string $title, string $text, string $more = '', int $code = 200): void {
    http_response_code($code);
    $col = ['ok' => '#1f7a4d', 'warn' => '#b42318', 'note' => '#6b4e00'][$kind] ?? '#13294b';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>LinkedIn: post calendar</title>'
       . '<style>body{margin:0;background:#f4f6f9;color:#0f1b2d;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}main{max-width:520px;margin:8vh auto;padding:0 16px}'
       . '.box{background:#fff;border:1px solid #dce2ea;border-left:8px solid ' . $col . ';border-radius:14px;padding:18px 20px}h1{font-size:20px;margin:0 0 8px}p{margin:8px 0}'
       . 'button{display:block;width:100%;text-align:left;border:1px solid #dce2ea;background:#fff;border-radius:10px;padding:12px 14px;margin:8px 0;font:inherit;font-weight:650;cursor:pointer;min-height:48px}'
       . 'button:disabled{opacity:.5;cursor:not-allowed}button small{display:block;font-weight:500;color:#566476}a{color:#13294b;font-weight:700}#msg{min-height:1.4em;font-weight:600}</style></head><body><main><div class="box" id="box">'
       . '<h1>' . h($title) . '</h1><p>' . h($text) . '</p>' . $more . '<p><a href="../">Back to the post calendar</a></p></div></main></body></html>';
    exit;
}

$me = pcSessionMe();
if (!$me || ($me['role'] ?? '') !== 'admin') page('warn', 'Sign in first', 'Open the post calendar on this phone or computer, sign in with Matthew\'s code, then press Connect LinkedIn again. Nothing was changed.', '', 403);
$st = pcLiTakeState((string) ($_GET['state'] ?? ''));
if (!$st) page('warn', 'This link is old', 'This LinkedIn sign-in was already used, is over 15 minutes old, or did not start here. Press Connect LinkedIn again on the post calendar. Nothing was changed.', '', 400);
$cid = (string) $st['client'];
if (!pcLiAllowed($cid)) page('warn', 'Not set up', 'LinkedIn is only set up for Surge.', '', 400);
$name = (string) (pcState()['clients'][$cid]['name'] ?? $cid);

if (isset($_GET['error'])) {
    $r = pcLiRefused($cid, pcClean($_GET['error'], 80), pcClean($_GET['error_description'] ?? '', 400));
    page($r['kind'] === 'refused' ? 'warn' : 'note', $r['kind'] === 'refused' ? 'LinkedIn hasn\'t approved posting yet' : ($r['kind'] === 'retry' ? 'Press Connect LinkedIn again' : 'Nothing changed'), $r['text']);
}
$code = (string) ($_GET['code'] ?? '');
if ($code === '') page('warn', 'Nothing came back', 'LinkedIn sent no answer. Press Connect LinkedIn again. Nothing was changed.', '', 400);
$r = pcLiFinish($cid, $code, (string) $me['name']);
if ($r['kind'] !== 'connected') page('warn', $r['kind'] === 'refused' ? 'LinkedIn hasn\'t approved posting yet' : 'Not connected', $r['text']);

/* connected: the Pages, so he picks the one to post as (Surge Inc) */
$v = pcLiView(pcState()['clients'][$cid]);
$btn = '';
foreach ((array) ($v['orgs'] ?? []) as $o) {
    $roles = implode(', ', array_map(fn($x) => ucwords(strtolower(str_replace('_', ' ', $x))), (array) $o['roles']));
    $btn .= '<button type="button" data-org="' . h($o['id']) . '"' . ($o['canPost'] ? '' : ' disabled') . '>' . h($o['name']) . '<small>' . h($roles) . ($o['canPost'] ? '' : ' (cannot post for this Page)') . ($v['org_id'] === (string) $o['id'] ? ' (chosen now)' : '') . '</small></button>';
}
$more = '<p>Connected as <b>' . h($v['member'] ?? '') . '</b>. Pick the LinkedIn Page ' . h($name) . ' posts as:</p>' . ($btn !== '' ? $btn : '<p><b>No Pages came back.</b></p>') . '<p id="msg"></p>'
      . '<script>(function(){var m=document.getElementById("msg");[].forEach.call(document.querySelectorAll("button[data-org]"),function(b){b.onclick=function(){'
      . 'm.textContent="Saving...";fetch("cal.php?action=lipick",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-PC":"1"},body:JSON.stringify({id:' . json_encode($cid) . ',org:b.getAttribute("data-org")})})'
      . '.then(function(r){return r.json()}).then(function(j){if(!j.ok)throw new Error(j.error||"Not saved.");m.textContent="Done: ' . h($name) . ' posts to LinkedIn as "+j.li.org_name+". You can close this tab.";'
      . '[].forEach.call(document.querySelectorAll("button[data-org]"),function(x){x.disabled=true})}).catch(function(e){m.textContent=e.message})}})})();</script>';
page('ok', 'LinkedIn connected', $r['text'], $more);
