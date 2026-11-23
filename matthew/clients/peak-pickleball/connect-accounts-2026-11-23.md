# Peak: connecting the accounts (full access, read and write)

What Matthew does, step by step, so Claude can read the numbers every night **and make changes when needed**. Tyler has given Matthew
permission to take control of what he needs from these logins (23 Nov 2026).

**Two rules that stay in place whatever the access:**
- Anything that reaches the public (a post, an email or text to members, an ad, a review reply, a site change people will see) waits for
  Matthew's OK on that item, every time.
- Codes, passwords and tokens go only into `~/.ssh/` on the cloud computer, never into chat, email or a document. The command for that is
  in each section.

## Already connected
- **CourtReserve** and **Patch Retention**: pulled every night at 2:30 am. The current keys are used read-only by design. To make changes
  in either (for example switching Patch automations back on), Claude works through the same keys once Matthew says which change.
- **Peak Brand & Marketing Library** (Google Drive, shared by Cammie with m.sharpe@traverseplatforms.com): 41.8 GB of branding,
  memberships, events, leagues, tournaments, sponsors, website, socials content, pro shop and Whistle Pig material, a content calendar and
  the 2026 site map. **Read-only for us:** nothing is ever added, moved or deleted in Peak's own folders.

## 1. Google Business Profile (numbers, reviews, and editing the listing)
Source for the API steps: Google's prerequisites page (developers.google.com/my-business/content/prereqs, read 23 Nov 2026).
1. **Accept Tyler's invitation** with **m.sharpe@traverseplatforms.com**. If it came in as **Manager**, that's enough to edit. Ask for
   **Owner** if you want to add or remove other people yourself.
2. **Apply for API access:** https://support.google.com/business/contact/api_default → choose **"Application for Basic API Access"**.
   - Google Cloud project number: **808186776004** (the Assistant's project; confirm in console.cloud.google.com → Dashboard → Project info,
     signed in with the account that owns it).
   - Email: m.sharpe@traverseplatforms.com (it must be an owner or manager on the profile). Website: peakpickleball.us.
   - Use: "Manage the Business Profile for a client business we look after, Peak Pickleball (one location): read performance (calls,
     website clicks, directions, searches) and reviews, reply to reviews, and keep hours, info and posts up to date."
   - Google's rule: the profile must be **verified and active 60+ days** with a website (Peak's is).
3. **Wait for approval.** Google emails after review; no timeline is published. The API quota shows 0 per minute until approved, then 300.
4. **Then:** Claude enables the Business Profile APIs in that project, and you sign in once. The scope Google uses, **business.manage**,
   is full read and write: numbers, reviews and replies, hours, info and posts.
- **Until then:** screenshot the Performance tab and the star rating and review count once now (the day-one value).

## 2. Facebook and Instagram (insights, posts, messages, ads)
This lives in **Peak's own Meta business portfolio**, never in the Sixfold 365 portfolio our "Pipeline" app sits in.
1. **Check your access:** business.facebook.com → pick **Peak's portfolio** → Settings → Users → People → your name. You need **Full
   control** (admin of the business). If Cammie gave partial access, ask her to make you a full-control admin.
2. **Create the system user:** Settings → Users → **System users** → Add → name **"Peak Claude"**, role **Admin**.
3. **Give it the assets with full control:** on the system user → Assign assets:
   - **Page:** Peak Pickleball → **Full control** (everything: content, messages, community activity, ads, insights).
   - **Instagram account:** Peak's → **Full control**.
   - **Ad account:** Peak's (if there is one) → **Manage ad account**.
4. **Make or pick the app:** Settings → Accounts → Apps. If Peak has none, go to developers.facebook.com → My Apps → Create App → type
   **Business** → name "Peak Claude" → business portfolio **Peak's**. Then back in Business Settings, Apps → add it to the system user (Full
   control).
5. **Generate the token:** System users → Peak Claude → **Generate new token** → app "Peak Claude" → **Token expiration: Never** → tick:
   pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_metadata, pages_manage_posts, pages_manage_engagement,
   pages_messaging, read_insights, instagram_basic, instagram_manage_insights, instagram_content_publish, instagram_manage_comments,
   instagram_manage_messages, business_management, ads_read, ads_management → Generate.
6. **Save it on the cloud computer only:** in the VS Code terminal run `cat > ~/.ssh/peak-meta-token.txt`, paste the token, press Enter,
   then Ctrl+D. Tell Claude it's there. Claude checks it (reads only), then the nightly pull adds Page and Instagram insights.
- Posting, replying to messages or comments, and anything with ads still wait for your OK on each item.

## 3. WordPress (the website)
1. **Make your own login** (or ask Wes to): in WordPress → Users → Add New User → your name, email m.sharpe@traverseplatforms.com, role
   **Administrator**. Then change the shared "peakadmin" password, since it went by email.
2. **Make an Application Password** for Claude: sign in as yourself → Users → Profile → scroll to **Application Passwords** → name it
   "Claude" → Add New Application Password → copy it (shown once).
3. **Save it on the cloud computer only:** in the VS Code terminal run `cat > ~/.ssh/peak-wp-app-password.txt`, type your WordPress
   username on the first line and the application password on the second, press Enter, then Ctrl+D.
- That gives full access through WordPress's own API: pages, posts, settings and form entries. Changes people will see (the privacy
  policy, the Ziggi's line, new pages) still wait for your OK on each. Plugin and theme updates go through Wes, since the site is his build.

## 4. Google Analytics and Search Console (website numbers)
- **Analytics (property G-WDBWJ1Q6HN):** ask Wes (or whoever owns it) to add m.sharpe@traverseplatforms.com as **Editor**. Editor
  lets Claude set up conversions and audiences for the ads, not only read. Admin → Property access management → + → Editor.
- **Search Console (peakpickleball.us):** ask to be added as an **Owner** (or a Full user). Settings → Users and permissions → Add user.
- Then you sign in once and the nightly pull adds both.

## 5. Meta ad account (ad spend and results)
- Covered by step 2.3 if Peak has an ad account. If not, one gets made under Peak's portfolio when the ad budget is approved.
