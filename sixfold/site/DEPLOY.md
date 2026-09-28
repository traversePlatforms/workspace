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

## ⚑ Step 0 — the order, corrected 2026-09-21

This file first assumed the domain already pointed at SiteGround. **It does not.**
`sixfoldcolorado.com` is registered at Squarespace, its nameservers are Squarespace,
and it currently serves a Squarespace **"Coming Soon" parking page**. `surgeftw.com`
is the same registrar with its nameservers already at SiteGround — so this move has
been done once on this account.

**Add the domain to SiteGround BEFORE changing any DNS.** Point DNS at a server
that does not know the domain and visitors get an error, or whatever that account
serves by default.

### 0a — check the plan first

**SiteGround StartUp allows ONE website, and Surge is using it.** GrowBig and GoGeek
allow more. If the plan is StartUp, adding Sixfold needs an upgrade — a billing
decision, better found now than halfway through.

### 0b — add the domain to SiteGround

Client Area → **Websites** → **New Website** → **Existing Domain** →
`sixfoldcolorado.com`. **Decline WordPress and the site builder** — an empty site is
what is wanted.

**⚑ Confirm it gets its OWN document root, not Surge's `public_html`.** This is the
one step that can damage something that already works: uploading into Surge's root
overwrites the live Surge site.

Note the **server IP** shown in Site Tools — needed in 0d. Do not assume it matches
`surgeftw.com` (`35.209.216.247`). Read it.

### 0c — upload before repointing DNS

Do steps 2 to 4 below **now**, while the domain still resolves to Squarespace.
Nothing is public yet, so there is no audience and no rush. The point is that when
DNS moves, the real site is already sitting there instead of an empty folder.

SSL waits until after DNS — Let's Encrypt validates over HTTP against the live
domain, so it cannot be issued until the domain actually reaches SiteGround.

### ⚑ 0d — DNS, without touching email

**Do NOT change the nameservers.** That drags every record to SiteGround, including
the five Google Workspace MX records, and mail breaks until they are rebuilt on the
other side. **Leave DNS at Squarespace and change only where the website points.**
Registrar and DNS at Squarespace, hosting at SiteGround, is a normal split.

In Squarespace DNS for the domain:

**Leave alone** — the entire **Google Workspace** block (five MX records) and the
**Google Workspace Verification** TXT. That is the email.

**First disconnect the domain from the Squarespace site**, or the parking page keeps
winning and custom A records may be ignored.

**Then add:**

| Type | Name | Data |
|---|---|---|
| A | `@` | the SiteGround IP from 0b |
| CNAME | `www` | `sixfoldcolorado.com` |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |

**That SPF record does not exist today** — checked 2026-09-21. Surge has one,
Sixfold does not. It is part of why mail from this domain can land in spam.

**⚑ If the form sends via SiteGround's PHP `mail()`, the Google SPF line is not
enough** — SiteGround's own mail servers need including, or the form's mail fails
SPF. **Get that `include:` string from SiteGround's documentation rather than
guessing it.** The cleaner alternative: make `website@SixfoldColorado.com` a real
Google Workspace user and send via authenticated SMTP, which the Google line already
covers.

**Also:** DNS returns **two** `google-site-verification` TXT records while the
Squarespace panel showed one. Scroll the whole page and preserve both.

### Rollback

If the site does not appear, or anything about mail looks wrong: **delete the A and
CNAME records you added.** Squarespace resumes serving the parking page within the
TTL, and email was never touched, so nothing is lost but time.

**Screenshot the DNS page before you start** — that is the restore point. Lower the
TTLs a day ahead if you can; it shortens the window where resolvers still hold the
old answers.

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

**⚑⚑ NEVER EMPTY `public_html` BEFORE EXTRACTING. This has already destroyed
data once.** `api/submissions.log` lives on the server and nowhere else — not in
git, not in the OneDrive mirror, and `make-bundle.mjs` deliberately excludes it so
an upload cannot overwrite it. Extracting *over the top* preserves it. Clearing the
folder first deletes it, and **that is what happened on 2026-09-25** — the log was
confirmed gone on 09-28.

So, every upload, in this order:

1. **Download `public_html/api/submissions.log` first** and keep the copy in
   `sixfold/site/api/` locally, where the mirror covers it.
2. Extract the new bundle **over** the existing files. Do not clear the folder.
3. Confirm the log is still there afterwards and has not lost lines.

This stops mattering the day the form emails successfully, because every lead will
then exist in a mailbox too. Until then the log is the inbox and it has one copy.

**⚑ SiteGround nests a subfolder when it extracts a zip.** If you upload
`site.zip` and extract in place you can end up with `public_html/site/index.html`
instead of `public_html/index.html`. Check the root after extracting, and move the
contents up if it nested.

Also skip `assets/img/limbing.*` and `assets/img/stand.*` — about 820 KB, held in
reserve and referenced by no page.

## Step 3 — the mailbox, before you test the form

**⚑ SUPERSEDED 2026-09-21 — do not create `website@`.** `api/config.php` no longer
sends from it; `from` and `to` are both `Contact@SixfoldColorado.com`, which already
exists. Nothing had ever created `website@`, and mail from an address that does not
exist is a spam signal in its own right.

**SPF is done and correct** as of 2026-09-21:
`v=spf1 include:_spf.google.com ip4:35.206.97.198 ~all`, verified authoritative
2026-09-28. That `ip4` is SiteGround's **outbound relay**, not the web server IP —
the first attempt used the web IP and was wrong.

**⚑ The form still does not deliver.** Submissions log, `mail_accepted` is `true`,
and Google rejects with `550 High probability of spam`. Do not set DKIM from Site
Tools expecting it to help — that signs mail leaving *Google*, and this mail leaves
SiteGround. The fix is to stop using `mail()` and send through an email API. See
the email memory and §Step 3 of the fix plan.

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
