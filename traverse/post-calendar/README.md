# Post calendar (built 2026-10-31)

Matthew's approval calendar for the clients' Facebook and Instagram posts, with the server runner that publishes them. Built on his ask
("build the calendar and server runner, also set that up for surge as well"); clients beyond Sixfold 365 and Surge are added in the page.

- **Live:** https://traverseplatforms.com/posts-ab8c57/ (also tab 5, "Posts", of the Traverse hub `/hub-cc1f31de/`). Matthew's sign-in
  code is only in `~/.ssh/post-calendar-code.txt` on the laptop (admin: the only sign-in that can approve). The laptop's loader uses
  `~/.ssh/post-calendar-editor-code.txt` (editor: drafts, pictures, answers to change requests; it can never approve). Never print either.
  More codes: `php ~/www/traverseplatforms.com/post-calendar-tools/runner.php addaccount "Name" admin|editor` on the server.
- **The rule:** nothing goes out unless Matthew tapped Approve on that post. Approve records who, when and a fingerprint of the client, time,
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
  FB `/{page}/photos` with the picture's address (photo set: `/{page}/albums` + one photo each), IG `/{ig}/media` then `/media_publish`
  (photo set: carousel). Token: `post-calendar-data/private/meta-token.json` if present, else `sixfold-private/meta-social.json` (the same
  Pipeline token, checked 31 Oct). `php runner.php check` is a read-only look at which Pages the token sees.
- **Pictures:** `public_html/posts-ab8c57/media/` under random names (Instagram fetches them from there). The page turns a phone picture
  into a JPEG (no location data, at most 2160 px) before upload.

## Loading drafts (manifests)

`node traverse/post-calendar/tools/pc.mjs import <manifest.json>` (add `--dry-run` first to see what would load). Each item: `brand`
("sixfold", "surge" or a client id), `type` ("single" or "photoset"), `date` + `time` (Mountain; leave both out for "not scheduled yet"),
`targets`, `image` or `images` (2-10, paths or `{path, caption}`), `fb_caption`, `ig_caption`, `album` (photo sets), `note`. Everything
arrives as an unapproved draft; importing the same manifest again adds nothing twice. `pc.mjs list <client>` shows each post and what still
blocks its approval; `pc.mjs requests` (or `php runner.php requests` on the server) lists open change requests as JSON; `pc.mjs answer
<post-id> --image new.png --fb fb.txt --ig ig.txt` sends the new version and puts the post back to draft.

## Upload and tests

- `bash traverse/post-calendar/tools/deploy.sh` (backup to `~/upload-backups/before-postcal-<stamp>.tgz`, rename-into-place, md5 of every
  file); `--check` compares with live and sends nothing. `tools/token.sh compare|push` handles the token without printing it.
- `node traverse/post-calendar/test/pc-test.mjs`: API and runner against a local stand-in for graph.facebook.com (nothing reaches Meta):
  104 checks on 31 Oct. `node traverse/post-calendar/test/pc-ui-test.mjs [shots-folder]`: the page in headless Chrome at phone size, 20 checks.
- The old runner (`sixfold-tools/social-queue.php`, queue `sixfold-private/social-queue.json`) is folded in with `php runner.php
  migrate-queue <file>`: approvals kept; the new runner leaves migrated posts alone until the old queue file is retired.
