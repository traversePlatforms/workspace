# Hero background video — the slot is built, the file is not

The homepage hero is ready to take a looping background video. Until a file is
dropped here it shows `assets/img/hero-bg.jpg`, exactly as it does today — the
slot is inert, not broken, and nothing 404s.

## To turn it on

1. Put `hero.mp4` in this folder (and `hero.webm` too if you can — smaller).
2. In `index.html`, find the `HERO VIDEO SLOT` comment and **uncomment the two
   `<source>` lines**.
3. That's it. `site.js` ignores the `<video>` until it finds a `<source>` inside it.

## What the clip needs to be

This is wallpaper behind the headline, not something anyone watches. It is
darkened to 26% brightness, desaturated and blurred 3px, with a near-black
gradient over it — the same treatment the still photo gets. So:

- **8–15 seconds, and it must loop** without an obvious cut. Slow, continuous
  movement. A pan across the floor, people working, a booth being set up.
- **No sound.** It is muted and there are no controls; audio would never play.
- **Under ~3 MB for the mp4.** This loads on the homepage. Anything heavier and
  the page gets slower for a decoration most visitors will not consciously see.
  1280×720 is plenty at this blur — 1920 wide is wasted bytes.
- **H.264 / AAC-free mp4** for the widest support. WebM (VP9) as the smaller
  first choice if available.
- **Nothing legible.** At this blur most things vanish, but frame it as though
  they don't: no whiteboards with names against dollar figures, no KPI or
  leaderboard content, no identifiable members of the public, no children.
  See `brand/notes/RESTRICTED.md` — the photo clearances apply to video too.
- **First frame should resemble `hero-bg.jpg`**, since the still is what shows
  underneath and during load. A hard visual jump on swap looks like a glitch.

## What already happens for you

`site.js` deliberately leaves the still image in place when:

- the visitor has **reduced motion** turned on,
- the screen is **720px or narrower** (a background video is data a phone
  visitor spends on something they can barely see),
- the browser reports **save-data** or a 2G-class connection,
- the video **fails to load, is an unsupported codec, or autoplay is blocked**.

The video only fades in once it is genuinely playing, so none of those cases
ever show a black rectangle. The still is the guaranteed floor.

## Source footage

Raw material is in `brand/videos/` (~3.2 GB of phone clips and social exports).
It needs a human to choose and cut a clip — Claude cannot watch video, so it
cannot pick the shot or tell you whether one is any good. Give it a filename and
a timecode and it can do the encode and the wiring.
