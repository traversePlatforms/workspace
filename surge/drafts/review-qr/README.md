# Google review QR — Surge

Generated 2026-09-08. Points people straight at the "rate & review" box for
Surge's Google Business Profile.

**Encoded link:** `https://g.page/r/CbLJ0flOE4VvEBM/review`
— the short link from the Business Profile's *Ask for reviews* button. It 302s to
`search.google.com/local/writereview?placeid=ChIJQ1kalQKBa4cRssnR-U4ThW8`.
If the link ever changes, regenerate (see below) rather than editing the files.

## Files

| File | Use |
|---|---|
| `surge-review-qr.svg` | **Print** — branded (SURGE badge centre), infinitely scalable. Default choice for cards, table tents, posters, stickers. |
| `surge-review-qr.png` | Digital / quick use — branded, 1400×1400. |
| `surge-review-qr-plain.svg` | Print, **no centre badge** — maximum scan reliability (use if a cheap printer or a tiny size is muddying the badged one). |
| `surge-review-qr-plain.png` | Digital, no badge, 1400×1400. |

All are black on white with a 4-module quiet zone and error-correction level H.

## Checked

Both the branded and plain codes were decoded back to the exact URL with a
real-world reader (jsQR) after rasterising. **Still do a physical test:** print
the size you'll actually use and scan it with 2–3 different phones (iOS Camera +
an Android or two) before ordering a batch. Keep at least a 6–8 mm white border
around the code on whatever it's placed on.

## Choosing a look

- **"Surge Review QR" artifact** — `https://claude.ai/code/artifact/5a06b01e-6d7c-44b4-8b69-960aa1c6f42d`.
  Hosted page, opens in any browser (phone or desktop), nothing to download. The reviewer
  picks a look, fills in their name, hits **Copy my pick**, and pastes the plain-text summary
  into a reply. **Private until shared** — open it and use the page's Share menu to send the
  boss a link. This is the version to use when he's not at your machine.
- `surge-review-qr-builder.html` — the offline equivalent. Open in a browser (double-click).
  Live preview of the code + review card, editable colours and card text. **Save PNG / Save
  SVG** for the code; **Print / Save as PDF** for the card (the dark card now prints its
  background correctly). Runs locally, nothing is sent anywhere.
- `surge-review-qr-pick-sheet.pdf` — one-page **decision form for the boss**, ready to send.
  Four code looks side by side with tick boxes, plus card style, wording, and where it'll be
  used. He prints and ticks by hand, or marks it up in any PDF viewer (Preview, Edge,
  Acrobat) — the boxes are drawn, not fillable form fields. Marked-up sheet comes back → we
  produce the final print files.
- `surge-review-qr-pick-sheet.html` — the editable source for that PDF. Change wording or
  options here, then re-export (headless Chrome `--print-to-pdf`, or open and Print → Save
  as PDF).

## Regenerating

Script + deps are in this session's scratchpad (`scratchpad/qrgen/`, ephemeral).
To rebuild: `npm i qrcode`, then a short script that calls
`QRCode.toString(url, {type:'svg', errorCorrectionLevel:'H', margin:4})` and
injects a centred `<rect>` badge + the SURGE wordmark `<path>` (pulled from
`drafts/surge-site/index.html`). The interactive version is the
"Surge Review QR" artifact.

Not posted anywhere — this is collateral for print/print-shop handoff.
