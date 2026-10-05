# Retired 2026-10-05: client logos and client-branded photos

Moved out of `build/assets/img/` so the bundle stops shipping them. Nothing on the site referenced
them any more, but every file in the bundle is reachable by URL.

Why: the office's staging review (2026-09-29), confirmed by Matthew 2026-10-05 — no client logos and
no client-branded gear on any page. See the 2026-10-05 revision at the top of
`surge/brand/notes/RESTRICTED.md`, which governs.

- `clients/` — the two marks from the old /about/ client wall
- `booth-event.jpg` — the old /what-we-do/ hero (client banner and client shirts)
- `field-booth-event.*`, `field-booth-nonprofit.*` — unused booth frames, same problem

Archived, not deleted. Do not move any of them back into `build/`.
