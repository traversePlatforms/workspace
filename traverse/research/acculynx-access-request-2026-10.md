# AccuLynx integration access request (draft, not sent)

**For:** Matthew to review and send himself, if he wants TraverseRoofing to send booked doors straight into AccuLynx.
**Status:** draft, 2026-10-08. Nothing has been sent.

## Why this is needed

AccuLynx's developer documentation (apidocs.acculynx.com, API V2, read 2026-10-08) says API keys are for AccuLynx's own
customers, and that a business integrating with AccuLynx on behalf of its customers must request access first; doing it
without access "can result in suspension of the AccuLynx account". That would be the roofer's account, so Traverse does not
connect to AccuLynx until AccuLynx says yes.

The request form linked from those docs no longer opens (404 on 2026-10-08). The docs list **api@acculynx.com** as the API
contact, so the request goes there.

Two more facts from AccuLynx's own pages:
- A roofer needs the paid **AppConnections** add-on before their account can make API keys at all, and only a company or
  location administrator can make one.
- AppConnections already lists field-sales apps (Spotio among them), so this kind of integration is one they support.

## What Traverse would send (for the email)

One booked door at a time, from the roofer's own Traverse install: create the contact, create the job in the Lead milestone,
add the initial appointment (the roof walk) and a note with what the rep saw (hail near the house, roof size and material,
year built). Nothing is read back from AccuLynx beyond the IDs needed to link those records.

## The email

> **To:** api@acculynx.com
> **From:** Matthew Sharpe, [email], [phone]
> **Subject:** Integration access request: Traverse (field sales app for roofers)
>
> Hello,
>
> I build Traverse, a door-to-door field sales app for roofing companies. Reps knock doors, book roof inspections and record
> what they saw at the house. Several of the roofers we talk to run their business in AccuLynx, so I'd like to request
> integration access to send their booked leads into their own AccuLynx accounts, as your API documentation asks.
>
> What the integration would do, only with a customer's own API key:
> - create a contact and a job in the Lead milestone for each door a rep books
> - set the job's initial appointment (the roof inspection the homeowner agreed to)
> - add one note with what the rep recorded (address details, hail history near the house, roof size and material)
>
> It would not read or change anything else in the customer's account.
>
> Company: [Traverse Platforms LLC, once filed / or your name as sole proprietor]
> Website: [traverseplatforms.com, once live]
> Contact: Matthew Sharpe, [email], [phone]
>
> Please let me know what you need from me, and whether there is a partner or AppConnections listing process I should follow
> instead.
>
> Thank you,
> Matthew Sharpe

## Before sending

- **The company line.** Traverse Platforms LLC is decided but not filed, and traverseplatforms.com is not live yet (both
  open in TASKS / memory). Send under your own name, or wait until the LLC and the site exist; AccuLynx may ask for either.
- Use a Traverse email address if you have one by then; a personal address is fine otherwise.

## Fact-check log

| Claim | Source | Result |
|---|---|---|
| API keys are for AccuLynx customers; integrators must request access; failure can suspend the account | AccuLynx API V2 OpenAPI description (apidocs.acculynx.com, Create Contact reference), 2026-10-08 | Verified (quoted) |
| api@acculynx.com is the API contact | Same OpenAPI definition, `info.contact.email` | Verified |
| The linked request form is gone | docs.google.com form URL returned 404, 2026-10-08 | Verified |
| API keys need the paid AppConnections add-on; only admins make keys | Search summaries of AccuLynx's AppConnections pages and a third-party help article | Plausible, not read on acculynx.com itself; confirm with AccuLynx |
| AppConnections lists Spotio, Hover, RoofSnap, Hatch, CallRail, RoofScope | acculynx.com/appconnections (search summary) | Plausible |
| Create Job puts the job in the Lead milestone, unassigned; contact required; notes up to 1,000 characters; initial appointment endpoint exists | apidocs.acculynx.com reference index (llms.txt) and guide | Verified |
