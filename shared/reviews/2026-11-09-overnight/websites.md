# Overnight review 9–10 Nov 2026: the websites

Area: traverseplatforms.com, 365aeration.com + sixfoldcolorado.com, staging.surgeftw.com. Commit `3c3a9155`.
Checked by crawling every page and asset of each site, probing for exposed files, reading the live `.htaccess` files, the PHP
error logs and the website PHP (booking, checkout, find-my-app, Stripe hook, the 365 relay, the Surge form handler),
rendering pages in headless Chrome at 390 and 1280 wide for console errors and layout overflow, and comparing every local
build with what is on the servers by md5.

## 1. Fixed and live

**traverseplatforms.com** (backup `~/upload-backups/before-review-site-20261109.tgz` on the trav account; uploaded as
minify-public copies through `~/bin/safe-extract.sh`, all 9 files md5-identical, cache flushed, every page 200 from the server)
- The trades page (`/editions/`) carried the homepage's meta description, og:title, og:description and og:url word for word.
  Google saw two pages with one description, and sharing the trades page showed the homepage's link. It now has its own
  description and og tags, and `og:url`/canonical say `/editions/`. Fixed in `build-editions-page.cjs`.
- No page had a canonical link. Added to the homepage (`build-preview.cjs`), the demo page, the trades page and the four legal
  pages. The five `?e=` variants of the trades page all point at `/editions/`.
- The four legal pages had no `<h1>` (the title was rendered as an h2), no meta description and no canonical. `build-legal.cjs`
  now writes all three; same look, the h1 uses the h2 style.
- Demo booking: a made-up date like `2026-13-45` threw inside PHP (a 500 with no message). `demo/api.php` now answers
  "Pick a day and a time." Tested live: the bad date answers 400 JSON; the slots call still works.
- The manage page said "Regular hours: Monday to Friday, 9 am to 5 pm" (stale since 30 Oct); it now prints the hours from
  site-config.php.
- `build-site.cjs`: the noindex-stripping regex had `s*` instead of `\s*` (harmless, left a blank line); fixed.
- Proof: before the edits the whole chain (build-preview → build-editions-page → build-legal → build-site → minify-public)
  reproduced the live files byte for byte, so only the intended lines changed (diff checked). `marked` for build-legal.cjs is
  not installed anywhere on this laptop; I installed it in the session scratchpad and passed `MARKED_DIR`. If you want it
  permanent: `npm install marked` in `traverse/marketing-site/`.

**365aeration.com** (a365 account; backup `~/upload-backups/before-review-365-20261109.tgz`; both domain caches flushed)
- `www.365aeration.com` answered 200 with the same page (a second address for the one site; aeration365.com and
  www.aeration365.com already 301'd). Now 301 → `https://365aeration.com/…`. Verified: www → 301, bare 200, http → https,
  aeration365.com → 301, `/sign/` `/q/` `/card/` 200, the relay API answers.
- No `sitemap.xml` (404) and robots.txt without a Sitemap line (robots.txt did not exist on disk; SiteGround was serving a
  default). Added a one-URL sitemap and a robots.txt; Search Console (set up 23 Oct) can now take the sitemap.
- The live homepage was the raw source (31,523 bytes, uploaded 1 Nov), not the minify-public copy the rule asks for. Replaced
  with the minified copy of the identical source (27,962 bytes); title, form and meta checked.
- Two deploy backups sat beside live files (`index.pre-required-20261101.html`, `q/index.html.pre-customquote-…`); they were
  403'd by the .htaccess rule but the rule is "never beside the live file". Moved to `~/upload-backups/365-*`.
- `sixfold/aeration365-site/htaccess-365main.txt` had fallen behind the server since 25 Oct (no security headers, no preview
  redirects). It is the live copy again, plus the www rule.
- My own checks hit `/card/ /car/ /truck/ /yard/` and were counted as QR scans; the five rows (10 Nov 06:11 and 06:28 UTC)
  were removed from `scan-log/scans.csv` (backup `~/upload-backups/scans.csv.pre-review-20261109`). Nothing else touched.

**sixfoldcolorado.com** (six account; backup `~/upload-backups/before-review-sixfold-site-20261109.tgz`)
- The 23 Oct redirects only applied to folder addresses. SiteGround's nginx serves an existing file straight from disk, around
  `.htaccess`, so `/index.html`, `/services/aeration/index.html`, `/contact/index.html`, `/assets/site.css` and every other old
  Sixfold Colorado page were still served as they were (old branding, old contact form posting to the old handler). Proven
  from the server: 200 before, 301 after. Fix: `chmod 600` on the 33 old html/css/js/image files (Apache, running as the account,
  still reads them and applies the 301; nginx no longer short-cuts). `api/`, `.well-known`, `robots.txt`, `sitemap.xml` and the
  Google verification file are untouched. Nothing deleted; `chmod 644` undoes it.
- `.htaccess.pre-365-20261023` moved out of public_html to `~/upload-backups/sixfold-htaccess.pre-365-20261023`.

**staging.surgeftw.com only** (surge account; backup `~/upload-backups/staging-htaccess.pre-review-20261109`; live
surgeftw.com's .htaccess untouched, md5 checked)
- Chrome logged `Manifest: Line: 1, column: 1, Syntax error` on every page: Apache sent `site.webmanifest` with no Content-Type.
  Added `AddType application/manifest+json .webmanifest`; now served with the right type. Also added
  `Strict-Transport-Security` (HTTPS is already forced; Traverse and 365 send the same header). In `surge/website/build/.htaccess`,
  so the next bundle carries it.

## 2. Fixed but not live
Nothing. (The 365 sitemap/robots and the Traverse pages are both in the repo and on the servers.)

## 3. For Matthew
- **Surge: the staging `api/config.php` answers 200 over the web.** It runs as PHP and prints nothing (it only returns an array),
  so nothing leaks, but DEPLOY.md says it must 403. One `<Files "config.php">Require all denied</Files>` in `api/` would do it;
  I left it because the Sixfold/Traverse api folders have exactly that rule and I did not want to change the Surge bundle's file
  list the night before you may hand it to Lance. Say the word and I add it.
- **Surge: form submissions on staging** go to `info@surgeftw.com` via PHP `mail()`; `submissions.log` on staging has 3 test rows
  from September. Still the one unproven hop before launch (DEPLOY.md step 8).
- **sixfoldcolorado.com `api/submit.php` is still live and executable** (old form handler, with its config and SMTP files).
  Nothing links to it now. Recommendation: move `api/` out of public_html at the next Sixfold session (keep
  `api/submissions.log`, the only record of the old form leads). Not done: it is Brandon's site and the memory says api/ was
  left alone on purpose.
- **Traverse app API errors (the app agent's area, not the website):** `public_html/api/php_errorlog` holds 18 "Allowed memory
  size of 805306368 bytes exhausted" fatals in rounds.php / traverse-*-rounds.php (25 Oct, 30 Oct, 6 Nov 22:05–22:13), plus
  5× "Cannot redeclare moRoot()" (2 Nov, sixfold-practice-mail-oauth-lib.php vs mail-oauth-lib.php). Passed on, not touched.
- **Shared website API files** (`api/traverse-start.php`, `traverse-hook.php`, `traverse-clients-lib.php`, `traverse-findapp.php`):
  read, no defects found (signature check, no-enumeration answer, rate limits, locks all as described). Nothing changed, nothing
  deployed there.
- **Traverse legal pages now carry an h1** where the title was an h2. The text is unchanged; it is the same words one heading
  level up. Mentioning it because the pages are attorney-approved.
- **The SiteGround bot filter now challenges this laptop's address** (SG-Captcha, "202 Accepted") on all four sites after the
  crawl. It clears on its own; it is why the later checks ran from the servers. Nothing to do.

## 4. Checked and fine
- Every internal link, image, stylesheet and script on all three sites: 0 broken (Traverse 25 URLs, 365 12, Surge staging 87;
  the one Surge 404 is a JS template string, not a link).
- Exposed files: `.git`, `.htaccess`, `.htpasswd`, `.env`, `*.md`, `*.log`, `*.bak/.zip/.sql`, `error_log`, the private folders
  (`traverse-site-private`, `a365-private`) all 403/404 on every site. `api/submissions.log` denied on Sixfold and Surge.
- Security headers present on Traverse, 365 and (now) Surge staging; no mixed content on any page; no analytics or third-party
  scripts beyond Google Fonts.
- noindex/robots/sitemap: Traverse marketing pages indexable, `/start/ /find/ /shots/` and the apps noindex by X-Robots-Tag
  (8 Nov rules kept); sitemap lists the 7 pages; Surge staging noindex + `Disallow: /` as intended; Traverse redirects
  http→https and www→bare; Surge staging redirects (`/how-it-works/ /training/ /sectors/`) work.
- Phone and email on every Traverse page: (303) 596-9515 and hello@traverseplatforms.com only. 365: (720) 830-4553 and
  contact@365aeration.com only. Surge staging: 720-719-5495 everywhere.
- Demo booking: slots API answers (open slots from 10 Nov evening); plans + quote (Team, yearly, 12 seats: $329/mo, $3,948
  first charge, $0 today); find-my-app and the Stripe hook refuse GET (405) and an unsigned POST ("bad signature").
- Surge staging is file-for-file identical to a fresh bundle from `surge/website/build` (72 files; only the server's
  `submissions.log` extra). `seo-audit.mjs` 0 failures; `audit-links.mjs` clean. Forms: every input labelled (the only
  "unlabelled" ones are the honeypots). Headless Chrome at 390 and 1280 on 8 pages: no JS errors, no overflow (the blank band in
  a full-page screenshot is the scroll-reveal, which honours reduced-motion).
- Headless Chrome on the Traverse pages (home, demo, trades, start checkout, find) and 365 (home, /sign/, /q/, /card/
  preview) at 390 and 1280 wide: no JS exceptions, no console errors, no horizontal overflow on the phone width. (Some 1280
  runs got SiteGround's robot challenge instead of the page, see §3; the three "broken" 365 photos it flagged are lazy-loaded
  and 200 on the server.)
- Traverse local `site/public_html` matched live before the edits (PHP, images, .htaccess identical; HTML identical once
  minified). 365 `/sign/` and `/q/` identical to the local dist.
- External links the sites point to answer: YouTube channel, Nextdoor page, Google review link, Instagram (365aeration,
  surge.ftw). Facebook returns a login page to anything that is not a browser (not checkable from here).
- Old Sixfold `sitemap.xml`/`robots.txt` left in place: they list URLs that now 301, which is what a change of address wants.
- Big assets: Traverse screenshots have WebP beside each PNG since 7 Nov; Surge hero video 1.4 MB mp4 / 1.5 MB webm (unchanged,
  as designed).
