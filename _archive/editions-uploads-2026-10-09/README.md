# editions-uploads-2026-10-09 — set aside 2026-10-27

Three upload packs from 9 October 2026, moved out of `traverse/editions/dist/` (code review 2026-10-27, item 10). All three
went live that day and were verified; `dist/` is rebuilt by `node traverse/editions/build-editions.cjs`, so nothing here is
needed to rebuild or redeploy anything. No script, page or note in the repo points at these paths.

| Folder | What it was |
|---|---|
| `upload-2026-10-09/` | `extract-in-public_html.zip`, the 9 Oct afternoon app upload (see the traverse-app-copy notes) |
| `upload-speed-2026-10-09/` | `extract-in-public_html.zip`, the 9 Oct speed pass (minified page) |
| `upload-teller-2026-10-09/` | Teller County roof and solar side files for Roofing and Solar (Cripple Creek, Divide, Florissant, Woodland Park) |

`MOVE-MANIFEST-2026-10-27.csv` lists each file's old and new path, size and md5 (14 files, 4.3 MB). Gitignored payload, like
the rest of `_archive/`: git holds only this README and the manifest.
