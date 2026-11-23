# Peak: connecting the accounts so metrics pull automatically (23 Nov 2026)

What Matthew does, step by step, so the nightly pull can read each source. Everything read-only. Codes and tokens go only into `~/.ssh/` on
the cloud computer (never into chat, email or the repo).

## Already connected
- **CourtReserve** and **Patch Retention**: nightly at 2:30 am (tools/nightly-pull.sh).

## 1. Google Business Profile (calls, website clicks, directions, searches, reviews)
Source: Google's own prerequisites page (developers.google.com/my-business/content/prereqs, read 23 Nov 2026).
1. **Accept Tyler's invitation** with **m.sharpe@traverseplatforms.com**. Google requires the person who applies to be "an owner/manager on
   your business's GBP".
2. **Apply for API access:** https://support.google.com/business/contact/api_default → choose **"Application for Basic API Access"**.
   - Google Cloud project number: **808186776004** (the Assistant's project; sign in to console.cloud.google.com with the account that owns
     it to confirm: Dashboard → Project info).
   - Email: m.sharpe@traverseplatforms.com. Website: peakpickleball.us.
   - Use: "Read-only reporting of Business Profile performance (calls, website clicks, direction requests, search views) and reviews for a
     client business we manage, Peak Pickleball, one location."
   - Google's rule: the profile must be **verified and active 60+ days** (Peak's is) with a website on it.
3. **Wait for approval.** Google emails after review; no timeline is published. In the Cloud console the Business Profile API quota shows
   0 per minute until approved, 300 once approved.
4. **Then:** enable the Business Profile APIs in that project and sign in once (scope business.manage); the nightly pull adds GBP.
- **Until then:** screenshot the Profile's Performance tab and the review count/star rating once now (day-one value) and weekly.

## 2. Facebook and Instagram (reach, followers, engagement)
Peak's connection must live in **Peak's own Meta business portfolio**, not in the Sixfold 365 portfolio our "Pipeline" app sits in.
1. In Meta Business Suite (business.facebook.com), pick **Peak's portfolio** → Settings → Users → People: check your access. Making a
   reporting user needs **Full control** (admin). If Cammie gave partial access, ask her for full control, or ask her to do steps 2-4.
2. Settings → Users → **System users** → Add → name **"Peak reporting"**, role **Employee**.
3. **Assign assets** to it: Peak's Facebook Page and Instagram account, read-only (insights / view content only).
4. **Generate a token** for it (an app is needed: if Peak's portfolio has none, create one at developers.facebook.com under Peak's portfolio,
   type Business, name "Peak reporting"). Expiry: **Never**. Permissions: pages_show_list, pages_read_engagement, read_insights,
   instagram_basic, instagram_manage_insights.
5. **Save it only on the cloud computer:** in the VS Code terminal run `cat > ~/.ssh/peak-meta-token.txt`, paste the token, press Enter,
   then Ctrl+D. Tell Claude it's there. The nightly pull adds Page and Instagram insights; nothing is ever posted.

## 3. WordPress (site content, forms, fixes later)
- Login received (shared "peakadmin"; stored in ~/.ssh/peak-wordpress.json). Looked at read-only on 23 Nov: 21 plugins, Avada theme,
  Yoast SEO, Ninja Forms, Meta Pixel plugin (pixel 624560343236394), Google Analytics tag G-WDBWJ1Q6HN, no Site Kit, 4 plugin updates
  waiting, **"Privacy Policy" page is an unpublished WordPress draft** (the published one is only for a "PeakDB Court Reserve Watcher").
- Next: ask Tyler (or Wes) for a **login in Matthew's own name**, then make an **Application Password** under it (Users → Profile) so the
  nightly reads never use the shared admin login. Change nothing on the site until Tyler OKs each change.
- Worth telling Wes: **WP File Manager** is active; it's a plugin attackers target often. Remove it if nobody uses it.

## 4. Google Analytics (website visitors, sources, ad clicks)
- Not granted yet, and not visible from WordPress (no Site Kit). Ask **Wes (wes@lighthousewd.com)**, who built the site, to add
  m.sharpe@traverseplatforms.com as a **Viewer** on property **G-WDBWJ1Q6HN**. Then the nightly pull adds GA.

## 5. Meta ad account (ad spend and results)
- Comes with the ad budget approval (the ask on hold).
