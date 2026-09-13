# Outreach emails — sending the rates page

**Built:** 2026-08-24
**Status:** Drafts. Nothing sent to anyone.
Companion to [services-page.html](services-page.html) and [services-pricing.md](services-pricing.md).

---

## How to send it — the three routes, ranked

### 1. Your own domain (recommended)

The page is **one self-contained HTML file** — no build step, no server, no
database. It can be dropped on any static host as-is.

- A domain is roughly **$10–15 a year**.
- Cloudflare Pages, Netlify and GitHub Pages all host a single page free.
- Point it at something short: `/rates` or `/pricing`.

**Why this is worth doing rather than sending the Claude link:** you are selling
websites. The URL is part of the pitch, and a prospect who receives a link on
someone else's domain has already been told something about how you operate.
It is the cheapest credibility available.

### 2. The Claude artifact link

Works, and costs nothing. Two things to know first:

- **A new artifact is private.** Until you open it and use the **Share** control
  in the page header, anyone you send it to sees nothing. This is the step people
  miss.
- **On Pro and Max, a public link is the only sharing option** — anyone with the
  link, no sign-in. On **Team or Enterprise, public sharing is off** until an
  Owner turns on *External sharing* in admin settings. If your account is on a
  Surge team plan, check this before you promise anyone a link.
- A public viewer who is not signed in sees the label
  **"Content is user-generated and unverified"** where your name would be.
  Fine for a colleague, not ideal on a sales document.

Use it for a quick look or an internal review. Move to your own domain before
any volume of outreach.

### 3. PDF attachment

[matthew-sharpe-rates.pdf](matthew-sharpe-rates.pdf) — **7 pages**, generated
from the same file. The page carries a print stylesheet that switches to a light
palette, drops the animated background, and keeps every priced block off a page
break.

Regenerate it after any edit to the page:

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="matthew\matthew-sharpe-rates.pdf" "marketing\services-page.html"
```

Good for someone who asked for "something to look at," or for a printed leave-behind
after a door knock. Worse than a link for cold email — attachments hurt deliverability
and a lot of people will not open one from a stranger.

### What not to do

**Do not paste the page into the body of an email.** Email clients — Outlook
especially — strip CSS grid, flexbox and custom properties, which is most of how
this page is built. It would arrive as a stack of unstyled text. HTML email is a
separate discipline built on tables and inline styles; the page cannot be
converted by pasting.

---

## The emails

Keep them short. The page does the selling — the email's only job is to get it
opened. All three are written to be sent as plain text.

### A — Cold, to a local business

> **Subject:** Website and marketing — rates
>
> Hi [name],
>
> I'm Matthew, I build websites and run marketing for small businesses out of
> Englewood. I came across [business] and thought I'd send my rates over in case
> it's useful now or later.
>
> Everything I do and what it costs is on one page here: [link]
>
> It starts at $800 a month, or $200 a week, and websites are priced separately
> from $2,200. You deal with me directly rather than an account manager.
>
> If it's not a fit, no problem — happy to be a name you have if that changes.
>
> Matthew Sharpe
> [phone] · Matthew.c.sharpe@gmail.com

**Why it is built this way:** it names the price in the email. Most outreach
hides the number to force a call, and most recipients read that as a reason to
delete it. Leading with $800 filters out anyone who was never going to pay, which
is the point — you want the ones who read that and keep going.

### B — Cold, where you noticed something specific

Better than A wherever you can be bothered to look first. One true, specific
observation outperforms any amount of polish.

> **Subject:** [business] — one thing on your Google listing
>
> Hi [name],
>
> I had a look at [business] and noticed [one specific thing — hours wrong on the
> Google listing, no website, the site not working on a phone, no reviews since
> a date]. That one is usually a quick fix.
>
> I build websites and run marketing for small businesses around Englewood. My
> rates are all on one page here: [link]
>
> Worth a short call either way — I'll tell you what I'd do first even if you
> don't want to hire anyone.
>
> Matthew Sharpe
> [phone] · Matthew.c.sharpe@gmail.com

**Rule for this one:** the observation has to be real and checked. Do not write
"I noticed your site could be improved" — that is a template and it reads as one.
If you cannot find something specific in two minutes, send A instead.

### C — Warm, referral or someone who asked

> **Subject:** Rates, as promised
>
> Hi [name],
>
> Good to speak — here's everything I do and what it costs: [link]
>
> The middle tier is what most businesses your size need, but have a look and
> tell me what you think. If a one-off website is the better answer I'll say so.
>
> Matthew Sharpe
> [phone] · Matthew.c.sharpe@gmail.com

---

## Notes on sending

- **Send from a domain address once you have one.** A gmail address is fine for
  warm replies and weak for cold outreach — it is the single biggest deliverability
  difference available for the price of the domain.
- **Plain text beats designed email** for one-to-one outreach. It looks like a
  person wrote it, because a person did.
- **One follow-up, once, about a week later.** Reply to your own thread with two
  lines. Do not build a sequence.
- **Do not BCC a list.** Send them individually. Bulk cold email from a new
  address gets the address filtered, and then even your warm replies stop arriving.
- **Check the CAN-SPAM basics** before any volume: a real physical address in the
  footer, an honest subject line, and a way to opt out that you actually honour.
  One-to-one email to a business is low risk; a list is where the rules bite.

---

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| A new artifact is private until shared from the page header **Share** control | Claude Code docs, *Share session output as artifacts* | **Verified.** |
| On Pro and Max, a public link is the only sharing option; on Team and Enterprise, public sharing is off until an Owner enables *External sharing* | Same docs, "Share an artifact" and "Control public sharing" | **Verified.** Matthew's plan is unknown — flagged as something for him to check, not assumed. |
| Public viewers who are not signed in see "Content is user-generated and unverified" instead of the author's name | Same docs | **Verified**, quoted exactly. |
| An artifact is a single self-contained page, no backend, CSP blocks external requests except Google Fonts | Same docs, "Page constraints" | **Verified.** Confirms the page can be rehosted anywhere as one file. |
| PDF is 7 pages | Generated and counted from the file itself, 2026-08-24 | **Verified by counting**, not estimated from screen height — screen measurement does not predict page fit. |
| Outlook strips CSS grid, flexbox and custom properties in HTML email | Long-standing, widely documented behaviour of the Word rendering engine | **Not re-verified this session.** Stated as the reason not to paste the page into an email body; the recommendation holds regardless of the exact property list. |
| Domain cost $10–15/year; Cloudflare Pages, Netlify, GitHub Pages free for a single static page | General market knowledge | **Not verified this session.** Order-of-magnitude only — check current pricing before committing. |
| CAN-SPAM requires a physical address, honest subject lines and a working opt-out | US federal law | **Not re-verified this session.** Directional; confirm against the FTC's own guidance before sending to any list. |

**Unresolved:** Matthew's claude.ai plan tier, which decides whether the artifact
can be shared publicly at all. Everything in route 2 is conditional on that.

---

## Added 2026-08-24 — the one-page version

[Horizon-Rates.pdf](_horizon-branded-superseded/Horizon-Rates.pdf) — **one page**, built from
[rates-onesheet.html](_horizon-branded-superseded/rates-onesheet.html) and branded with the Horizon mark.
Same prices as the full page; the reasoning, the process narrative and the
"worth knowing" section are left on the long page.

This is the version to attach or hand over. One page gets read, seven gets
skimmed, and a single sheet survives being printed and left on a desk. The
seven-page PDF stays useful for someone who has already asked for detail.

Regenerate after any edit:

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="marketing\Horizon-Rates.pdf" "marketing\rates-onesheet.html"
```

**One page is the spec.** Check the page count after any edit — screen height
lies about page fit, and the first three builds of this sheet ran to two pages
while looking fine on screen.
