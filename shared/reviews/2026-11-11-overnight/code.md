# Overnight code review: everything committed 11 Nov 2026

Reviewed overnight 11 to 12 Nov. Scope: the 21 commits of 11 Nov (Surge launch switches and the form's attachments, J.A.R.V.I.S.
personal-assistant prompt, learned notes, open-SSH stream, quick first pass, voice notes, drag-guard installer, TASKS, Veterans Day
post files, the ADA vendor review page).

**Short version:** nothing is broken for customers, nothing was found that sends, posts or charges on its own, no secrets are in the
commits, Jen's screens are unchanged apart from the mic button in the chat (which was the request), and the editions are not touched
by voice notes (the server answers "Not here" and the button is not drawn outside Sixfold). **I changed no code and deployed nothing.**
The findings that matter are all in the J.A.R.V.I.S. watcher (`help-watch.sh`), which was off-limits tonight, or are judgement calls.

## What I checked on the servers (read-only)

- Live and staging Surge `api/submit.php` both match the repo (md5 `5ea667d0...`).
- `sixfold-tools/help-next.php`, `help-transcript.php`, `help-reply.php` and the live `api/rounds.php` all match the repo.
- Surge live, asked from the server itself: `api/uploads/`, `api/submissions.log`, `api/config.php` answer 403; `robots.txt` 200 and
  allows all; home page has no noindex; thank-you page keeps noindex; `deploy/DEPLOY.md`, `_preview-hero-b.html`, `blog/_template/`
  are not on the live site (404); staging still says noindex and Disallow. A GET to `submit.php` answers 405.
- Server PHP limits (memory 768M, upload 256M) are far above what a 10 MB attachment needs.
- From this laptop, every page on surgeftw.com and traverseplatforms.com answers SiteGround's captcha page (HTTP 202). That is this
  laptop's address being flagged, not the sites being down. It is the same thing that stops the J.A.R.V.I.S. quick check.

## Findings, most serious first

### 1. Another admin can type into Matthew's conversation and J.A.R.V.I.S. treats it as Matthew (medium to high; not fixed)

- `traverse/ops/help-watch.sh:90`, `:109`, `:118` decide "this is Matthew" from the ticket's owner (`by`), not from who wrote the
  newest message.
- `traverse/app/api/rounds.php:8896` and `:8948`: any login with the admin role may open and add to any conversation.
- New on 11 Nov: a ticket owned by Matthew now gets the personal-assistant prompt ("his message is his go" across Surge, Sixfold,
  Traverse, Peak, Donny, personal), Opus, and the quick pass that reads memory.
- What breaks: an admin other than Matthew who writes in one of his conversations gets his authority. The quick pass could answer
  them from his private notes (pay, personal lane); the full session could act on their message as his go.
- Who: only whoever holds an admin login on the Sixfold install. A small trusted group, but it is a real hole.
- Suggested fix (in `help-watch.sh`, so not done): take "Matthew" from the `from` of the last message in the ticket, and require
  every waiting message to be his; otherwise run the ordinary help-desk prompt.

### 2. A follow-up sent just after the answer gets "passed to Matthew" and is never answered (medium; not fixed)

- `traverse/ops/help-watch.sh:137-140`: when the session ends, the watcher looks at the last log line for the ticket. If it is not a
  reply, it posts "I couldn't finish looking into this one, so I've passed it to Matthew" and sets the ticket to `matthew`.
- If the person writes again ("thanks", or a second question) after the answer but before the session has exited, the last line is
  their message. They get the apology, and the new message is never picked up because the status is no longer `new`.
- The window got longer on 11 Nov: sessions now write to `jarvis-learned.md` and commit after replying.
- Who: anyone using the chat, Matthew most of all.
- Suggested fix: look for the last `reply` line written after the session started, not the last line of any kind; if a newer `msg`
  exists, leave the ticket `new`.

### 3. The learned-notes file mixes Matthew's private work into every session, including those answering the office (medium; judgement call)

- `traverse/ops/help-watch.sh:112-114` appends `traverse/ops/jarvis-learned.md` to every live session, whoever wrote in.
- `traverse/ops/jarvis-learned.md:8-9`, `:19-21`, `:26-29` already hold the Peak quote prices, his old laptop, and an order to his
  VS Code session. `jarvis-matthew-prompt.md` tells his sessions to keep adding to it, so pay or personal items can land there.
- What breaks: a session answering Jen, Brad or Cai carries those notes and could repeat them. It also blends entities, which
  CLAUDE.md says never to do.
- Suggested fix: two files (one for office tickets, one for his), or a line in `help-desk-prompt.md` that notes from Matthew's
  tickets are never repeated to anyone else. Not done: the first needs `help-watch.sh`, the second is your call.

### 4. Quick answer that fails to post leaves the ticket stuck for 90 minutes (low to medium; not fixed)

- `traverse/ops/help-watch.sh:125-127`: on `ANSWER` the reply is sent and the function returns without checking it arrived.
- With SSH as shaky as it was tonight (25 "Connection closed" lines in the log), a dropped reply leaves the ticket `working`,
  with no answer, until `help-next.php` puts it back to `new` after 90 minutes.
- Suggested fix: check the exit of `help-reply.sh`; on failure fall through to the full session (which has the safety net).

### 5. The open-SSH stream gave up 4 times out of 7 tonight (low; for whoever has the watcher)

- `traverse/ops/help-watch.sh:184-216`. The log shows 7 switches to the stream and 4 "keeps dropping" fall-backs, each within about
  two minutes.
- The coproc code itself is sound (I tested the read-inside-`$(...)` pattern in bash: it works, and it fails cleanly when the stream
  ends). The drops are the server closing connections.
- One thing that may make it worse: on each failed read the loop does a fresh SSH look and then reopens the stream straight away,
  with no pause (`:214-216`, then `continue`). That is up to 6 logins in about a minute, which may be what trips SiteGround's limit.
  A 10 to 15 second pause before reopening would be gentler.
- No second-watcher race found: the task's IgnoreNew keeps one copy, and the stream's SSH dies by itself within 5 s of the watcher
  exiting. `running.lock` is only set during a live ticket, not a practice one, as before.

### 6. Surge form: an email with an attachment gets doubled line endings in the message (low; not fixed)

- `surge/website/build/api/submit.php:236`: `str_replace("\n", "\r\n", $body)`. Browsers send a multi-line message with `\r\n`
  already, so each line break becomes `\r\r\n`.
- What breaks: only emails that carry a resume or document, and only cosmetically. Some mail programs show extra blank lines in the
  applicant's message. Nothing is lost.
- Fix is one line: `preg_replace('/\r\n?|\n/', "\r\n", $body)`. Not done: the Surge site takes only changes you send, and it would
  mean a live upload overnight for a cosmetic fault.

### 7. Surge form: if the email with the attachment is refused, nothing is emailed at all (low; not fixed)

- `surge/website/build/api/submit.php:249`: one `mail()` call. If it fails, the visitor sees "We couldn't send that just now" and
  may send it again. The enquiry is still in `submissions.log` and the file in `api/uploads/`, so nothing is lost, but info@ hears
  nothing.
- Suggested: on failure, send the plain email once more without the attachment (the note already says where the file is kept).

### 8. Surge form: Reply-To can be malformed by the person's name (low; older than 11 Nov)

- `surge/website/build/api/submit.php:216`: the name goes into the header as typed. Line breaks are stripped, so this is not header
  injection. But a name with a comma, quote mark or accent ("Smith, John") makes a Reply-To that some mail programs read wrongly.
- Suggested: quote and encode the name, or use the email address alone.

### 9. A transcript with a broken character is dropped (low; not fixed)

- `traverse/ops/help-transcript.php:19`: `preg_replace(..., /u)` returns nothing when the text is not valid UTF-8, so the script
  says "empty transcript" and exits. The chat then never shows a transcript for that note (the session still gets the text).
- Rare with English speech. Fix: `mb_scrub()` the text first. Not done because this file is uploaded by hand (it is not in
  `deploy-app.sh`), and it is rare.

### 10. Small things, no action needed tonight

- `traverse/ops/help-*.php` are not part of `deploy-app.sh`; they are uploaded by hand. They match tonight, but they can drift.
- `surge/website/build/api/submit.php:239`: the attachment name is sent as one long encoded word (over the 75-character limit when
  the name is long). Gmail and Outlook read it; a strict mail program might show the raw text. The name is plain ASCII after
  cleaning, so it does not need encoding at all.
- `traverse/app/summit-de59ae83/index.html` (chat poll, about line 7949): a voice note that is paused part-way goes back to the start
  when the chat redraws (every 15 s). Playing notes are protected; paused ones are not.
- `traverse/ops/help-watch.sh:89`: `BY` is not declared local. Harmless.
- The quick pass (`help-watch.sh:120`) has the Read tool with no folder limit, so it can open any file on the laptop, including the
  codes files. The prompt says never to print them. Only matters together with finding 1.

## Checked and found sound

- **Voice note upload** (`rounds.php` helpsend): size cap 6 MB, kind read from the file's own bytes, name made by the server, saved
  0600 in the ticket's private folder, 30 messages an hour limit applied before anything is saved.
- **Voice note download** (`rounds.php` helpfile): ticket id and file name are pattern-checked, owner or admin only, no path tricks
  possible, fixed content type with nosniff, byte ranges handled correctly including bad ranges (416).
- **Transcript post-back** (`help-transcript.php`): command line only, ticket and note must exist, control characters stripped,
  4,000 character cap. The watcher validates the ticket id, file name and folder before putting them in a remote command.
- **Recorder in the chat**: mic is released on close, on re-open and on cancel; Send while recording stops then sends; too-short and
  too-long notes are refused with a plain message.
- **Surge mail code**: no header injection (attachment name is base64, type comes from a fixed list, boundary is random, subject is
  fixed). Uploads stay blocked from the web and cannot run.
- **Surge launch switches**: noindex off on the real pages, kept on 404 and thank-you; robots and sitemap correct; staging still closed.
- **Nothing sends on its own**: the prompts repeat the standing rule; the quick pass has read-only tools; the practice chat has no tools.
- **Secrets**: none in the day's diffs. The poll key stays in `~/.ssh` and is not logged.
- **drag-guard-install.ps1**: fine. TASKS, Veterans Day files, ADA review page: nothing to flag in code terms.

## What I did

- Read every 11 Nov diff; read-only checks on both servers (three SSH calls); one local bash test of the coproc pattern.
- No code changed, nothing deployed, the watcher was not restarted, nothing posted, emailed, texted or queued.
- This report committed.
