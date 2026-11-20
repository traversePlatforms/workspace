<?php
declare(strict_types=1);
/* The site analytics collector (2026-11-20): the page script (v.js) posts one event here; ?a=report answers the stats page (key only).
   Everything is in the private folder's lib.php; see its header for what is kept and what never is. */
$lib = (getenv('SV_PRIVATE') ?: dirname(__DIR__, 2) . '/site-analytics') . '/lib.php';
if (!is_readable($lib)) { http_response_code(204); exit; }
require $lib;
if (($_GET['a'] ?? '') === 'report') svReportEndpoint(); else svCollect();
