# Jobber app setup (TR-46)

The Jobber connector is built and waiting for keys (2026-10-31). Clients connect their own Jobber account from
**Setup › Sync from another system › Jobber › Connect Jobber**; the app then reads their clients, requests, quotes and jobs every
5 minutes, read-only. Until the keys file below is on the server, the screen shows Jobber exactly as before (in the list that goes
through Zapier or Make).

Jobber has no API keys a company can paste. Traverse registers one app in Jobber's Developer Center, and each company's Jobber
admin allows it (OAuth). Everything below comes from Jobber's developer docs, read 2026-10-31:
developer.getjobber.com/docs (Getting Started, App Authorization, Refresh Token Rotation, Setting up Webhooks, API Versioning,
API Rate Limits, Custom Integrations, App Review Process, Testing Your App).

## What Matthew does (about 20 minutes)

1. **Make a Developer Center account** at https://developer.getjobber.com (sign up). Use m.sharpe@traverseplatforms.com.
   This account is separate from any Jobber business account.
2. **Make a free Jobber developer test account**: the "developer testing signup link" on the Getting Started page. It gives
   90 days with no subscription prompt and is what the first real test connects to. (Extension: email Jobber's API support.)
3. In the Developer Center: **Apps › New**, and fill in:
   - **App name:** Traverse
   - **Developer name:** Traverse Platforms LLC
   - **App description:** one or two lines, e.g. "Brings your Jobber clients, requests, quotes and jobs into your Traverse field
     sales app. Read-only." (Shown only if the app is ever listed in Jobber's App Marketplace.)
   - **Scopes:** read access to **Clients**, **Requests**, **Quotes** and **Jobs**, and nothing else: no write scopes. The
     connector never changes anything in Jobber. (Jobber's docs say scopes are picked on this form and shown to the company on
     Jobber's Allow Access screen; they don't list the exact checkbox labels, so tick the read boxes for those four.)
   - **OAuth Callback URL:** `https://traverseplatforms.com/api/jobber-oauth.php`
   - **Refresh Token Rotation:** leave it **on** (the default; required to publish; the connector handles it).
   - **Manage App URL** (asked for before publishing only): can wait. If the form insists, use `https://traverseplatforms.com/`.
   - **Webhooks** (optional now, required for App Review): topic **APP_DISCONNECT**, URL
     `https://traverseplatforms.com/api/jobber-hook.php`. With it, a company that presses Disconnect inside Jobber is shown as
     disconnected in Traverse at once instead of after the next failed read.
4. Save. The app is now in **Draft**. Copy its **Client ID** and **Client secret**.
5. **Give both to Claude** (or put them on the server yourself) as `traverse-shared/jobber-app.json`, beside
   `traverse-shared/mail-oauth.json`, chmod 600:

   ```json
   {"client_id": "...", "client_secret": "...", "version": "2025-04-16"}
   ```

   Never in git, never in public_html. `traverse-shared/mail-oauth.key` must already be there (it is: the email sign-in uses it);
   the Jobber tokens are sealed with a key derived from it.
6. **First real check:** in a Traverse edition, Setup › Sync from another system › Jobber › Connect Jobber, sign in with the
   developer test account, Allow Access, back in the app: "Connected to <your test account>". Turn it on, Sync now, and check the
   test account's clients show up as customers and leads.

Don't press **Test in GraphiQL** in the Developer Center with a real client's Jobber admin: Jobber's docs say each GraphiQL
session starts a new authorization that invalidates that admin's existing refresh tokens for the app, which would break that
client's connection until they connect again. Use the developer test account for GraphiQL.

## Limits while the app is a Draft

- A Draft app works exactly like a published one, but **API access is blocked if it is connected to more than 5 paying
  Jobber accounts** (developer test accounts don't count as paying). Five client companies on Jobber is the ceiling until
  Jobber approves more.
- Jobber's testing page says: "Mass distribution of URLs to connect to your app is prohibited unless authorized by Jobber", keep
  announcements private until approved, and don't engage existing Jobber customers in testing before coordinating with a Jobber
  developer representative. Its Custom Integrations page says an app that doesn't need more than 5 paying accounts "can remain in
  Draft state", no review needed, but also that custom integrations are "only possible for specific, approved Jobber customers
  (service providers) and developers" and that Jobber's focus is Marketplace apps. **Worth one email to Jobber's API support
  before the first real client connects**, saying what Traverse is (a field-sales app many unrelated companies use) and asking
  whether Draft use with up to 5 of them is fine. That's Matthew's call; I have not contacted Jobber.

## Going past 5 companies: App Review

Via Developer Center › Manage Apps › (…) › **Request Review** and its Pre-Submission Checklist:

- Jobber describes a **lighter review for franchises and multi-location businesses** that run several Jobber accounts of their
  own and need more than five. That doesn't describe Traverse (different companies), so expect the full review below.
- **A full review to be listed in Jobber's App Marketplace.** Jobber says you're ready when: the core features are complete and
  stable; tested end to end on your own Jobber accounts; **Refresh Token Rotation on and subscribed to APP_DISCONNECT**; connect,
  disconnect and reconnect work **both from Jobber's App Marketplace and from inside Traverse**; and you can give the reviewers a
  test login. They meet you for a live demo, test the workflows and edge cases, and review the listing (logo PNG or SVG, square,
  at least 384×384, at most 1 MB; gallery screenshots; features and benefits; Manage App URL). Approved apps usually get about
  two weeks of beta with selected Jobber customers before release.

**Before a Marketplace listing, one piece of work is left on our side:** when a company presses Connect in Jobber's App
Marketplace (instead of in Traverse), Jobber sends no `state`, so our callback can't tell which Traverse install it belongs to.
Today it answers "Connect Jobber from inside the app". A listing needs a step there that signs the person in to their Traverse
install first. Not needed while the app is a Draft.

## How the connector behaves (for support)

- **API version:** `X-JOBBER-GRAPHQL-VERSION: 2025-04-16` (the version Jobber's docs use; versions are supported at least 12
  months and readable up to 18). Jobber warns in its answers as a version nears its end; the warning lands in the PHP error log.
  To move to a newer version, check Jobber's changelog for breaking changes to the fields read (Client, Request, Quote, Job and
  their phones, emails, addresses and properties), then change `"version"` in `jobber-app.json`. No code change.
- **Tokens:** access tokens last 60 minutes and are renewed with the refresh token; with rotation each renewal returns a new
  refresh token, saved before anything else is asked. Both are sealed in that install's private folder (`jobber.json`).
- **Reads:** every 5 minutes (traverse-tools/crm-sync.php --pull, the same job as the other connectors) and on Sync now; only
  records changed since the last read; 50 to a page; a long first read carries on over the next runs. Jobber's limits (10,000
  query points per app and account, 500 back per second; 2,500 requests per 5 minutes) are far above this.
- **What comes in:** clients as customers (as leads while Jobber marks them leads); requests as leads; sent quotes as leads
  (an approved or converted quote marks the lead won; drafts are skipped); finished jobs as past work, scheduled jobs as the
  customer's next visit, unscheduled ones skipped. Same rules as every connector: link ids, fingerprints, nothing deleted in either
  system, each run that brings something is an import that can be undone.
- **When it breaks:** if Jobber refuses the saved connection (disconnected in Jobber, the account churned or downgraded, the
  client secret regenerated, or the app authorized again elsewhere), the screen says "Needs connecting again" and offers Connect
  Jobber again; after an hour of failed 5-minute runs Jobber is paused and the company's admins get an alert ("Sync paused:
  Jobber"), as with the other connectors.
- **Disconnect in Traverse** sends Jobber's `appDisconnect` (so Jobber shows it disconnected and drops the tokens) and deletes
  the tokens here. What came in stays.
- **Regenerating the client secret** in the Developer Center revokes every refresh token: every connected company must connect
  again. Jobber suggests disconnecting them first. Then put the new secret in `jobber-app.json`.

## Files

- `traverse/app/api/jobber-lib.php` (the connector), `api/jobber-oauth.php` (the callback), `api/jobber-hook.php` (the webhook);
  touch points in `api/rounds.php` (Sync from another system) and the page (Setup › Sync from another system).
- On the server only: `traverse-shared/jobber-app.json` (the keys), `traverse-shared/jobber-accounts.json` (which install each
  Jobber account is connected to, for the webhook), `<install>-private/jobber.json` (sealed tokens).
- Tests: scratchpad `ptest-tr48/jobber-test.mjs` against `jobber-mock.php` (55 checks, 2026-10-31).
