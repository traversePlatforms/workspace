# surgeftw.com — interim holding page

## Where things stand (checked 2026-09-04)

`surgeftw.com` is **live WordPress on SiteGround**. The public sees a **SeedProd**
"Coming Soon" page (stock "Get Ready!" template; its email link is broken —
points at `support@company.com`). Behind it the install looks close to blank, but
the **old media is still on disk** (e.g. the white Surge logo at
`https://surgeftw.com/wp-content/uploads/2024/12/White-Surge-LOGO-1ss.png`).

- Log in at `https://www.surgeftw.com/wp-login.php`.
- `/wp-admin/` returns 403 (SiteGround security blocks the path — not a real
  error; go through `/wp-login.php`).
- SiteGround panel: `https://login.siteground.com`.

**SeedProd's own "HTML" block mangles pasted markup** (strips `<style>`/`<svg>`,
chokes on comments — that's the white screen with stray words). Use one of the
two paths below instead.

---

## Path 1 — normal WordPress page (recommended, exact design)

The install is basically blank, so SeedProd isn't hiding anything worth hiding.

1. Log in.
2. **Pages → Add New.** Title it `Home`.
3. Add one block: search **"Custom HTML"** (the core WordPress block — it does
   *not* strip `<style>`, unlike SeedProd's).
4. Paste all of **`gutenberg-html.html`** into it. Publish.
5. **Settings → Reading → "Your homepage displays" → A static page →
   Homepage: Home.** Save.
6. **Plugins →** deactivate **Coming Soon Page & Maintenance Mode (SeedProd)**
   — or SeedProd dashboard → turn **Coming Soon Mode off**.

Done. The block pins itself full-screen over whatever theme is active, so it
doesn't matter what the theme looks like. Uses the real hosted Surge logo and
system fonts — no dependencies.

---

## Path 2 — rebuild inside SeedProd, no code (fallback)

Keeps SeedProd on. Won't be a pixel match but it's on-brand and reliable.

In **SeedProd → edit the Coming Soon page**:

- **Global Settings → Background →** color `#0A0A0A`.
- **Image block →** the logo: `https://surgeftw.com/wp-content/uploads/2024/12/White-Surge-LOGO-1ss.png` (or upload it).
- **Header block →** `The site is being rebuilt.` — text color `#F4F4F4`.
- **Text block →** `We're refreshing the whole thing — new pages, faster, clearer. It'll be back here shortly.` — color `#B0B4B0`.
- **Text block →** `720-719-5495` and `info@surgeftw.com` as links — **fix the
  email link to `mailto:info@surgeftw.com`** (it's currently
  `mailto:support@company.com`) — link color `#4ABE4A`.
- **Text block →** `Englewood, Colorado · Monday to Friday, 9:00 AM – 5:00 PM MT` — color `#B0B4B0`.
- **Page Settings → Custom CSS →** paste `seedprod-custom-css.css` (kills the
  forced-white background).
- Save; confirm Coming Soon Mode is **Active**.

---

## Files here

| File | For |
|---|---|
| `gutenberg-html.html` | Path 1 — the core WordPress **Custom HTML** block |
| `index.html` | standalone page — any static host, or double-click to preview |
| `seedprod-block.html` / `seedprod-custom-css.css` | only if you insist on SeedProd's HTML block (it mangles the markup — not recommended) |

Preview of the design: `node` one-liner on **http://localhost:8082/**.

## Later

When the rework (`drafts/surge-site/`) is ready it replaces this install or goes
on it. Nothing here needs undoing beyond deleting the Home page / turning SeedProd
back on.
