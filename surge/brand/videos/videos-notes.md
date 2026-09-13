# Videos — inventory

**Nothing here has been watched.** I cannot open video, so every line below is filename, size and date — not content. A clip is only usable once someone tells me what's in it, drops a transcript in `brand/notes/`, or exports a still to `brand/photos/`.

---

## In this folder

| File | Size | Notes |
|---|---|---|
| `2026-07-22-whatsapp-clip.mp4` | 2.2 MB | Was `WhatsApp Video 2026-07-22 at 2.42.59 PM.mp4`, loose in `photos/` until 2026-08-13. Contents unknown. |

## 9 Instagram `.mp4` files — added 2026-08-13

Stripped from Surge's own public Instagram alongside the 84 images now in `photos/instagram-export/`. Named by Instagram media ID; **unwatched, like everything else here.**

| File | Size |
|---|---|
| `17887365516396458.mp4` | 0.15 MB |
| `17889200235243470.mp4` | 1.7 MB |
| `17958790677108538.mp4` | 2.4 MB |
| `17981664341876793.mp4` | 2.4 MB |
| `18009072206839477.mp4` | 6.8 MB |
| `18093317291189303.mp4` | 2.6 MB |
| `18097805758834481.mp4` | 6.9 MB |
| `18103859000076920.mp4` | 35.3 MB |
| `18157258891407790.mp4` | 3.0 MB |

**CORRECTION, same day.** I first wrote that these were the most promising hero candidates because they are already web-sized MP4s that a human chose to publish. Then I read their headers. **They are the worst candidates in the folder**, and the reason is not editing difficulty — the source is wrong in three independent ways:

| File | Size | Duration |
|---|---|---|
| `17887365516396458.mp4` | **720×960 portrait** | 6.5s |
| `17889200235243470.mp4` | **360×640 portrait** | 50s |
| `17958790677108538.mp4` | **720×1280 portrait** | 10s |
| `17981664341876793.mp4` | **720×1280 portrait** | 31s |
| `18009072206839477.mp4` | **720×1280 portrait** | 36s |
| `18093317291189303.mp4` | **720×1280 portrait** | 12s |
| `18097805758834481.mp4` | **720×1278 portrait** | 30s |
| `18103859000076920.mp4` | **720×1280 portrait** | 76s |
| `18157258891407790.mp4` | **720×1280 portrait** | 23s |

1. **Every one is 9:16 portrait, 720px wide at best.** The hero is a full-bleed landscape band. Filling it with a 720-wide portrait clip means upscaling past 2× and cropping away most of the frame. It would be a blurry vertical sliver.
2. **They carry burnt-in text.** Poster frames pulled from three of them show `Team night!`, `Lost challenge = Push ups` and a subtitle reading `DOESN'T`. Overlay text is baked into the pixels and cannot be removed — it would sit on top of the headline.
3. **They carry watermarks and other people's handles** — `surge.ftw` on one, `mayaogea` on another. These are stories, not footage.

They remain useful as a record of what the account has published. They are not raw material.

## The `.MOV` files are the real candidates

Read from the file headers on 2026-08-13 — **all sixteen are landscape**, which is exactly what the hero needs:

| File | Resolution | Duration | Size |
|---|---|---|---|
| `IMG_5125.MOV` | **3840×2160 (4K)** | 48s | 564 MB |
| `IMG_5133.MOV` | **3840×2160 (4K)** | 36s | 417 MB |
| `IMG_5148.MOV` | **3840×2160 (4K)** | 155s | 1830 MB |
| `IMG_5885.MOV` | 1920×1080 | 5s | 10 MB |
| `IMG_7624.MOV` | 1920×1080 | 23s | 71 MB |
| `IMG_7633.MOV` | 1920×1080 | 14s | 25 MB |
| `IMG_7640.MOV` | 1920×1080 | 2s | 3 MB |
| `IMG_7641.MOV` | 1920×1080 | 1s | 1 MB |
| `IMG_7642.MOV` | 1920×1080 | 1s | 1 MB |
| `IMG_7643.MOV` | 1920×1080 | 22s | 39 MB |
| `IMG_7734.MOV` | 1920×1080 | 5s | 8 MB |
| `IMG_7774.MOV` | 1920×1080 | 14s | 42 MB |
| `IMG_7775.MOV` | 1920×1080 | 7s | 22 MB |
| `IMG_7776.MOV` | 1920×1080 | 19s | 59 MB |
| `IMG_7777.MOV` | 1920×1080 | 6s | 20 MB |
| `IMG_5861.mov` | 1280×720 | 29s | 9 MB |

**SUPERSEDED — see the review section below.** The table above reads *stored* dimensions. Fourteen of these sixteen carry rotation metadata and actually decode as **portrait**. Only `IMG_5125` and `IMG_5148` are genuinely landscape.

---

## Reviewed 2026-08-13 — ffmpeg installed, every clip frame-sampled

ffmpeg 9.0 was installed and all 26 clips were sampled frame by frame onto contact sheets, with full-resolution crops taken wherever a whiteboard or a sign appeared. **This is the first time anything in this folder has been looked at.**

### Only two clips are actually landscape

**This is the finding that decided everything else**, and it corrects the table above. A portrait clip in a full-bleed hero is an upscaled, hard-cropped sliver, so this rules out fourteen of sixteen before content is even considered — and all nine Instagram clips too.

### `IMG_5125` — disqualified, and worth knowing why

4K, 48s, locked-off camera in a conference room. Composed well, calm, good ambient movement.

**Its whiteboard names a client contact and their method.** Legible at full resolution: an email address of the form `B.REID @ [client domain]`, an organisation name with `$$$` beside it, and a lead-generation breakdown — `Comm` / `Resi`, `hail trace (find a block)`, `land glide`, `fast people`, `build out`. That is roofing-client work: Tier 4 client identity, plus a named individual's email address, plus that client's commercial method.

**Do not publish this clip or any still from it.** It is the only clip in the folder with a hard restriction problem, and it happened to be one of the only two usable shapes.

### SUPERSEDED — `hero-homepage-supplied.mp4` is now the homepage hero

Matthew supplied his own edit on 2026-08-13 and asked for it to replace the `IMG_5148` cut. Done. `IMG_5148` remains a valid fallback and its notes below still stand.

**The supplied file:** 1080×1920 portrait, 21.7s, h.264 + AAC. An edited social reel — office training footage, three people presenting, forest/log segments composited from Instagram story screenshots (with the `surge.ftw` watermark and story timers visible), a promotion-certificate segment, and a closing office shot. Burnt-in subtitle captions throughout (`LOOK`, `BEING`, `You can't overcome what you won't recognize`).

**How it was fitted.** The last 4.1s of the source is black, so only 0:00–17:30 was encoded. It is portrait in a landscape slot: a cover-crop to hero ratio keeps a 1080×456 strip out of the middle and **decapitates the subject in most shots** — verified frame by frame. So the portrait frame is scaled to full height, centred, and the sides filled with a blurred, darkened copy of itself. Nothing is cropped away. Output 1920×1080, 30fps, **audio track removed**, 2.8 MB mp4 / 2.3 MB webm.

**Open question, raised not resolved.** Around 0:10–0:14 the clip shows a **`Certificate of Promotion`** naming an individual with the rung **`Closer`**, legible at full size. Two rules touch it:

- **Tier 2** restricts *advancement and promotion as a career path* — the rung structure, "how you move up at Surge." A promotion certificate naming a rung is that, in picture form.
- **Tier 4** requires a yes before naming any real person. The individual is not on the team page.

It is Matthew's own edit and his own company's certificate, so this is squarely his call rather than mine — but it is on the homepage, and `brand-voice-company.md` §5 names the promotion ladder as exactly the terrain critics cite. **Trimming that window is a one-line change.** Left in pending his answer.

**Also worth knowing:** the embedded story screenshots carry the `surge.ftw` watermark and story countdown timers. Fine as a stylistic choice, but they read as social content rather than website content, and they are the lowest-resolution material in the edit.

### `IMG_5148` — the previous hero, still a valid fallback

4K, 155s, locked-off. A rep in a black suit running through a pitch to camera in the main office — blank whiteboard, the gong, gold stanchions, red carpet, mirror, trophy shelf.

- **0:00–0:50** — the POT LUCK board is behind her and fully legible: nine staff first names, `THU @ 6`, `softball @ 7:30`, `HEADCOUNT`. Unusable.
- **From roughly 0:50 to the end** — **the board is wiped blank.** Verified at 0:50, 1:20, 2:00 and 2:30. Nothing else in frame carries text.

**1:32–1:50 was taken for the hero loop.** Cropped to a 2.37:1 band, scaled to 1920×810, 30fps, **audio track removed entirely** rather than merely muted — so nothing said in that room ships with the page. Output: 1.5 MB MP4 and 1.2 MB WebM at `surge-site/public/video/hero-loop.*`.

### Everything else, and why it lost

| Clips | What they are | Why not |
|---|---|---|
| `IMG_7774` `7775` `7776` `7777` | Bowling night | Portrait; members of the public throughout; wrong subject for a B2B hero |
| `IMG_7624` | Rec-league softball at night | Portrait, and **children are visible** — the same hard NO as the softball stills |
| `IMG_7633` `IMG_7643` | Someone riding a balance board down the office corridor | Portrait. Both also end with the `F*CK AVERAGE / BE LEGENDARY` print filling frame — the same print that forced the `IMG_7634` crop |
| `IMG_7734` | Training room, group standing, boards blank | Portrait. Content was the best of the 1080p set — worth re-shooting this composition in landscape |
| `IMG_5133` | The birthday cake being carried through the office | Portrait; and it is a birthday, not the business |
| `IMG_5861` `IMG_5885` | — | Portrait by explicit rotation flag |
| The 9 Instagram `.mp4`s | Stories and reels | Portrait, 720px, burnt-in captions, watermarks |

### The one thing worth doing about all this

**Every clip Surge owns except two was shot in portrait.** Fine for Instagram, useless for the website, and it will keep being useless every time footage is needed for a landscape slot. `IMG_7734`'s composition — the room working, boards blank, nobody staring down the lens — is exactly the right hero content and it cannot be used because of how the phone was held.

**Shoot landscape when the footage might end up on the site.** One habit, and the next clip is usable in both places.

Two caveats that have not moved:

- **Still unwatched.** The `IMG_76xx`/`IMG_77xx` run sits in the same camera-roll range as the training-room stills, so assume boards and audio until a specific clip is checked. That is the group most likely to look good and most likely to be contaminated.
- **ffmpeg is not installed on this machine**, so nothing here can be transcoded, trimmed or frame-sampled without it. A 1920×1080 `.MOV` at 20–70 MB cannot go on a web page as-is.

## The 16 `.MOV` files — now in this folder

## The 16 `.MOV` files — now in this folder

**~3.0 GB total.** Superseding the note below: on 2026-08-13 the whole `Desktop\Stuff for surge drive\` folder was copied into `brand/photos/`, videos included. Since they were already inside the project, leaving them out was no longer the choice on the table — so they were moved out of `photos/` and into here, where video belongs. **This folder is now 3.05 GB and syncs with OneDrive.**

If that sync cost turns out to matter, the fix is to move them back out to a local folder and leave this inventory pointing at it. Nothing else depends on their location.

| File | Size | File date |
|---|---|---|
| `IMG_5125.MOV` | 564 MB | 2026-08-12 |
| `IMG_5133.MOV` | 417 MB | 2026-08-12 |
| `IMG_5148.MOV` | **1.8 GB** | 2026-08-12 |
| `IMG_5861.mov` | 9 MB | 2026-07-27 |
| `IMG_5885.MOV` | 10 MB | 2026-07-27 |
| `IMG_7624.MOV` | 71 MB | 2026-07-27 |
| `IMG_7633.MOV` | 25 MB | 2026-07-27 |
| `IMG_7640.MOV` | 3 MB | 2026-07-27 |
| `IMG_7641.MOV` | 1 MB | 2026-07-27 |
| `IMG_7642.MOV` | 1 MB | 2026-07-27 |
| `IMG_7643.MOV` | 39 MB | 2026-07-27 |
| `IMG_7734.MOV` | 8 MB | 2026-07-27 |
| `IMG_7774.MOV` | 42 MB | 2026-07-27 |
| `IMG_7775.MOV` | 22 MB | 2026-07-27 |
| `IMG_7776.MOV` | 59 MB | 2026-07-27 |
| `IMG_7777.MOV` | 20 MB | 2026-07-27 |

The dates above are file dates, not capture dates — the MOV headers didn't yield an EXIF timestamp the way the HEICs did, and all the 07-27 ones carry the same batch-copy time.

**Two clusters, guessing from the numbering only:**

- **The `IMG_76xx` / `IMG_77xx` run** sits in the same camera-roll range as `photos/Office and work/IMG_7634`–`IMG_7639` and `IMG_7733`–`IMG_7738` — the training-room cohort and the mobile-whiteboard session. If that holds, these are **video of the training floor**, which is the most valuable footage the company could have and also the material most likely to contain restricted content on a board or in a script. Both at once.
- **`IMG_5125`–`IMG_5148`** brackets `IMG_5134`–`IMG_5147`, the birthday-cake and potluck-board stills shot 2026-07-28 and 07-29. Same office, same few days.

**This is inference from filename numbering and nothing else.** Do not treat it as knowledge of what's in them.

## Cheapest way to make these usable

Export one still per clip to `brand/photos/` — a frame is enough for me to say what a clip shows, whether it's publishable, and whether it's worth the storage. Sixteen stills is a small job and it converts 3 GB of opaque files into a catalogue. The three large ones (`5125`, `5133`, `5148`) are worth doing first: at 400 MB–1.8 GB they are long takes, and length usually means a meeting, a training session or an event rather than a quick clip.

**Restriction warning, in advance.** Anything shot on the training floor is likely to catch a whiteboard, a script, or a trainer talking through operator-side phrasing. `RESTRICTED.md` Tier 1 covers the influence-technique material, and a photograph of a board is the same act as publishing the text — see the `IMG_0481` crop in `photos/photos-notes.md`. Video is worse, because it carries audio too. Assume training footage is restricted until a specific clip is checked, not the reverse.
