# HOA registry: what we got, and the one request left

**Status 2026-10-03: the HOA list is DONE without a records request.** The narrowed request
below (phone and email only) is drafted and **NOT sent**. Matthew decides whether and who signs.

## What happened

The original plan was an open-records (CORA) request for the state HOA registry. While checking
where to send it, the Division of Real Estate's own records page turned out to say it is
"regularly asked for lists of licensees or HOA registrations. This is publicly available
information," and points to a free roster generator instead.

So the list was downloaded the same day, free:
`apps2.colorado.gov/dre/licensing/Lookup/GenerateRoster.aspx` -> "HOA - Home Owner's
Association - Active" -> Download -> CSV. **8,596 active HOAs statewide.** Saved as
`hoa-registry/hoa-roster-active-2026-10-03.csv`; `hoa-registry/build-hoa-list.mjs` cuts it to
our ground. Results and method: [hoa-registry/HOA-LIST.md](hoa-registry/HOA-LIST.md).

**What the roster leaves out: phone and email.** It has the designated agent's name and the
mailing address, but not the agent's phone or email, even though registration collects them.

## Is the request still worth sending?

**Probably not first.** About 85% of the in-scope HOAs are professionally managed, and the
management companies publish their own phone numbers. One call to RowCal reaches 166 of them.
Send this only if the self-managed ones (153) turn out to matter.

The roster page also says "This is the only information we collect on HOAs", which may mean the
Division treats agent phone and email as not for release. The letter asks them to say so.

---

**To:** `DORA_DRE_RecordRequests@state.co.us` (the Division's Custodian of Records; requests
must be in writing, and cannot be made by phone)

**Subject:** Open records request: designated agent phone and email, HOA registrations in El Paso, Douglas and Teller counties

Under the Colorado Open Records Act (C.R.S. 24-72-201 et seq.), I request the designated agent
**telephone number and email address**, as recorded at registration under C.R.S. 38-33.3-401,
for each currently active unit owners' association whose community is in El Paso, Douglas or
Teller County.

I already have the public HOA roster from the Division's roster generator, so this request is
limited to those two fields. Please include each association's legal name and credential
number so the records can be matched to the roster.

An electronic file (CSV or spreadsheet) is preferred. If the records cannot be filtered by
county, the same two fields for all active associations is acceptable.

If fees apply, please send an estimate before starting. If any part is withheld, please identify
the part and the basis for withholding it.

I would appreciate a reply by [date].

[Name]
[Sixfold LLC — title]
[Phone] · [Email]

---

## Fact-check log
- **Where to send:** the Division's Open Record Requests page, dre.colorado.gov, read 2026-10-03.
  It says `DORA_DRE_RecordRequests@state.co.us`, written requests only, include a deadline, and
  say whether you want electronic copies. **Corrected:** the first draft sent it to the HOA
  enquiries inbox, which is the wrong one.
- **Fees:** same page. $41.37 an hour for research and retrieval, the first hour free, billed in
  quarter hours. An estimate comes before any work. Not quoted in the letter on purpose.
- **Response time:** same page, citing C.R.S. 24-72-203(3): presumed 3 working days, extendable
  by up to 7 more.
- **Fields collected at registration, including agent phone and email:** the Division's "HOA
  Center Advisory: Registration Changes Pursuant to Section 38-33.3-401", read 2026-10-03, which
  also lists the HB25-1043 additions (delinquency, judgments, payment plans, foreclosures).
- **Roster download and "the only information we collect":** the roster generator page, used
  2026-10-03.
- **Unresolved:** whether agent phone and email are releasable.
