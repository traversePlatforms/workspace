<?php
/* One person signs in: Matthew. The first password is made with a one-time setup code (set on the server by hand, then gone);
   after that, the password only. Eight wrong tries in 15 minutes from one address locks that address out for the rest of them. */
declare(strict_types=1);

function aSessionStart(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('asst');
    session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.save_path', aDataDir());
    ini_set('session.gc_maxlifetime', (string) (14 * 86400));
    session_start();
}
function signedIn(): bool { aSessionStart(); return !empty($_SESSION['ok']) && ($_SESSION['at'] ?? 0) > time() - 14 * 86400; }
function ip(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? '?'); }
function tooManyTries(): bool {
    $r = jget('tries.json'); $mine = array_filter((array) ($r[ip()] ?? []), fn($t) => $t > time() - 900);
    return count($mine) >= 8;
}
function noteTry(): void { jedit('tries.json', function ($r) { $r[ip()] = array_values(array_filter((array) ($r[ip()] ?? []), fn($t) => $t > time() - 900)); $r[ip()][] = time(); return $r; }); }
function signIn(string $password): bool {
    if (tooManyTries()) return false;
    $h = (string) (cfg()['passwordHash'] ?? '');
    if ($h === '' || !password_verify($password, $h)) { noteTry(); alog('signin failed', ['ip' => ip()]); return false; }
    aSessionStart(); session_regenerate_id(true); $_SESSION['ok'] = 1; $_SESSION['at'] = time();
    alog('signin', ['ip' => ip()]);
    return true;
}
/** the first password, with the setup code */
function firstPassword(string $code, string $password): ?string {
    if (tooManyTries()) return 'Too many tries. Wait 15 minutes.';
    $c = cfg();
    if (!empty($c['passwordHash'])) return 'A password is already set.';
    if (empty($c['setupCodeHash']) || !password_verify($code, (string) $c['setupCodeHash'])) { noteTry(); return 'That setup code is not right.'; }
    if (mb_strlen($password) < 12) return 'Use at least 12 characters.';
    jedit('config.json', function ($c) use ($password) { $c['passwordHash'] = password_hash($password, PASSWORD_DEFAULT); unset($c['setupCodeHash']); return $c; });
    aSessionStart(); session_regenerate_id(true); $_SESSION['ok'] = 1; $_SESSION['at'] = time();
    alog('password set', ['ip' => ip()]);
    return null;
}
/** a POST from another site is refused (the cookie is Lax already; this is the second lock) */
function sameOrigin(): bool {
    $o = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($o === '') return true;
    $p = parse_url($o); $h = ($p['host'] ?? '') . (isset($p['port']) ? ':' . $p['port'] : '');
    return $h === ($_SERVER['HTTP_HOST'] ?? '');
}
