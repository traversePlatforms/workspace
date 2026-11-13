# Sixfold Square audit, 13 Nov 2026

Asked by Matthew after Brandon said Sixfold is short on some things. The pull from Square was read-only (GET requests only), covering 1 Jul to 13 Nov 2026, across both Square locations: **Six Fold Colorado** and **Sixfold 365**. Every payment, refund, bank payout and invoice was checked against the jobs in the Sixfold app.

## 1. Where the money went (the main finding)

Square sends each location's money to whichever bank account that location is set to. From mid-September to mid-October, Six Fold Colorado was set to Matthew's own accounts, not Brandon's business account.

| Location | Paid out to | Dates | Amount |
|---|---|---|---|
| Six Fold Colorado | Stride Bank checking ending 379 (holder Matthew Sharpe) | 8 Sep | $1.00 (the $1 test charge) |
| Six Fold Colorado | Instant transfer to a debit card (Square does not show whose) | 16 Sep | $735.37 |
| Six Fold Colorado | Bank of America checking ending 701 (holder Matthew Sharpe) | 21 Sep, 6 Oct, 7 Oct, 16 Oct | $1,957.73 |
| Six Fold Colorado | Wells Fargo business checking ending 639 (holder Brandon Long) | 23 Oct | $193.10 |
| Sixfold 365 | Wells Fargo business checking ending 639 (holder Brandon Long) | 20 Oct to 13 Nov | $9,315.41 |

**$2,694.10 of Six Fold Colorado card money did not go to Brandon's Wells Fargo.** That's $1 + $735.37 + $1,957.73. It was Kara Rosenstauch's four payments ($750, $750, $550, $550) and Brian Skelton's first $200, after fees. Since 23 Oct, both locations pay into Wells Fargo ending 639.

Square also lists a Wells Fargo ending 639 under Brandon's name that is **DISABLED**. It was probably an earlier attempt that failed verification, so payouts went to the next verified account.

**Still linked and verified, worth removing:**
- Bank of America ending 701 is still on **both** locations.
- Stride ending 379 is still on Six Fold Colorado.
If either location is switched back to one of them, deposits would go there again.

**What this audit can't see:** whether that $2,694.10 was later passed on to Brandon. That needs Matthew's bank statements.

## 2. Square to the bank: it balances

| | Six Fold Colorado | Sixfold 365 |
|---|---|---|
| Card payments taken | $3,001.00 | $9,941.00 |
| Refunds | $0 | -$25.00 (Carlos Perez, "Accidental Charge" 16 Oct; his price was lowered from $200 to $175) |
| Square processing fees | -$60.23 | -$310.56 |
| Instant-transfer fees | -$53.57 | $0 |
| Paid out to banks | $2,887.20 | $9,315.41 |
| Waiting for the next payout | $0 | $290.03 (Chase Gardner, 13 Nov) |

Both columns add up to the cent. Nothing is missing inside Square.

- **Fees total $424.36**: $370.79 in card processing and $53.57 in instant-transfer fees. That's about 3.3% of card sales.
- **The instant-transfer fees came from instant deposits on Six Fold Colorado** in Sep and Oct, at about 1.9% each. Standard next-day deposits are free.
- **Two $0.00 "No sale" entries** (19 Oct, 12 Nov) are a cash drawer opened in the Square app. No money moved.

## 3. Jobs against payments

**28 jobs paid by card match Square exactly.** Each customer's payments, usually a deposit plus a balance, add up to the job price. The two smaller locations of money are:
- Kara's September job ($1,500 over 2 payments), which was before the app.
- A $50 monthly-plan visit for Leann Gunnell, on top of her $50 job.

**Still owed:**

| Customer | Job | Price | State |
|---|---|---|---|
| Daniel Chavez-Rey | 27 Oct, marked done | $403 | **Unpaid.** A $478 pay link went out 27 Oct. On 6 Nov the price was lowered to $403 and a new link sent. Neither was paid. A return visit on 6 Nov (west side) is booked at $0 and is not marked done. |
| Thomas Good | 12 Nov, aeration | $150 | Unpaid and not marked done. Was the job done? |

**Paid outside Square, so check the bank deposit:**

| Customer | Date | Amount | How |
|---|---|---|---|
| Zane Hawkins | 27 Oct | $400 | Check (Jen marked it paid) |
| Shannon Jones | 2 Sep | $1,125 | Check. It was recorded in Square as a check but never passed through Square, so it only reaches the bank if someone deposited it. This is the same "$1,125 check of 2 Sep" the expenses workbook already asks about. |

**Deleted, so not owed:** Rich Rooney's $900 job (11 Nov), and two test or duplicate jobs (Matthwe Sharper, Roy Bojorquez).

## 4. Questions for Brandon

1. What exactly is short, and in which account? If it's Wells Fargo ending 639, section 1 is the likely answer.
2. Did the Shannon Jones $1,125 check and the Zane Hawkins $400 check reach the bank?
3. Daniel Chavez-Rey: is $403 right for both visits together, and who is chasing it?
4. Was Thomas Good's aeration done on 12 Nov?

## Fact-check log

- **Verified:**
  - Every figure comes from Square's API (payments, refunds, payouts and payout entries, invoices, bank accounts), pulled 13 Nov 2026.
  - Job prices and payment states come from the live app's jobs.log and leads.log, copied the same day.
  - Fees are Square's own `processing_fee` and DEPOSIT_FEE entries.
- **Not verified:**
  - Who owns the debit card behind the 16 Sep instant transfer.
  - Whether any money was later moved between Matthew's and Brandon's accounts.
  - Cash, Venmo, Zelle or check money that was never entered in the app.
