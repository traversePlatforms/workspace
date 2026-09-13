# Surge — social media kit (WORDMARK ONLY): upload guide

**Built 2026-09-08.** The same kit as [../social-kit/](../social-kit/) — same
palette (brand green kept), same dimensions, same layouts, same file list —
**with the added three-bar mark removed everywhere.** Just the default Surge
wordmark we have always used, on the dark ground, with a green baseline rule and
a faint green glow on the banners.

**Use this one while the bar mark is being confirmed.** When it's approved,
switch to [../social-kit/](../social-kit/) — the mark is the only difference.

**Status: draft & stage only.** Nothing uploaded, posted, or scheduled.

- **All files:** [out/](out/) — 22 PNGs, every name prefixed `surge-wm-`.
- **See them first:** [out/review.html](out/review.html).
- **Regenerate:** `node build-social.mjs` (needs Chrome). Provenance in
  [out/MANIFEST.json](out/MANIFEST.json).

---

## About the profile pictures — read this

There is no bar mark, so the avatar is **the wordmark set into the square**. The
wordmark is 3.69 : 1 and has no square form (see `brand/logos/README.md`), so:

- it reads well at the sizes a profile picture is actually shown (~100–200 px);
- it gets small and hard to read below ~64 px (a comment avatar, a favicon).

**That gap is exactly what the square mark is for** — it's the thing pending
sign-off. If the answer is no bar mark at all, the alternatives are a cropped
"S" monogram or a tighter stacked lockup; say which and I'll cut it.

One avatar artwork, exported at seven sizes named per destination — upload the
file with the platform's name in it.

---

## Platform by platform

### LinkedIn — Surge company page
| Slot | File | Where |
|---|---|---|
| Page logo | `surge-wm-avatar-linkedin-400.png` | Admin view → **Edit page** → *Page info* → **Logo**. Square (min 268). |
| Cover image | `surge-wm-banner-linkedin-company-1128x191.png` | Admin view → **Edit page** → **Cover image**. 1128×191. Wordmark centred, clear of the lower-left logo tile. |

### LinkedIn — personal profile *(optional)*
| Slot | File | Where |
|---|---|---|
| Background photo | `surge-wm-banner-linkedin-personal-1584x396.png` | Profile → camera on the background strip → **Add photo**. 1584×396 (4:1). |

### Facebook — Surge page
| Slot | File | Where |
|---|---|---|
| Profile picture | `surge-wm-avatar-facebook-500.png` | Page → **Edit** on the profile picture → **Upload photo**. Circle, 176/196 px. |
| Cover photo | `surge-wm-banner-facebook-1640x624.png` | Page → **Edit** on the cover → **Upload photo**. 1640×624; mobile crops toward centre — content is centred. |

### Instagram — Surge
| Slot | File | Where |
|---|---|---|
| Profile photo | `surge-wm-avatar-instagram-320.png` | **Edit profile** → **Change profile photo**. Circle. |
| Story Highlight covers | `surge-wm-ig-highlight-1-door.png` … `-6-chart.png` | On a Highlight → **Edit Highlight** → **Edit cover**. Six green line icons. Centre circle only. |

### X — Surge
| Slot | File | Where |
|---|---|---|
| Profile photo | `surge-wm-avatar-x-400.png` | **Edit profile** → camera on the avatar. Circle. |
| Header photo | `surge-wm-banner-x-1500x500.png` | **Edit profile** → camera on the header. 1500×500 (3:1). Lower-left covered by the profile photo. |

### Nextdoor — Surge business page
| Slot | File | Where |
|---|---|---|
| Business logo | `surge-wm-avatar-nextdoor-1200.png` | Business page → **Edit** → **Business logo**. Circle. |
| Cover photo | `surge-wm-banner-nextdoor-1440x400.png` | Business page → **Edit** → **Cover photo**. 1440×400 working assumption — check the dialog's crop box; if it differs use `surge-wm-banner-16x9-1920x1080.png`. |

### YouTube — Surge channel
| Slot | File | Where |
|---|---|---|
| Profile picture | `surge-wm-avatar-youtube-800.png` | **Customise channel** → **Branding** → **Picture**. Min 98×98, 4 MB max. |
| Banner image | `surge-wm-banner-youtube-2560x1440.png` | **Customise channel** → **Branding** → **Banner image**. Upload 2560×1440. Only the centre **1546×423** shows on every device — the wordmark is inside it. |

### Google Business Profile — Surge
| Slot | File | Where |
|---|---|---|
| Logo | `surge-wm-logo-google-720.png` | Business Profile → **Photos** → **Logo**. Recommended 720×720 (min 250; 10 KB–5 MB). |
| Cover | `surge-wm-banner-google-1024x576.png` | Business Profile → **Photos** → **Cover**. 16:9. |

---

## Quick reference — every file

| File | Platform | Field |
|---|---|---|
| `surge-wm-avatar-linkedin-400.png` | LinkedIn company | Page logo |
| `surge-wm-avatar-facebook-500.png` | Facebook | Profile picture |
| `surge-wm-avatar-instagram-320.png` | Instagram | Profile photo |
| `surge-wm-avatar-x-400.png` | X | Profile photo |
| `surge-wm-avatar-nextdoor-1200.png` | Nextdoor | Business logo |
| `surge-wm-avatar-youtube-800.png` | YouTube | Channel picture |
| `surge-wm-logo-google-720.png` | Google Business Profile | Logo |
| `surge-wm-avatar-master-1024.png` | — | Fallback; downscale |
| `surge-wm-banner-linkedin-company-1128x191.png` | LinkedIn company | Cover image |
| `surge-wm-banner-linkedin-personal-1584x396.png` | LinkedIn personal *(opt.)* | Background photo |
| `surge-wm-banner-facebook-1640x624.png` | Facebook | Cover photo |
| `surge-wm-banner-x-1500x500.png` | X | Header photo |
| `surge-wm-banner-nextdoor-1440x400.png` | Nextdoor | Cover photo |
| `surge-wm-banner-youtube-2560x1440.png` | YouTube | Banner image |
| `surge-wm-banner-google-1024x576.png` | Google Business Profile | Cover |
| `surge-wm-banner-16x9-1920x1080.png` | — | Any other 16:9 / crop fallback |
| `surge-wm-ig-highlight-1-door.png` … `-6-chart.png` | Instagram | Story Highlight covers |

---

## What's on these assets

| Element | Source / status |
|---|---|
| Ground `#0a0a0a`, text `#f4f4f4`, grey `#ababab`, green `#4abe4a` | `brand/guidelines/README.md` — the dark website ramp + brand green. **Green kept** (baseline rule + glow only). |
| Wordmark | `brand/logos/surge-wordmark.svg`, white — the default logo, inverted for dark. **No bar mark.** |
| Descriptor "Outsourced sales & marketing" | Cleared — `brand/notes/RESTRICTED.md` "Clear to use". No superiority/uniqueness claim. |
| No tagline, metric, client, or location | Off on purpose (brand-voice-company §1/§2/§5, RESTRICTED Tier 4). |

Dimensions: LinkedIn / X / YouTube specs used as published; Facebook / Nextdoor use
working ratios with centre-weighted compositions. **The upload dialog's crop
preview is the authority** — re-run the generator if any box differs.

**Nothing here has been published.** Approval for one platform isn't approval for
the next.
