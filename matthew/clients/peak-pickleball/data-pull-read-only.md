# Peak: pulling data without changing anything (4 Nov 2026)

Matthew sent the permission request on 4 Nov (wording: [data-permission-email-2026-11-04.md](data-permission-email-2026-11-04.md)). **Nothing gets pulled until Peak replies.** Pull only what the reply allows. Matthew: "we must do it in a way that doesnt alter anything that they have going on."

**Where files go:** `matthew/clients/peak-pickleball/data/`. It's kept out of git, so it's not in the GitHub copy or the Drive backup either; it lives on this laptop only. Save Peak's reply there too, next to the exports.

## CourtReserve: safe

- Running any report under **Reports** and using **Export to Excel / PDF**. Reading and exporting changes nothing.
- Looking at Settings pages without saving.

## CourtReserve: don't

- **Don't use the action buttons on report results:** email or text the list, change membership, assign or cancel. They act on real members.
- Don't save report filters or presets. They change the screens Peak's staff see.
- Don't press **MembersFirst Export**, and don't create or reset API logins under Settings > Additional Features > API. They can start a sync or break a connected tool.
- Don't press Save on any Settings page, even with nothing changed.
- Don't touch members, bookings, events, staff accounts or prices.

## Microsoft 365: safe

- **Billing > Bills & payments** and **Users > Active users**: reading only.
- **Message trace** (Exchange admin center): which vendors email them, without opening anything. Only if the reply covers it.

## Microsoft 365: don't

- **Don't give yourself access to anyone's mailbox** (Full Access, delegation, eDiscovery roles). Each of those is a change to their system that their staff can see.
- Don't run content searches across mailboxes. In Purview they create saved search records, and the reply has to allow them.
- **Don't register an app** (Graph API), and don't change users, licences, rules or settings.
- For the invoices: the simplest no-change route is to **ask the owner to forward** the CourtReserve and email-service invoices to Matthew's own address.

## First pull, once allowed (no names in it)

Membership Status, Court Utilization, Event Summary, Attendance Summary and Attendance Heat Map, for the last 12 months; plus the invoices. Member and guest lists wait until the systems build (TASKS X-13) is green-lit.
