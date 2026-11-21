# Claire's Traverse email: steps for Matthew

Claire needs her own Traverse mailbox to send the personal follow-up emails. A new Google Workspace user is a paid seat, so **you make it yourself**; nothing has been created.

**Suggested address:** `claire@traverseplatforms.com`

## Make the user (admin.google.com, signed in as the Traverse admin, M.Sharpe@TraversePlatforms.com)

1. Go to **admin.google.com**.
2. Left menu: **Directory**, then **Users**.
3. Click **Add new user**.
4. First name **Claire**, last name as she gives it. Primary email: **claire**, with **@traverseplatforms.com** after it.
5. Leave "Secondary email" empty unless you want the sign-in details sent to her personal address.
6. Click **Add new user**. Google shows a temporary password: copy it, or use "Send" to email the sign-in details to her. She changes it when she first signs in.
7. Check the licence: open her user, look at **Licences**, and confirm a Google Workspace licence is on (Workspace usually adds one automatically when there's a free seat; if there isn't, it asks you to buy one).
8. Ask her to turn on **2-Step Verification** at her first sign-in (her account, Security).

## Her signature (she does this in Gmail, signed in as claire@)

1. Gmail: the gear icon, then **See all settings**.
2. **General** tab, scroll to **Signature**, click **Create new**, name it "Traverse".
3. Type:

   ```
   Claire
   Traverse
   traverseplatforms.com
   ```

   No phone number unless you give her one to use.
4. Under "Signature defaults", pick it for **new emails** and **replies/forwards**.
5. Scroll to the bottom and click **Save Changes**.

## Before she sends her first email

- Approve the follow-up email script (`matthew/claire/traverse/scripts/follow-up-email-DRAFT.md`).
- Give her the postal address line the desk's emails carry (US law wants one in commercial email, hand-sent included).
- Her mail goes out on traverseplatforms.com, the same domain as the desk's drip. The domain already has SPF, DKIM (google._domainkey) and DMARC, so her mailbox needs nothing extra.
