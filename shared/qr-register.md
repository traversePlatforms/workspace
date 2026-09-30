# QR register — every code, and where it actually goes

**Audited 2026-09-29** (TASKS.md X-2). Every QR asset in the workspace was **decoded back**,
not read off a filename. `_archive/` excluded.

**Method:** rasterise each PNG and SVG at 1200 / 800 / 600 px and decode with jsQR. A code that
does not scan looks exactly like one that does, so nothing here is asserted from its source
document.

## Result — 13 assets, 2 destinations, no defects

| Destination | Files | Entity | Status |
|---|---|---|---|
| `https://linktr.ee/SixFoldColorado` | 9 | Sixfold | **live**, checked 2026-09-29 |
| `https://g.page/r/CbLJ0flOE4VvEBM/review` | 4 | Surge | **live** — 302s to Google's review form |

**All 13 decoded cleanly. No stale codes, no wrong destinations, no dead links, no duplicates
pointing at different places.** That is a better result than expected.

### Sixfold — `sixfold/brand/qr/` (9 files, one code)

`sixfold-qr-brand` · `-brand-nologo` · `-brand-on-white` · `-print-black` (each .png + .svg)
and `-on-dark-tile.png`. Variants of one code, different grounds and treatments.

**In circulation:** the **printed business card** (`sixfold-qr-brand.png`) and the door flyer
(`-brand-on-white.png`, mono build swaps to `-print-black.png`, not yet printed).

### Surge — `surge/drafts/review-qr/` (4 files, one code)

`surge-review-qr` and `-plain`, each .png + .svg. The link 302s to
`search.google.com/local/writereview?placeid=ChIJQ1kalQKBa4cRssnR-U4ThW8`, and that Place ID
matches the one on record for Surge. **Not printed — still in `drafts/`.**

*(The redirect confirms the link resolves and carries the right Place ID. The review form
itself renders in JavaScript, so the business name was not read back from it.)*

---

## ⚑ What the audit actually found: three gaps, not three errors

### 1. Sixfold has no review QR at all

Surge has one; Sixfold does not. Sixfold has a Google Business page — it is linked from the
Linktree — but nothing takes a customer straight to the review form. **TASKS.md X-3 is "push
for reviews across the board", and Sixfold currently cannot at parity with Surge.**

**What is needed:** Sixfold's Place ID or its `g.page/r/…/review` link, out of its Google
Business Profile. Then `sixfold/brand/qr/build-qr.mjs` generates the family, and the review
collateral Surge already has can be reskinned rather than rebuilt.

### 2. Surge has no general / social QR

Only the review code exists. If the Surge Linktree (TASKS.md SG-3) is going on anything
printed, there is no code for it.

### 3. ⚑ Every Sixfold printed piece depends on one third party

All nine Sixfold assets are the same code, and it points at **Linktree** — so every card,
flyer and future magnet leads through a free-tier third-party page.

**This is the exact risk `brand/qr/README.md` refused to take on the encoding side.** The codes
were generated locally, deliberately, so that no QR service could redirect them, start charging
or shut down. The destination then reintroduced the same dependency by another door.

**`sixfoldcolorado.com` is live and is the durable destination** — it cannot change terms and
it belongs to Sixfold. **But the cards are already printed**, so this is now an argument for
*future* collateral, not a reason to reprint anything. See the card README.

---

## Rules worth keeping

- **Decode, never assume.** Filenames and surrounding documents are not evidence.
- **Verify the destination too**, not just the encoding. A perfect code to a dead page fails.
- **Re-run this after any QR is regenerated or any destination changes.**
- Deps for this (`jsqr`, `pngjs`, and `qrcode` to re-encode) install into a scratch directory
  outside OneDrive in about a second — see [[qr-in-print]] in memory.
