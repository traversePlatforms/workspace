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
  `clients: ["sixfold"]` on the account. Inside its clients it does everything a post needs: write, edit captions, pictures, album, date and
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
  FB `/{page}/photos` with the picture's address (photo set: `/{page}/albums` + one photo each), IG `/{ig}/media` then `/media_publish`
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
  199 checks on 16 Nov (the client sign-in and phone-video sections need ffmpeg + ffprobe on PATH, else the video part is skipped).
  `node traverse/post-calendar/test/pc-ui-test.mjs [shots-folder]`: the page in headless Chrome at phone size, 49 checks on 16 Nov.
- The old runner (`sixfold-tools/social-queue.php`, queue `sixfold-private/social-queue.json`) is folded in with `php runner.php
  migrate-queue <file>`: approvals kept; the new runner leaves migrated posts alone until the old queue file is retired.
