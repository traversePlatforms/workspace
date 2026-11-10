# Surge site — deploying to SiteGround

**Status 2026-11-10: launch-ready, waiting on Matthew's go.** Static site plus a
PHP form handler. `staging.surgeftw.com` is file-for-file the current bundle and
the office has approved it. `surgeftw.com` still serves the WordPress site —
uploading this bundle to its `public_html` **replaces it**, so that upload is the
publish step and needs Matthew's explicit go.

## Launch day — the runbook (revised 2026-11-10 after the launch-readiness review)

What ships: `dist/surge-site-<date>.zip`, 72 files, ~7.5 MB, 23 pages, **files at
the archive root** (no wrapper folder since 2026-11-04; the SiteGround "extracts
into a subfolder" trap is gone). Entry paths use `/`, so Info-ZIP `unzip` on the
server extracts it cleanly. Every page carries `noindex` and `robots.txt` says
`Disallow: /` until step 2 below — that is the staging posture, not a bug.

Server access: `bash ~/.ssh/sg.sh surge '<cmd>' < /dev/null`. Staging root is
`~/www/staging.surgeftw.com/public_html`; the live root is
`~/www/surgeftw.com/public_html` (WordPress, 676 MB, read-only until step 6).
Name staging vs live in every command.

### Before the go — nothing public changes

1. **Phone number — done.** Matthew confirmed 1 Nov that (720) 719-5495 is the
   number; the old site's "Call Us" button was fixed 8 Nov. The build has 72
   `tel:+17207195495` links and 75 displays of 720-719-5495, nothing else.
2. **Flip the three launch switches in `build/`** — these and nothing else:
   - `node deploy/toggle-noindex.mjs off` — removes
     `<meta name="robots" content="noindex">` from 21 pages and **keeps it on
     `404.html` and `thank-you/`** (neither belongs in Google).
   - `robots.txt` — delete the `Disallow: /` line and the STAGING POSTURE
     comment; keep `Sitemap: https://surgeftw.com/sitemap.xml`.
   - `sitemap.xml` — add `<lastmod>YYYY-MM-DD</lastmod>` (launch day) inside
     each of the 21 `<url>` blocks. Same commit, optional: `datePublished`
     (launch day) in the three `BlogPosting` blocks — each carries a comment
     saying where.
3. `node deploy/make-bundle.mjs` → extract → `verify-bundle` + `audit-links` on
   the extracted copy → `node deploy/seo-audit.mjs` (expect **0 failures and
   "0 of 23 pages carry noindex"**). Commit. Do **not** put this bundle on
   staging: staging is a full duplicate of the site and must stay `noindex`.
4. **Matthew's go.** Nothing below runs without it.

### The swap — after the go, in this order

5. **Back up live, on the server** (the site is not touched by this):
   ```
   S=$(date +%Y%m%d-%H%M)
   cd ~/www/surgeftw.com/public_html && wp db export ~/upload-backups/surge-wp-db-before-launch-$S.sql
   tar czf ~/upload-backups/surge-wp-public_html-before-launch-$S.tgz -C ~/www/surgeftw.com public_html
   ls -la ~/upload-backups/ | tail -3; tar tzf ~/upload-backups/surge-wp-public_html-before-launch-$S.tgz | wc -l
   ```
   The tree includes `wp-config.php` (database credentials) and the `.htaccess`;
   the tgz keeps both. The MySQL database itself is never dropped by anything
   below, so WordPress can come back from the files alone.
6. **Move WordPress out, do not delete it:**
   ```
   mkdir -p ~/retired-wp-$S && cd ~/www/surgeftw.com/public_html
   mv .htaccess * ~/retired-wp-$S/      # leaves .well-known in place (certificates)
   ls -la                                # only .well-known should remain
   ```
7. **Upload and extract at the root:** `scp` the zip to `~/tmp/`, then
   `unzip -o ~/tmp/surge-site-<date>.zip -d ~/www/surgeftw.com/public_html` and
   delete the zip. `ls -la public_html` must show `index.html` and `.htaccess`
   at the top, and `api/uploads/` (0755, owned by the account — PHP runs as the
   account on SiteGround, so it is writable).
8. **Verify byte-identical:** `find . -type f | sort | xargs md5sum` on the server
   against the same listing of the extracted bundle — 72 lines, all equal.
9. **Flush the cache:** `site-tools-client domain-all list -f id,name`, then
   `site-tools-client domain-all update id=<surgeftw.com id> flush_cache=1`
   (answers `msg=OK`). SiteGround's dynamic cache (`X-Proxy-Cache-Info: DT:1`)
   otherwise serves the WordPress homepage for a while. Cache-bust every URL
   you check (`?cb=123`).
10. **Live checks, private window:** home, `/careers/`, one bio page,
    `/contact/#feedback`, a made-up URL (404 page **with a 404 status**),
    `/how-it-works/`, `/our-focus/`, `/privacy-policy/`, `/clients/` and
    `/leadership-skills/` (all 301 to the right page), `/sitemap_index.xml` →
    `/sitemap.xml`, `http://` → `https://`, `www.` → bare, `/api/config.php`
    and `/api/submissions.log` → 403, `/wp-admin/` → 410, hero video playing
    (phone loads only `hero-mobile.mp4`), tap a form field on a real iPhone (no
    zoom). Response headers: HSTS, nosniff, X-Frame-Options, Referrer-Policy.
    Then `node deploy/mobile-audit.mjs --devices --base=https://surgeftw.com`
    (0 failures) and `node deploy/seo-audit.mjs` once more.
11. **Matthew submits the feedback form once.** The mail must land in
    `info@surgeftw.com` (a Google Workspace mailbox; the domain's SPF already
    includes SiteGround, DMARC is `p=none`). If it does not arrive: check spam,
    confirm `website@surgeftw.com` exists in Site Tools → Email, turn on DKIM
    in Site Tools → Email → Authentication, and as a last resort switch the
    handler to SMTP or Formspree (see "Forms" below). Every submission is also
    in `api/submissions.log`, so nothing is lost while that is sorted.
12. **Google Search Console:** submit `https://surgeftw.com/sitemap.xml`
    (the old Yoast sitemap URLs now 301 to it), then URL Inspection → Request
    indexing on `/`. Site Kit and Yoast go with WordPress; Search Console itself
    stays verified if it was verified by DNS — check the property's verification
    method before the swap, and if it was an HTML file or the Site Kit plugin,
    re-verify by DNS TXT afterwards.
13. **Staging afterwards:** leave it on the `noindex` + `Disallow: /` bundle
    (it is still useful for the next round) — never the launch bundle.
14. **Next day:** `public_html/php_errorlog` (should not exist), `api/submissions.log`,
    Search Console coverage, SiteGround Site Tools → Statistics → Traffic. **No
    analytics script** — decided 2026-09-16, `/privacy/` says so in writing.

### Roll back (minutes, no DNS)

The database was never touched, so the WordPress site comes back from its files:
```
cd ~/www/surgeftw.com/public_html && mkdir -p ~/new-site-pulled-$S && mv .htaccess * ~/new-site-pulled-$S/
mv ~/retired-wp-$S/.htaccess ~/retired-wp-$S/* ~/www/surgeftw.com/public_html/
site-tools-client domain-all update id=<id> flush_cache=1
```
If the retired folder is gone, `tar xzf` the step-5 tgz into `~/www/surgeftw.com/`
and `wp db import` the `.sql` only if the database was changed (it is not, by this
runbook). Older copies: `surge/website/wp-restore/` in the repo and
`~/upload-backups/surge-live-database-20250805.sql` on the server.

`info@surgeftw.com` is read by the recruitment team, who also handle client
acquisition — confirmed 2026-09-16, so both form types land with the people
who act on them.

---

## What's already done

- **Images optimised** — 18.3 MB → ~1.8 MB. Originals kept in
  `source-material/img-originals/`. The pipeline is `deploy/optimise-images.mjs`
  (rebuilt in-repo 2026-09-16; needs `npm install` at the repo root once —
  `sharp` + `heic-convert` are declared in `package.json`).
- **`<picture>` + WebP** for the two photos where WebP wins; `loading="lazy"` /
  `decoding="async"` on content images; `fetchpriority="high"` on the hero.
- **Favicons** — `favicon.svg` (the S mark) + PNG sizes + `apple-touch-icon` +
  `site.webmanifest`; linked from every page's `<head>`.
- **Forms wired** — `/contact/` (client + applicant) and `/book/` post to
  `api/submit.php`: honeypot, validation, emails `to` from `api/config.php`, and
  appends every submission to `api/submissions.log` as a backup. JS shows an
  inline result; with no JS the native POST still works and redirects to
  `/thank-you/`.
- **`404.html`**, **`sitemap.xml`**, **`robots.txt`**, **`.htaccess`**
  (HTTPS + www→non-www redirect, 404, blocks notes/sources, cache headers,
  security headers, gzip).
- Orphan `team.png` (1.2 MB) removed.

## What is NOT done (2026-11-10)

- Not launched; no DNS touched. Live `surgeftw.com` is still WordPress.
- `mail()` deliverability not proven end to end — only testable live (runbook step 11).
- `noindex` on every page and `Disallow: /` in `robots.txt` — deliberate until
  runbook step 2.
- No `<lastmod>` in the sitemap and no `datePublished` on the posts — runbook step 2.
- No analytics (and `/privacy/` says so).

---

## Build the upload bundle

```
node deploy/make-bundle.mjs
```

Writes `deploy/dist/surge-site-<date>.zip` (~6 MB, ~80 files). It excludes this
`deploy/` folder, all `*.md`, the form log, and the `_*` backups.

It also **strips every HTML and CSS comment** on the way in (added 2026-09-12).
The build notes in the pages are for whoever edits them next, not for the public,
and several carried material that should not ship. Keep writing notes in the
source — they stop at the zip. JS comments are left alone on purpose.

## Check the bundle before you upload it

Both take the path to an *extracted* copy of the zip, not the zip itself.

```
node deploy/verify-bundle.mjs <extracted-dir>    # tags balanced, no comments left
node deploy/audit-links.mjs   <extracted-dir>    # internal links, assets, #anchors
```

`verify-bundle` should say all tags balanced and no comments. `audit-links` should
say no broken internal links, assets or anchors, and then list the external URLs —
those are **not** fetched, so eyeball that list for anything that looks wrong.

Extract the zip somewhere temporary first, e.g.:

```
powershell -NoProfile -Command "Expand-Archive -Path deploy/dist/surge-site-<date>.zip -DestinationPath /tmp/check -Force"
```

## Upload it

**Site Tools → File Manager** (easiest): open `public_html`, delete anything
already there, **Upload** the zip, then **Extract** it in place. Delete the zip
afterwards.

Or **SFTP** the extracted contents into `public_html`. Or connect the
**Site Tools → Devs → Git** repo and push.

The site must sit at the **document root** of a domain or subdomain — every asset
path is root-absolute (`/assets/…`), so a subfolder install breaks.

## SSL

**Site Tools → Security → SSL** → install Let's Encrypt for the domain, then turn
on **HTTPS Enforce**. The `.htaccess` also forces HTTPS as a backstop.

---

## Forms

1. Edit **`api/config.php`**: set `to` (where enquiries go) and `from`.
2. `from` must be a **real mailbox/alias on the domain** or mail lands in spam.
   Create `website@surgeftw.com` in **Site Tools → Email → Accounts** (or as a
   forwarder).
3. Submit each form once on the live site and confirm the email arrives.
   Every submission is also in `api/submissions.log` regardless.
4. If deliverability is poor: point `api/submit.php` at SMTP, **or** drop the PHP
   handler and set each form's `action` to a Formspree/Basin endpoint — the
   fields already carry `_form` and a `_hp` honeypot, so either service works
   with no markup change.

`api/submissions.log` is blocked by `.htaccess`. Clear it periodically.

### File uploads (applicant resume + client document)

Two forms accept a file: the applicant form (a résumé — `resume`, PDF/Word,
`allowed_ext` + `max_upload`, 5 MB) and the client enquiry form (an optional
document — `document`, PDF/Office/image, `allowed_ext_doc` + `max_upload_doc`,
10 MB). Both go through the same `save_upload()` in `api/submit.php`: it validates
extension + MIME + size, renames the file to a random name, and moves it to
`api/uploads/`. `api/uploads/.htaccess` denies web access and disables PHP there;
retrieve files by **SFTP / File Manager**. The notification email carries the
stored filename, not an attachment.

- The `api/uploads/` directory must exist and be **writable by PHP** (0755, or
  0775 if PHP runs as a different user). It ships with its `.htaccess`; the
  handler also `mkdir`s it on first use.
- A missing, oversized, wrong-type, or unwritable upload **never blocks the
  submission** — it is flagged in the email and the rest still sends. The résumé
  is optional by design ("welcome but not required"); the client document always
  was.
- Confirm the host allows uploads: `file_uploads = On` and
  `upload_max_filesize` / `post_max_size` ≥ 10 MB in PHP config.
- No rate limiting beyond the honeypot. If a form gets abused, move it to a
  hosted service (Formspree etc., which also handles file uploads) per point 4.
- `make-bundle.mjs` skips `api/uploads/` contents (applicant/client PII) but
  keeps the folder and its `.htaccess`, so bundles never carry received files.

---

## DNS / email safety

`surgeftw.com` has live email (`m.sharpe@…`, `info@…`). **Do not move the
nameservers to SiteGround** unless you also recreate every MX / SPF / DKIM record
there — otherwise mail breaks.

Safer options:
- **Launch on a subdomain first** (e.g. `new.surgeftw.com`): add it in Site Tools,
  point just that host at SiteGround, review, then cut over.
- Or change only the web **A record** (and `www`) to SiteGround's IP
  (Site Tools → Site → Dashboard) and leave the rest of DNS alone.

---

## Before you flip it live (original checklist — superseded by the runbook at the top, kept for the detail)

1. **Content review** against `brand/notes/RESTRICTED.md` and the fact-check log
   in `index-draft-notes.md`. Confirm the Englewood address, phone, and the
   JSON-LD block on `index.html` are what should be public.
2. `node deploy/toggle-noindex.mjs off` — strips the `noindex` meta from every
   page. Then edit `robots.txt` and delete the `Disallow: /` line.
3. Decide **www vs non-www**; the `.htaccess` currently redirects www → non-www.
   Flip both `RewriteCond`/`RewriteRule` lines if you want the opposite.
4. Rebuild the bundle and re-upload, or edit in place via File Manager.
5. Submit `https://surgeftw.com/sitemap.xml` in Google Search Console.
6. **Do NOT add an analytics snippet without deciding this first.** `/privacy/`
   says, in published copy: *"We do not run analytics or advertising trackers on
   this site."* Adding one contradicts a promise the site makes. Either change the
   policy first, or stay with Search Console — it is first-party, needs no tracker
   on the page, and does not touch that sentence.
   *(The old wording here offered the snippet with no mention of the policy.)*

### SEO steps that belong at launch, not before

7. `node deploy/seo-audit.mjs` — should be 0 failures. Run it again after the
   noindex flip, because the audit reports the noindex count and that is the
   number to check.
8. **Add `datePublished` to the six `BlogPosting` blocks.** Each one carries a
   comment saying so. It was left out deliberately: nothing has been published,
   and a publication date that is not true is worse than a missing one.
9. **Add `<lastmod>` to `sitemap.xml`** — launch day for every URL, then the real
   date on each later edit. It is how a crawler decides what to re-crawl.
10. Re-check the two pages where the location rule bites: `/about/` and
    `/contact/` must not pair the service line with Englewood in the title or
    description. `/careers/` may name it — hiring is the subject. See
    `brand-voice-company.md` §5.
11. Test: every nav link, both forms, a 404, HTTPS redirect, mobile.
   For mobile, run the phone auditor against the LIVE URL before calling it done,
   not just the local one: `node deploy/mobile-audit.mjs --devices --base=https://surgeftw.com`
   (`--devices` is nine real viewports — three phones, a phone on its side, iPad Mini,
   iPad, an Android tablet, iPad landscape, iPad Pro landscape — in one run; the
   hamburger hands over to the desktop nav at 940px, INSIDE the iPad band, so both
   navs get exercised on touch).
   It checks the things a desktop browser cannot show you — iOS input zoom, tap
   targets, text under 12px, what a phone actually downloads — and exits 1 on any
   failure. Then open a form on a real iPhone and tap a field: the page must NOT zoom.

---

## Local preview

```
node surge/website/build/deploy/serve-surge.mjs             # -> http://localhost:8080
node surge/website/build/deploy/serve-surge.mjs --port 8081  # if 8080 is taken
```

Static serve + clean URLs + the retired-URL 301s + a mock `/api/submit.php` that
logs to `surge-submissions.log` in the OS temp dir. It finds the site root
relative to itself, so it runs from any working directory.

Lived in the session scratchpad until 2026-09-14 and had to be recreated most
sessions; it's tracked here now. Ctrl+C to stop — and check nothing is already
listening on 8080, since a stale copy answers every URL with a 404.
