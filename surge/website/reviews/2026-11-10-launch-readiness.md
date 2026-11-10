# Surge website — launch-readiness review, 10 November 2026

Scope: the rebuilt site in `surge/website/build/` (bundle `deploy/dist/surge-site-2026-11-10.zip`, 72 files, 23 pages), as it stands on `staging.surgeftw.com`, checked against the job of replacing the WordPress site on `surgeftw.com`. The live WordPress site was read only; nothing on it was changed. No form was submitted, nothing was posted, DNS was not touched.

## Verdict: READY, after the three launch switches and Matthew's go

Everything technical that could be checked without taking the site live passes. Two real gaps were found and fixed today (both are in the bundle and on staging):

1. **None of the old WordPress URLs redirected.** The runbook claimed they were covered; they were not. Every indexed or linked address on the current live site (`/our-focus/`, `/generate-revenue/`, `/clients/`, `/personal-growth/`, `/career-growth/`, `/locations/…`, `/privacy-policy/`, `/terms-conditions/`, the three post slugs, archives, feeds and the Yoast sitemaps) would have become a 404 at launch. All now 301 to the page that does that job.
2. **`api/config.php` answered 200 over the web.** It prints nothing, so nothing leaked, but it is now 403 as the runbook always expected.

What remains before the swap is only what must wait for launch day: turn `noindex` off, remove `Disallow: /`, add `<lastmod>`, rebuild, and Matthew's go. One hop is unprovable until the site is live: a real form submission reaching `info@surgeftw.com` through SiteGround `mail()`.

---

## (a) Fixed and on staging

Commit **`8012dc14`** (branch `main`). Staging backup taken first: **`~/upload-backups/surge-staging-before-2026-11-10-launch-review.tgz`** (on the Surge SiteGround account, 101 entries). Upload: the fresh bundle, `unzip -o` at the staging root, all **72 files md5-identical** to the extracted bundle, dynamic cache flushed (`site-tools-client domain-all update id=2 flush_cache=1`, `msg=OK`).

| # | What | File | Verified |
|---|---|---|---|
| 1 | Redirect map for the WordPress site's URLs: `our-focus`, `generate-revenue` → `/what-we-do/`; `clients` → `/about/#sectors`; `personal-growth`, `career-growth` → `/careers/`; `locations/*`, `denver-co`, `asheville-nc`, `houston-tx` → `/contact/`; `privacy-policy` → `/privacy/`; `terms-conditions` → `/terms/`; `leadership-skills`, `entering-new-markets`, `scale-your-team` → `/blog/<slug>/`; `blog/page/N`, date archives, `category|tag|author`, `feed` → `/blog/`; Yoast + core sitemap files → `/sitemap.xml`; `wp-admin|wp-includes|wp-content|wp-json`, `wp-login.php`, `wp-cron.php`, `xmlrpc.php` → 410 Gone | `build/.htaccess` | Every one probed on staging from the server: 301 to the right target (`/wp-admin/` 403 and `/xmlrpc.php` reset by SiteGround's own rules, which is fine) |
| 2 | `<Files "config.php"> Require all denied` | `build/.htaccess` | Staging `/api/config.php` → 403; `/api/submit.php` still answers (405 on GET, as designed) |
| 3 | `toggle-noindex.mjs off` now **keeps** `noindex` on `404.html` and `/thank-you/` (it would have stripped them with the rest) | `deploy/toggle-noindex.mjs` | Regex tested on both path styles; not run in `off` mode (that is launch step 2) |
| 4 | Dev server carries the same redirect table, so `serve-surge.mjs` matches `.htaccess` again | `deploy/serve-surge.mjs` | All new entries 301 locally on port 8081 |
| 5 | Runbook rewritten for replacing WordPress: backup of live `public_html` + `wp db export` first, move WordPress out (not delete), `unzip` at the root, md5 check, cache flush, the full live-check list, Search Console note, staging stays `noindex`, and a rollback that takes minutes | `deploy/DEPLOY.md` | Read through; every command is one that worked today on staging or is read-only |

The source of the URL list: the live site's `sitemap_index.xml` / `page-sitemap.xml` / `post-sitemap.xml`, every internal link on its eight main pages, and `wp post list` (19 published pages and posts, including the three `/locations/` pages and `/clients/` which are not in its sitemap).

### Checked and clean (no change needed)

- **Staging = bundle.** Before today's change staging was already file-for-file the 4 Nov bundle; after it, 72/72 again. Only `.htaccess` changed in the bundle today.
- **Bundle checks:** `verify-bundle` 23 pages, tags balanced, no comments shipped; `audit-links` 0 broken links, assets or anchors; `seo-audit` 0 failures, 15 warnings (the same 15 as before: word counts on short pages). All 23 JSON-LD blocks parse (Organization on `/`, BreadcrumbList everywhere, BlogPosting on the three posts). Titles and descriptions unique. Canonicals all point at `https://surgeftw.com/…`, none at staging. `og:url`, `og:image` (`/assets/img/og.png`, 1200×630) absolute on the live domain. Sitemap 21 URLs, excludes `404.html` and `/thank-you/` correctly.
- **Pages on staging:** 200 on every page, 404 page returns a real 404 status, the five older redirects (`/how-it-works/`, `/training/`, `/careers/apply/`, `/sectors/*`, `/team/ryan-conger|jon-wallace/`) 301 correctly, `http://` → `https://`, `.md`/`.log`/dotfiles/`api/uploads/` all 403.
- **Headers on staging:** HSTS (one year), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `site.webmanifest` served as `application/manifest+json` (the 9 Nov fix). Static assets cached 30 days by header and cache-busted by content hash (`site.css?v=…`, `site.js?v=…`), so a launch-day change cannot be masked by the browser cache. SiteGround's dynamic cache (`X-Proxy-Cache-Info: DT:1`) is the one that needs flushing after any upload — in the runbook.
- **Phone, email, address:** 72 `tel:` links, every one `+17207195495`; 75 displayed numbers, every one `720-719-5495`; no other number anywhere in the bundle. Emails: `info@surgeftw.com` (62 places) and `website@surgeftw.com` (the form's From). JSON-LD address is Englewood, CO, no street. The old site's "Call Us" button was fixed on 8 Nov, so the one open launch step about the phone is closed; Matthew confirmed the number on 1 Nov.
- **Forms:** four forms (`book`, `client`, `job`, `feedback`) all post to `/api/submit.php`; handler present on staging and identical to the build; honeypot `_hp` on all four; server-side validation (name, valid email, message, the two consent boxes, timeline on client); JS path returns JSON and shows the inline success/error message, no-JS path 303 → `/thank-you/`; every accepted submission appended to `api/submissions.log` (403 from the web; three September test rows on staging); uploads go to `api/uploads/` with web access and PHP execution denied; mail to `info@surgeftw.com` from `website@surgeftw.com`. DNS: `info@` is a Google Workspace mailbox (MX aspmx.l.google.com), the SPF record includes SiteGround (`include:surgeftw.com.spf.auto.dnssmarthost.net`), DMARC is `p=none` — so a SiteGround `mail()` send should pass SPF. Not submitted; that test is Matthew's.
- **Mobile/tablet/desktop:** device audit, 23 pages × 9 devices (360, 390, 430, phone landscape, iPad Mini, iPad, Android tablet, iPad landscape, iPad Pro landscape, all touch): **0 failures, 5 warnings** (two lazy images not yet loaded in the probe, the hamburger panel's closed submenu links, and the footer's Terms / Privacy links at 21 px tall which pass on spacing). Hero video: phones transfer ~1.1 MB for the home page (the 559 KB mobile file only), tablets ~2.0 MB (the desktop file), as designed. Page weight elsewhere is small (site.css 46 KB, site.js 14 KB, hero still 70 KB WebP).
- **Accessibility basics:** every page has `lang`, one `h1`, a skip link, alt on every image, no duplicate ids, every real input labelled (the contact page's three radios are wrapped in `<label>`), viewport does not block zoom, no empty links. One note: the footer uses `h4` under `h2` on every page (a heading-level skip). Not a failure; left alone because it is markup in all 23 pages and harmless.
- **Certificates:** the SiteGround certificate is a wildcard (`*.surgeftw.com` + `surgeftw.com`, valid to 31 Jan 2027), so `www.surgeftw.com` will be served and then 301'd to the bare host by the `.htaccess`; nothing to install at launch.
- **RESTRICTED.md / client rules, text:** a sweep of every page's visible text, alt text and meta for client names (InstaBuzz, Veterans Association, Humane, SPCA, Houston, Gig), competitor names, MLM/pyramid, proprietary/unique-method claims, nationwide/footprint wording, dollar figures, "uncapped", "travel opportunities", "day in the life", "other states", "only in Colorado": **nothing found**. The only "proprietary" is the home page's line that says the opposite (anyone claiming a proprietary process is selling the idea). Service area is the settled phrase, "clients in multiple states", on `/what-we-do/`; Englewood appears only where the subject is the office, hiring or the footer address; `/about/` and `/contact/` titles do not pair the location with the service line.
- **RESTRICTED.md / client rules, images:** looked at all 12 site images and 8 headshots. No client logo, shirt, banner, lanyard or signage. The softball tees read "SURGE"; the office posters are GRIT / MIND OVER MATTER; the office wall slogan and the goals board are not in any frame. **Hero video:** pulled 20 stills across both files (`hero.mp4`, `hero-mobile.mp4`) plus two close crops. One rep holds a clear laminate that is unreadable at any size the video has; nothing else branded. This closes the "hero video unchecked for client gear" note from 5 Oct as far as stills can — I cannot watch it play.
- **Retired assets:** none of `surge/website/_retired-assets/` is in the bundle (client wall, booth photo, Jon/Ryan headshots all absent from the 72-file list).
- **Comments stripped:** the bundler removed comments from 24 HTML/CSS files; `verify-bundle` confirms none shipped (the build notes that once carried restricted material stop at the zip).

---

## (b) Found but left for Matthew

Nothing here blocks the launch. Wording is untouched per the standing rule (only the changes Matthew sends).

1. **The one unproven hop: `mail()` → `info@surgeftw.com`.** Only testable live. Runbook step 11 is his one feedback-form send after the swap; `submissions.log` holds the copy either way. If it lands in spam, DKIM for `surgeftw.com` can be switched on in Site Tools → Email → Authentication (I did not change any DNS or mail setting).
2. **Google Search Console.** The live homepage carries no `google-site-verification` meta and `public_html` has no `google*.html` file, so if Surge's property exists it is verified by DNS (survives the swap) or not set up at all. Worth a look before launch; the runbook says to submit the new sitemap right after.
3. **Staging stays a duplicate of the live site.** It keeps the `noindex` + `Disallow: /` bundle, which is the right posture. If he would rather empty it after launch, say so; I left it.
4. **`www` vs bare host.** The `.htaccess` sends `www.surgeftw.com` → `surgeftw.com`, as it has since September. The current WordPress site also answers on the bare host, so no change in canonical — flagging only because it is a one-line flip if he ever wants `www`.
5. **Wording items already open from earlier rounds, not re-raised here:** the Digital channel line, the `/team/` room wording, the Roofing card, the bios in their own words, the home KPI figures (his), og.png's headline. All recorded in the 4 Nov memory notes; none is a launch blocker and none was changed.
6. **Footer heading level** (`h4` under `h2`, every page). Cosmetic for screen-reader outlines. Fix is mechanical if wanted; not done because it touches all 23 pages for no visible change.
7. **The old site had a "redirect 404 to similar post" plugin.** That is how odd old URLs have been landing somewhere until now. The new `.htaccess` map covers every URL the old site actually publishes; anything beyond that will be an honest 404 with the site's 404 page.

---

## (c) Launch checklist

Server access: `bash ~/.ssh/sg.sh surge '<cmd>' < /dev/null`. Staging root `~/www/staging.surgeftw.com/public_html`; live root `~/www/surgeftw.com/public_html` (WordPress, 676 MB). The full commands are in `surge/website/build/deploy/DEPLOY.md`, runbook steps 1–14; this is the order.

**Before the go (nothing public changes):**

1. Phone — done (720-719-5495 confirmed 1 Nov; old Call Us fixed 8 Nov). No action.
2. In `build/`: `node deploy/toggle-noindex.mjs off` (21 pages cleared, 404 and thank-you kept) · delete `Disallow: /` and the STAGING POSTURE comment from `robots.txt` · add `<lastmod>` (launch day) to the 21 sitemap URLs · optional: `datePublished` on the three posts.
3. `node deploy/make-bundle.mjs` → extract → `verify-bundle`, `audit-links`, `seo-audit` (expect 0 failures and "0 of 23 pages carry noindex"). Commit. Do **not** upload this bundle to staging.
4. Have ready: the live backup commands (step 6), the domain id for the cache flush (`id=1` is `surgeftw.com`, `id=2` staging), a private browser window, a real phone.
5. **Matthew's go.**

**After the go, in this order (DEPLOY.md 5–14):**

6. Back up live on the server: `wp db export` to `~/upload-backups/surge-wp-db-before-launch-<stamp>.sql` and `tar czf ~/upload-backups/surge-wp-public_html-before-launch-<stamp>.tgz` of `public_html`; confirm both exist and the tar lists files.
7. Move WordPress out: `mv .htaccess * ~/retired-wp-<stamp>/` (leaves `.well-known`). The database stays in MySQL untouched.
8. `scp` the launch zip to `~/tmp/`, `unzip -o … -d ~/www/surgeftw.com/public_html`, delete the zip; `index.html` and `.htaccess` at the root, `api/uploads/` present.
9. md5 the 72 files against the extracted bundle — all equal.
10. `site-tools-client domain-all update id=1 flush_cache=1`.
11. Live checks (cache-busted): home, `/careers/`, a bio, `/contact/#feedback`, made-up URL → 404 status, `/how-it-works/` `/our-focus/` `/privacy-policy/` `/clients/` `/leadership-skills/` → 301, `/sitemap_index.xml` → `/sitemap.xml`, `http://` → `https://`, `www.` → bare, `/api/config.php` and `/api/submissions.log` → 403, `/wp-admin/` gone, hero video playing, HSTS/nosniff headers; then `node deploy/mobile-audit.mjs --devices --base=https://surgeftw.com` (0 failures) and `seo-audit.mjs` again.
12. Matthew submits the feedback form once; confirm it arrives in `info@surgeftw.com`.
13. Search Console: submit `https://surgeftw.com/sitemap.xml`, request indexing on `/`; check the property's verification method.
14. Leave staging on its `noindex` bundle. Next day: `php_errorlog`, `submissions.log`, Search Console coverage, Site Tools traffic stats. No analytics script (`/privacy/` promises none).

**Rollback (minutes, no DNS):** move the new files out, move `~/retired-wp-<stamp>/` back into `public_html`, flush cache. The database was never changed, so WordPress returns as it was; the step-6 tgz + sql are the second copy.

---

## What I could not check

- Mail delivery end to end (needs a real send — his).
- Whether a Search Console property for `surgeftw.com` exists and how it is verified (needs his Google account).
- The hero video in motion; I checked 20 stills and two crops, not playback.
- SiteGround's own edge rules (`/wp-admin/` 403, `xmlrpc.php` reset) are the host's, not ours; they will behave the same on the live domain.
- Anything Google already indexes beyond what the live site publishes (I mapped its sitemaps, menus and `wp post list`, 19 items plus archives, not a search-engine index).
