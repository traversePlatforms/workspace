# Jen's admin account: build spec (15 Nov 2026)

Matthew, 15 Nov 2026: "So we are building this admin account for jen and giving her almost full access other then some data points which belongs to just me." Jen and Brad are taking over Sixfold, and Matthew and Brandon are moving their focus to Peak, so Jen has to be able to run the whole company from her app.

**Account.** "Jen McPherson", today an `office` account on the Sixfold install, becomes `admin` (never super). Her separate quote-only login "Jen" stays as it is.

**Restriction mechanism.** Everything she must not see hangs on one rule that marks her as an admin who isn't Matthew. Build it as a server-side check, for example `ownerOnly()` = the super admin only, so it also covers any future admin. Every restriction must be enforced by the server, not only hidden in the page.

## Hidden from her (the super admin's only)

1. **Pricing math.** The formula, rates, crew share, gas, bag costs and every cost figure. `a365pricing` must give her the office's hidden view, and `a365pricingset` must refuse her. Price changes go through J.A.R.V.I.S. (help-desk-prompt.md already says so).
2. **Matthew's pipeline.** His leads (`webLead()`: website and Facebook leads from his periods, `fromjen`) stay hidden from her, as they are from the office today (`webHide()`).
3. **Traverse billing and licence screens**, and the billing lock.
4. **Matthew's account and Claude Check.** She never sees them in the account lists, the team, the leaderboard or view-as. The test accounts too.
5. **Other people's J.A.R.V.I.S. chats.** Already live (83337b90): everyone sees their own, and the super admin sees all.
6. **View-as ("see through their eyes").** Off for her.
7. **Usage.** Remove it from her account and keep it in Matthew's.
8. **The skip trace button.** Remove it.

## Accounts

- She can add people and create their codes ("passwords").
- She can't see Matthew or Claude Check.
- She can't change any admin: no edit, remove, new code or sign-out on an admin or super row. She can't make anyone an admin either. That last part is our reading of "she cant make any changes to the admins"; check it with Matthew if unsure.
- **Clear the teams.** Matthew made a team before (team `tc91f3dd5`: Nneka Smith runs it, with Christian Jensen and Bria W). Reset to neutral:
  - nobody on a team
  - no "Runs a team" flags
  - delete the team itself

  Back up the account files first.

## Her home screen ("Today")

- **Call list, not a door list.** Her Today section reflects the pipeline, not doors.
- **"Best neighborhood to knock" becomes "Priority contacts"** from the pipeline, showing only 4–5. Pick them by what makes sense in the app's own terms: due follow-ups, new leads not yet contacted, quotes with no answer. Explain the rule in the report.
- **Remove the lines under the search bar**: "Best near me" and the "N to come back to" line. Remove them from her page entirely.
- **Her quoting and scheduling stay exactly as they've been for her office account.** Where her office screens differ from the admin screens for the Pipeline, Quote builder, Quick quote, Schedule or Jobs board, she keeps her office version. Matthew: "If changes have been made to her quoting and scheduling that isnt them same as it has been for mine then keep those changes the same."
- **Alerts and to-dos.** Everything the office role gets today must keep reaching her:
  - new-lead pushes and the in-app list
  - "Aftercare to send"
  - "Not marked done"
  - Leads to call
  - due follow-ups
  - deposit paid

  Check every `role === 'office'` path in rounds.php and index.html for this.

## Pages

- **Stats page:** keep it, and make sure every number is current and correct.
  - Ad spend: Matthew's 14 Nov figures are in.
  - Close rate.
  - Leads by source.
  - Jobs.
- **Square stats page:** keep it and make sure it's up to date. The all-locations Square read was fixed 15 Nov (ca79ffc5).
- **"My stats" button:** focused on her own work (leads, sales, quotes, bookings, follow-ups), similar to Matthew's own stats view.
- **Results, Training and Agreement terms:** keep. Training changes go through Matthew.
- **Other ways to pay:** keep. She may add her own payment options.
  - Every payment taken any way must be recorded with its method and amount in the job's pay record, so the profit check (sixfold-tools/profit-check.php) can count it.
  - Add that to the profit check: money taken outside Square, by method, per month. Matthew: "i wanna make sure i get paid when im suppose to" (his 5% profit share).

## Messenger into the pipeline

Keep the Messenger preview. Add a button: "Do you want to start adding messages to the pipeline?" If she says yes:

- Messenger conversations go into the Pipeline as their own section, next to To call, Quoted and the rest. Name it Messenger.
- Use the page token the app already reads (eod-report.php reads the conversations).
- Never send a message from the app.
- Each conversation becomes one lead (source `messenger`), deduplicated against existing leads by name, phone or email (the lead-doubles rules).

## Test emails go to Jen

- **Newsletter:** the preview "send me a letter" goes to Jen's email (J.McPherson@365aeration.com), not Matthew's. Matthew gets his in his Claude session.
- **Follow-up letter:** "Send me a test" goes to Jen's email too.
- **Deposits:** add a "Send me a test" button that goes to Jen's email.

## Menus

Remove the J.A.R.V.I.S. item from the left office menu, for Jen and for Matthew. The chat bubble stays on every screen.
