# surgeftw.com — restored WordPress vs. the July 2026 audit screenshots

Compiled 2026-09-04. Source material: the 39 screenshots in `Desktop/previous website look/`
(two audit passes, 23 Jul 2026 and 30 Jul 2026), against the site as it's actually live right now
— the Aug-2025 `.wpress` database restored into WordPress on SiteGround. Live pages read via direct
fetch the same day.

**Read this whole file before applying anything from `recovered-copy/`.** Three items below are
flagged RESTRICTED or NOT RECOMMENDED — they are transcribed for the record, not staged to paste in.

Direction confirmed with Matthew 2026-09-04: the WordPress restore is the real plan now (the static
rebuild in `drafts/surge-site/` is shelved/reference — see `surge-site-rebuild` memory). Fidelity
target is best-effort from what's actually in the restored database — where the July screenshots
show content that isn't in the DB, it's noted, not invented wholesale.

---

## 0. The three-way mismatch

This isn't a two-way diff. Three different snapshots of the site disagree with each other:

| | **23/30 Jul 2026 audit** (screenshots) | **Live now** (Aug-2025 `.wpress` restore) |
|---|---|---|
| Top nav | Home / Our Focus / **Company ▾** / **Careers** | Home / Our Focus / **Team** / **Clients** / Contact |
| Phone | (720) 719-5495 | (719) 315-7742 |
| Locations shown | Denver, CO · Houston, TX · Asheville, NC | Denver, CO · Nevada City, CA |
| Careers page | Full page, "We're Hiring," application form | **Missing** — `/careers/` falls back to home |
| Blog | "Our Blog," 3 posts (Apr 2026, Mar 2026, and one dated May 2024) | **Missing** — `/blog/` falls back to home |
| Team bios | 10 people: Dylan Conger + Brandon Long (owners), Ryan Conger, Jon Wallace, Nneka Smith, Paige Bennett, Lance Axon, Maya Ogea, Myles Zoutte, Cai Silva | 7 people: Dylan Conger + Brandon Long (owners), **Logan Navo**, Jon Wallace, **Taylor Riley**, **Donte Landry**, Nneka Smith — different, much shorter placeholder-style quotes |
| Clients page | "Our Clients" hero + Instabuzz Media feature | Same — Instabuzz Media still there |

So "restore it to match July" isn't a single target. The restored database is older than the July
audit in some ways (contact info, team roster, missing pages) and the July audit itself doesn't
match what's on `clients.md`/current staff either (see §3). None of the three is simply "correct."

---

## 1. Pages that exist in the July audit but are gone from the live restore

- **`/careers/`** — full "We're Hiring" page: hero, "Reach out in minutes" 3-step panel, an
  application form (first/last name, phone, email, file upload for cover letter/resume, "how did
  you hear about us," SMS consent checkbox + reCAPTCHA). Recovered text staged in
  `recovered-copy/careers.md` — **see the flag on it below before reusing the copy.**
- **`/blog/`** or wherever "Our Blog" lived — 3 post teasers: *Leadership Is a Skill You Build, Not
  a Title You Earn* (Apr 17, 2026), *How to Conduct Market Research Before Expanding Into a New
  Market* (Mar 31, 2026), *How to Build a Scalable Team for Long-Term Business Growth* (May 29,
  2024 — note the much older date, so this one may predate the Aug-2025 snapshot and be recoverable
  from the `.wpress` `database.sql` even though the newer two aren't). Only titles/dates are visible
  in the screenshots, not body copy — the posts themselves would need pulling from
  `wp-content/ai1wm-backups/…wpress` → `database.sql`, or they're gone.
- **A `Company ▾` dropdown structure** — July nav had Team content living under "Company" (which
  also housed "Powered By Our People"). Live nav now has "Team" as its own top-level item pointing
  straight at `/team/`. Not a content loss, just a menu-structure difference — flagging in case the
  WP menu itself needs rebuilding rather than assuming it'll come back with content.

## 2. Content that's live now but doesn't match July

- **Team roster** (`/team/`) — three people shown live (Logan Navo, Taylor Riley, Donte Landry)
  don't appear in the July audit roster *or* in the confirmed current staff list from the
  `surge-site-rebuild` work (Brandon Long, Matthew Sharpe, Ryan Conger, Jon Wallace, Nneka Smith,
  Paige Bennett, Lance Axon, Maya Ogea, Myles Zoutte, Cai Silva). Their quotes are also a different,
  much thinner style ("Tequila by The Champs," "Survivor because I outwit, outplay and outlast") —
  reads like an earlier placeholder pass, not a trimmed version of the July bios. **This is public on
  the live site right now** showing people who may not be current staff. Needs Matthew's call on
  whether to pull the July bios back in, wait for the named-roster work from `surge-site` to migrate
  over, or take the page down to something minimal in the meantime.
- **Contact info** — live phone (719) 315-7742 vs. July's (720) 719-5495. Live locations (Denver,
  Nevada City) vs. July's (Denver, Houston, Asheville). Neither set is self-evidently the current
  truth — **flagging both rather than picking one.** See §3.

## 3. Facts that need Matthew's confirmation before either version goes back up

Per `RESTRICTED.md` Tier 2, "Structure and scale" (affiliate offices, footprint, "no footprint,
scale, growth, or nationwide framing") is restricted-pending-authorization regardless of which
snapshot it comes from — so this isn't just a copy-accuracy question, it's a publish-permission
question:

- **Which phone number is current** — (720) 719-5495 or (719) 315-7742.
- **Which locations are current.** RESTRICTED.md's own roster (Denver, ~~Houston~~ closed,
  Asheville, Indianapolis) matches *none* of the three location sets seen across the screenshots and
  live site (Houston+Asheville / Nevada City / and Indianapolis appearing nowhere on the site at
  all). A public "Our Locations" page naming multiple cities is exactly the "footprint, scale,
  growth" framing Tier 2 says not to publish without a yes — worth deciding whether that page should
  exist at all, not just which cities it names.
- **Whether Dylan Conger should still appear as Co-Owner.** He's on both the July and live team
  pages; the `surge-site` rebuild's roster work explicitly excluded him from the current lineup.

## 4. Flagged — do not restore as-is

**A. `/clients/` names Instabuzz Media as a client, live right now.** Logo, a quoted mission
statement, and copy built around them ("Boosting Sales While Saving You Time"). This is a direct
hit on `RESTRICTED.md` Tier 4: *"Client identity, at any resolution. Sector only. The reason is
consent — no client hired Surge in order to become marketing material."* It's already live from the
Aug-2025 restore, and it's also in the July audit, so it's not something I'd be introducing — but I
won't reproduce or extend it, and it's worth deciding whether to pull it now rather than folding it
into a "keep as-is" fix list. Flagging rather than silently leaving it as a checked box.

**B. The Careers/Company "why work here" copy is textured exactly like the devilcorp-tell
brand-voice-company.md §5 names**, and it's recovered verbatim in `recovered-copy/careers.md` and
`recovered-copy/company-team.md` for the record — not as ready-to-paste copy. Specific lines:
- "With Us You Will: **01 Learn** ... **02 Earn** — Earn unlimited income by joining our team.
  Flexible hours and competitive pay ... **03 Grow**"
- Myles Zoutte's bio: *"probably why my next goal is buying my first McLaren within three years."*
- Nneka Smith's bio: *"I am all about making my money work for me and not the other way around."*
- Cai Silva's closing quote: *"You can have anything you want if you will just help enough other
  people get what they want." — Zig Ziglar*

These are the specific patterns the earlier `surge-site` team-page rewrite deliberately stripped
("stripped the McLaren / make my money work for me / learn earn and grow / motivational-quote
texture"). Restoring this WordPress content verbatim would put them straight back on the live site.
Recommend rewriting rather than reusing if/when Careers comes back.

---

## 5. What's confirmed fine to restore/rebuild as-is

The core service pages check out — no restricted content, and only the phone-number/location
details above are actually in question:

- Homepage hero, "Our Focus" 3-card section, "An award-winning goal driven sales team" (Vision /
  Mission / Process), "Why Work With Us?" — all present in the live restore already, matching the
  July audit almost word-for-word.
- `/generate-revenue/`, `/personal-growth/`, `/career-growth/` — all three live and matching.
- `/locations/` exists live (content differs from July — see §3).
- Footer structure, social links (LinkedIn/Instagram/Google Maps) — consistent across both
  snapshots.

---

## Fact-check log

- **Verified by direct comparison** (screenshot vs. live fetch, same day): nav structure, all
  contact details, team roster, presence/absence of Careers and Blog, Clients page content. Primary
  sources: the 39 screenshots (dated in filename) and live `surgeftw.com` pages fetched 2026-09-04.
- **Corrected**: my initial assumption that "match the July screenshots" was a single well-defined
  target — it isn't; see §0.
- **Unresolved**: current correct phone number, current correct location list, whether the two
  newer blog posts (Mar/Apr 2026) exist anywhere recoverable, whether Dylan Conger is still
  Co-Owner, whether Instabuzz Media naming should come down now or wait. All flagged above rather
  than guessed.
- Blog post *body copy* was never verified — only titles/dates were visible in the screenshots, so
  no claims from those posts appear anywhere in this file or in `recovered-copy/`.
