# Overnight review, 2026-10-06: summary

Five Fable reviewers ran overnight, one per area. Each fixed clear bugs on this computer with tests; I checked every fix
before committing it. **Nothing was uploaded, published or changed on a live site.** Live checks were read-only.

| Area | Report | Result |
|---|---|---|
| Door app (whole codebase) | [door-app.md](door-app.md) | No security holes found. 3 bugs fixed, plus 1 I fixed from its list. Tests: 1,480 passing |
| Surge site | [surge-site.md](surge-site.md) | All audits pass; staging = local; no client names or logos. 1 fix; 2 leftover headshots archived |
| Sixfold website | [sixfold-site.md](sixfold-site.md) | Live = local; private files blocked; copy rules all met. Wording and page-comment fixes |
| Today's documents | [documents.md](documents.md) | Law citations verified; Brian's dates correct. 5 lesson fixes |
| Notes and task list | [notes-and-tasks.md](notes-and-tasks.md) | Stale notes and tasks corrected; Brian and the uploads added to TASKS |

## What was fixed (all committed)

**Door app** (commit `240d326`, not uploaded)
- A malformed date in a calendar request crashed it with a server error.
- Changing month on the new calendar left the old day picked ("Nothing on this day").
- The backups (download and nightly) were missing personal goals, the training lessons and the roofing price settings.
- A manager opening a teammate's Doors tab saw their own doors under the teammate's name.

**Training lessons** (commit `22f86a6`, not uploaded)
- "+ Add a lead" is admin-only; crew now pass the details to the office.
- The app warns about Do Not Call on looked-up numbers but doesn't check the lists; the lesson now says wait for the office.
- A softened version of the dropped 55/38/7 claim removed.
- The deposit wording no longer claims something the agreements don't say.
- First aid on every crew stated as a requirement, not a fact (the safety guide says it isn't in place yet).

**Surge site** (commit `ba8fd38`, not on staging)
- The booking page's date grid gets the label screen readers need.
- Jon's and Ryan's headshots archived out of the site (their pages redirected, but the images still loaded by URL).

**Sixfold site** (commit `1e98915`, not uploaded)
- "All three services" became "four" on four pages (aeration was the fourth).
- Hidden page comments no longer carry a customer's name and price, the street address, or your quote about licences.

**Notes and TASKS** (commit `be2bb2b`): five stale index lines, dead paths from the door-app move, Brian's job and the
uploads added as tasks.

## To upload when you're ready

1. **Door app**, any order, flush last (full table at the top of `door-app/site/summit-de59ae83/DEPLOY-ROUNDS.md`):
   - `api/rounds.php` → `public_html/api/`
   - `summit-de59ae83/index.html` → `public_html/summit-de59ae83/`
   - `data/rounds/training.json` → `sixfold-data/rounds/`
   - `tools/nightly-backup.php` → `sixfold-tools/`
2. **Surge staging:** `surge/website/build/deploy/dist/surge-site-2026-10-06.zip` into **staging.surgeftw.com/public_html**
   (read the path back first). Then delete `assets/img/people/jon-wallace.jpg` and `ryan-conger.webp` there by hand.
3. **Sixfold site:** rebuild the bundle when convenient; nothing urgent in tonight's changes.

(You uploaded the Training + calendar batch before bed; it's live and verified.)

## Questions for you, most important first

1. **Did Kara sign?** 7 October was her last safe signing day for the 12 October job.
2. **Is a mid-October overseed in Castle Rock honest to sell (Brian, 15 Oct)?** The water research left it open; seed down this late may not take until spring.
3. **The agreements promise an 811 locate before aeration**, but Colorado's 811 law appears to exclude shallow lawn work. Keep it as extra caution, or drop it? (Brandon's call.)
4. **Surge bio pages still end with a client pitch** ("tell us what you need sold", Book a consultation), and the /about/ "How we work" wording uses the phrasing brand-voice §5 rejected ("other states"; settled phrase: "clients in multiple states").
5. **Surge home page figures** (106,000+ / 37,600+ / 8,900+) still have no source on record.
6. **The Surge link-preview image** still says "We handle your entire sales team".
7. **Door app judgement calls** (in door-app.md): crew on a team can see teammates' lead phone numbers through the calendar;
   the manager's leaderboard shows everyone's personal goals; storm alerts reach crew phones; the morning email runs as
   admin so it can see the commercial test towns. Each is fine or not depending on what you want.
8. **Sixfold site:** www.sixfoldcolorado.com doesn't redirect to the bare address, and the WebP photos are bigger than the
   JPEGs they replace (slower for modern browsers). Both easy to fix.

## Housekeeping

- Bash ate backticks twice tonight while I wrote notes (no files were harmed; the text was repaired with the editor).
- The test harness's PHP server was restarted by the door-app reviewer and may still be running.
