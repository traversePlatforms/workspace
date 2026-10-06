# Sixfold website — overnight review, 2026-10-06

**Scope:** `sixfold/site/` except `summit-de59ae83/` (the door app's quote page, someone else's).
**Live site:** https://sixfoldcolorado.com — checked with read-only GETs only. **The live contact form was not submitted.** Nothing was uploaded, committed or built; no dated bundle was touched.

## Summary

The site is in good shape. The live pages are byte-identical to the local files and to the `dist/sixfold-site-2026-10-05` bundle, both plain and with a `?cb=` cache-buster, so there is no stale-cache or wrong-folder problem. Every private path that must be denied is denied (`.md`, `.mjs`, `.htaccess`, `api/config.php`, `api/submissions.log`, `api/.ratelimit/`, `_tabled/`, `.git/`). The form handler is sound: honeypot that logs its rejections, per-IP throttle that fails open, header-injection guard on everything that reaches a mail header, lead written to the log before any send is attempted, send result logged with a stage. HTML validates clean (html-validate, `standard` preset, 10 pages, 0 errors). The link auditor passes every page in scope.

Eight files changed, all small. The real finds were copy and shipped comments rather than code:

1. **Three service pages said "All three services" and `/services/` said "whichever of the three you need"** — stale since the fourth service (lawn and turf care) was added on 2026-09-24. Fixed.
2. **The public HTML source carried a customer's first name and the price of her aeration job, the street address the schema deliberately leaves out, and a quote about licensing** — all inside HTML comments, which ship to the browser. View-source shows them. Fixed by rewording the three comments; the broader fix (strip comments at bundle time) is the top recommendation.
3. **`sitemap.xml` `lastmod` dates were stale** against git, which is the rule the file itself states. Fixed.

Nothing on the site says licensed, insured, bonded, certified or Firewise; no aeration price, no "free quote", no "end-of-summer rates", no germination guarantee, no watering promise, no pesticide or weed control, no county cost-share by name. Landscaping is never framed as the after-job of fire mitigation. Phone is (303) 915-1045 everywhere. Zero tracking confirmed (the only script is `site.js`, loaded on `/contact/` only).

## FIXED

### 1. Stale service count on four pages

- `sixfold/site/services/fire-mitigation/index.html:128`, `services/land-clearing/index.html:107`, `services/landscaping/index.html:116` — the ghost button under "How it goes" read **"All three services"**. The aeration page already said "All four services" and `/services/` h1 says "Four services".
- `sixfold/site/services/index.html:274` — the contact band read **"whichever of the three you need"**.

**Failure scenario:** a visitor on the landscaping page is told there are three services, clicks through to a page headed "Four services. Any one of them, or all four." The site disagrees with itself on the simplest fact about it.
**Fix:** "All four services" / "whichever of the four you need".
**Verification:** `grep -rn "three" ` across the ten pages — the only remaining hits are inside HTML comments and the wildfire guide's "All three are real" (the three ignition mechanisms, correct). `audit-links.mjs` chrome-drift check still passes.

### 2. Internal and personal content shipped in HTML comments

HTML comments are sent to the browser. Three of them carried content that the site's own rules keep off the page:

- `sixfold/site/services/aeration/index.html:11-13` — named a customer ("Kara") and **her job price ($1,100 for 3/4 acre)**. The site rule is no aeration price on the website; this was in the page source of the aeration page. Reworded to "one customer's job price … the figure is in the quote engine, not here".
- `sixfold/site/index.html:33-35` — the comment explaining why `streetAddress` is omitted from the schema **printed the street address** (17890 Sierra Way). Reworded to say the address is on the agreements, without the address.
- `sixfold/site/who-pays/index.html:184-189` — quoted the owner on not wanting to "get into what licenses we have or dont". Given the standing rule never to claim a licence, a public-source comment that reads as "we would rather not say" is a liability. Reworded to record the decision without the quote.

**Failure scenario:** anyone who hits view-source, a competitor, a curious customer, or a crawler that indexes comments (some do) sees a customer's name and price, the home address, and a remark about licences.
**Verification:** `grep -n -i -E 'kara|sierra|17890|licenses we' ` across the ten pages returns nothing. Pages still validate; auditor still passes.

Comments are 12–33% of every shipped page (7.5 KB of the 22.8 KB home page). See RECOMMENDED #1 for the structural fix — the remaining comments still name Matthew and Brandon, describe a password-manager incident, call a photo a PLACEHOLDER, and say "NOT deployed" on a live site.

### 3. `sitemap.xml` lastmod out of date

- `sixfold/site/sitemap.xml:28-68` — eight of nine entries said 2026-09-20 or 2026-09-21. The file's own header says `lastmod` is each page's last commit date from git. Git says 2026-09-25 for eight pages (the aeration-led reposition) and 2026-10-04 for `/contact/` (the `via` field).

**Failure scenario:** none visible; crawlers either ignore a `lastmod` that is wrong or, worse, trust it and skip re-crawling the repositioned pages.
**Fix:** dates set from `git log -1 --format=%ad -- <page>` for each entry. **Note:** when the edits above are committed, the dates for `index.html`, `services/*` and `who-pays/` move again — regenerate before the next bundle (recommendation #6 is to stop maintaining this by hand).
**Verification:** 9 `<loc>` entries, each with a date matching git at the time of writing.

## RECOMMENDED (ranked)

1. **Strip HTML comments at bundle time.** `sixfold/site/make-bundle.mjs:65-67` copies `.html` verbatim. Add a transform for `.html` files that removes `<!--[\s\S]*?-->` before writing to the stage folder (keep the source files as they are — the auditor relies on the `CHROME:*` markers in source, not in the bundle). The pages have no conditional comments and the one inline `<script>` is JSON-LD with no `-->` in it, so a plain regex is safe; verify by diffing a stripped page's text content against the original. Saves 3–7 KB per page and ends the whole class of leak fixed in #2 above. Why first: the three comments I reworded are the ones that broke a rule tonight; a dozen more are one paste away from doing the same.

2. **`www.sixfoldcolorado.com` serves the site without redirecting to the bare host.** Live check: `https://www.sixfoldcolorado.com/` → 200, same content. Canonical tags and the sitemap say bare, so search engines will cope, but it is two hosts for one site. `sixfold/site/.htaccess:50-61` already holds the redirect block, commented out. **Only the second half is needed** — HTTP→HTTPS is already done by SiteGround's nginx (`http://sixfoldcolorado.com/` → 301 to https, verified). Uncomment just the `www` rule and its `RewriteEngine On`, upload the one file, then request `https://www.sixfoldcolorado.com/services/` and expect a 301 to the bare host. The file has never been parsed by Apache; if the site goes blank, rename it.

3. **`<nav>` landmarks have no accessible names** (html-validate `a11y` preset, every page, header nav and footer nav). A screen-reader user hears "navigation" twice with no way to tell them apart. Add `aria-label="Main"` to the `<nav class="nav">` inside `CHROME:HEAD` and `aria-label="Footer"` to `<nav class="foot-nav">` inside `CHROME:FOOT` — **identically on all ten pages**, or the drift auditor fails. Related, same pass: the header and footer logo `<svg role="img" aria-label="Sixfold">` sits next to visible text "Sixfold Colorado", so the link reads "Sixfold Sixfold Colorado"; make those two SVGs `aria-hidden="true"` (the hero mark, which stands alone, should keep its label). And `sixfold/site/wildfire-guide/index.html:424` — the three `<th>` in the zone table's header row want `scope="col"`.

4. **The webp images are larger than the jpg fallbacks, on every photo.** `assets/img/*.webp` vs `.jpg`: beds 160 KB vs 152, trimming 232 vs 204, slash-line 407 vs 363, and so on. Every `<picture>` lists the webp `<source>` first, so every modern browser downloads the bigger file. `assets/img/build-photos.mjs:74-75` encodes webp at quality 72 and jpg at quality 76 with mozjpeg — mozjpeg is beating libwebp at these settings. Either drop the `<source type="image/webp">` lines (seven `<picture>` blocks across four pages, and `make-bundle` stops shipping ~1.6 MB of webp), or re-encode webp at a quality that actually comes in under the jpg (try 60–65 and look). Home page photo weight is ~1.17 MB as served; it would be ~1.07 MB with the jpgs alone, and well under 1 MB with a proper webp pass. The source photos are on the Desktop, so this needs Matthew's machine.

5. **The link auditor exits 1 on every run** because of `summit-de59ae83/quote.html` (two relative `./` links, "bonded", "$1"). That page is the door app's and out of my scope, but the consequence lands here: `audit-links.mjs` can no longer gate a commit, and a real failure on a site page would hide among the four known ones. Either the quote page gets `<!-- AUDIT-ALLOW: … -->` waivers from its owner, or `sixfold/site/audit-links.mjs` skips `summit-de59ae83/` the way it skips `_tabled/`. One of the two should happen before the next site edit.

6. **Generate `sitemap.xml` `lastmod` from git instead of maintaining it by hand.** It was wrong tonight and the README records it being wrong twice before. `make-bundle.mjs` already shells out (`execFileSync`); a `git log -1 --format=%as -- <page>` per entry at bundle time, written into the staged copy only, removes the chore. Until then, re-run the dates after committing tonight's edits (see FIXED #3).

7. **`api/secrets.example.php` and `api/smtp.php` are reachable on the live host** (`200`, empty body — PHP executes them and they output nothing). `make-bundle.mjs` now refuses to ship `secrets.example.php`, so it is a leftover from the 2026-09-28 upload. Neither leaks anything today, but the only thing standing between them and plain text is PHP running. Delete `public_html/api/secrets.example.php` from the host, and add to `sixfold/site/api/.htaccess` (same proven `<Files>` syntax as the existing `config.php` rule):
   ```apache
   <FilesMatch "^(smtp|secrets|secrets\.example|rounds-codes)\.php$">
     Require all denied
   </FilesMatch>
   ```
   These files are only ever `require`d from PHP, which bypasses `.htaccess`, so nothing breaks. Verify after upload: `/api/smtp.php` → 403, `/api/submit.php` (GET) → still 405.

8. **No-JS submit with a missing field lands on a bare text page.** `sixfold/site/contact/index.html:88` has `novalidate` on the form, so without JavaScript the browser skips its own required-field checks and `api/submit.php:181` answers 422 as `text/plain` ("Please include a phone number.") — a blank white page with no link back. Remove `novalidate`: the JS path still calls `checkValidity()`/`reportValidity()` itself (`site.js:65`), so behaviour with JS is unchanged, and without JS the browser blocks the empty submit in place.

9. **`ErrorDocument 404 /` serves the home page body with a 404 status.** `sixfold/site/.htaccess:36`. Verified live: `/no-such-page/` → 404 with the 22,863-byte home page. The status code is right, so search engines are fine, but a person who mistyped a URL gets the home page with the wrong URL in the bar and no "that page is not here". A tiny `/404.html` with the chrome and one line would be better. Low priority.

10. **Add HSTS once the `www` redirect is in** (`Header always set Strict-Transport-Security "max-age=31536000"` inside the existing `mod_headers` block). HTTPS is already forced at nginx; this just stops the first request going out plain.

11. **`robots.txt` disallows `/thank-you/`, which is also `noindex`.** A crawler that obeys the disallow never sees the `noindex`. Harmless here because nothing links to the page, but Google's guidance is to pick one — drop the `Disallow: /thank-you/` line and let the meta tag do the job.

12. **Copy, judgement calls — not changed:**
    - Home `<h1>` names three services ("Lawn aeration, landscaping and land clearing on Colorado's Front Range.") and leaves out fire mitigation while the line under it says "all four". README says this is positioning and not to be changed without Matthew. Flagging only.
    - The descriptor **"Lawn, Land & Fire"** (settled 2026-09-28 per memory) is on no page; the header and hero have carried no descriptor since 2026-09-24. `.brand span` and `.hero .lockup .desc` are still in `site.css` so it is a one-span change per page — but it is a brand call for Matthew/Brandon.
    - `/contact/`: "leave a message and we'll ring back the same day" is a service promise with no source behind it.
    - `/who-pays/:192`: "that part we can guarantee" (the paperwork). Not a germination or watering guarantee, so within the rules, but "guarantee" is a word to use once on purpose.
    - `/wildfire-guide/:289-291`: the `.fine` note "Labelled stops most, not 'stops': the source is explicit…" reads as an audit note left on the page. Correct content, internal register.
    - `assets/site.js:7-8` comment still says the default radio is fire mitigation; it is lawn. Comment only.
    - `contact/index.html:11-12` comment still says "a PHP mail() handler"; it is SMTP since 2026-09-28. Comment only.

## Form handler — what was checked and found sound

`sixfold/site/api/submit.php`, `smtp.php`, `config.php` (not `secrets.php`, which was not opened):

- **Method:** GET → 405 (verified live, `Method not allowed`, text/plain).
- **Input:** every field through one `$field()` helper — `mb_scrub` for invalid UTF-8, trim, per-field length cap. `need` and `via` are whitelisted against fixed maps.
- **Validation:** name, `FILTER_VALIDATE_EMAIL`, phone non-empty, message non-empty → 422 with a human sentence.
- **Spam/abuse:** honeypot (`_confirm_url`, readonly so password managers leave it alone) → silent success, logged with a `rejected` tag so a misfire is visible. Per-IP throttle 3/10 min and 12/day, counters in `api/.ratelimit/` named by sha256 of the IP, fails open. No CAPTCHA, by design.
- **Header injection:** `$hdr()` strips CR/LF/TAB from name, town and email before they reach Subject or Reply-To; name capped at 80 for the header. `smtp.php:185` strips CR/LF from every extra header again. Subject is RFC 2047 encoded (always, because of the em-dash). Reply-To quotes/escapes ASCII names and MIME-encodes non-ASCII ones. Body is base64, dot-stuffed.
- **Where submissions go:** `api/submissions.log` (JSON lines; 403 live) and, when `sixfold-data/leads/` exists above `public_html`, `leads.log` for the door app. Lead is written **before** the send. Log pruned at 180 days, unparseable lines kept.
- **Send:** authenticated SMTP to Gmail on 587 with STARTTLS (TLS 1.2/1.3 flags), result logged as `stage`/`error`. Customer always gets success.
- **Error handling:** `smtp.php` never throws and never prints; `quote.php` sets `display_errors=0`. `submit.php` does not set `display_errors` itself — on a host with it on, a PHP warning (say, the leads directory unwritable) would print into the JSON body and the JS would show the error message. SiteGround defaults it off. Worth one line (`@ini_set('display_errors','0')`) at the top of `submit.php` for parity with `quote.php`.
- **Minor, not a hole:** a Subject built from an 80-character name and 80-character town in 4-byte characters base64-encodes to ~930 bytes on one header line, near the 998 limit and over RFC 2047's 75-character encoded-word limit. Gmail accepts long encoded words; a stricter MTA might fold or reject. Capping `$safeName`/`$safeTown` at 40 would remove the edge.

## Live checks (read-only)

| Request | Result |
|---|---|
| All 10 pages, plain and `?cb=<random>` | 200, byte-identical to local and to `dist/sixfold-site-2026-10-05` |
| `site.css`, `site.js`, `robots.txt`, `sitemap.xml` | 200, identical to local |
| `http://` → | 301 to `https://` (nginx) |
| `https://www.` | 200, **no redirect** (rec. #2) |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` present — `.htaccess` is honoured. No HSTS |
| Asset caching | `Cache-Control: max-age=31536000` on images |
| `/README.md` `/LAUNCH.md` `/DEPLOY.md` `/PHOTOS.md` | 403 |
| `/api/config.php` `/api/submissions.log` `/api/.ratelimit/` `/api/` `/api/.htaccess` `/.htaccess` | 403 |
| `/audit-links.mjs` `/serve.mjs` `/make-bundle.mjs` `/assets/img/build-photos.mjs` | 403 |
| `/.git/HEAD` `/.git/config` `/data/` | 403 |
| `/_tabled/merch/` `/api/secrets.php` `/api/rounds-codes.php` `/sixfold-data/` `/sixfold-private/secrets.php` | 404 |
| `/api/secrets.example.php` `/api/smtp.php` | 200, empty body (rec. #7) |
| `/api/submit.php` GET | 405 |
| `/api/quote.php` | 401 "Sign in first" (door app's; behaves) |
| `/no-such-page/` | 404, home page body (rec. #9) |

## Tooling run

- `node sixfold/site/audit-links.mjs` — 11 pages, 180 links; **0 problems in scope**; 4 problems all in `summit-de59ae83/quote.html` (rec. #5).
- `html-validate --preset standard` on the 10 pages — **0 errors**. `--preset a11y` — 13 errors, all the two landmark names and three `<th scope>` (rec. #3).
- `audit-runtime.mjs` (headless Chrome at 390/768/1280/1600, 10 pages, 40 renders, run after the edits above against `serve.mjs`) — **0 failures, 0 warnings.** That covers composited text contrast, broken images, console errors, tap-target size, heading order and form semantics. Its only notes are informational (title/description lengths, `/thank-you/` is the one `noindex` page).

## NOT CHECKED

- **The form end to end.** Never submitted — it emails a real inbox and files a real lead. The handler was read and reasoned about, not executed; `LAUNCH.md` records it was exercised under `php -S` on 2026-09-21 and the live delivery was fixed 2026-09-28.
- **`api/secrets.php`, `api/rounds-codes.php`, anything in `sixfold-private/`** — not opened, by instruction.
- **`summit-de59ae83/`** — out of scope; only its effect on the shared auditor is noted.
- **`_tabled/merch/`** — parked, blocked by `serve.mjs` and `.htaccess`, not reviewed.
- **Real-device mobile rendering.** Layout was checked by the runtime auditor's headless Chrome at 390/768/1280/1600 and by reading the media queries; no phone was used. The README records no horizontal overflow at 320/390/768/1280 on 2026-09-18.
- **Email deliverability / DNS (SPF, DKIM, DMARC)** — not re-checked; `DEPLOY.md` records SPF as verified 2026-09-28.
- **Fact-checking the tax-credit and insurance figures on `/who-pays/` and the distances in `/wildfire-guide/`** — those carry their own audits (2026-08-25) and I did not re-derive them.
- **Google Business Profile / Search Console state.**
- **`api/quote.php`** — read for the `.htaccess`/storage interaction only; its logic belongs to the door app review.

## Changed files (working tree, uncommitted)

```
sixfold/site/index.html                            comment: street address removed
sixfold/site/services/aeration/index.html          comment: customer name + price removed
sixfold/site/who-pays/index.html                   comment: licensing quote removed
sixfold/site/services/index.html                   "of the three" -> "of the four"
sixfold/site/services/fire-mitigation/index.html   "All three services" -> "All four services"
sixfold/site/services/land-clearing/index.html     same
sixfold/site/services/landscaping/index.html       same
sixfold/site/sitemap.xml                           lastmod from git (8 entries)
```

No bundle was built. `dist/sixfold-site-2026-10-05` is untouched and now **differs from the working tree** in these eight files; the next `make-bundle.mjs` run picks them up.
