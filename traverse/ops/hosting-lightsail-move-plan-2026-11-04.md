# Moving Traverse from SiteGround to AWS Lightsail: plan and prices

4 Nov 2026, for Matthew. Nothing is bought or changed by this plan; buying the server and switching the domain each need his go.

## What moves

Only the **Traverse SiteGround account** (traverseplatforms.com):
- all six apps plus the Sixfold practice copy;
- the Traverse website, the Prospect Desk, the post calendar, the assistant, the Peak desk;
- every data and private folder next to them.

Measured today: 9.6 GB and about 247,000 files. Traffic is about 23,600 log lines a day, which is tiny.

**What stays where it is:**
- 365aeration.com / aeration365.com stay on their own SiteGround account. The customer deposit links and printed QR codes point there, so nothing changes for customers.
- Surge's site stays on Surge's account.
- Email stays on Google Workspace. The apps already send through Google's mail servers (port 587), and Lightsail doesn't block that.

## The server

**Lightsail Linux "Medium", 4 GB memory, $24.00 a month.** It comes with:
- 2 vCPUs;
- 80 GB disk (we use 9.6 GB);
- 4 TB of data transfer a month;
- a public IPv4 address.

Software: Ubuntu, Apache and PHP 8.2, the same versions SiteGround runs now. The app has no database, so nothing needs converting.

How it compares with SiteGround on processing:
- **SiteGround GrowBig:** 2,000 CPU-seconds an hour, about half of one processor all the time.
- **Lightsail $24:** a 20% baseline on each of its 2 processors, about 0.4 of one processor all the time. It can burst to the full 2 processors when it has saved up credit by idling.

The two are about even for normal use. The difference is that the server would be ours alone, with no file-count limit.

If it turns out to be too small, the next size up is **8 GB for $44 a month** (30% baseline). Changing size takes about 15 minutes, from a snapshot.

## Monthly cost

| | Per month | Source |
|---|---|---|
| Lightsail Medium 4 GB | $24.00 | AWS Lightsail bundles page (official), 4 Nov 2026 |
| Daily automatic snapshots, 7 kept | about $1-3 (estimate) | $0.05 per GB-month, from third-party guides and an AWS re:Post answer; not confirmed on an official AWS page |
| Fixed IP address | $0 while attached to the server | AWS Lightsail |
| **Total** | **about $25-27** | |

For comparison, our October notes put SiteGround GrowBig at $4.99 a month for the first year, then $29.99 a month. Recent review sites quote $24.99-29.99 for the renewal. **Check your SiteGround billing for what you actually paid and the renewal date.** If this year is prepaid, moving early doesn't get that money back.

**Money isn't the reason to move.** After SiteGround's first year the two cost about the same.

## Why move (and why not yet)

**What moving gets you:**
- No file-count limit. We're at 61% of SiteGround's limit.
- Real scheduled jobs.
- A place to run the help-desk watcher, so help replies don't wait for your laptop.
- Room for more paying installs.

**What it costs you:** upkeep becomes ours. That covers security updates, SSL renewals, the firewall, watching the disk, and any 2 am outage. I'd set most of it to run by itself (automatic security updates, certificate renewal, an alert when something breaks), but it's still ours to fix.

**When to move:** before SiteGround renews, or sooner if any of these happens:
- a second or third paying install;
- Site Tools shows CPU warnings;
- you want help replies running around the clock.

Until then, clearing old upload backups is the cheap fix for the file count.

## Steps

| # | Step | Who | Time |
|---|---|---|---|
| 1 | Create the AWS account (your card, your login, two-factor on) and give me access for the server only | **Matthew** | 20 min |
| 2 | Buy the $24 server in Oregon (us-west-2), attach a fixed IP address, open only the web ports and SSH | Me, **on your go** | 15 min |
| 3 | Set the server up: Apache, PHP 8.2 with the same modules, automatic security updates, firewall, the SSL certificate tool, a disk alert | Me | 2-3 hours |
| 4 | Copy everything across with checksums. This is the same method as the 9 Oct move, which copied 1,230 files with no misses | Me | 1-2 hours |
| 5 | Re-create the scheduled jobs as real server jobs: storm update, push alerts (both), morning/hourly email, nightly backup, social queue, prospect sends, site visitors. Then remove the piggybacking on the 5-minute job | Me | 1 hour |
| 6 | Test all six apps, the practice copy and the desk on the new server **before** the address moves, using the read-only check accounts | Me | 2 hours |
| 7 | Move DNS. traverseplatforms.com's DNS is on SiteGround today, so the records (Google mail, DKIM, DMARC, site verification) are copied to Porkbun first. SiteGround's managed SPF line gets replaced with Google's own. Then the nameservers change | Me, **on your go** (nameserver change) | 30 min, then up to a day to spread |
| 8 | Final top-up copy of the data during a quiet hour (evening, no jobs running), so no lead or job falls in the gap | Me | 30 min |
| 9 | Check that sign-ins and phone alerts carried over. The web address is the same and the sign-in and alert keys move with the data, so nobody should need to sign in again (the 9 Oct move changed address, which is why it did). Checked on one phone first; if alerts dropped, people turn them back on | Me, then everyone only if needed | 15 min |
| 10 | Keep SiteGround untouched for 2 weeks as the fallback, then cancel it | **Matthew** | |

**Total:** about a day of my work plus the DNS wait. Your part is steps 1, 2, 7 and 10.

## If something goes wrong

Until step 10, going back is one DNS change: point the address back at SiteGround. Any data written on the new server in the meantime gets copied back first.

## Not decided yet

- **Help-desk watcher on the server.** It needs Claude Code signed in on the server under your plan. That's a separate step after the move. It isn't needed to move.
- **Region.** I'd pick Oregon (us-west-2), the closest US region with the full Lightsail range. Ohio is the alternative.

## Sources

- [Lightsail instance bundles (AWS, official)](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html): prices, memory, disk, transfer.
- [Lightsail baseline CPU performance (AWS, official)](https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html): 20% baseline on the $24 plan, 30% on the $44 plan.
- Snapshot rate of $0.05 per GB-month: [AWS re:Post answer](https://repost.aws/questions/QUKkMBBhiGRNOOkFCMr9HnAA/lightsail-backup-issue-cost) and [cloudburn.io guide](https://cloudburn.io/blog/amazon-lightsail-pricing). Secondary sources.
- SiteGround renewal: [comparedge.com cost guide](https://comparedge.com/tools/siteground/cost-guide) ($24.99) and [tooltester.com](https://www.tooltester.com/en/blog/siteground-pricing/) (up to $29.99). Review sites, not SiteGround itself.
- Our server figures (9.6 GB, about 247,000 files, PHP 8.2.35, Google SMTP) were measured over SSH on 4 Nov 2026.

## Fact-check log

- **Verified:** Lightsail $24 = 4 GB / 2 vCPU / 80 GB / 4 TB, and $44 = 8 GB / 160 GB (official AWS page, 4 Nov). The 20% and 30% baselines (official). Server size, file count, PHP version and mail route (measured today).
- **Corrected:** last night I said Jen would have to sign in again. That was true of the 9 Oct move, which changed address. This one keeps the address, so she shouldn't.
- **Unconfirmed:** the snapshot price (secondary sources only). SiteGround's renewal price and what Matthew actually pays: sources disagree, so it's left for his billing page.
