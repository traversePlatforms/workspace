# Free-map follow-up: address check, 22 Nov 2026

**Nothing on the desk was changed, queued or sent.** Read-only copy of the desk's events log and seed, DNS lookups only (no mail-server probing), run on the cloud VM (`~/prospects/mxcheck`).

## Read this first

The desk's log shows the "Following up from Matthew at Traverse" follow-up was already sent: **1,210 messages, 8 to 12 Nov** (queued 8 Nov on Matthew's go, "free-map follow-up"). Only 2 bounces were logged after 8 Nov. The draft file still says "Not queued", so it is out of date. The list below is the draft's audience as the draft defines it (roofing and lawn, got the main email, not bounced, unsubscribed, past "Emailed", or sent the free-map email), so **1,191 of the 1,230 have already had this follow-up**; only **39 have not**. If the new run is meant for a different or later round, this check still holds for those addresses.

## Counts (1,230 addresses, 695 domains)

| Result | All | Not yet followed up |
|---|---|---|
| Would bounce | 0 | 0 |
| Risky | 41 | 22 |
| Fine | 1,189 | 17 |

Why so clean: the earlier checks (6 Nov MX check, 2 Nov bounce scan, `mailbad` flags) already took out the bad ones. 69 first-send bounces, 4 mail-check flags, 1 unsubscribe and 8 addresses edited away were excluded before checking, and so were 200 other-trade companies, 12 who got the free-map email and 4 whose status moved on.

## Risky (41): what he would remove or look at

- **39 are the same address on two or three company records** (21 distinct addresses). Examples: Superior Roofing (3 records, bids@superiorroofing.com), Family Roofing (3, roofinglady@gmail.com), Colorado Tree (3, coloradotree@comcast.net), Rocky Mountain Roofing (2, edith@rockymountainroofing.com), Keystone, Heritage, Black Roofing, Armour, Highland, Patriot and others. They deliver, but one inbox gets two or three copies. Keep one record per address. Most of the 22 risky rows not yet followed up are these.
- **1 placeholder-looking address**: PHASE ONE LANDSCAPES, INC., email@phaseonelandscapes.com ("email@" is often a website template line). The domain takes mail and no bounce was logged on the first send, so it is a judgement call.
- **1 odd address**: Resolute Painting & Roofing, whose address local part is a whole sentence of services (resolutepaintingroofingfreeestimates...). The domain takes mail, so it probably works; it looks scraped.

## What the checks covered

1. Syntax and typo domains (gmial, yahooo, .con and similar): none found.
2. Domain lookup, MX or address fallback, null MX: every domain has an MX record, none null.
3. Already bounced in the first send (86 bounce records and the hourly bounce scan) and duplicates across companies: bounced addresses were removed beforehand; duplicates listed above.
4. Role and no-reply addresses (noreply, donotreply, postmaster and similar): none found.

Limits: DNS only, so a mailbox that does not exist on a working domain will still bounce. Two bounces landed after the 8 Nov send, so a few per thousand is normal.

## Files

- Full list with a reason per row: `traverse/prospect-desk/drafts/followup-email-check-2026-11-22.csv` (columns: id, company, email, result, reason, followed_up_8nov). Gitignored, not committed. Copy also in `desk-data-local/`.
- Check script: `traverse/prospect-desk/tools/email-check.mjs`.
- Candidate list and raw desk copies (events log, seed, bounce scan, all dated 2026-11-22): `traverse/prospect-desk/desk-data-local/` (gitignored).

## Fact-check log

- Verified: counts from the live events log and seed pulled 22 Nov; every domain looked up.
- Corrected: the draft's "Not queued" status is wrong, the follow-up went out 8 to 12 Nov.
- Unresolved: whether this run is meant to repeat the follow-up or is a second round.
