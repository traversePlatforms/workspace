<?php
declare(strict_types=1);
/* Microsoft sends Matthew back here after Connect Microsoft (registered in Peak's tenant as the "Matthew outreach" app's redirect:
   https://traverseplatforms.com/peak-mail-31dc56/oauth.php; inside Outbox the old address's oauth.php is a pointer to this file). The checks
   and the token exchange are pmAuthCallback() in lib.php. */
require __DIR__ . '/lib.php';
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
if (!pmReady()) { http_response_code(500); exit('Not set up.'); }
$r = pmAuthCallback($_GET, $_COOKIE);
pmW('oauth-last.json', $r + ['at' => pmNow()]);
$here = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? PM_PATH . '/oauth.php'))), '/') . '/';
setcookie(pmCookieName(), '', ['expires' => 1, 'path' => pmCookiePath()]);
header('Location: ' . pmHome((string) $r['kind'], $here), true, 302);
