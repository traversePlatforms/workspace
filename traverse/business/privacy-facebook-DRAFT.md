# DRAFT: Facebook additions for Meta's App Review (not published)

Written 30 Oct 2026 for TR-45, from Meta's App Review requirements as summarised in `traverse/ops/meta-app-review-facebook-leads.md` §4.
Matthew to read; the privacy policy was attorney-approved, so this addition should go past the attorney before it goes live.
Publish only once the Traverse Meta app exists (it names the app's permissions).

---

## 1. New section for the privacy policy: "Facebook lead ads"

**Connecting a Facebook Page.** A company using Traverse can choose to connect its own Facebook Page so that people who fill in the
company's Facebook or Instagram lead-ad forms appear in the company's pipeline in its Traverse app. Nothing is read until a company's
admin connects a Page, and only the Pages that admin allows.

**What we read, after a company connects:**
- the list of Pages the admin allowed;
- those Pages' lead forms (their names and questions);
- the answers people submit on those forms (typically name, phone, email, address and the form's own questions);
- the names of the ad, ad set, campaign and form each lead came from.

**Why.** To put each lead into that company's own pipeline in its Traverse app, and to alert the person the company chose. We do not
sell this information, use it for advertising, share it with other companies, or use it to train AI.

**Who sees it.** The company's own users who can see its pipeline, and Traverse support when helping that company. It is stored on
Traverse's hosting provider in the United States.

**Access tokens.** The permission Facebook gives us is kept encrypted on our server, never shown to anyone, and deleted when the company
disconnects.

**How to stop it.** In the app: Setup › Facebook leads › Disconnect, which removes Traverse's permissions at Facebook and deletes the
tokens. Or on Facebook: Settings › Business integrations › Traverse › Remove.

**Keeping and deleting.** Leads already brought in become the company's customer records in its own app. They stay until the company
deletes them or its subscription ends, under the Subscription Agreement's deletion terms. A person who filled in a form can ask the
company, or Traverse at hello@traverseplatforms.com, to delete their information.

**Meta's terms.** Our use of information received from Meta follows the Meta Platform Terms.

---

## 2. Data deletion instructions (a short public page; Meta asks for its address)

Suggested address: `https://traverseplatforms.com/privacy/#facebook-data` (an anchor on the privacy page) or `/data-deletion/`.

> **Deleting Facebook data from Traverse**
>
> **To stop Traverse reading your Page's leads:** in your Traverse app go to Setup › Facebook leads › Disconnect, or on Facebook go to
> Settings › Business integrations, find Traverse and choose Remove. Either way, Traverse's access ends and the stored permission is deleted.
>
> **To delete leads already brought in:** the company deletes them in its pipeline, or emails hello@traverseplatforms.com from the
> account's admin address. If you filled in a company's form and want your details removed, ask that company, or email us and we will pass
> it on.
>
> We confirm every deletion request within 30 days.

---

## Fact-check log
- What is read, why, tokens, disconnect behaviour: from the built feature (api/fb-leads-lib.php, Setup › Facebook leads) as described in
  `traverse/ops/meta-app-review-facebook-leads.md` §1 and §4.
- "Stored in the United States": SiteGround hosting, as in the existing privacy policy's processor list. Not re-verified tonight.
- Contact address hello@traverseplatforms.com: the site's contact address since 30 Oct (reaches Matthew).
- Unresolved: whether the attorney wants the deletion page separate from the privacy page; the 30-day confirmation window is the doc's
  suggestion, Matthew's call.
