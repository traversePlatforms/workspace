# Golden Ring ad video (Peak Pickleball, Cammie's brief, 24 Nov 2026)

Two 32 s, 1080x1920 Reels for the Golden Ring National Championships (15–17 Jan 2027): a voiceover version and a text-only version.

- **Brief:** Cammie Wilson's email "Golden Ring National Championship January" (24 Nov, Matthew's Peak Outlook).
- **Sources (not in git):**
  - `source/`: her 3 ring clips and logo, plus copies from Peak's library (Golden Ring 2027 logos, PEAK FLIGHT SOCIAL.mp4, Pikes Peak or Bust match clips).
  - `ai/`: Gemini light plates (dust, rays, smoke, flare); AI used for atmosphere only, per Cammie.
  - `vo/`: ElevenLabs "Brian" lines.
- **Build:** `bash tools/build.sh` makes out/golden-ring-vo.mp4 and out/golden-ring-text.mp4.
  - With music: `MUSIC=track.mp3 MUSIC_AT=<secs> bash tools/build.sh`. The music should come from Meta's Sound Collection (Matthew downloads it).
  - Text cards: `node tools/cards.cjs`.
  - Ring grade: `tools/ringgrade.sh`.
- **Draft 1** is in Matthew's Drive, folder "Peak - Golden Ring video drafts". Nothing is posted; the ad launches only on Matthew's go.
- **Draft 2 (25 Nov):** music by Google Lyria (`tools/lyria.mjs`, lyria-3.5, about $0.08 a take; Matthew's go). There are 3 takes in `music/`.
  - `tools/musicedit.sh` cuts each take so its hits land on the 14 / 22 / 26 s booms.
  - Take 3's ending is turned down under the last voice line (`music/take3-edit-vo.wav`).
  - Six files are in Drive, in "Draft 2 - with music". Sound effects are still the homemade ones (Matthew: keep them for now).
- **Draft 3 (25 Nov):** Matthew found the hand-held ring clips too shaky, so the ring scenes are now sharp stills.
  - `tools/ringstill.sh` takes the frame with the least blur (the scores are from ffmpeg blurdetect) and gives it a smooth zoompan push and a gold glint.
  - Frames used: MVI_0151 at 1.52 s, MVI_0150 at 1.36 s, MVI_0151 at 1.32 s (tight).
  - The shield push uses zoompan too. The old `ringgrade.sh` is no longer used.
  - Drive folder "Draft 3 - steady ring".
- **Music fix (25 Nov):** the jump at 22 s into a quieter part of each track sounded like the music stopping and starting over (Matthew).
  - Each take now plays as one continuous piece from its 14 s hit, with a 4 s fade over the end card.
  - Files: `music/take*-cont.wav`, plus `take3-cont-vo.wav` with the ending turned down under the voice.
  - Don't splice music sections again without a long crossfade.
