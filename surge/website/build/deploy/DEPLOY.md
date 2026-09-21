# Surge site — deploying to SiteGround

**Status 2026-09-16: build is launch-ready; waiting on photos + video.** Static
site plus a PHP form handler. `surgeftw.com` currently serves the Aug-2025
WordPress restore as a placeholder — uploading this bundle **replaces it**, so
the upload is the publish step and needs Matthew's explicit go.

## Launch day — the runbook (dry-run 2026-09-16, everything below passed)

Dry-run state: `dist/surge-site-2026-09-16.zip`, 83 files, 6,069 KB. 28 pages,
tags balanced, no comments shipped, no broken links / assets / anchors, no
placeholders. `noindex` on 28/28, `robots.txt` `Disallow: /`, sitemap 26 URLs,
www → non-www, JSON-LD carries phone + `info@surgeftw.com` + Englewood CO (no
street address). **No analytics — and `/privacy/` states that in writing.**

Content gates are closed: two review rounds (09-14), RESTRICTED.md check, form
test on all four paths (09-16, local). Not gated on Lance's figures or Donny's
logo — both slot in after launch if late.

**When the photos are in:**

1. Drop the shoot in a dated folder under `brand/photos/`, then
   `node deploy/optimise-images.mjs <that folder>` — HEIC or JPEG in,
   1440×1080 JPEG (+ WebP where it wins) out in `assets/img/`, metadata
   stripped. It warns on portrait or undersized frames; the shot list says
   reshoot those. `--name` renames a single file, `--slot hero` for the hero
   background. Then reference the files and check every `<picture>` slot at
   1280 and at 420.
2. `node deploy/make-bundle.mjs` → extract → `verify-bundle` + `audit-links`
   **on the extracted copy** (against the repo both false-positive on comments).
3. **⚑ CONFIRM THE PHONE NUMBER BEFORE THE GO.** Matthew said 2026-09-20 he
   would verify it and asked to be reminded here. The build is internally
   consistent — **92 `tel:` links, every one `+17207195495`, and 96 displayed
   as 720-719-5495, with no trace of any other number.** So this is not a
   find-the-bug check; it is one question: **is 720-719-5495 the number that
   should ring in 96 places, and does it reach someone?** Dial it.

   Why it is a step at all: the WordPress site this replaces has the hero
   **"Call Us" button dialling `tel:7193157742`** while displaying the 720
   number beside it — found 2026-09-20. That is the current live state, so the
   number on the domain today cannot be used to confirm anything.

4. Matthew's go. Then, in this order:
5. `node deploy/toggle-noindex.mjs off`; delete the `Disallow: /` line in
   `robots.txt`; rebuild (step 2 again — the bundle must be the one without
   noindex).
6. **Rehearse on `staging.surgeftw.com` first.** It already exists on SiteGround
   (the 09-08 form test ran there) and `website@surgeftw.com` was created then.
   Upload the launch bundle to the staging subdomain's root and run every check
   in step 8 there — `mail()`, the `.htaccess` redirects, HTTPS — while the
   placeholder on the main domain is untouched. Confirm someone reads
   `info@surgeftw.com` (the `to` in `api/config.php`).
7. **Site Tools → File Manager → `public_html`**: delete the WordPress files,
   upload the zip, Extract, delete the zip. `api/uploads/` must be writable.
8. Live checks, in a private window (on staging first, then again on the real
   domain): home, one bio page, `/careers/`, `/contact/#feedback`, a made-up URL
   (404 page), `/how-it-works/` and `/sectors/` (301s), `http://` → `https://`,
   `www.` → bare, phone width. **Submit the feedback form once** and confirm
   the email lands in `info@` — the one hop the local test could not prove.
9. Google Search Console: submit `https://surgeftw.com/sitemap.xml`. Google
   review link and the WordPress-era URLs are covered by the `.htaccess`
   redirect map (item 7 on the punch list).
   **SEO, at this point and not before** (`node deploy/seo-audit.mjs`, 0 failures
   expected — re-run it after step 5, since it reports the noindex count):
   - **Add `datePublished` to the six `BlogPosting` blocks.** Each carries a
     comment saying so. Left out deliberately — nothing has been published, and a
     publication date that is not true is worse than a missing one.
   - **Add `<lastmod>` to `sitemap.xml`**: launch day on every URL, the real date
     on each edit after. It is how a crawler decides what to re-crawl.
10. **Analytics — decided 2026-09-16: no tracking script at launch.** Measure
   with SiteGround's built-in traffic stats (Site Tools → Statistics →
   Traffic — server-side, no cookies, and the same kind of numbers as the
   July-2026 baseline), Search Console (step 9), and the form log. `/privacy/`
   stays as written. Revisit only with a specific question the three cannot
   answer; then a cookieless tool (Plausible / Fathom) and a one-sentence
   privacy edit. Not GA4.

`info@surgeftw.com` is read by the recruitment team, who also handle client
acquisition — confirmed 2026-09-16, so both form types land with the people
who act on them.

Roll back: re-upload the WordPress backup (`drafts/surge-wp-restore/`) — or,
faster, put `noindex` back with `toggle-noindex.mjs on` and re-upload.

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

## What is NOT done

- Not uploaded; no DNS touched. (The WordPress placeholder on the domain is a
  separate, earlier upload.)
- `mail()` deliverability not proven — only testable live (runbook step 8).
- `noindex` on every page and `Disallow: /` in `robots.txt` — deliberate until
  runbook step 5.
- No analytics (and `/privacy/` says so).
- Photos + hero video — the only open content item.
- ~~Content not re-checked against RESTRICTED.md~~ — done, two review rounds
  by 2026-09-14; record in `index-draft-notes.md`.

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
