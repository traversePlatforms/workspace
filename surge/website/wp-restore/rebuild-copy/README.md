# Rebuild copy — ready to paste into WordPress/Elementor

Confirmed with Matthew 2026-09-04: rebuild surgeftw.com to match the July 2026 audit, and
RESTRICTED.md / brand-voice-company.md still govern the new site the same as everything else — so
anything in the screenshots that trips a restriction gets rewritten or dropped, not restored
verbatim. This folder is the result: every page from the July audit, reconstructed, with the flagged
material fixed instead of just flagged.

**Update, same day, later:** a second, newer `.wpress` backup turned up —
`Documents/surge/surgeftw-com-20260812-235352-uq7z5qsgfmvz.wpress`, made by Rise Marketing on
2026-08-12, three weeks after the July audit and reportedly the last thing they did before Surge
canceled with them. Verified genuine (parsed its internal structure directly, not just the
filename) and intact: full `database.sql`, full media library, all plugins, the theme. I extracted
the database and mined it directly — so what's in this folder now is source-verified against the
actual last-known site content, not just screenshots. Every file below says what's confirmed vs.
what's still a July-screenshot read. **Matthew has separately asked SiteGround support to restore
the live site from this file instead of the Aug-2025 one that went up 2026-09-03.**

**Everything in here is written to be pasted in.** I have no WordPress/Elementor access — nothing
here has touched the live site. Paste it in yourself, or hand these files to Rise Marketing / whoever
ends up with admin access after the SiteGround restore.

## The four open items — all resolved from the database

1. **Phone number — resolved: (720) 719-5495.** Confirmed on the Careers page, the Contact page,
   and the sitewide footer template. The (719) 315-7742 seen on the interim Aug-2025 restore doesn't
   appear anywhere in the Aug-2026 database — it belongs to that older, different snapshot only.
2. **Locations — real data found, policy call unchanged.** The database confirms Denver, CO /
   Houston, TX / Asheville, NC are genuinely the three current location pages (matches Home and
   Contact). **Still recommending Denver-only in published copy** — that's brand-voice-company.md
   §5 barring footprint/scale framing outright, not a question of what's accurate. Separately: three
   pages (Generate Revenue, Personal Growth, Career Growth) have a stale, wrong "Denver, CO / Nevada
   City, CA" widget that matches neither the real locations nor anything else on the site — a live
   bug, worth fixing regardless of which location policy you land on. See `our-focus.md`.
3. **Blog posts — resolved, full text recovered.** All three post bodies were sitting in
   `database.sql`, including the two 2026-dated ones I'd said couldn't be recovered from screenshots
   alone. Real, published `wp_posts` rows — not written by me. Checked against RESTRICTED.md: clean.
   Full text in `blog.md`.
4. **Dylan Conger — resolved: still Co-Owner** as of Aug 12, 2026, the most current snapshot that
   exists. See `company-team.md`.

## What changed, by page

- **Home** — no changes. Nothing restricted; matches the database exactly.
- **Our Focus + subpages** — the "Learn/Earn/Grow" earnings-claim panel and a stale "Nevada City"
  location widget are confirmed live, identically, on all three subpages (not just one, as I'd
  first thought) — both rewritten. One flag from my first pass (a suspected copy-paste leftover on
  Personal Growth) turned out to be a misread of the screenshot and is retracted.
- **Careers** — turned out cleaner than expected: the earnings-claim panel I'd originally rewritten
  *here* doesn't actually live on this page at all (it's on Career Growth) — correction applied,
  nothing left to rewrite. Phone confirmed, one form-field label corrected.
- **Company & Team** — three bios trimmed by exactly one line each (a McLaren reference, a "make my
  money work for me" line, a closing Zig Ziglar quote) — all three confirmed verbatim against the
  database, not just the screenshots. Dylan Conger confirmed current.
- **Clients** — the named client (logo + quoted mission statement) is gone; confirmed it was still
  live as of Aug 12, 2026, so this is a real, current fix, not a stale one. Replaced with a
  sector-level paragraph and a line on why no client names appear.
- **Contact** — confirmed clean and current: phone, locations, and copy all check out against the
  live database with no corrections needed beyond the same Denver-only policy trim.
- **Blog** — fully written now; see item 3 above.

## Nav structure

The July audit's nav was consistently **Home / Our Focus ▾ / Company ▾ / Careers** on every page —
different from the interim Aug-2025 restore (Home / Our Focus ▾ / Team / Clients / Contact) that was
briefly live. The database doesn't store the nav menu structure in a form I've mined yet, so this is
still screenshot-sourced:
- Move "Team" content under a new "Company" dropdown — that's where "Powered By Our People" lived.
- Add "Careers" back as a top-level item.
- "Clients" and "Contact" weren't in the July main nav *or* footer — Clients seems to have existed
  as an unlinked page. Worth linking it now that it's genericized; no policy reason left to hide it.

This is a WP Appearance → Menus change — not something I can do without admin access.

## Source trail

- July 2026 audit screenshots: `Desktop/Surge/previous website look/` (39 images, 23 & 30 Jul).
- Interim restore (superseded): `.wpress` dated 2025-08-05, in the old backup already on file — see
  `surge-wordpress-backup` memory.
- **Authoritative source for this pass:** `Documents/surge/surgeftw-com-20260812-235352-uq7z5qsgfmvz.wpress`
  — verified genuine AI1WM export, WordPress 7.0.4, SiteGround, table prefix `dcy_`. Its
  `database.sql` (3.67 MB, extracted and parsed directly) is what every "confirmed" note above is
  checked against.
