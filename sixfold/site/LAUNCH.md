# Before this site goes on a host

Written 2026-09-19, out of the full-site audit. Everything here is **blocked on
the domain resolving or on the host existing** — none of it can be done or
tested on disk, which is exactly why it needs writing down rather than
remembering.

Nothing below authorises putting the site up. That is still Matthew's call, per
the standing draft-only rule.

---

## 1. The three tags that need the live domain

`<link rel="canonical">`, `og:url` and `og:image` all need an absolute URL, and
`audit-links.mjs` blocks the bare domain in copy (`web-address` rule) precisely
because it does not resolve yet. **The share image is already built** at
`/assets/og-image.jpg` — 1200×630, the slash-line photograph with the mark and
the service line on a scrim.

Paste this inside `<!-- CHROME:META -->` on **every** page, changing only the
two URLs per page:

```html
  <link rel="canonical" href="https://sixfoldcolorado.com/PATH/">
  <meta property="og:url" content="https://sixfoldcolorado.com/PATH/">
  <meta property="og:image" content="https://sixfoldcolorado.com/assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Cleared ground on a Front Range property, slash lined up ready for chipping">
```

Because canonical and og:url differ per page they **cannot** live in the shared
CHROME:META block — the drift auditor would fail every page against the first.
Put them **above** the `<!-- CHROME:META -->` marker, next to `<title>`.

`og:title` and `og:description` are deliberately absent throughout: every
scraper falls back to `<title>` and `<meta name="description">`, and duplicating
them is two places to fall out of step.

Check the result in Facebook's Sharing Debugger and LinkedIn's Post Inspector
before announcing anything — both cache, and both need a re-scrape after a fix.

## 2. Files that must not be uploaded

`serve.mjs` blocks these locally, so **the dev server hides a problem that is
real on a host**. A plain Apache/LiteSpeed box serves `.mjs` and `.md` as text:

```
sixfold/site/README.md              build notes, internal reasoning
sixfold/site/PHOTOS.md              the Kara consent decision, in writing
sixfold/site/LAUNCH.md              this file
sixfold/site/audit-links.mjs        the copy rules, i.e. what we will not say
sixfold/site/audit-runtime.mjs      same, plus how the site is tested
sixfold/site/serve.mjs
sixfold/site/assets/img/build-photos.mjs   absolute Desktop paths
sixfold/site/_tabled/               the whole folder
```

Either exclude them from the upload, or put this at the site root as
`.htaccess` (SiteGround and most shared hosts honour it):

```apache
<FilesMatch "\.(md|mjs|log|sh|map)$">
  Require all denied
</FilesMatch>
RedirectMatch 404 ^/_tabled/
```

The `api/` folder already has its own `.htaccess` covering `config.php` and the
submissions log. **Verify both** by requesting `/README.md` and
`/api/config.php` on the live host — a rule that is not honoured fails silently.

## 3. The form, which has never run against real PHP

`serve.mjs` answers `/api/submit.php` by logging. Nothing on disk has executed
the PHP. On the host:

- **`from` in `api/config.php` must be a mailbox that really exists on the
  domain** (`website@SixfoldColorado.com`). Mail claiming to be from
  SixfoldColorado.com and sent from elsewhere gets filed as forged. Set SPF
  and DKIM at the same time.
- Send a real test to `Contact@SixfoldColorado.com` and confirm it **arrives
  and is not in spam** — that is the whole point of the page.
- Confirm `api/submissions.log` is being written, and that it is **not
  fetchable** over HTTP.
- **There is no rate limit.** Nothing stops a bot posting the form a thousand
  times; the honeypot only catches the lazy ones. Worth a per-IP throttle
  before the URL is anywhere public.
- **`submissions.log` is personal data** — names, emails, phone numbers and IPs
  in plain text, indefinitely. Fine as a backup; decide how long it is kept.

## 4. Indexing

Every page except `/thank-you/` currently carries **no robots directive**, so a
host will index them the moment it is reachable. That is the intent at launch,
but it means **staging is indexable too**. If it goes on a staging URL first,
add `<meta name="robots" content="noindex">` and remember to take it off —
the Surge rebuild has this exact step in its own punch list.

**Both files now exist** — written 2026-09-20, and they are **meant to be
uploaded**, unlike everything in §2.

- **`robots.txt`** — `Allow: /`, with `/api/` and `/thank-you/` disallowed, and
  the sitemap declared. **It does not keep staging out of the index**: a
  `Disallow` asks a crawler not to *fetch* a URL, and a disallowed URL can still
  be indexed from a link elsewhere with no snippet under it. Staging needs the
  `noindex` meta above, per page.
- **`sitemap.xml`** — **five** URLs, not six. `/thank-you/` is excluded because
  it is `noindex`, and listing a noindex URL is a contradiction Search Console
  reports as an error. (The old note here said six; it was counting the pages,
  not the indexable ones.)

Both carry the **absolute** `https://sixfoldcolorado.com/` — a sitemap `<loc>`
has no relative form, so this is the one pair of files that cannot be written
domain-agnostic. If the domain ever changes, they change with it.

On the day: submit the sitemap in Search Console, and fetch `/robots.txt` over
HTTP once to confirm the host serves it as `text/plain` from the site root and
not from a subfolder — SiteGround nests a folder on extract, which is the same
trap the Surge deploy has.

`audit-links.mjs` now checks the sitemap against the pages on disk, so a page
added without a sitemap entry is a build failure rather than something found in
Search Console six weeks later.

## 5. Small things

- `assets/img/limbing.*` and `assets/img/stand.*` are **not referenced by any
  page** — about 820 KB across webp and jpg. Kept on purpose (`PHOTOS.md` calls
  them held in reserve); just do not upload them.
- Home loads roughly 1.1 MB of photographs. All lazy except what is in the first
  screen, so it is fine on a phone, but it is the number to watch if more get
  added.

## 6. Finish the LocalBusiness schema

Added 2026-09-20. The block is in `index.html` between `<!-- SEO:SCHEMA -->` and
`<!-- /SEO:SCHEMA -->`, **home page only** — two `LocalBusiness` blocks on two
pages with no shared `@id` can be read as two separate businesses.

Three keys are missing because all three need the live domain. Add them here,
then the block can also go on `/contact/` **carrying the same `@id`**, which is
what makes the two one entity rather than two:

```json
  "@id": "https://sixfoldcolorado.com/#business",
  "url": "https://sixfoldcolorado.com/",
  "image": "https://sixfoldcolorado.com/assets/og-image.jpg",
```

Then validate at `search.google.com/test/rich-results` — it reads the live URL,
so it cannot be run before the host exists.

**Two decisions to make at the same time, neither of them a drafting job:**

- **`streetAddress` is deliberately absent.** 17890 Sierra Way is on the
  agreements because a cancellation notice needs a real address that someone
  collects post at — that is not the same as publishing it on a website.
  Google wants a full address for the local pack, so leaving it out has a cost.
- **A Google Business Profile does more for local search than anything on this
  site.** The schema supports a profile; it does not replace one. If only one
  thing gets done, it is the profile.
