# Sixfold Colorado — putting the site up on SiteGround

Written 2026-09-21, when Matthew confirmed **SixfoldColorado.com is already on the
SiteGround account that carries the Surge site.** That was the blocker; it is gone.

**I have not uploaded anything and will not.** Everything below is yours to run —
the standing rule is that nothing goes in front of an audience without your
per-request go-ahead, and putting a site live is exactly that.

`LAUNCH.md` is the *why* for each item. This is the *order*.

---

## Done already — do not redo these

- **canonical, `og:url`, `og:image`** on all nine pages. Was `LAUNCH.md` §1.
- **JSON-LD `@id`, `url`, `image`.** Was §6.
- **`robots.txt` and `sitemap.xml`** — eight URLs, `/thank-you/` correctly absent.
- **The root `.htaccess`** — written, never parsed. See step 4.
- **The form** — rate limited (3/10min, 12/day) and the log prunes at 180 days.

Both auditors are clean: `audit-links.mjs` all clear, `audit-runtime.mjs`
**36 renders, 0 failures, 0 warnings.**

---

## ⚑ Step 0 — the one that can break the Surge site

**Check where SixfoldColorado.com's document root points, before you upload
anything.**

Site Tools → Domain → check whether Sixfold is a **separate site** with its own
document root, or an **addon/parked domain** pointing at the Surge `public_html`.

**If it points at Surge's `public_html`, stop.** Uploading there overwrites the
live Surge site. Sixfold needs its own root — typically
`~/www/sixfoldcolorado.com/public_html`.

This is the only step on this page that can damage something that already works.

## Step 1 — a staging pass first, if you want one

Same pattern as the Surge rebuild. If you stage it:

- **Add `<meta name="robots" content="noindex">` to every page**, and write
  yourself a note to take it off. `robots.txt` **does not** do this job — a
  `Disallow` asks a crawler not to fetch, and a disallowed URL can still be indexed
  from a link elsewhere.
- Staging on SiteGround is indexable by default. This is the step people forget in
  both directions: adding it, and removing it.

If you go straight to live, skip this.

## Step 2 — upload only what should be public

**Do not upload these**, and the root `.htaccess` is the second line of defence,
not the first:

```
README.md          build notes and internal reasoning
LAUNCH.md          the launch reasoning
DEPLOY.md          this file
PHOTOS.md          the Kara consent decision, in writing
audit-links.mjs    the copy rules — i.e. everything we decided not to say
audit-runtime.mjs  same, plus how the site is tested
serve.mjs
assets/img/build-photos.mjs    absolute Desktop paths
_tabled/           the whole folder — the merch board
```

**Upload everything else**, including the dotfiles — `.htaccess` and
`api/.htaccess` are both load-bearing, and file managers hide dotfiles by default.
Check they arrived.

**⚑ SiteGround nests a subfolder when it extracts a zip.** If you upload
`site.zip` and extract in place you can end up with `public_html/site/index.html`
instead of `public_html/index.html`. Check the root after extracting, and move the
contents up if it nested.

Also skip `assets/img/limbing.*` and `assets/img/stand.*` — about 820 KB, held in
reserve and referenced by no page.

## Step 3 — the mailbox, before you test the form

**Create `website@SixfoldColorado.com` on the host.** `api/config.php` sends from
it, and **mail claiming to be from the domain but sent from elsewhere gets filed as
forged.** Set **SPF and DKIM** at the same time — SiteGround does both from Site
Tools → Email → Authentication.

The destination, `Contact@SixfoldColorado.com`, already exists.

## Step 4 — permissions

- `api/` must be **writable** so `submissions.log` and `.ratelimit/` can be
  created.
- **⚑ If `.ratelimit/` cannot be written, the throttle silently does nothing.** It
  fails open by design, so a real enquiry still gets through — but nothing tells
  you the limiter is off. Confirm the directory appears after your first test post.

## Step 5 — SSL, then the redirects

1. Site Tools → Security → SSL → issue **Let's Encrypt** for the domain **and**
   `www`.
2. Wait for it to be active. Only then:
3. Open `.htaccess` and **uncomment the HTTPS and canonical-host block** at the
   bottom.

**⚑ The canonical tags and `sitemap.xml` both say the BARE domain**, no `www`. The
redirect block is written to match. If you change one, change all three.

**If the site goes blank after editing `.htaccess`, rename the file.** A syntax
error there returns 500 for the whole site, not just the file it names — and it has
never been parsed, because there is no Apache on the build machine.

## Step 6 — verify, and beat the cache

**⚑ SiteGround serves a stale proxy cache after an upload.** The Surge deploy hit
this. Purge it (Site Tools → Speed → Caching → Flush) and add `?v=1` when you
check, or you will be looking at the old file and believing it.

Then, on the live domain:

| Request | Expect |
|---|---|
| `/README.md` | **403 or 404** — if it shows text, `.htaccess` is not being honoured |
| `/api/config.php` | **403 or 404** |
| `/api/submissions.log` | **403 or 404** |
| `/_tabled/merch/` | **404** |
| `/robots.txt` | plain text, and it names the sitemap |
| `/sitemap.xml` | XML, eight URLs |
| every page | loads, and the header mark is not a broken image |

A rule the host ignores **fails silently and looks exactly like a rule that
works.** This table is the only way to tell.

## Step 7 — the form, which is the one thing still unproven

The PHP has been executed locally — every path, including the throttle and the
prune. **What has never been proved is that a message arrives.**

1. Submit the real form on the live site.
2. Confirm it lands in `Contact@SixfoldColorado.com` **and is not in spam.**
3. Confirm `api/submissions.log` gained a line.
4. Confirm `/api/submissions.log` is **not fetchable** over HTTP.
5. Submit four times in ten minutes — the fourth should return **429**.

**If mail does not arrive, the lead is still in the log.** The handler reports
success either way on purpose, so a customer is never told to try again for a
delivery fault that is ours.

## Step 8 — tell Google

1. Search Console → add the property → verify (SiteGround can do the DNS TXT).
2. Submit `https://sixfoldcolorado.com/sitemap.xml`.
3. **Remove the `noindex` tags if you staged.** Then request indexing on the home
   page.
4. **Google Business Profile** — the profile already exists. Add the website URL to
   it, and check whether it is set up as a **service-area business**. If it shows no
   street address, the JSON-LD is correct as written; if it shows one, they should
   match. A mismatch is worse than an omission.
5. Facebook Sharing Debugger and LinkedIn Post Inspector — both cache, and both
   need a re-scrape after any fix.

## Step 9 — the things that only exist once it is live

- Add `"sameAs"` to the JSON-LD pointing at the Google Business Profile. One line,
  and it is the strongest signal tying the two records together.
- The **referral packet** prints `SixfoldColorado.com` on its footer. That stops
  being an exception the moment this is up.

---

## What is still not done, and is not mine

- **`/services/land-clearing/` and `/services/landscaping/` are thin.** Everything
  on record about those two services is already on them. They need job detail,
  before-and-afters, and the towns the work was done in — field material, from
  Brandon.
- **The landscaping cadence** — weekly, seasonal, annual — **has no source.** It
  has been drafted and pulled twice. It needs a fact, not another attempt at
  writing around it.
