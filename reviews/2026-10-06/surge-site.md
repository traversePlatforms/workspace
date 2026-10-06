# Surge website — overnight review, 2026-10-06

Scope: `surge/website/build/` (the static rebuild) and read-only checks against
`https://staging.surgeftw.com`. The live `surgeftw.com` (WordPress) was not touched or reviewed.
Nothing was uploaded, no form was submitted, nothing was committed.

**Headline:** the build is in good shape. One real bug fixed (an ARIA error on `/book/`). No
RESTRICTED violation found: no client named anywhere in the shipped files, no client logo file in
the bundle, no client-branded gear in any photo the site actually uses. The rest is a ranked list of
judgement calls for Matthew, the biggest being leftovers from the candidate-first rewrite on the
team bio pages, the old social card, and the unsourced KPI figures on the home page.

---

## Summary — what was checked, and the results

| Check | Result |
|---|---|
| `node deploy/seo-audit.mjs` | **0 failures, 15 warnings** (thin bio pages, short `/thank-you/` title + description, footer `h4` under `h2`). Notes: no `<lastmod>`, `robots.txt` still `Disallow: /`, `noindex` on 26/26 — all expected before launch. |
| `node deploy/make-bundle.mjs` | 77 files, 7,590 KB. The clock had passed midnight UTC, so it wrote **`deploy/dist/surge-site-2026-10-06.zip`**; the 10-05 zip was not touched (sha256 `7d7b63d7…2509a4` before and after). A build from the unmodified tree was byte-identical in content to the 10-05 zip, i.e. what is on staging. |
| `node deploy/verify-bundle.mjs` (extracted zip) | 26 shipped pages: all tags balanced, no comments left. |
| `node deploy/audit-links.mjs` (extracted zip) | No broken internal links, assets or anchors. 13 external URLs (fonts + social profiles), not fetched. |
| `html-validate` 8.29 (standard preset) on the extracted zip | **1 error** — fixed (see FIXED). Clean after the fix. |
| JSON-LD | 32 blocks, all parse. `ProfessionalService` on `/`, `BreadcrumbList` everywhere else. |
| Structural scan (own script) | No duplicate `id`s, no `<img>` without `alt`, no `href="#"`, exactly one `h1` per page, every `<label for>` resolves. |
| `node deploy/mobile-audit.mjs --devices` (9 viewports × 26 pages) | **0 failures, 7 warnings across 234 renders.** No input zoom, no overflow, no text under 12 px. Warnings: footer Privacy/Terms links 21 px tall (pass on spacing), `/book/` consent checkbox 13×13 on tablets (pass on spacing), two lazy images not loaded on a phone-landscape scroll (expected), closed submenu links with no box (expected). Page weight: ~1.1 MB on phones, ~2.0 MB on tablets (the desktop hero video). |
| Staging vs bundle | **All 33 text files on staging byte-identical to the 10-05 zip**, fetched plain and again cache-busted (`?v=…`). Image/video sizes match. |
| Staging behaviour | Pages 200; `/how-it-works/`, `/training/`, `/careers/apply`, `/sectors/`, `/team/ryan-conger/`, `/team/jon-wallace/` all 301 to the right targets; `http://` → `https://` 301; made-up URL serves the 404 page; `.htaccess`, `api/submissions.log`, `api/uploads/`, `*.md`, directory listings all 403; `GET /api/submit.php` 405; `_preview-hero-b.html` and `blog/_template/` absent (underscore rule). Security headers present (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy); Brotli on; CSS cached one year. `www.staging.surgeftw.com` has no DNS, so the www→bare rule cannot be tested on staging — launch-day check (DEPLOY.md step 8). |
| RESTRICTED grep (every roster name, InstaBuzz, Houston, Gig, "Family in Need", Wallace, Conger) | **Zero hits** in any shipped HTML/CSS/JS/PHP/XML/TXT. |
| Images actually used (viewed one by one: hero-bg, morning-block, training-standing, training-table, training-cohort-notes, trainer-whiteboard, team-corridor, office-floor-b, team-softball, og.png) | No client logos, shirts, banners or kiosks. Whiteboard writing is teaching content and illegible at shipped size. **Softball photo: twelve adults, no children.** One person wears a black non-Surge tee with partial lettering ("…ERING MOMS") — not a client mark as far as I can tell, noting it because the rule is "no branded gear". |
| `api/submit.php` + `api/config.php` + both `.htaccess` | No injection path found: CR/LF stripped from name/email before the `Reply-To` header, email passes `FILTER_VALIDATE_EMAIL`, subject built from a fixed list, uploads renamed to random names with an allow-listed extension, MIME-checked, stored in a `Require all denied` folder with the PHP engine off, never attached to the email. Honeypot and consent gates work as documented. Hardening suggestions under RECOMMENDED. |

---

## FIXED

### 1. `/book/` calendar grid: `aria-label` on a plain `<div>`

- **File:** `surge/website/build/book/index.html:138`
- **Bug:** `<div class="cal__grid" data-cal-grid aria-label="Choose a date">`. ARIA prohibits `aria-label` on an element with no role (generic), and `html-validate` reports it as an error (`aria-label-misuse`).
- **Failure scenario:** a screen-reader user tabbing into the date picker hears unlabelled day buttons ("1, button… 2, button…") with no group name; browsers drop the label on a generic element.
- **Fix:** added `role="group"` so the label is announced as the group's name. One attribute; the CSS and JS select by class and `data-cal-grid`, so nothing else changes.
- **Verified:** `html-validate` now clean across all 26 pages; `verify-bundle` and `audit-links` still pass on the rebuilt zip; the rebuilt zip differs from the 10-05 bundle in `book/index.html` only.

That is the only change to the site. No copy, no design, no other file.

---

## RECOMMENDED — ranked

1. **Photos of departed staff still ship and are publicly reachable.**
   `assets/img/people/jon-wallace.jpg` (113 KB) and `assets/img/people/ryan-conger.webp` are in the bundle and answer **200 on staging** at their old URLs. Their pages redirect to `/team/`, but the images do not, and the URLs are guessable from the pattern. Delete the two files before launch. While there: `office-floor-a.jpg`, `office-floor-wide.jpg`, `office-floor-wide.webp` and `surge-wordmark.svg` are also unreferenced (about 935 KB of dead weight in every upload). Not done because deleting files is a judgement call and the wordmark may be wanted later.

2. **Team bio pages still speak to clients** — leftover from the candidate-first rewrite.
   All eight `team/<name>/index.html` close on: *"The people who would run your account all work out of the same office. Have a look at who else is here, or tell us what you need sold."* with a **Book a consultation** button (e.g. `team/brandon-long/index.html` ~line 150). `/team/` itself now closes candidate-first ("Work alongside them. Apply / See the roles"). The `/team/` meta description (`team/index.html:7`) is also client-facing: *"the trainers, managers and coordinators your account would actually deal with."* **Suggestion only:** mirror the `/team/` closer on the bio pages (Apply / See the full team) and reword the description for a candidate reader.

3. **`/about/` "How we work" uses the two wordings `brand-voice-company.md` §5 rejected.**
   `about/index.html:137-140`: *"One office, campaigns in several states."* / *"Every campaign is run from the Englewood office, including the ones for companies in other states."* The spec's table rejects "Every campaign runs out of Englewood…" (leads with the limitation — Matthew: "it scares off out of state companies") and "other states" (Colorado as the reference point). The settled phrase is **"clients in multiple states"**, which `/what-we-do/` FAQ uses correctly. If this wording came from the office review, record it as a deliberate override; otherwise reword. Report-only.

4. **The social card is still the old client-first one.**
   `assets/img/og.png` reads **"WE HANDLE YOUR ENTIRE SALES TEAM."** under "Outsourced sales & marketing", and it is the `og:image` on all 26 pages (64 references); `og:image:alt` is "Surge — outsourced sales and marketing" everywhere. The home page's own `<title>`/`og:title` now say "Sales Careers in Englewood, Colorado". A shared link to the home page will show a card contradicting the page. Report-only as instructed; a new 1200×630 card is a design job.

5. **Home-page KPI figures are still unsourced.**
   `index.html:197-222`: 106,000+ / 37,600+ / 8,900+ under "2026 campaigns to date". `index-draft-notes.md` (fact-check log, ~line 1843) still records them as *"Unresolved — carried from prior build… no pullable internal source"*, and the 1-in-3 / 1-in-4 ratios as arithmetic on those. The on-page scope sentence is good, but `brand-voice-company.md` §2 needs a current, pullable source and a period that matches — and "2026 … to date" is a period claim. Before launch: get the source on record, confirm the period, or take the band out. Report-only.

6. **Form handler hardening (not holes).**
   - `api/submit.php:199-200`: `Reply-To: <name> <email>` uses the raw display name. CR/LF are stripped so no header injection, but `<`, `>`, `"` or a comma in the name make a malformed/ambiguous Reply-To. Simplest: `'Reply-To: ' . $email`, or strip those characters and quote the name.
   - `api/config.php` is directly requestable (200, empty body — PHP runs the `return`). Harmless today; one `.htaccess` rule closes it: `<Files "config.php">Require all denied</Files>`.
   - No rate limiting beyond the honeypot — already documented in DEPLOY.md; a form flood is the likely first abuse. Keep the Formspree fallback in mind.

7. **`.htaccess`: no HSTS.** After launch, once HTTPS is confirmed on the bare domain, add `Header always set Strict-Transport-Security "max-age=31536000"` (no `includeSubDomains` while staging and any mail-related subdomains exist). No CSP either; with Google Fonts and inline scripts on `/book/` and `/team/` that is real work and optional.

8. **`/about/` description names Englewood** (`about/index.html:7` ends "… Englewood, Colorado."). DEPLOY.md step 10 says `/about/` and `/contact/` must not pair the service line with Englewood in title or description. It is appended rather than paired, so borderline — flag for the pre-launch pass. Home `<title>` pairing "Sales Careers" with Englewood is allowed (hiring is the subject).

9. **Two content photos ship without WebP:** `team-softball.jpg` (376 KB, the heaviest image on the site) and `office-floor-b.jpg` (272 KB). Every other content photo has a `.webp` sibling. `node deploy/optimise-images.mjs` would do it. Tablet page weight (~2 MB) is the full hero video, by design — screens over 720 px wide get the desktop file.

10. **`/book/` label not tied to the picker.** `book/index.html:131` `<label>Pick a date and time</label>` has no `for` and wraps no control. Give it an `id` and put `aria-labelledby` on the new `role="group"` (or on the `.booking` wrapper). Related: the consent checkbox is 13×13 on tablets (mobile audit warning; passes on spacing).

11. **SEO-audit warnings worth a minute at launch:** `/thank-you/` title (14 chars) and description (50 chars); footer column headings are `h4` directly under `h2` on every page (make them `h3`, or `<p class="fcol__head">` — they are not document headings); `<lastmod>` in the sitemap and `datePublished` on the six blog posts are launch-day items already in DEPLOY.md.

12. **Duplicate URL forms answer 200:** `/index.html`, `/about/index.html`. Canonical tags point at the slash form, so search engines are fine; a `RewriteRule` to strip `index.html` is optional tidiness.

13. **Mobile nav panel is 15 links tall** (7 top-level + 8 subnav; the 8 have no box until their submenu is opened). Works, and the audit only warns, but on a 390 px phone the open panel is 400 px. Design call.

---

## NOT CHECKED

- The live `surgeftw.com` WordPress site — out of scope.
- Any form end-to-end: no form was submitted on staging or locally (they send real email). `mail()` deliverability remains unproven — DEPLOY.md step 8.
- The 13 external URLs (social profiles, Google Fonts) were not fetched.
- Real devices. The mobile audit is Chrome emulation; iOS Safari input-zoom and autoplay were not tested on hardware.
- The hero videos (`hero.mp4`, `hero.webm`, `hero-mobile.mp4`) — I cannot watch video. The build notes say they were cut from the office walkthrough with the "AVERAGE / LEGENDARY" wall cropped out; not independently verified.
- `hero-bg.jpg` has a whiteboard grid at the far left; illegible at shipped size and behind the darken/blur, not inspected at source resolution.
- The eight headshots in `assets/img/people/` (small cropped portraits) were not opened individually.
- `assets/site.css` (67 KB) was not read line by line; relied on the stripped copy balancing (545/545 braces), the mobile audit and staging rendering identically.
- The six blog post bodies were not re-read in full — titles, descriptions and the client-name grep cover them; they had their own pass in September.
- WAVE/axe-style contrast audit beyond what `mobile-audit.mjs` computes.

---

## Changed files

- `surge/website/build/book/index.html` — one attribute added at line 138 (`role="group"`). Left uncommitted in the working tree.
- `surge/website/build/deploy/dist/surge-site-2026-10-06.zip` — **new** check bundle built from the working tree with the fix (77 files, 7,590 KB; gitignored). Differs from `surge-site-2026-10-05.zip` only in `book/index.html`. The 10-05 zip is untouched (sha256 `7d7b63d7f563394cecdc29d68885ae4c6406eff8fc627eccdc3ac5320a2509a4`). Delete the 10-06 zip if it is confusing; nothing depends on it.
- This report: `reviews/2026-10-06/surge-site.md`.

Not mine: `git status` also shows modified files under `door-app/` and `reviews/2026-10-06/door-app.md` from the other overnight reviewer.

The local dev server I started on port 8080 for the mobile audit was stopped afterwards.
