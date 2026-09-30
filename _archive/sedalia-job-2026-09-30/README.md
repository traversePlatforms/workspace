# Sedalia job — set aside 2026-09-30

**Job closed.** Archived rather than deleted, per the standing instruction from the 2026-09-13
reorganisation: *archive everything, delete nothing.* The From/To record is
[MOVE-MANIFEST-2026-09-30.csv](MOVE-MANIFEST-2026-09-30.csv), and unlike that earlier move this
one is in git too.

11 files: the service agreement in all four forms it existed in, and both quote options —
**A, hauled away** and **B, chipped on site** — with their sources.

## ⚑ What did NOT come here, and why

**`sedalia-A-service-agreement.notes.md` stayed in `sixfold/agreements/`.** Twenty-two live
documents reference Sedalia, and that notes file is the one carrying knowledge the rest depend
on — `kara-docusign-setup.md` cites it for the finding that a `-DocuSign.pdf` is byte-identical
to the ordinary render, and `operations/invoice-spec.md` cites the two quotes here as the worked
example of a quote too coarse to split at invoicing time. **Archive the artefacts, keep the
lessons.**

**`marketing/sedalia-owner-funding-guide`** also stayed. It is named for the Sedalia owner but is
really a reusable funding guide, so it belongs with the marketing sweep rather than here.

## One to-do that is now parked with the file

`sedalia-A-service-agreement-fillable.pdf` carries **30 AcroForm fields** and has **no generator
in the repo** — the agreements README lists rebuilding it as a generated AcroForm as an
afternoon's work that would make it reproducible for the first time. If a fillable agreement is
ever wanted again, build it fresh from the current template rather than editing this one; it is
filled with Sedalia's details.

## Generators updated in the same commit

`agreements/build.mjs`, `quotes/build.mjs` and three JOBS entries in `tools/html-to-pdf.mjs`,
so no build looks for these files any more.
