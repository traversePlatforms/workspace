# Facebook and Instagram: run everything from Traverse

Matthew, 23 Nov 2026: "All of the facebook pages I manage are on sixfold. Id love to have everything transition to traverse since that is my
management company that I manage everything from." Sixfold's OK: given (Matthew, 23 Nov). Traverse Platforms isn't registered yet.

## How it will be organised

```
Traverse Platforms  (Meta business portfolio, owned by Matthew)
 ├─ owns: the Traverse Facebook Page (moved over from Sixfold's portfolio)
 ├─ app "Traverse Claude" + system user "Traverse Claude"   ← the one connection Claude uses for everything
 ├─ partner access: Peak Pickleball's Page, Instagram, ad account      (Peak keeps owning them)
 └─ partner access: Sixfold's Page(s), Instagram, ad account           (Sixfold keeps owning them)
```

Each business keeps owning its own Pages. Traverse gets access as a partner, which is how agencies run client accounts. One login and one
token cover everything, and access can be removed cleanly if a client ever leaves.

**Rules that stay:** anything public (posts, replies, messages, ads) waits for Matthew's OK on each item. Tokens go only into `~/.ssh/` on
the cloud computer, never into chat or email.

## Step 1 done differently (23 Nov): reuse the empty "Sixfold Colorado" portfolio
Meta wouldn't allow another portfolio (limit reached). Matthew's empty "Sixfold Colorado" portfolio (no Pages, Instagram, ad accounts,
datasets or billing; checked 23 Nov) is renamed **Traverse Platforms**, Jen removed from it (her 365 access is separate). Its ID stays
**1302132595284587**: that's the Business portfolio ID partners add. Matthew's Facebook login email moves from the Sixfold address to
m.sharpe@traverseplatforms.com.

## Step 1 (original). Create the Traverse Platforms business portfolio
1. Go to **business.facebook.com/overview** → **Create an account** (or the portfolio menu → **Create a business portfolio**).
2. Business name **Traverse Platforms**, your name, business email **m.sharpe@traverseplatforms.com**.
3. Open **Settings → Business info** and copy the **Business portfolio ID** (a long number). Partners need it in steps 3 and 4.

**Business verification:** not yet, since Traverse isn't registered. The portfolio works now for the setup, partner access and insights. Meta
may hold back some posting and ad permissions until Traverse is verified. Once Traverse is registered, go to Settings → Security Center →
Start verification, with the legal name, address and one document (articles, EIN letter or a utility bill).

## Step 2. Create the app and the system user (in Traverse)
1. **developers.facebook.com → My Apps → Create App** → use case **"Other"** → type **Business** → name **Traverse Claude** → business
   portfolio **Traverse Platforms** → Create.
2. Back in **business.facebook.com → Traverse Platforms → Settings → Users → System users → Add**: name **Traverse Claude**, role **Admin**.
3. **Settings → Accounts → Apps**: check Traverse Claude is listed. On the system user → **Assign assets → Apps → Traverse Claude → Full
   control (Manage app)**.

## Step 3. Peak gives Traverse access (partner)
In **Peak's** portfolio (Cammie, or you with full control there):
1. **Settings → Users → Partners → Add → "Give a partner access to your assets"** → paste **Traverse's Business portfolio ID**.
2. Share, each with **Full control**: Peak's **Facebook Page**, **Instagram account**, and **ad account** (if there is one).
Then in **Traverse's** portfolio: **System users → Traverse Claude → Assign assets** → pick Peak's Page, Instagram and ad account (they show
up under the partner's assets) → Full control.

## Step 4. Sixfold gives Traverse access (partner)
In **Sixfold's** portfolio (Sixfold 365, where you're already an admin), do the same as Step 3: Partners → add Traverse's ID → share
Sixfold's Page(s), Instagram and ad account with Full control. Then assign them to the Traverse Claude system user in Traverse.
- **Leave the "Pipeline" system user and app in Sixfold's portfolio alone for now.** Sixfold's Facebook lead ads run through it. Claude
  moves the lead ads to the Traverse connection once Step 6 works, checks that a new lead still arrives, and only then is Pipeline retired.

## Step 5. Move the Traverse Page into the Traverse portfolio (DONE 23 Nov: claimed by Traverse, Page ID 1405686169302553; Traverse Claude has full control, checked through the API)
1. In **Sixfold's** portfolio → **Settings → Accounts → Pages** → Traverse's Page → **Remove** it from the business (you stay its admin; the
   Page itself isn't deleted).
2. In **Traverse's** portfolio → **Settings → Accounts → Pages → Add → Add a Page** → pick the Traverse Page → it's claimed.
3. Assign it to the Traverse Claude system user (Full control).
Do this when nothing is scheduled to post on it.

## Step 6. Make the token and save it on the cloud computer
1. **Traverse portfolio → System users → Traverse Claude → Generate new token** → app **Traverse Claude** → **Token expiration: Never**.
2. Tick: pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_metadata, pages_manage_posts,
   pages_manage_engagement, pages_messaging, read_insights, instagram_basic, instagram_manage_insights, instagram_content_publish,
   instagram_manage_comments, instagram_manage_messages, business_management, ads_read, ads_management, leads_retrieval. If some can't be
   ticked yet (verification), generate it with the rest; it can be remade later.
3. In the **VS Code terminal**: `cat > ~/.ssh/traverse-meta-token.txt`, paste the token, press Enter, then **Ctrl+D**. Tell Claude.

## What Claude does after
- Checks the token: which Pages, Instagram accounts and ad accounts it reaches. It reads only to check.
- Adds Peak's Page and Instagram insights to the nightly pull (and Sixfold's and Traverse's if wanted).
- Moves Sixfold's lead ads to the new connection, confirms a lead arrives, then tells you Pipeline can be retired.
