# Post calendar (built 2026-10-31)

Matthew's approval calendar for the clients' Facebook and Instagram posts, with the server runner that publishes them. Built on his ask
("build the calendar and server runner, also set that up for surge as well"); clients beyond Sixfold 365 and Surge are added in the page.

- **Live:** https://traverseplatforms.com/posts-ab8c57/ (also tab 5, "Posts", of the Traverse hub `/hub-cc1f31de/`). Matthew's sign-in
  code is only in `~/.ssh/post-calendar-code.txt` on the laptop (admin: every client, approves, client setup). The laptop's loader uses
  `~/.ssh/post-calendar-editor-code.txt` (editor: drafts, pictures, answers to change requests; it can never approve). Jen McPherson's
  Sixfold-only code is in `~/.ssh/post-calendar-jen-code.txt` (client sign-in, below). Never print any of them.
- **Accounts** (on the server, `php ~/www/traverseplatforms.com/post-calendar-tools/runner.php ...`):
  `addaccount "Name" admin|editor|client [--clients id1,id2] [--code-only]`, `removeaccount "Name" [role]` (signs its sessions out at
  once), `accounts` (names, roles and scopes; never codes). Sessions made since 16 Nov point at their account, so removing an account or
  changing its scope counts on the next call.
- **Client sign-ins (16 Nov 2026, Matthew: "Create a sixfold only sign in for jen. I want her to be able to write, schedule, and approve the
  content. And make changes and request changes as its needed ... she needs to be able to change the dates as well"):** role `client` with
  `clients: ["sixfold"]` on the account. Inside its clients it does everything a post needs: write, edit captions, pictures, date and
  time, upload/replace/remove/reorder pictures and videos, approve, unapprove, request changes, withdraw a request, answer by editing, failed
  back to draft, remove. It may change the **posting days** (slots) of its own client and nothing else of the client: the API refuses
  (403) a `client` call carrying anything but `id` and `slots`, never calls Meta for it, and refuses add, archive and the Meta Pages list.
  Every other client, and every post of one, answers 404 to it exactly as if it did not exist (`data`, `slots`, `requests`, every post
  action, `upload` before any file is kept). The page opens straight on its client, with no client switcher, no "All clients", no client
  setup, and a "Posting days" screen instead. Approvals record the approver's name; cards and the post sheet show "Approved by".
- **The rule:** nothing goes out unless an approver tapped Approve on that post: Matthew (any client) or a client's own approver (its own
  client only). The editor can never approve. Approve records who, when and a fingerprint of the client, time,
  targets, captions and pictures; any change drops it back to draft, and the runner checks the fingerprint again. No bulk approve. Change
  requests ("Request changes") block approval until they are answered.
- **Clients never mix:** each post belongs to one client for life; each client posts only to its assigned Page and Instagram account (a
  Page belongs to one active client at a time); the page shows one client at a time (the all-clients view is counts only). A client
  connects through the Pipeline token (the client adds Matthew's business as a partner on its Page) or with its own Page token, kept in
  `post-calendar-data/private/client-<id>.json` and never shown.
- **Runner:** `post-calendar-tools/runner.php`, started every 5 minutes by `sixfold-tools/meta-leads.php` (the SiteGround cron), so a post
  goes within about 5 minutes of its time. Posts each approved, due post once (claimed under a lock first, each platform recorded as it
  goes), never retries a failed one (Back to draft, then Approve again; what already went is not sent twice), skips anything over 6 hours
  late, and emails m.sharpe@traverseplatforms.com once per failure through the travMail sender. Same Graph calls as the 27 Oct scripts:
  FB `/{page}/photos` with the picture's address (photo set since 16 Nov: each photo to `/{page}/photos` with `published=false`, then one `/{page}/feed` post with `attached_media`; Meta refused this app Page albums at the first real photo set, 16 Nov 1:15 pm, "(#3) Application does not have the capability", so no album name is asked for any more), IG `/{ig}/media` then `/media_publish`
  (photo set: carousel). Token: `post-calendar-data/private/meta-token.json` if present, else `sixfold-private/meta-social.json` (the same
  Pipeline token, checked 31 Oct). `php runner.php check` is a read-only look at which Pages the token sees.
- **Pictures:** `public_html/posts-ab8c57/media/` under random names (Instagram fetches them from there). The page turns a phone picture
  into a JPEG (no location data, at most 2160 px) before upload.
- **Videos from the page (16 Nov 2026, Matthew: "What if she wants to do a video, how will that work"):** a single post takes an mp4, mov or
  m4v; it goes out as a Reel on Facebook and Instagram (photo sets still refuse video). The server makes the MP4 (`pcStoreVideo` in lib.php):
  with an ffmpeg that has libx264 it converts anything not H.264 + AAC, or over 1920 px on the long side, to H.264 CRF 23 + AAC, long side at
  most 1920, at most 60 fps, +faststart. **The host's `/usr/local/bin/ffmpeg` has no H.264 encoder** (checked 16 Nov: only a hardware
  wrapper with no device), so live it **re-packs** instead: H.264 or HEVC video (what phones record; both Reels take either) copied into
  MP4 with +faststart, sound made AAC if it is not, location and other metadata dropped. A video that would need real converting (4K, over
  60 fps, another codec) is refused in plain words asking for 1080p. To get full converting, put the path of an ffmpeg built with libx264
  in `post-calendar-tools/ffmpeg-path.txt` (checked once and kept in `post-calendar-data/video-tools.json`). The 90-second and 100 MB limits
  are checked on the result. The page checks length, size and 4K before uploading where the phone's browser can read the video, shows the
  upload percentage, then "Converting/Preparing the video...". Host limits: upload_max_filesize and post_max_size 256 MB (a 90 s 1080p phone
  clip is about 90 MB). Page note: "Phone videos: record in 1080p, under 90 seconds."

## LinkedIn (Surge only, built 18 Nov 2026)

Matthew, 18 Nov: "I want this connected to my posts app under the surge section. We are going to schedule posts similiar to how we do with
surge. I am still putting surge facebook on hold until i gain access to the appropriate surge account." Code: `server/linkedin.php`
(loaded by lib.php) and `app/api/linkedin-oauth.php`.

- **The app:** Surge Inc's own LinkedIn developer app, Community Management API only (Development tier requested 18 Nov). Keys on the
  laptop in `~/.ssh/surge-linkedin-app.txt` (line 1 client ID, line 2 secret); on the server in `post-calendar-data/private/linkedin-app.json`
  (chmod 600), sent with `bash tools/linkedin-app.sh push` (`compare` says same/different). Never printed. Optional keys in that file:
  `version` (LinkedIn-Version, YYYYMM; the code says 202611, bump it before about Nov 2027) and `scopes_extra`.
- **Connect (Matthew only):** Manage clients > Surge > Connect LinkedIn. Opens LinkedIn in a new tab with scopes `w_organization_social
  rw_organization_admin r_organization_social r_basicprofile`; LinkedIn returns to `api/linkedin-oauth.php` (registered in the app). That
  page works only with Matthew's sign-in cookie and a one-use state under 15 minutes old; it swaps the code, reads his name and his Pages
  (organizationAcls), and he picks Surge Inc. Tokens are sealed (AES-256-GCM, key = `private/linkedin.key` mixed with the app secret) in
  `private/linkedin-surge.json`. A refusal is said plainly ("LinkedIn hasn't approved posting yet" + LinkedIn's words); if LinkedIn refuses
  only an extra scope (r_organization_social, r_basicprofile) it is left out next time and he presses Connect again.
- **Staying signed in:** the runner refreshes the access token when it has under 7 days left (refresh tokens last a year from the first
  Connect, then Connect again). If it can't, the page says "Needs reconnecting" and Matthew gets one email.
- **Posts:** target `li` (Surge only), with its own words (`li`, at most 3,000 characters after LinkedIn's little-text escaping, no links)
  and an optional first comment (`li_comment`, at most 1,250; the place for links, per Surge's voice spec). Words alone, one picture, or a
  photo set of 2-20 pictures; no video. Same approve, fingerprint, once-only, failure email and Back to draft rules: the post and the first
  comment are recorded separately, so a refused comment is the only thing tried again. The post's address
  (linkedin.com/feed/update/urn:li:share:.../) is kept.
- **Numbers:** likes, comments, shares, impressions and clicks (organizationalEntityShareStatistics), read about 2 hours, 1 day, 3 days and
  7 days after a post went, shown on the post. Needs Matthew to be a Super admin (ADMINISTRATOR) of the Page.
- `php runner.php linkedin`: the connection as the page shows it (never tokens).

## Facebook / Instagram hold (18 Nov 2026)

`php runner.php hold <client> fb,ig "why"` / `unhold <client> fb,ig`. A held platform can't be approved (the reason shows on the post),
approved posts using it go back to draft, and the runner never sends to it or asks Meta about it. **Surge fb,ig is on hold since 18 Nov**
(Matthew: until he has access to the right Surge account). Lift only on his word.

## Loading drafts (manifests)

`node traverse/post-calendar/tools/pc.mjs import <manifest.json>` (add `--dry-run` first to see what would load). Each item: `brand`
("sixfold", "surge" or a client id), `type` ("single" or "photoset"), `date` + `time` (Mountain; leave both out for "not scheduled yet"),
`targets`, `image` or `images` (2-10, paths or `{path, caption}`), `fb_caption`, `ig_caption`, `li_caption` + `li_comment` (LinkedIn), `album` (photo sets; kept but not used since 16 Nov), `note`. Everything
arrives as an unapproved draft; importing the same manifest again adds nothing twice. `pc.mjs list <client>` shows each post and what still
blocks its approval; `pc.mjs requests` (or `php runner.php requests` on the server) lists open change requests as JSON; `pc.mjs answer
<post-id> --image new.png --fb fb.txt --ig ig.txt` sends the new version and puts the post back to draft.

## Upload and tests

- `bash traverse/post-calendar/tools/deploy.sh` (backup to `~/upload-backups/before-postcal-<stamp>.tgz`, rename-into-place, md5 of every
  file); `--check` compares with live and sends nothing. `tools/token.sh compare|push` handles the token without printing it.
- `node traverse/post-calendar/test/pc-test.mjs`: API and runner against a local stand-in for graph.facebook.com (nothing reaches Meta):
  294 checks on 18 Nov, LinkedIn against a local stand-in for linkedin.com included (the client sign-in and phone-video sections need ffmpeg +
  ffprobe on PATH, else the video part is skipped).
  `node traverse/post-calendar/test/pc-ui-test.mjs [shots-folder]`: the page in headless Chrome at phone size, 68 checks on 18 Nov.
- The old runner (`sixfold-tools/social-queue.php`, queue `sixfold-private/social-queue.json`) is folded in with `php runner.php
  migrate-queue <file>`: approvals kept; the new runner leaves migrated posts alone until the old queue file is retired.
