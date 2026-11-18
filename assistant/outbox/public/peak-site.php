<?php
declare(strict_types=1);
/* Goes up as public_html/outbox-092b0f/peak/site.php, beside the Peak sender's lib.php (which loads it). It tells that copy where it lives
   and hands its sign-in to Outbox: Outbox's code is the only way in, the Peak data stays in peak-mail-data, and Microsoft comes back to
   whichever redirect Outbox's Peak section says is registered (the old address until Matthew adds the new one in Entra). */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/lib.php';
define('PM_PATH', OB_PATH . '/peak');
define('PM_ROOT', obRoot());
function pmSiteSignedIn(): bool { return obSignedIn(); }
function pmSiteRedirect(): string { return obPeakRedirect(); }
function pmSiteHome(string $kind): string { return OB_PATH . '/?tab=peak&ms=' . rawurlencode($kind); }
