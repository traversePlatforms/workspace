<?php
/* The Peak email moved into Outbox (2026-11-17). This old address stays for the hourly cron (sixfold-tools/morning-email.php) and the laptop's overnight check still call this path; the real file is Outbox's copy. */
require dirname(__DIR__) . '/outbox-092b0f/peak/cron.php';
