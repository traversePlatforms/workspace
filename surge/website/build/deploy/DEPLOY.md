# Surge site — deploying to SiteGround

**Status: not deployed.** This is a static site plus a PHP form handler. It runs
locally and builds into a drag-and-drop bundle. Actually putting it on a public
domain is the one step still to do, and it needs your call (see "Before you flip
it live").

---

## What's already done

- **Images optimised** — 18.3 MB → ~1.8 MB. Originals kept in
  `drafts/_surge-site-img-originals/`. Re-run `scratchpad/imgproc/build.mjs` if
  originals change (portable node v22 + `sharp`).
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

- Not uploaded anywhere; no DNS touched.
- `mail()` deliverability not proven (see Forms below).
- Every page still carries `<meta name="robots" content="noindex">` and
  `robots.txt` still has `Disallow: /` — deliberate for staging.
- No analytics.
- Content not re-checked against `brand/notes/RESTRICTED.md` for a public launch.

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

## Before you flip it live (checklist)

1. **Content review** against `brand/notes/RESTRICTED.md` and the fact-check log
   in `index-draft-notes.md`. Confirm the Englewood address, phone, and the
   JSON-LD block on `index.html` are what should be public.
2. `node deploy/toggle-noindex.mjs off` — strips the `noindex` meta from every
   page. Then edit `robots.txt` and delete the `Disallow: /` line.
3. Decide **www vs non-www**; the `.htaccess` currently redirects www → non-www.
   Flip both `RewriteCond`/`RewriteRule` lines if you want the opposite.
4. Rebuild the bundle and re-upload, or edit in place via File Manager.
5. Submit `https://surgeftw.com/sitemap.xml` in Google Search Console.
6. Add an analytics snippet to the page `<head>` if wanted (one line in
   `scratchpad/site-tasks.mjs`'s `HEAD_LINKS` re-runs it across all pages).
7. Test: every nav link, both forms, a 404, HTTPS redirect, mobile.

---

## Local preview

```
node scratchpad/serve-surge.mjs      # -> http://localhost:8080
```

Static serve + clean URLs + a mock `/api/submit.php` that logs to
`scratchpad/surge-submissions.log`. If the scratchpad copy is gone, it's a small
plain-node file — recreate from `surge-site-rebuild` memory or ask.
