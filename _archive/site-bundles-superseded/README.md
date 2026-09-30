# Superseded site bundles — set aside 2026-09-30

Two deploy bundles, moved out of `sixfold/site/dist/` so only the current one is there.

| Bundle | Files |
|---|---|
| `sixfold-site-2026-09-21` | 34 |
| `sixfold-site-2026-09-26` | 35 |

`sixfold-site-2026-09-28` stayed in `sixfold/site/dist/` — it is the current one.

## ⚑ Git is not a backup for these

`sixfold/site/dist/` is gitignored and so is this folder's payload, which means **git history
does not contain these files** — unlike everything else archived on 2026-09-30. Moving them here
keeps them on disk and in the OneDrive mirror; deleting them would be final.

They were moved rather than deleted for that reason: a bundle is the rollback path if a deploy
goes wrong, and the cost of keeping two is a folder nobody opens.

## Rebuilding instead

A bundle can be regenerated from source with `make-bundle.mjs` rather than restored from here,
so these matter most as a record of *what was actually live* on those dates, not as build
artefacts.
