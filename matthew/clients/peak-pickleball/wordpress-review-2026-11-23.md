# Peak's website (WordPress): what's there and what we need

Looked at read-only on 23 Nov 2026 with the login Tyler sent. Nothing was changed or saved. Login details are stored privately on the cloud
computer (never in documents).

## What the site is
- **WordPress**, on the latest version. **Theme: "Peak Pickleball"**, a custom child of **Avada** (a paid theme). Built and looked after by
  **Wes, wes@lighthousewd.com (Lighthouse WD)**, who Tyler says they still work with.
- **Login page:** peakpickleball.us/login-secure/ (moved there by the "WPS Hide Login" plugin). Signs in with one shared admin login, "peakadmin".
- **Pages:** 50 in all: 31 published, 18 drafts, 1 private. The drafts include old pricing, league, events and holiday pages, and the
  **Privacy Policy** (see below).
- **Tracking on every page:** Google Analytics **G-WDBWJ1Q6HN** and the **Meta Pixel 624560343236394** (through the "Meta pixel for WordPress"
  plugin).

## Plugins (21; 20 switched on)
| Plugin | What it does | Note |
|---|---|---|
| Avada Builder, Avada Core | The theme's page builder | Paid licence: ask Wes who owns it |
| Peak Instructor Dashboard, Peak Multi-Court Event Agreement | Custom plugins made for Peak | Ask Wes what they do |
| Ninja Forms | The site's forms | Form entries could count as leads; see "What we can measure" |
| Yoast SEO, Redirection | Search settings, redirects | Yoast has an update waiting |
| Meta pixel for WordPress | The Facebook/Instagram pixel | Needs the privacy policy (Meta's terms) |
| WPCode Lite, Classic Editor, Classic Widgets, TablePress, SVG Support, Yoast Duplicate Post | Everyday tools | TablePress has an update waiting |
| Limit Login Attempts Reloaded, Really Simple Security, WPS Hide Login | Login protection | Limit Login Attempts has an update waiting |
| Easy Updates Manager, WP Rollback | Control updates | May be holding automatic updates back |
| **WP File Manager** | Edits server files from inside WordPress | **A common target for attackers.** Remove it if nobody uses it (Wes) |
| SeedProd Coming Soon | Maintenance page | Switched off |

**4 plugin updates are waiting**, three named above. Updates are Wes's call, because the site is his build.

## Problems found
1. **No published privacy policy.** "Privacy Policy" is WordPress's own starter page, still a **draft**. The public link returns "not
   found". The site runs the Meta Pixel and Google Analytics, and Meta's terms require a privacy notice. This has to be fixed before any ads.
   The only published policy is for a separate tool ("PeakDB Court Reserve Watcher").
2. **The Amenities page says Ziggi's provides the free coffee.** That's no longer true, and it's free advertising for them.
3. **Shared admin login, sent by email.** Everyone uses "peakadmin". Better: a login per person, and change the shared password.
4. **WP File Manager is switched on** (see above).
5. **Four plugin updates waiting.**

## What we can measure from the site, and what each needs
| Measure | Where it comes from | What we need |
|---|---|---|
| Visitors, where they come from, top pages, ad and email clicks reaching the site | Google Analytics (G-WDBWJ1Q6HN) | **Viewer access** for m.sharpe@traverseplatforms.com (from Wes or whoever owns it) |
| Google searches people find Peak through | Google Search Console | **Restricted user** access on peakpickleball.us |
| Form submissions (leads) per week, by form | Ninja Forms entries | A WordPress login in Matthew's own name, with an **Application Password**, read-only use |
| Free-class and membership clicks from the site into CourtReserve | Google Analytics events / UTM links | GA access, then tag the buttons (Wes) |
| Meta Pixel events (page views, "book now" clicks) | Meta Events Manager | Peak's Meta business access (Facebook steps) |
| Site speed and uptime | Public checks (we can run these) | Nothing |
| Search listings (page titles and descriptions) | Yoast SEO | The same own-name login |

## What to ask (added to Tyler's list; Wes for the technical ones)
- A WordPress login in Matthew's own name (and change the shared one's password, since it went by email).
- Google Analytics Viewer and Search Console access, probably from Wes.
- OK to **publish a real privacy policy** (Peak's attorney may want to see it) and to **take the Ziggi's line off the Amenities page**.
- An intro to **Wes**: who owns the Avada licence and the custom theme, the hosting and backups, what the two custom Peak plugins do, and
  whether WP File Manager can come off and the 4 updates go on.
