# Sixfold Colorado — social media kit: upload guide

**Rebuilt 2026-09-08** from the 2026-08-21 set. One visual system across every
platform: Pine Black `#0E1512` ground, the Ridge mark in Ember `#E4703A`, the
"Sixfold" serif wordmark, Moss `#8AA07A` descriptor and contact line, an ember
rule.

**New contact number `(303) 915-1045` is baked into every banner.** The old
number `(720) 772-6146` and the assets that carried it are in
[_superseded-2026-09-08/](_superseded-2026-09-08/) — do not upload those.

**Status: draft & stage only.** No account has been created on any platform,
nothing uploaded, nothing posted. Same standing rule as every Sixfold surface.

- **All files:** [out/](out/) — 23 PNGs.
- **See them first:** open [out/review.html](out/review.html).
- **Regenerate:** `node build-social.mjs` (needs Chrome). Provenance in
  [out/MANIFEST.json](out/MANIFEST.json).

---

## The rule for profile marks

**There is one mark artwork, in two forms:**

- **crest** (no roots) — for avatars that display small and circle-cropped
  (LinkedIn, Facebook, Instagram, X). The ten root strands turn to mush below
  ~96px.
- **full** (with roots) — for larger placements (Nextdoor, YouTube, Google logo)
  and a light-ground alternate on Bone.

Each is exported at the size its platform wants, named for that platform. Upload
the file with the platform's name in it.

---

## Platform by platform

### LinkedIn — Sixfold Colorado page
| Slot | File | Where to put it |
|---|---|---|
| Page logo | `sixfold-avatar-linkedin-400.png` | Admin view → **Edit page** → *Page info* → **Logo**. Square (min 300). |
| Cover image | `sixfold-banner-linkedin-company-1128x191.png` | Admin view → **Edit page** → **Cover image**. 1128×191. One row: mark · Sixfold · phone. |

> Logo tile sits lower-left over the cover — the row is centred and clears it.

### LinkedIn — personal profile *(optional)*
| Slot | File | Where to put it |
|---|---|---|
| Background photo | `sixfold-banner-linkedin-personal-1584x396.png` | Profile → camera on the background strip → **Add photo**. 1584×396 (4:1). |

### Facebook — Sixfold Colorado page
| Slot | File | Where to put it |
|---|---|---|
| Profile picture | `sixfold-avatar-facebook-500.png` | Page → **Edit** on the profile picture → **Upload photo**. Circle, 176/196px. Crest. |
| Cover photo | `sixfold-banner-facebook-1640x624.png` | Page → **Edit** on the cover → **Upload photo**. 1640×624; mobile crops toward the centre — content is centred for that. Full lockup + bio line + contact. |

### Instagram — Sixfold Colorado
| Slot | File | Where to put it |
|---|---|---|
| Profile photo | `sixfold-avatar-instagram-320.png` | **Edit profile** → **Change profile photo**. Circle. Crest. |
| Story Highlight covers | `sixfold-ig-highlight-1-tree.png` … `-6-doc.png` | On a Highlight → **Edit Highlight** → **Edit cover**. Six ember icons: tree, flame, axe, chipper, shield, doc. Centre circle only. |

*(Instagram has no banner.)*

### X — Sixfold Colorado
| Slot | File | Where to put it |
|---|---|---|
| Profile photo | `sixfold-avatar-x-400.png` | **Edit profile** → camera on the avatar. Circle. Crest. |
| Header photo | `sixfold-banner-x-1500x500.png` | **Edit profile** → camera on the header. 1500×500 (3:1). Lower-left is covered by the profile photo. |

### Nextdoor — Sixfold Colorado business page
| Slot | File | Where to put it |
|---|---|---|
| Business logo | `sixfold-avatar-nextdoor-1200.png` | Business page → **Edit** → **Business logo**. Circle. Full mark with roots. |
| Cover photo | `sixfold-banner-nextdoor-1440x400.png` | Business page → **Edit** → **Cover photo**. 1440×400 working assumption — **check the dialog's crop box**; if it differs use `sixfold-banner-16x9-1920x1080.png`. |

### YouTube — Sixfold Colorado channel
| Slot | File | Where to put it |
|---|---|---|
| Profile picture | `sixfold-avatar-youtube-800.png` | **Customise channel** → **Branding** → **Picture**. Min 98×98, 4 MB max. |
| Banner image | `sixfold-banner-youtube-2560x1440.png` | **Customise channel** → **Branding** → **Banner image**. Upload 2560×1440. Only the centre **1546×423** shows on every device — the lockup is inside it. |

### Google Business Profile — Sixfold Colorado
| Slot | File | Where to put it |
|---|---|---|
| Logo | `sixfold-logo-google-720.png` | Business Profile → **Photos** → **Logo**. Google recommends exactly 720×720 (min 250; 10 KB–5 MB). |
| Cover | `sixfold-banner-google-1024x576.png` | Business Profile → **Photos** → **Cover**. 16:9. |

> **Verified from Google's own help page (read 2026-08-21):** JPG/PNG, 10 KB–5 MB,
> recommended 720×720, min 250×250. The logo will not display until the profile
> also carries name, address, category, phone and hours, and photos take 24–48 h
> to appear after verification.

### Light-ground alternate
`sixfold-avatar-on-bone-1024.png` — the mark on Bone `#EDE7DC` instead of Pine.
For any placement that sits the avatar on dark chrome and needs a light tile.

---

## Quick reference — every file

| File | Platform | Field |
|---|---|---|
| `sixfold-avatar-linkedin-400.png` | LinkedIn page | Page logo (crest) |
| `sixfold-avatar-facebook-500.png` | Facebook | Profile picture (crest) |
| `sixfold-avatar-instagram-320.png` | Instagram | Profile photo (crest) |
| `sixfold-avatar-x-400.png` | X | Profile photo (crest) |
| `sixfold-avatar-nextdoor-1200.png` | Nextdoor | Business logo (full) |
| `sixfold-avatar-youtube-800.png` | YouTube | Channel picture (full) |
| `sixfold-logo-google-720.png` | Google Business Profile | Logo (full) |
| `sixfold-avatar-on-bone-1024.png` | — | Light-ground alternate |
| `sixfold-avatar-master-1024.png` | — | Fallback; downscale |
| `sixfold-banner-linkedin-company-1128x191.png` | LinkedIn page | Cover image |
| `sixfold-banner-linkedin-personal-1584x396.png` | LinkedIn personal *(opt.)* | Background photo |
| `sixfold-banner-facebook-1640x624.png` | Facebook | Cover photo |
| `sixfold-banner-x-1500x500.png` | X | Header photo |
| `sixfold-banner-nextdoor-1440x400.png` | Nextdoor | Cover photo |
| `sixfold-banner-youtube-2560x1440.png` | YouTube | Banner image |
| `sixfold-banner-google-1024x576.png` | Google Business Profile | Cover |
| `sixfold-banner-16x9-1920x1080.png` | — | Any other 16:9 / crop fallback |
| `sixfold-ig-highlight-1-tree.png` … `-6-doc.png` | Instagram | Story Highlight covers |

---

## What is deliberately not on these assets

Same standing rules as every Sixfold surface — they apply to profiles and bios
too, not just print:

- **No "licensed and insured", "certified", "bonded", "Firewise".** None true yet.
- **No county cost-share by name** (Douglas County included) until Sixfold is on
  the approved contractor list.
- **No website URL.** `SixfoldColorado.com` is owned but not hosted — a dead link
  is worse than none. `Contact@SixfoldColorado.com` is live and could be added if
  you want an email on the banner (it is not on them now).
- **No street address.** Service area "Front Range" only.
- **No price, offer, "free estimates", or track record** (years / job counts /
  reviews).
- **"We handle the paperwork for you" is banned phrasing.** Not used.

**On the banners, and fact-checked in `../../marketing/facebook-page-copy.md`:**
"Sixfold" · "Land & Fire" (accepted placeholder) · "We do the work and show you
who pays for it." · "Fire mitigation · Front Range · (303) 915-1045".

---

## Open / to sweep next

- **`(720) 772-6146` still appears elsewhere.** The new number needs to reach:
  `../../marketing/` (Facebook page copy, Square business description), the Square
  asset set (`../square/`), `../../site/` if a number is shown, and any quote or
  agreement template. Not done in this pass — flag for a follow-up.
- **Ridge vs Sweep** is still formally Brandon's call. Every built asset uses
  Ridge; swap `RIDGE_*` in `build-social.mjs` and re-run if that changes.
- **"Land & Fire"** is still a placeholder descriptor.
- **Confirm each platform's real crop** in its own upload dialog before pages go
  live; re-export if any differ.
