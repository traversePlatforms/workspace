# _archive — set aside 2026-09-13

Nothing in here is referenced by live work. It was kept rather than deleted on your
instruction ("archive everything, delete nothing"). Empty any pile you're confident about.

[MOVE-MANIFEST-2026-09-13.csv](MOVE-MANIFEST-2026-09-13.csv) lists all 69 moves made during the
reorganisation, `From` → `To`. This project is not under git, so that CSV is the only undo record.

## What's here

### `node_modules-checklist-pdf/` — 1,643 files, 21 MB
The dependency tree for `surge/drafts/checklist-pdf/` (one package: `pdf-lib`).
`package.json` and `package-lock.json` are still in the project folder, so
`npm install` there rebuilds this exactly. **This is the one pile that is safe to
delete outright** — it was 73% of the file count in the old `drafts/` folder and
is most of why that folder felt unnavigable.

### `surge-website-schemes-2026-09-08/` — 236 files, 57 MB
Three near-identical copies of the Surge site from the 2026-09-08 colour-scheme work:
`dark-backup/`, `scheme-b/`, `scheme-c/`. Each still carries its own `_REVERT-README.md`
or `_SCHEME-README.md` explaining what it was for. The live site is `surge/website/build/`,
which is newer than all three. Keep until the palette is settled, then delete.

### `duplicate-photos/` — 46 files, 60 MB
- `duplicates-2026-08-13/`, `duplicates-2026-09-11/` — piles a previous pass already
  identified as duplicates and named accordingly.
- `culture-originals-pre-rotation/` — the pre-rotation originals of four Culture photos.
  The rotated versions are live in `surge/brand/photos/Culture/`.

Check nothing here is the only copy of a shot you want before deleting.

### `surge-website-removed/` — 11 files
`pages-removed/` (careers-apply, how-it-works, sectors/{aeration,nonprofit,roofing}, training)
and `insights-removed/` (discovery-questions, talk-ratio, training-retention) — pages and
articles deliberately cut from the site build. Kept because the copy is reusable.

### `unrelated/` — 6 files
- `claire-raccoon-manga/` — five images, not Surge, not Sixfold, not yours-freelance.
- `sixfold$winrel.pdf` — was loose in the project root with a temp-looking filename.

Neither belongs to any of the three entities. Move them somewhere personal or delete.
