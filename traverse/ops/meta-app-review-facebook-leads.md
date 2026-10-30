# Facebook lead ads for client installs: what Matthew submits to Meta

Written 30 Oct 2026, with the build (api/fb-leads-lib.php, api/fb-oauth.php, tools/fb-leads.php, Setup › Facebook leads).
Sources are Meta's own developer docs, read 30 Oct 2026 (links at the end). Meta changes these screens often: where a
step below doesn't match what the dashboard shows, the dashboard wins.

## 1. Where things stand

- **Built and tested against a stand-in for Facebook.** Editions and client installs get Setup › Facebook leads: Connect Facebook,
  pick Pages and forms, match questions to name/phone/email/address/notes, choose who gets new leads (nobody yet / one person /
  take turns) and whether they get an alert, Check now, Disconnect. The leads come in every 5 minutes on the cron that already
  exists (traverse-tools/push-alerts.sh runs fb-leads.php for each install). Sixfold 365 is untouched: it keeps its own job.
- **Polling, not Meta's webhook.** The leadgen webhook needs the app Live with Advanced Access, a public endpoint that checks
  X-Hub-Signature-256, and each Page subscribed (`POST /{page}/subscribed_apps`, which needs `pages_manage_metadata`). Polling
  needs none of that and works today. The webhook can be added after approval as a "check now" ping.
- **What the read-only check of the existing Meta app found (30 Oct):** the app the Sixfold job uses is
  **"365 Aeration and Seeding leads" (app id 2270622310394133)**. Its system user ("Pipeline") token never expires and has
  `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `ads_management`,
  `ads_read`, `business_management` and more, on two Pages: Sixfold 365 and Surge Inc. `/me/businesses` returned nothing for that
  token, so I could not see the business or its verification status. Nothing was changed.

## 2. Do this first: a Traverse app, not the 365 one

The 365 app's name, business and Pages are Sixfold's. Meta reviews an app against the business that owns it, and Business
Verification has to be for the company that serves the clients, so the client feature needs **its own app owned by Traverse
Platforms LLC.** Leave the 365 app exactly as it is for Sixfold.

1. business.facebook.com: make (or pick) a **business portfolio for Traverse Platforms LLC**. Matthew as admin.
2. developers.facebook.com › My Apps › Create app › use case **"Other"** › app type **Business** › name it "Traverse",
   contact email m.sharpe@traverseplatforms.com, business portfolio = Traverse Platforms LLC.
3. Add the product **Facebook Login for Business** › Configurations › Create configuration:
   - Name: "Traverse lead ads".
   - Login variation: General.
   - Access token: **System-user access token** (a business integration system user token: it never expires and belongs to the
     client's business, best for a 5-minute server job). Meta only offers this to apps set up as a Tech Provider; if the
     dashboard doesn't offer it, pick **User access token** (the server swaps it for a 60-day token and keeps the Pages' tokens,
     which don't expire; if Facebook ever stops accepting it, the app shows "Needs reconnecting" and tells the admins).
   - Assets: **Pages** (and Ad accounts only if the ad spend part in section 8 is built).
   - Permissions: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, `ads_management`,
     `business_management`. (Meta's permissions reference lists `leads_retrieval` as depending on these plus `ads_read` and the
     "Ads Management Standard Access" feature. Add `ads_read` too if the dashboard insists.)
   - Copy the **Configuration ID**.
4. Facebook Login for Business › Settings › **Valid OAuth Redirect URIs**: `https://traverseplatforms.com/api/fb-oauth.php`.
   Client OAuth login and Web OAuth login on; Enforce HTTPS on.
5. App settings › Basic: App ID and App secret (Show). Put them on the server (never in git, never in chat):

   `~/www/traverseplatforms.com/traverse-shared/meta-app.json`, chmod 600:
   ```json
   {"app_id": "<App ID>", "app_secret": "<App secret>", "config_id": "<Configuration ID>", "graph": "https://graph.facebook.com/v23.0"}
   ```
   The tokens are sealed with the key that mail sign-in already uses (traverse-shared/mail-oauth.key); nothing else to make.
6. Deploy (deploy-app.sh already ships fb-oauth.php, fb-leads-lib.php and traverse-tools/fb-leads.php).

## 3. What works the day the file is on the server (before App Review)

The app starts in Development mode with Standard Access. Meta: permissions can be requested from anyone with a role on the
app, and an app used only by people with a role (or in a claimed business) doesn't need App Review.

- **Matthew, and anyone he adds as an app Tester/Developer** (App roles › Roles), can press Connect Facebook in any edition or
  client install and connect Pages they manage. Good for testing on TraverseRoofing with a real Page and a test lead.
- **Traverse's super admin can also paste a token** (Setup › Facebook leads › "Connect with a token (Traverse only)"): a system
  user's token from Business Settings › System users (with the Page assigned to that system user), or one Page's own token.
  This is how a first client can go live before approval: they add Traverse's business as a partner on their Page (Business
  Settings › Pages › Assign partners, with Leads access), Matthew assigns the Page to a Traverse system user and pastes its token.
- **Test leads without spending money:** Meta's Lead Ads Testing Tool, developers.facebook.com/tools/lead-ads-testing, pick the
  Page and form, Create lead. Then Setup › Facebook leads › Check now.
- Anyone else pressing Connect Facebook before approval: Facebook refuses them on its own screen. The app says "Not connected".

## 4. Before submitting: settings, privacy policy, deletion

App settings › Basic (Meta's App Review "Content" page lists these):

| Field | Value |
|---|---|
| App domains | traverseplatforms.com |
| Privacy Policy URL | https://traverseplatforms.com/privacy/ |
| Terms of Service URL | https://traverseplatforms.com/terms-of-use/ |
| User data deletion | Data Deletion Instructions URL (see below) |
| App icon | 1024 × 1024, the Traverse mark |
| Category | Business and Pages |
| Contact email | m.sharpe@traverseplatforms.com |

**⚑ The site is behind its password.** Google's branding check already failed for this reason. Meta's reviewers must be able
to open the privacy policy, the deletion page and the app itself. The privacy and deletion pages at least have to be public
before submitting.

**Privacy policy: add a Facebook section** (it already covers the Gmail/Microsoft send-only sign-in and Anthropic):
1. What Traverse reads, only after a company's admin connects: the list of Pages they allow, those Pages' lead forms (names and
   questions), and the answers people submit on those forms (typically name, phone, email, address and the form's own questions),
   plus the ad, ad set, campaign and form names a lead came from.
2. Why: to put each lead into that company's own Pipeline in its Traverse app, and to alert the person the company chose. Nothing
   else: not sold, not used for advertising, not shared with other companies, not used to train AI.
3. Who sees it: the company's own users with access to its Pipeline, and Traverse support. Stored on Traverse's hosting
   (SiteGround, US).
4. Tokens: kept encrypted on the server, never shown to anyone, deleted when the company disconnects.
5. How to stop it: Setup › Facebook leads › Disconnect (removes Traverse's permissions at Facebook and deletes the tokens), or
   on Facebook: Settings › Business integrations › Traverse › Remove.
6. Retention and deletion: leads already brought in are the company's customer records in its own app; they stay until the
   company deletes them or its subscription ends (the Subscription Agreement's deletion terms apply). A person who filled in a
   form can ask the company, or Traverse at the contact address, to delete their data.
7. A statement that use of information received from Meta follows the Meta Platform Terms.

**Data deletion instructions page** (Meta accepts either a callback or an instructions URL; the callback is for user data from
Facebook Login, and Traverse keeps no Facebook user profile data, only the company's tokens and its leads). A short public page,
e.g. https://traverseplatforms.com/privacy/#facebook-data, saying: to remove Traverse's access, Disconnect in Setup ›
Facebook leads or remove Traverse under Facebook Settings › Business integrations; to delete leads, the company deletes them in
its Pipeline or asks m.sharpe@traverseplatforms.com; we confirm within 30 days.

## 5. Business Verification (Traverse Platforms LLC)

Meta: apps that request Advanced Access, or that let other businesses access their own data, must be connected to a business
that has completed Business Verification; it's done once per business. Business Settings › Security Center › Start
verification (business admin only). Have ready: legal name exactly as filed (Traverse Platforms LLC), address, phone, the website
(public, with the same name), and an official document showing the name and address (Meta's Help Center lists what it accepts:
articles of organization, EIN letter, a utility or bank statement, and so on). Meta may also ask to verify the domain (a DNS TXT
record at SiteGround, or a meta tag). The old separate "Access Verification" for Tech Providers is no longer required (Meta's
page says so).

## 6. App Review: what to submit

App Review › Permissions and features › request **Advanced Access** for each permission in the configuration (and
`public_profile`, which Meta says Facebook Login for Business needs before going live). For each one Meta asks how the app uses
it and wants a screen recording. One recording can cover all of them if every permission's use is visible in it.

**Screen recording script** (English UI, captions on anything not obvious; Meta asks for the whole flow from signed out):
1. Open the app signed out (a demo install, e.g. TraverseRoofing), sign in with the reviewer code. Caption: "A roofing company's
   admin signs in to their Traverse app."
2. Office › Setup › Facebook leads. Caption: "The company connects its own Facebook Page so its lead ads reach its pipeline."
3. Press **Connect Facebook**. Facebook's Login for Business dialog: pick the business, pick the Page, review the permissions,
   Continue. (Shows `pages_show_list`, `business_management`.)
4. Back in the app: "Facebook connected · 1 Page". Tick the Page. Press **Show the forms and what each question fills in**: the
   form's questions with Name / Phone / Email / Address / Notes. Caption: "Traverse reads the Page's lead forms and their
   questions." (`pages_read_engagement`, `pages_manage_ads`, `leads_retrieval`.)
5. Who gets new leads: Take turns between two people, Alert them: On. Save.
6. In another tab, the Lead Ads Testing Tool: create a test lead for that form.
7. Back in the app: **Check now** → "1 new lead in the Pipeline". Open the Pipeline: the lead with name, phone, email, the
   form answers, "Facebook ad", the form and Page. Caption: "The lead is retrieved with leads_retrieval and lands in the
   company's pipeline, assigned to the next person." (`leads_retrieval`, `ads_management` for the ad/campaign names.)
8. Setup › Facebook leads › **Disconnect** › confirm. Caption: "Disconnecting removes Traverse's permissions and deletes the tokens."

**Permission notes to paste** (one per permission):
- `leads_retrieval`: "Traverse is a CRM for field-sales companies. A company's admin connects its own Facebook Page; every 5
  minutes Traverse retrieves new leads from the forms the admin chose and adds them to that company's pipeline, so the sales team
  can call them. Used only for the advertiser's own leads, on their request."
- `pages_show_list`: "After login we list the Pages the admin granted so they can choose which Pages' lead forms come in."
- `pages_read_engagement`: "Required to read the Page's lead forms (names and questions) so the admin can choose forms and match
  each question to a field in their pipeline."
- `pages_manage_ads`: "Lead forms belong to the Page's ads; Meta requires it with leads_retrieval to read the Page's forms and
  leads."
- `ads_management`: "Required by Meta with leads_retrieval to read the ad, ad set and campaign names on each lead, shown on the
  lead so the company knows which ad produced it. We do not create or change ads."
- `business_management`: "Facebook Login for Business: the admin picks their business portfolio and the Pages it owns; needed for
  Pages owned by a business portfolio."
- `public_profile`: "Facebook Login for Business: the name of the person who connected, shown as 'Connected as …'."

**Testing instructions for reviewers:** the address of a demo install, a sign-in code for its admin (a demo code only, never a
client's), and: "Setup › Facebook leads › Connect Facebook. Use any Facebook account that manages a Page with a lead form, or
create a test lead with developers.facebook.com/tools/lead-ads-testing after connecting." Meta: if reviewers cannot get into the
app to test, the whole submission is rejected.

**Data handling questions** (Meta asks these for Advanced Access): data processors = SiteGround (hosting, US); no other
service gets Platform Data; no sharing or sale; deletion as in section 4; who in the company can see it (the client's own users,
Traverse support); responsible person = Matthew Sharpe.

After approval: switch the app to **Live**. Every company can then Connect Facebook itself. Meta's Data Use Checkup comes
yearly; keep the privacy policy current.

## 7. If something stops

- A connection Facebook no longer accepts (password changed, access removed, token expired): the install marks it "Needs
  reconnecting", tells its admins once in the app, and the cron prints it once. Connect again fixes it.
- A form or Leads Access problem: the screen shows Facebook's words; the cron prints it once. The usual cause: the person who
  connected has no Leads access on the Page (Meta Business Suite › Settings › Leads access).

## 8. Ad spend on the Stats page (noted, not built)

Meta's Insights API reads real spend: `GET /act_{ad-account-id}/insights?fields=spend,impressions,actions&time_range={"since":
"YYYY-MM-DD","until":"YYYY-MM-DD"}` (or `date_preset`), per account or per campaign (`/{campaign-id}/insights`). It needs
`ads_read` (Advanced Access, same review) and the client granting its **ad account** as an asset in the login configuration
(add "Ad accounts" to the configuration's assets). With that, a nightly pull could fill the Stats page's ad spend instead of
typing it. Not built tonight: the editions Stats page is being built by another agent right now, and the spend should land in
whatever it stores. Small once that exists: one call per connected ad account per night.

## Sources (Meta's own docs, read 30 Oct 2026)

- Facebook Login for Business: developers.facebook.com/docs/facebook-login/facebook-login-for-business
- Retrieving leads: developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
- Leadgen webhooks: developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen
- Permissions reference: developers.facebook.com/docs/permissions
- Long-lived tokens: developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
- App Review: developers.facebook.com/docs/app-review and .../resp-plat-initiatives/individual-processes/app-review/content
- Screen recordings: developers.facebook.com/docs/app-review/submission-guide/screen-recordings
- Business Verification: developers.facebook.com/documentation/development/release/business-verification
- Access Verification (no longer required): developers.facebook.com/docs/development/release/access-verification
- Data deletion callback: developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
- Insights API: developers.facebook.com/docs/marketing-api/insights
