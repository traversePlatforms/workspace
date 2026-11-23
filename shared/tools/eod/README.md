# End-of-day reports: two reports (redesigned 23 Nov 2026)

Matthew, 23 Nov 2026: "I need to really redo my whole end of day recap, just because there is multiple companies now and multiple
data points." He chose **changes daily, numbers weekly**:

| Report | When | File | Made by |
|---|---|---|---|
| **Changes** | every working day | `changelog/YYYY-MM-DD.html` + `.pdf`, an entry in `CHANGELOG.md` | `daily.mjs` from a small JSON the session writes |
| **Business numbers** | every Sunday | `changelog/weekly-YYYY-MM-DD.html` + `.pdf` | `weekly.mjs`, numbers collected by itself |

Both use the same look (`lib.mjs`): the navy header band, number tiles and white cards from Brandon's end-of-day picture, fonts from
`traverse/app/tools/eod-assets`. Font paths stay `url('../traverse/...')`: the laptop's sync rewrites exactly that prefix.

**Desktop copy:** the laptop's sync (`traverse/ops/jarvis-cloud-sync.sh`, `vm_eod`) copies `changelog/20YY-MM-DD*.html/pdf` and
`changelog/weekly-20YY-MM-DD*.html/pdf` into `Desktop\End of Day Reports` after it pulls. The files reach the laptop with the repo, so they
come down once they are committed.

Files: `daily.mjs`, `weekly.mjs`, `lib.mjs`, `server/sixfold-week.php`, `server/reads.php`, `examples/daily-example.json`.

---

## 1. The daily Changes report

What changed in the apps, sites, settings and tools that day. Each item is one plain line. Items are grouped per company:

- **Traverse:** the field app, editions, website
- **Sixfold 365:** app, websites, email
- **Peak Pickleball:** sponsor desk, Outbox and email, data work
- **J.A.R.V.I.S. and workspace:** cloud computer, backups, automations
- **Personal**

After the companies come **Running tonight** and **Waiting on you**.

**Surge:** only a count, rendered as the single line "Surge: N changes (see the laptop)". Surge wording is never drafted on this machine,
and restricted Surge content is never quoted.

At the end of the day, the session:

1. Reads the day's `git log` and adds the things done outside git (server settings, emails drafted, laptop changes).
2. Writes the input JSON (copy `examples/daily-example.json`; the scratchpad is fine, it does not need keeping).
3. Runs `node shared/tools/eod/daily.mjs <day.json> --changelog`. This writes the html and the PDF, and adds the CHANGELOG.md entry once per date.
4. Commits.

Input fields are listed in the header of `daily.mjs`:

- `pill` is one of `live`, `off` (built, off), `posted`, `sent`, `run` or `starting`.
- `tiles` is optional. Without it, the tiles show: changes, areas touched, running tonight, waiting on you.
- `dateTo` turns the report into a catch-up for several days.

To test a render without touching `changelog/`, set `EOD_OUTDIR=<dir>`. The fonts only load when that folder sits next to a `traverse/` folder.

## 2. The weekly Business numbers report

```
node shared/tools/eod/weekly.mjs                    # the 7 days ending today, Colorado time
node shared/tools/eod/weekly.mjs --end 2026-11-29   # the 7 days ending that day
node shared/tools/eod/weekly.mjs --render-only      # re-draw from the saved snapshot (no server calls)
node shared/tools/eod/weekly.mjs --no-pdf
```

The report shows each company's metrics with **last week, this week and the change**. The change is green when it moves the good way,
orange when it moves the bad way, and grey when neither way is better.

Each run saves a snapshot, `~/jarvis/localappdata/ProjectBackup/eod/weekly-<end>.json` (`$LOCALAPPDATA/ProjectBackup/eod`). The snapshot
holds counts and dollars only, never names. Next week compares against it. Metrics that only exist as a running total (ad spend, desk
stages, installs, Stripe month so far, members) need the previous snapshot, so the first week shows "n/a" for last week. If the closest
snapshot is not exactly 7 days old, the row says which day it was compared with.

**Rules:**

- No number without a source.
- A metric with no source shows **"not available yet (why)"**.
- Everything is read only:
  - Server numbers come through `bash ~/jarvis/bin/sg.sh trav`. The two scripts in `server/` are piped to `php` (`php -- <start> <end>`
    over stdin) and are **never installed on the server**.
  - `profit-check.php --line` is the only existing command run as-is. Never `--monthly` or `--alert`: those send email.
- Nothing is sent and no server data changes.

**Schedule (not installed yet):** a systemd **user** timer on this machine, Sundays at about 8:30 pm MT. That is after Sixfold's 8 pm
end-of-day email, so the day's ad spend is usually typed in by then. It would look like this:

```
# ~/.config/systemd/user/eod-weekly.service
[Service]
Type=oneshot
WorkingDirectory=/home/yard/main
Environment=TZ=America/Denver
ExecStart=/usr/bin/node shared/tools/eod/weekly.mjs
# ~/.config/systemd/user/eod-weekly.timer
[Timer]
OnCalendar=Sun *-*-* 20:30 America/Denver
Persistent=true
[Install]
WantedBy=timers.target
```

Then:

- `systemctl --user enable --now eod-weekly.timer`.
- Add a line to `traverse/ops/runs-on-vm.txt`.
- Commit the two changelog files after the run (or have the timer's job commit them), so the laptop's sync brings them to the Desktop.

### Where each number comes from

Weeks run from day `end-6` to day `end`, against the 7 days before. Times are Colorado time.

**Sixfold 365** (`server/sixfold-week.php`). It loads the app the way `sixfold-tools/eod-report.php` does (action `digest`, command line),
with the same filters: test leads and their jobs are left out, and jobs taken off are left out.

| Metric | Source | Live? |
|---|---|---|
| New leads (by source) | `leadsAll()`, lead `at` in the week. Facebook form leads arrive by themselves; Messenger leads only when typed in | yes |
| Quotes sent, value | first quote time per lead from `leadst.log` (eod-report's rule) | yes |
| Jobs booked, value | `jobsAll()`, job `at` (booked time) | yes |
| Jobs done, value | jobs dated in the week and marked done | yes |
| Money collected | Square `squarePaymentsSince()`, completed, net of refunds (same as Brandon's report) | yes |
| Ad spend, all time | `adSpend()`: lifetime Meta totals **typed in** on the Stats page (the app cannot read the ad account) | yes, only as fresh as the last typing |
| Ad spend this week | the change in the all-time total between two weekly snapshots | from the second weekly run |
| Profit, by month | `sixfold-tools/profit-check.php --line` (month figures on known costs; insurance, phone, gas and owner pay unknown) | yes (monthly, not weekly) |
| 365aeration.com visitors, views, conversions | site analytics: that server's signed report (30-day daily series; conversions by kind only when the run ends today) | yes, counting began 20 Nov 2026 |

**Traverse** (`server/reads.php`, plus `assistant/jarvis/tools/jarvis-money.mjs`)

| Metric | Source | Live? |
|---|---|---|
| traverseplatforms.com visitors, views, conversions | `site-analytics/lib.php` `svSummary()` on this server's own data, any range | yes, from 20 Nov 2026 |
| Demo bookings | `traverse-site-private/bookings.json` (the /demo/ page), by the day booked; cancelled counted apart | yes |
| Installs in a Stripe trial, paying installs | every install's `*-data/rounds/billing.json` status (`trialing` / `active`, written by Stripe webhooks) | yes (0 billing records on 23 Nov) |
| New paying installs | `billing.json` `paid_at` in the week | yes |
| Website sign-ups | `traverse-shared/clients/registry.json` (the /start/ checkout) | yes |
| Stripe charges, month so far | `jarvis-money.mjs stripe --force` (GET balance + this month's charges), written to `ProjectBackup/eod/money/` so the Assistant's copy is untouched; key from `~/.ssh/stripe-live.json`, never printed | yes; weekly = change within a month |
| Prospect emails sent, bounces, unsubscribes, clicks, prospects added | Prospect Desk `traverse-prospects-data/events.log`, rows by type | yes |
| Prospect replies | not recorded by the desk (replies land in the mailbox and the Assistant) | **not yet** |

**Peak Pickleball** (`server/reads.php`, plus the nightly pulls)

| Metric | Source | Live? |
|---|---|---|
| Outreach sent, replied (people), booked, bounced, unsubscribed, opened (people), by list | the Peak sender's `peak-mail-data/events.log`, the same rows `cron.php stats` counts | yes, lists started 23 Nov 2026 |
| Desk: companies past "new", in "meeting", tours | `php desk.php check` in `public_html/peak-desk-28d38d/api` (stages per pipeline) | yes; movement from the second run |
| Paid active members, new members | `matthew/clients/peak-pickleball/data/pulls/<day>/impact.json` (nightly CourtReserve + Patch pulls, `tools/nightly-pull.sh`) | **"pull not running yet"** until impact.json exists |

### Adding a metric

1. **Find the read path.** Use an existing file or command that already holds the number. Read-only only: no POST to our own APIs, no
   `--alert`/`--monthly`/`--now` switches, nothing that sends.
2. **Server data:** add a `$part('name', fn)` block to `server/reads.php`. It should return counts for `this` and `last`, using `$wk($timestamp)`.
   Print counts only, never names or addresses. For the Sixfold app, add to `server/sixfold-week.php`, which can call any app function.
3. **Local data:** read it in `collect()` in `weekly.mjs` into `raw.<name>`.
4. **Add the row** in `build()`: `{ label, src, last, this, unit: '$' | undefined, better: 'up' | 'down' | '' }`.
   - No source yet: `{ label, src, na: 'not available yet (why)' }`.
   - Running total: take last week's value from `P` (the previous snapshot's `raw`) and set `lastNa` when there is none.
   - Text only: `{ label, src, text }`.
5. **Test.** Run `node shared/tools/eod/weekly.mjs --no-pdf`, look at the html, then add the metric to the tables above.
