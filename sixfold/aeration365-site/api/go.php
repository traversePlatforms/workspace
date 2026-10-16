<?php
/* The printed QR codes land here (2026-10-16): /yard (yard sign), /truck (truck magnets), /car (car magnet), /card (business card).
   For now each forwards to the homepage; a link page per address replaces this before the print is handed out (Matthew's plan).
   Counts each scan, time + piece only (no IP, no cookie), in ../../scan-log/scans.csv, outside public_html. Link prefetchers and
   bots can add a few counts, so treat the numbers as a rough guide. */
$ok = ['yard', 'truck', 'car', 'card'];
if (!in_array($piece ?? '', $ok, true)) $piece = 'unknown';
$dir = dirname(__DIR__, 2) . '/scan-log';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
@file_put_contents("$dir/scans.csv", gmdate('c') . ",$piece\n", FILE_APPEND | LOCK_EX);
header('Cache-Control: no-store, max-age=0');
header('Location: /?from=' . $piece, true, 302);
exit;
