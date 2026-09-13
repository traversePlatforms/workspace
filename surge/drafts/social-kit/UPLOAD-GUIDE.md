# Surge — social media kit: upload guide

**Built 2026-09-08.** One visual system across every platform: `#0a0a0a` ground,
the ascending-bars mark in brand green `#4abe4a`, the traced Surge wordmark, a
mono descriptor, a green baseline rule.

**Status: draft & stage only.** Nothing here has been uploaded, posted, or
scheduled. This guide tells you which file goes in which field when you decide
to publish. Standing rule (CLAUDE.md): I don't post — you do.

- **All files:** [out/](out/) — 22 PNGs.
- **See them first:** open [out/review.html](out/review.html) — every asset at a
  legible size with its label.
- **Regenerate:** `node build-social.mjs` (needs Chrome). Change the composition
  once, the whole set re-exports. Provenance in [out/MANIFEST.json](out/MANIFEST.json).

---

## The rule for profile pictures

**There is one avatar artwork.** It is exported at seven sizes, each file named
for where it goes, so you never have to guess or resize. Upload the file with the
platform's name in it. They are pixel-identical apart from resolution.

The bars sit inside a centre circle with margin — it survives every platform's
circle crop.

---

## Platform by platform

### LinkedIn — Surge company page
| Slot | File | Where to put it |
|---|---|---|
| Page logo | `surge-avatar-linkedin-400.png` | Admin view → **Edit page** → *Page info* → **Logo**. Square, 400×400 (min 268). |
| Cover image | `surge-banner-linkedin-company-1128x191.png` | Admin view → **Edit page** → **Cover image**. 1128×191. |

> The page tucks the round logo tile into the **lower-left** of the cover. The
> lockup is centred and clear of it. If LinkedIn's crop box in the dialog looks
> taller than 4:1, use `surge-banner-16x9-1920x1080.png` instead.

### LinkedIn — personal profile *(optional — only if you run Surge from your own profile too)*
| Slot | File | Where to put it |
|---|---|---|
| Background photo | `surge-banner-linkedin-personal-1584x396.png` | Your profile → camera icon on the background strip → **Add photo**. 1584×396 (4:1). |
| Profile photo | *(your headshot — not in this kit)* | — |

### Facebook — Surge page
| Slot | File | Where to put it |
|---|---|---|
| Profile picture | `surge-avatar-facebook-500.png` | Page → **Edit** (pencil on the profile picture) → **Upload photo**. Shows as a circle, 176px desktop / 196px mobile. |
| Cover photo | `surge-banner-facebook-1640x624.png` | Page → **Edit** on the cover → **Upload photo**. Uploads at 1640×624; desktop shows ~820×312, mobile crops toward the centre — everything important is centred. |

### Instagram — Surge
| Slot | File | Where to put it |
|---|---|---|
| Profile photo | `surge-avatar-instagram-320.png` | **Edit profile** → **Change profile photo**. Circle crop. |
| Story Highlight covers | `surge-ig-highlight-1-door.png` … `-6-chart.png` | On a Highlight → **Edit Highlight** → **Edit cover** → choose from gallery. Six line icons: door, phone, headset, booth, team, chart. Instagram shows the centre circle only. |

*(Instagram has no banner — the profile photo and the grid do that job.)*

### X — Surge
| Slot | File | Where to put it |
|---|---|---|
| Profile photo | `surge-avatar-x-400.png` | **Edit profile** → camera on the avatar. Circle crop, ~133px. |
| Header photo | `surge-banner-x-1500x500.png` | **Edit profile** → camera on the header. 1500×500 (3:1). Lower-left is covered by the profile photo — the lockup clears it. |

### Nextdoor — Surge business page
| Slot | File | Where to put it |
|---|---|---|
| Business logo / photo | `surge-avatar-nextdoor-1200.png` | Business page → **Edit** → **Business logo**. Circle crop. |
| Cover photo | `surge-banner-nextdoor-1440x400.png` | Business page → **Edit** → **Cover photo**. 1440×400 is a working assumption — **check the crop box the dialog shows** and if it differs, use `surge-banner-16x9-1920x1080.png`. |

### YouTube — Surge channel
| Slot | File | Where to put it |
|---|---|---|
| Profile picture | `surge-avatar-youtube-800.png` | **Customise channel** → **Branding** → **Picture**. Min 98×98, 4 MB max. |
| Banner image | `surge-banner-youtube-2560x1440.png` | **Customise channel** → **Branding** → **Banner image**. Upload 2560×1440. Only the centre **1546×423** is guaranteed on every device (TV, desktop, phone) — the lockup is inside that box; the rest is dark field. |

### Google Business Profile — Surge
| Slot | File | Where to put it |
|---|---|---|
| Logo | `surge-logo-google-720.png` | Business Profile → **Photos** → **Logo**. Google's own recommended size is exactly 720×720 (min 250; 10 KB–5 MB). |
| Cover | `surge-banner-google-1024x576.png` | Business Profile → **Photos** → **Cover**. 16:9. Setting a cover does **not** guarantee it shows first. |

> This is the same Google profile the review-QR collateral points at
> (`drafts/review-qr/`). Logo and cover only show once the profile carries name,
> address, category, phone and hours.

---

## Quick reference — every file

| File | Platform | Field |
|---|---|---|
| `surge-avatar-linkedin-400.png` | LinkedIn company | Page logo |
| `surge-avatar-facebook-500.png` | Facebook | Profile picture |
| `surge-avatar-instagram-320.png` | Instagram | Profile photo |
| `surge-avatar-x-400.png` | X | Profile photo |
| `surge-avatar-nextdoor-1200.png` | Nextdoor | Business logo |
| `surge-avatar-youtube-800.png` | YouTube | Channel picture |
| `surge-logo-google-720.png` | Google Business Profile | Logo |
| `surge-avatar-master-1024.png` | — | Fallback for any field not listed; downscale |
| `surge-banner-linkedin-company-1128x191.png` | LinkedIn company | Cover image |
| `surge-banner-linkedin-personal-1584x396.png` | LinkedIn personal *(optional)* | Background photo |
| `surge-banner-facebook-1640x624.png` | Facebook | Cover photo |
| `surge-banner-x-1500x500.png` | X | Header photo |
| `surge-banner-nextdoor-1440x400.png` | Nextdoor | Cover photo |
| `surge-banner-youtube-2560x1440.png` | YouTube | Banner image |
| `surge-banner-google-1024x576.png` | Google Business Profile | Cover |
| `surge-banner-16x9-1920x1080.png` | — | Any other 16:9 slot / crop fallback |
| `surge-ig-highlight-1-door.png` … `-6-chart.png` | Instagram | Story Highlight covers |

---

## About the dimensions

**LinkedIn, X and YouTube publish image specs** and those numbers are used as-is.
**Facebook and Nextdoor do not** publish reliable specs (Meta's help centre blocks
automated reads; Nextdoor's business help has no image dimensions). Those two use
long-standing working ratios and the compositions are centre-weighted so an
unknown crop takes the same amount off both sides. **The upload dialog's own crop
preview is the authority — trust it over this file** and re-run the generator if
any platform's box differs.

---

## What is deliberately on / not on these assets  (clearance log)

Design assets, so there is little to fact-check — but the copy that *is* on them
was checked against the brand files:

| Element | Source / status |
|---|---|
| Palette `#0a0a0a` / `#4abe4a` / `#f4f4f4` / `#ababab` | `brand/guidelines/README.md` — supplied brand green + the dark website ramp. |
| Wordmark | `brand/logos/surge-wordmark.svg` — the traced master, "this is the one". |
| Descriptor "Outsourced sales & marketing" | Plain category label. Cleared — `brand/notes/RESTRICTED.md` "Clear to use" (channels / what Surge is, §1 of `brand-voice-company.md`). No superiority or uniqueness claim. |
| No tagline, metric, client name, or location | Kept off on purpose. No proprietary-method claim (§1), no scale/footprint framing (§5), no unscoped figure (§2), no client identity (Tier 4). Base location (Englewood) and founding year are cleared and could be added to a banner later if you want them. |
| Alternate descriptors that also clear | "HIRING · TRAINING · MANAGING SALES TEAMS", "FIELD SALES, HANDLED". Change `DESCRIPTOR` in `build-social.mjs` and re-run. |

**Nothing here has been published.** When you want an account set up or a file
uploaded, say so per-platform — approval for one isn't approval for the next.
