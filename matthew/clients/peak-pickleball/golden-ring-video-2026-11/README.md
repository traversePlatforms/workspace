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
