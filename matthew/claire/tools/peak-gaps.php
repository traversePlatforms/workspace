<?php
/* Which Peak desk cards are missing a website, a phone or a general email (2026-11-21, Claire's first look-ups). Read only. Prints one line of
   JSON per card: world, id, name, list, kind/cat, priority or score, stage, owner, and yes/no flags. No phones, emails or names of people. */
chdir(getenv('HOME') . '/www/traverseplatforms.com/public_html/peak-desk-28d38d/api');
require 'desk-store.php';
$sc = jread('scans.json', []);
foreach (['sponsor', 'expo'] as $w) foreach (recs($w, false) as $id => $R) {
    if (!empty($R['off'])) continue;
    $site = trim((string) ($R['site'] ?? '')) !== '';
    $phone = trim((string) ($R['phone'] ?? '')) !== ''; $email = false;
    foreach (array_merge($R['contacts'] ?? [], $R['added'] ?? []) as $c) { if (trim((string) ($c['phone'] ?? '')) !== '') $phone = true; if (trim((string) ($c['email'] ?? '')) !== '') $email = true; }
    $s = $sc[$id] ?? null; $scanPh = $s && !empty($s['phones']); $scanEm = $s && !empty($s['emails']);
    echo json_encode(['w' => $w, 'id' => $id, 'name' => (string) $R['name'], 'list' => (string) ($R['list'] ?? ''), 'kind' => (string) ($R['kind'] ?? $R['cat'] ?? ''),
        'pri' => $R['pri'] ?? null, 'score' => $R['score'] ?? null, 'stage' => (string) $R['stage'], 'owner' => (string) ($R['owner'] ?? ''), 'peak' => !empty($R['peak']),
        'site' => $site, 'phone' => $phone, 'email' => $email, 'scanPhone' => $scanPh, 'scanEmail' => $scanEm, 'dnc' => count($R['dnc'] ?? [])], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
}
