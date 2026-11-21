# Peak Pickleball corporate sponsorships — Brandon + Matthew (2026-10-19)

**The arrangement (proposed, nothing signed):** Brandon sells corporate sponsorships for Peak Pickleball (Colorado
Springs); Matthew provides the infrastructure (prospect lists, sponsor pipeline, proposal maker, tracked QR codes,
monthly sponsor reports, inventory and renewal tracking). Paid by commission. Peak offered office space.

**Kept separate from Surge.** Memberships and the nonprofit are a Surge client prospect, filed in
[surge/clients/peak-pickleball/](../../surge/clients/peak-pickleball/README.md). Surge's voice specs and RESTRICTED.md
don't govern this side. Flagged once in the doc: agree with Surge who owns which part before starting.

**The research:** Claude Doc "Peak Pickleball: sponsorships and memberships deep dive"
https://claude.ai/artifact/MSvAAG6Eay4uGbN84RtCaH (private until shared).

## Facts the plan rests on (checked 19 Oct 2026; sources in the doc)

- Peak sells a court sponsorship at $12,000 a year and a title spot at $24,000; it lists 10 title, 15 court and 3 logo
  sponsors for 24 courts, so up to 9 courts may be open (confirm with Peak).
- Agency commission norms: 15–20% on new deals, about 10% on renewals (trade commentary, not a survey).
- Nothing gets built until the commission terms are in writing (the doc lists what to agree).

## Step 1 lists (2026-10-21)

`Peak-Sponsor-Leads-2026-10.xlsx` (built by `tools/build_leads.py`): 41 sponsor leads (8 A-priority), 14 employers with 400+
staff, 5 checked outside prices, a short pitch + tour-invite draft (not sent), and a fact-check tab. Summary added to the Claude
Doc as "Sponsor leads, employers and prices (21 Oct)". Most leads: Colorado Springs Sports Corp 2026 members. Contacts are
mostly "to find"; a paid contact tool needs Matthew's go.

## J.A.R.V.I.S. on the desk (built 2026-11-21, TASKS JV-APPS)

Matthew, 21 Nov: "I need cai brandon and nneka to be able to make changes to the peak application. The goal is to have jarvis handle a
lot of the tasks that they would reach out to me about". A blue chat button on every screen, for every desk sign-in (sellers, expo
accounts, admins; Claude Check only looks). Each person sees their own chats; the admin sees everyone's. Photos (up to 4), voice notes (2
minutes), PDFs in replies, Earlier, Clear, Refresh now. The reply reaches the writer through the desk's own alerts (push per device, the
email heads-up if they turned it on); a tap opens `#jarvis/<id>`. Code: `shared/jv-chat/` (README there), `jvAction()` in api/desk.php,
`jvMount()` in index.html; the chat lives in `peak-desk-data/jarvis/`.

What J.A.R.V.I.S. does (traverse/ops/jarvis-peak-prompt.md): the person's desk work through `php desk.php as "<name>" <action> < body.json`
(the same code as their button, with their role; rows marked `via: J.A.R.V.I.S.`; tours booked this way never email the visitor), bug
fixes and normal changes (tested, then `bash tools/deploy-desk.sh <label>`, which checks live against git, backs up each file, uploads
and compares md5; `--check` sends nothing). `desk.php as` refuses, whoever asks: sending email, the email, booking and desk settings,
prices, packages, proposals, signed deals, P&L, Hunter, devices and alerts. Those, the blasts and Outbox, deleting, accounts and drastic
changes go to Matthew.

Upload since 21 Nov: `bash matthew/peak-pickleball-sponsorship/tools/deploy-desk.sh <label>` (page minified, api/*.php, jv-lib.php and the
server tool jv-tools/jv.php).

## The research account (built 2026-11-21, for Claire)

Role `research` (`php desk.php addaccount "Name" research`). She sees the sponsor and expo cards and may only: add or correct a website
(`site`, sponsors), a phone or a general email (`contact`, `contactedit`), add notes (Mark looked up = a note that starts "Looked up:"), and
run the free look-up of a company's own website (`scan`, never Hunter). `RESEARCH_OK` in api/desk.php is the whole list; everything else
answers 403, from the page and through `php desk.php as` (J.A.R.V.I.S.). Her data has no Inbox, tours, proposals, packages, templates, desk
emails or the words of emails received, and she never owns a company. On the page: Companies and More (Look) only, phones and emails as
text (no call, text or email links), no Remove, no Don't contact, no chat. Her how-to: `matthew/claire/`.
