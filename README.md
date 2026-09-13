# Where everything is

Reorganised 2026-09-13. Three separate entities, one folder each, plus shared tooling and an archive.
Rules for working here are in [CLAUDE.md](CLAUDE.md).

```
claude test 2/
├─ README.md               ← this file
├─ CLAUDE.md               ← the rules (read every session)
│
├─ surge/        780 files   3.8 GB   the sales company
├─ sixfold/      223 files    18 MB   the fire-mitigation company
├─ matthew/       11 files   1.1 MB   your own freelance offering
├─ shared/         6 files   0.1 MB   tools used by more than one
└─ _archive/   1,943 files   139 MB   superseded / duplicate / not relevant
```

## surge/ — outsourced sales & marketing

| Folder | What's in it |
|---|---|
| `brand-voice-company.md`, `brand-voice-personal.md` | The two voice specs. Read one before drafting. |
| `training-publishability-review.md` | Which training material can be published |
| [surge/brand/](surge/brand/) | 399 files, 3.7 GB — logos, photos, videos, your typed notes, design guidelines. Start at its README. |
| [surge/training-source/](surge/training-source/) | The 8 training-step `.docx` files + template |
| [surge/drafts/](surge/drafts/) | 173 files — **social output only**: posts, infographics, carousels, the social kit, review QR |
| [surge/website/](surge/website/) | The surgeftw.com rebuild. `build/` is the live one; also `holding-page/`, `wp-restore/`, `source-material/` |
| [surge/clients/](surge/clients/) | Client work. Currently `storm-restoration/` — platform sheet, lead engine, hiring set, roof infographic |

The big number is video: `surge/brand/videos/` alone is ~3.2 GB. Everything else in Surge is about 570 MB.

## sixfold/ — fire mitigation

Left exactly as it was; it was already the tidiest tree here. Start at [sixfold/README.md](sixfold/README.md), which is the project-state file. Contains `agreements/`, `brand/`, `content/`, `marketing/`, `operations/`, `quotes/`, `research/`, `site/`, `tax-credit-notebook/`, `tools/`.

## matthew/ — your own thing

Your independent websites-and-marketing offering: rate card, services page, pricing, outreach emails, hosting notes, and `matthew-sharpe-rates.pdf`.

**The brand name is still open.** The old `rates-onesheet` files were branded "HORIZON" — that's **Donny's company**, not yours — so they sit in `_horizon-branded-superseded/` and should be rebuilt under whatever name you pick. Rename this folder then too.

## shared/ — used by more than one entity

- `shared/tools/` — `Extract-Docx.ps1`, `Build-Marks.py`, `Trace-Logo.py`, `Print-Pdf.mjs`, `Declient-Photo.py`
- `shared/presentation/build-so-far.html` — the "Three systems, one stack" overview

## _archive/ — kept, not deleted

Nothing here is referenced by live work. Delete any pile you're confident about.

| Pile | Size | Why it's here |
|---|---|---|
| `node_modules-checklist-pdf/` | 1,643 files, 21 MB | Dependency tree. `npm install` in `surge/drafts/checklist-pdf/` rebuilds it. **Safe to delete.** |
| `surge-website-schemes-2026-09-08/` | 236 files, 57 MB | Three colour-scheme experiments, each with its own revert README |
| `duplicate-photos/` | 46 files, 60 MB | Piles already labelled as duplicates, plus pre-rotation originals |
| `surge-website-removed/` | 11 files | Pages and insight articles cut from the site |
| `unrelated/` | 6 files | `claire-raccoon-manga/`, and a stray `sixfold$winrel.pdf` from the root |
| `MOVE-MANIFEST-2026-09-13.csv` | — | **Every one of the 69 moves, from → to.** The record of where things came from — git history starts *after* the move. |

## Where does a new file go?

- A social post, infographic or carousel for Surge → `surge/drafts/`
- Anything for a Surge client → `surge/clients/<sector>/`  (**sector name, never the client's name**)
- Site pages, templates, assets → `surge/website/build/`
- Your typed notes, photos, logos → `surge/brand/`
- A training step `.docx` → `surge/training-source/`
- Anything Sixfold → `sixfold/<existing subfolder>`
- Your own rates, services, outreach → `matthew/`
- A script used by two entities → `shared/tools/`

## Version control

**Git repository since 2026-09-13**, branch `main`, no remote. First commit is the post-reorganisation restore point.

**Tracked** (666 files, 62 MB): markdown, HTML, CSS, scripts, SVG, PDFs, the `.docx` training sources, small images, and the notes `.md` files that live inside `surge/brand/photos/`.

**Not tracked** — see [.gitignore](.gitignore): raw video (3.2 GB), the `surge/brand/photos/` image tree (~500 MB), camera `.heic` originals, `node_modules/`, `**/deploy/dist/` bundles, `.zip`/`.wpress` archives, and the `_archive/` payload (its `README.md` and the move manifest *are* tracked).

> **Git is not a backup for the excluded media.** Roughly 3.9 GB of video and photos sits outside version control and needs a real backup.

Useful:
```
git log --oneline              # history
git status --short             # what changed
git diff                       # review before committing
git checkout -- <file>         # undo edits to one file
```

`core.autocrlf` is `false` repo-local, deliberately — git must not rewrite line endings on files whose encoding was just repaired.

## Two other things to know

**There is a stale duplicate of this project in OneDrive.** `C:\Users\Surge Inc\OneDrive\Desktop\claude test 2` is ~3.7 GB, frozen around 2026-09-04, still on the old folder structure. Left over from when OneDrive Desktop backup was enabled. **This folder — the live one — is not synced to OneDrive.** Don't edit the OneDrive copy; decide whether to delete it or make it the backup.

**Don't edit markdown with PowerShell.** `Get-Content -Raw` in PowerShell 5.1 reads UTF-8 as ANSI and silently double-encodes every em-dash on write. Use the editor, or Node. See the note at the end of [CLAUDE.md](CLAUDE.md).
