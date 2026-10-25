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
/* "Save contact" (2026-10-25): the company's card for the phone's contacts, not counted as a scan */
if (isset($_GET['vcf'])) {
  header('Content-Type: text/vcard; charset=utf-8');
  header('Content-Disposition: attachment; filename="Sixfold-365.vcf"');
  header('Cache-Control: no-store, max-age=0');
  echo implode("\r\n", ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Sixfold 365', 'ORG:Sixfold 365', 'TEL;TYPE=WORK,VOICE:+17208304553',
    'EMAIL;TYPE=WORK:contact@365aeration.com', 'URL:https://365aeration.com/', 'NOTE:Core aeration\, overseeding and fertilizer. Serving the Denver metro.', 'END:VCARD']) . "\r\n";
  exit;
}
$dir = dirname(__DIR__, 2) . '/scan-log';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
/* ?preview=1 shows the page without counting it (2026-10-21: for opening it ourselves) */
$preview = isset($_GET['preview']);
if (!$preview) @file_put_contents("$dir/scans.csv", gmdate('c') . ",$piece\n", FILE_APPEND | LOCK_EX);

/* ---- fill these in when they exist; an empty one hides its button ---- */
$LINKS = [
  'facebook' => 'https://www.facebook.com/1418675127985724',   /* the Sixfold 365 Page (was 365 Aeration and Seeding); no username set, so by id (2026-10-25) */
  'reviews'  => 'https://g.page/r/CdxyzSzq9tvEEBM/review',   /* Sixfold's Google profile, still named Sixfold Colorado (2026-10-25, Matthew: add a review button) */
];
$PHONE = '+17208304553'; $PHONE_SHOWN = '(720) 830-4553'; $EMAIL = 'contact@365aeration.com';
/* job photos: drop .jpg/.webp files in img/work/ and they show in a strip; none yet, so nothing shows. Our own jobs only, no stock people,
   no recognisable house fronts without the owner's say-so */
$PHOTOS = glob(dirname(__DIR__) . '/img/work/*.{jpg,jpeg,webp}', GLOB_BRACE) ?: [];
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
  .area{font-size:14px;font-weight:700;color:var(--head);margin:0 0 4px}
  .addr{display:flex;gap:8px;margin:2px 0 6px}
  .addr input{flex:1;min-width:0;min-height:52px;padding:0 16px;border-radius:999px;border:2px solid var(--head);background:#fff;color:var(--ink);font:16px 'DM Sans',sans-serif}
  .addr button{min-height:52px;padding:0 20px;border-radius:999px;border:0;background:var(--ember);color:#fff;font:700 16px 'Outfit',sans-serif;cursor:pointer}
  .addrlab{font-size:14px;color:var(--soft);text-align:left;margin:6px 4px 0}
  button.btn{width:100%;border:0;cursor:pointer}
  .work{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:24px}
  .work img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;filter:saturate(.92)}
  footer{background:var(--head);color:var(--bone);text-align:center;font-size:14px;padding:18px 20px;border-top:4px solid var(--ember)}
  footer a{color:#fff;font-weight:700}
</style>
</head>
<body>
<main>
  <img class="badge" src="/assets/365-sixfold-badge.svg" alt="Sixfold 365: Land, Aeration &amp; Seeding">
  <h1>Aeration &amp; Overseeding</h1>
  <p class="tag">Core aeration · Overseeding · Fertilizer</p>
  <p class="area">Serving the Denver metro</p>
<?php if ($piece === 'yard'): /* the yard signs stand on a customer's lawn, done or in progress (2026-10-21, Matthew) */ ?>
  <p class="from">Your neighbour chose Sixfold 365 for their lawn. Want yours done next?</p>
<?php else: ?>
  <p class="from">Thanks for scanning our <?= $h($FROM[$piece]) ?>.</p>
<?php endif; ?>
  <div class="links">
    <a class="btn main" href="/<?= $q ?>#quote">Get a quote</a>
    <form class="addrbox" action="/" method="get" id="addr">
      <p class="addrlab">Or start with your address</p>
      <div class="addr"><?php if ($piece !== 'unknown'): ?><input type="hidden" name="from" value="<?= $h($piece) ?>"><?php endif; ?>
        <input name="street" autocomplete="street-address" maxlength="120" placeholder="e.g. 1234 Elm St, Centennial" aria-label="Your street address" required>
        <button type="submit">Go</button></div>
    </form>
    <a class="btn" href="tel:<?= $h($PHONE) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Call <?= $h($PHONE_SHOWN) ?></a>
    <a class="btn" href="sms:<?= $h($PHONE) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Text us</a>
    <a class="btn" href="mailto:<?= $h($EMAIL) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>Email us</a>
    <a class="btn" href="?vcf=1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>Save our contact</a>
<?php if ($LINKS['facebook'] !== ''): ?>
    <a class="btn" href="<?= $h($LINKS['facebook']) ?>" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>Facebook</a>
<?php endif; if ($LINKS['reviews'] !== ''): ?>
    <a class="btn" href="<?= $h($LINKS['reviews']) ?>" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17.1l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z"/></svg>Reviews on Google</a>
<?php endif; ?>
    <button class="btn" type="button" id="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>Share with a neighbour</button>
  </div>
<?php if ($PHOTOS): ?>
  <div class="work"><?php foreach (array_slice($PHOTOS, 0, 6) as $p): ?><img src="/img/work/<?= $h(rawurlencode(basename($p))) ?>" alt="A lawn we worked on" loading="lazy"><?php endforeach; ?></div>
<?php endif; ?>
  <a class="site" href="/<?= $q ?>">Visit our website</a>
</main>
<footer>Call or text <a href="tel:<?= $h($PHONE) ?>"><?= $h($PHONE_SHOWN) ?></a></footer>
<script>
(function () {
  /* the address goes to the quote form, which starts with it filled in */
  var fm = document.getElementById('addr');
  fm.addEventListener('submit', function (e) {
    e.preventDefault(); var s = fm.elements.street.value.trim(); if (!s) return;
    var p = new URLSearchParams(); if (fm.elements.from) p.set('from', fm.elements.from.value);
    var parts = s.split(','); p.set('street', parts[0].trim()); if (parts[1]) p.set('city', parts[1].trim());
    location.href = '/?' + p.toString() + '#quote';
  });
  /* Share: the phone's own share sheet, else a text message with the link */
  var url = 'https://365aeration.com/', txt = 'Sixfold 365 does core aeration and overseeding around Denver: ';
  document.getElementById('share').addEventListener('click', function () {
    if (navigator.share) { navigator.share({ title: 'Sixfold 365', text: txt, url: url }).catch(function () {}); return; }
    location.href = 'sms:?&body=' + encodeURIComponent(txt + url);
  });
})();
</script>
</body>
</html>
