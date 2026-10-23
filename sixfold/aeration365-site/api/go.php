<?php
/* Where the printed QR codes land (2026-10-16 forwarder; link page 2026-10-19, Matthew: "build out where these business cards go to so
   that when we start building it out it has a place to go to"). /card (business card), /yard (yard sign), /truck (truck magnets) and
   /car (car magnet) each set $piece and include this file.
   Each scan is counted, time + piece only (no IP, no cookie), in ../../scan-log/scans.csv, outside public_html. Link prefetchers and
   bots can add a few counts, so treat the numbers as a rough guide.
   The page: the quote button first and biggest, then call, text, and Facebook and reviews once their links are filled in below.
   The quote form is the homepage's, opened with ?from=<piece> so the lead carries where it came from. */
$ok = ['yard', 'truck', 'car', 'card'];
if (!in_array($piece ?? '', $ok, true)) $piece = 'unknown';
$dir = dirname(__DIR__, 2) . '/scan-log';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
/* ?preview=1 shows the page without counting it (2026-10-21: for opening it ourselves) */
$preview = isset($_GET['preview']);
if (!$preview) @file_put_contents("$dir/scans.csv", gmdate('c') . ",$piece\n", FILE_APPEND | LOCK_EX);

/* ---- fill these in when they exist; an empty one hides its button ---- */
$LINKS = [
  'facebook' => '',   /* the 365 Aeration & Seeding Facebook page, e.g. https://www.facebook.com/... */
  'reviews'  => '',   /* a Google review profile, once 365 has one (only then is a reviews button shown) */
];
$PHONE = '+17208304553'; $PHONE_SHOWN = '(720) 830-4553';
$FROM = ['card' => 'business card', 'yard' => 'yard sign', 'truck' => 'truck', 'car' => 'car', 'unknown' => 'QR code'];

$q = $piece === 'unknown' ? '' : '?from=' . rawurlencode($piece);
$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sixfold 365 · Aeration &amp; Overseeding</title>
<meta name="description" content="Core aeration, overseeding, fertilizing and landscaping all over Colorado. Get a quote, or call or text <?= $h($PHONE_SHOWN) ?>.">
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/365-sixfold-badge.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  /* the combined Sixfold x 365 look, as printed on the business cards (badge option C, Light): Bone ground, forest green, ember accent */
  :root{--bone:#EDE7DC;--cream:#FFF8EC;--ink:#1D2A1C;--head:#2F5D2C;--green:#4C7A3F;--ember:#E4703A;--soft:#5a6858}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:var(--bone);color:var(--ink);font:16px/1.5 'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column}
  main{flex:1;width:100%;max-width:460px;margin:0 auto;padding:32px 20px 28px;text-align:center}
  .badge{width:168px;height:168px;display:block;margin:0 auto 16px}
  h1{font:800 30px/1.1 'Outfit',sans-serif;color:var(--head);margin:0 0 10px;letter-spacing:-.01em}
  h1::after{content:"";display:block;width:44px;height:3px;border-radius:2px;background:var(--ember);margin:12px auto 0}
  .tag{font:500 16px/1.4 'DM Sans',sans-serif;color:var(--ink);margin:0 0 4px}
  .from{font-size:14px;color:var(--soft);margin:0 0 24px}
  .links{display:grid;gap:12px}
  .btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 20px;border-radius:999px;font:700 17px 'Outfit',sans-serif;text-decoration:none;background:var(--cream);color:var(--head);box-shadow:inset 0 0 0 2px var(--head)}
  .btn svg{width:20px;height:20px;flex:none}
  .btn.main{min-height:68px;font-size:21px;background:var(--head);color:var(--cream);box-shadow:0 6px 16px rgba(29,42,28,.25)}
  .btn.main:active{background:#244a22}
  .site{display:inline-block;margin-top:20px;color:var(--head);font-weight:700}
  footer{background:var(--head);color:var(--bone);text-align:center;font-size:14px;padding:18px 20px;border-top:4px solid var(--ember)}
  footer a{color:#fff;font-weight:700}
</style>
</head>
<body>
<main>
  <img class="badge" src="/assets/365-sixfold-badge.svg" alt="Sixfold 365: Land, Aeration &amp; Seeding">
  <h1>Aeration &amp; Overseeding</h1>
  <p class="tag">Core aeration · Overseeding · Fertilizer</p>
<?php if ($piece === 'yard'): /* the yard signs stand on a customer's lawn, done or in progress (2026-10-21, Matthew) */ ?>
  <p class="from">Your neighbour chose Sixfold 365 for their lawn. Want yours done next?</p>
<?php else: ?>
  <p class="from">Thanks for scanning our <?= $h($FROM[$piece]) ?>.</p>
<?php endif; ?>
  <div class="links">
    <a class="btn main" href="/<?= $q ?>#quote">Get a quote</a>
    <a class="btn" href="tel:<?= $h($PHONE) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Call <?= $h($PHONE_SHOWN) ?></a>
    <a class="btn" href="sms:<?= $h($PHONE) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Text us</a>
<?php if ($LINKS['facebook'] !== ''): ?>
    <a class="btn" href="<?= $h($LINKS['facebook']) ?>" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>Facebook</a>
<?php endif; if ($LINKS['reviews'] !== ''): ?>
    <a class="btn" href="<?= $h($LINKS['reviews']) ?>" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17.1l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z"/></svg>Read our reviews</a>
<?php endif; ?>
  </div>
  <a class="site" href="/<?= $q ?>">Visit our website</a>
</main>
<footer>Call or text <a href="tel:<?= $h($PHONE) ?>"><?= $h($PHONE_SHOWN) ?></a></footer>
</body>
</html>
