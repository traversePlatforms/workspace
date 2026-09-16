# Workspace: three separate entities

Loads automatically each session. Keep it short — it's read every time.
Folder map and "where does this go" → [README.md](README.md).

## Route by entity first — they are not the same company

| Folder | What it is | Voice / rules |
|---|---|---|
| [surge/](surge/) | **Surge** — outsourced sales & marketing. Matthew's employer. | The two voice specs in `surge/` |
| [sixfold/](sixfold/) | **Sixfold LLC** — fire mitigation. Different company, Brandon's. | [sixfold/README.md](sixfold/README.md) |
| [matthew/](matthew/) | **Matthew's own** freelance websites & marketing offering. Brand name not chosen yet. | See §Matthew below |

**Never blend them.** Sixfold is not Surge; Surge's voice specs and RESTRICTED.md do not govern Sixfold or Matthew's own work. If a request doesn't say which entity, **ask** — don't infer from the topic.

**"Horizon" is Donny's company, not Matthew's.** Old rate sheets in `matthew/_horizon-branded-superseded/` carry that name and must not be reused as Matthew's brand.

---

## Publishing — draft and stage only

**Do not publish, post, or schedule anything to any platform.** Standing instruction as of 2026-08-05, no expiry. Applies to all three entities.

The Blotato MCP server can post to live social accounts. Available for reading account state and preparing content — **not for sending**.

- **Allowed:** writing and revising drafts, saving them to draft files, reading connected account info, preparing payloads for later review.
- **Not allowed without explicit per-request authorization:** publishing, posting, scheduling, queuing, or any action that puts content in front of an audience now or on a timer. **Scheduling counts as publishing** — it goes out without a further check.

The user will say when a publishing process should start. Until then, finished work ends in a draft file. If a request seems to imply posting, ask rather than inferring. Approval for one post is not approval for the next.

## Research standard — all entities

Any factual claim in a draft must trace to a primary source or a real outlet. Established during a research test where six SEO content farms recycled and invented confident, wrong specifics.

- Prefer first-party sources and named outlets over aggregators and content farms.
- Check the date on any number before using it — stale figures were off by 56% in testing.
- Where sources conflict and none is authoritative, leave the detail out rather than picking one.
- **Surge's own metrics count as factual claims** and need scope, date, and a pullable internal source — see [surge/brand-voice-company.md](surge/brand-voice-company.md) §2.
- Every draft file carries a fact-check log listing what was verified, what was corrected, and what stayed unresolved.

---

## Surge

### Before drafting anything

Read the applicable voice spec **before** writing a first line, not after:

- Personal post → [surge/brand-voice-personal.md](surge/brand-voice-personal.md)
- Company post → [surge/brand-voice-company.md](surge/brand-voice-company.md)

**If it isn't obvious which applies, ask.** Don't guess and don't blend the two. **Default to company register** — everything built here is company-first.

**Also read [surge/brand/notes/RESTRICTED.md](surge/brand/notes/RESTRICTED.md) before any draft.** Master list of what cannot be published, in four tiers, consolidated 2026-08-06. It overrides the restriction headers on individual notes files. The standing test for anything not listed: *would this read as confirmation to someone who already suspects the worst?* If yes, restricted — ask, don't infer.

For company posts, check the Constraints and Escalation sections and flag anything that trips them before handing over the draft.

### Voice quick reference

Both registers: sparing emoji, no formatting gimmicks (no emoji bullets, no single-word paragraphs, no stacked rhetorical questions), 150-200 words on LinkedIn, close on a question, 3-5 hashtags, links in the first comment.

**Stance is analytical.** Name companies and lay out the evidence, but stop short of the verdict — if a sentence tells the reader what to think about a named company, convert it to the underlying fact.

**Never fabricate a personal anecdote.** Leave a marked `[ANECDOTE]` slot with a suggested shape.

**On X:** drop hashtags, put links in the final tweet. Flag any other platform deviation rather than applying it silently.

### What Surge does

Outsourced sales and marketing — hiring, onboarding, training, and managing sales teams for companies that lack the infrastructure. Field channels: door-to-door, cold calling, events, booths.

**Clients — two rules, and they are different (revised 2026-09-11):**
- **In text: never named, sector only.** No sentence, heading or caption calls an organisation a client. The reason is consent, not how short the list is.
- **Logos and branding: cleared for use.** A client mark may be used *as a logo* (a client wall, a deck, a social graphic), and client merch in photos and video is fine. Matthew's call — see the 2026-09-11 revision in [surge/brand/notes/RESTRICTED.md](surge/brand/notes/RESTRICTED.md), which governs.

A mark on the page, a name in the copy — never the second.

**Roster corrected 2026-08-15** — see [surge/brand/notes/clients.md](surge/brand/notes/clients.md), restricted, context only. Six active clients plus one prospect, not three; four are nonprofit. **Surge does not work in air/HVAC and never did** — that was a mis-transcription of **aeration** that survived months as a confirmed fact. Which kind of aeration is still open; don't write sector specifics for it.

**One office is not a service area.** Englewood runs every campaign, including for out-of-state clients; the Houston affiliate room is closed. Copy may not imply Surge only sells in Colorado — it did, and it was false.

The method is not differentiated and the company says so; never claim a unique or proprietary process. Surge also carries a public MLM / "devilcorp" reputation. Both are handled in [surge/brand-voice-company.md](surge/brand-voice-company.md) §1, §3 and §5 — read them before any company post, and before anything aimed at recruiting.

### Surge source material

Training steps live in [surge/training-source/](surge/training-source/), one file per step, from [_TEMPLATE.md](surge/training-source/_TEMPLATE.md). **Read the relevant source file before drafting anything about a training step** — inventing a plausible detail instead has already happened once.

**Word documents are fine.** Drop `.docx` files into `surge/training-source/`; extract with [shared/tools/Extract-Docx.ps1](shared/tools/Extract-Docx.ps1):

```
.\shared\tools\Extract-Docx.ps1 -Path .\surge\training-source\<file>.docx
```

Text, paragraphs and table cells come through. Bold, headings and bullet glyphs don't, so structure has to come from the words. Add `-OutFile <name>.md` to keep a converted copy.

Source files are inputs, drafts are outputs. Never edit a source file to fit a draft; if it's wrong, say so.

### Surge draft convention

**All social output goes in [surge/drafts/](surge/drafts/).** One file per platform per topic: `surge/drafts/<topic>-<platform>-draft.md`. Infographics: `surge/drafts/<topic>-infographic.html`. Multi-image sets get their own subfolder.

Each draft contains the post, alternate hooks, lines cut with the reason, and the fact-check log. Keep the cut lines — they're the fastest way to lengthen a post later without re-researching.

**The website is not a draft folder** — it lives in [surge/website/](surge/website/). Client work lives in [surge/clients/](surge/clients/).

**I cannot watch video.** `surge/brand/videos/` is storage only — work from a transcript, a description, or an exported still.

---

## Matthew (own brand)

[matthew/](matthew/) holds his independent websites-and-marketing offering — rate card, services page, outreach emails, hosting notes. Signed in his own name, not Surge's and not Horizon's.

- **The brand is Stringline** (settled 2026-09-16), signed Matthew Sharpe. Identity is built in [matthew/branding/](matthew/branding/). Don't reuse "Horizon". Not yet registered — no domain, no filing, no USPTO search.
- **Stringline is a separate entity, Matthew's own** — decided 2026-09-16. Not a Surge sub-offering and not a trade name of Surge. It overlaps Surge's line of business (see [matthew/services-pricing.md](matthew/services-pricing.md) §8) and the answer is separation, so Surge's voice specs and RESTRICTED.md never apply to it. Anything that *would* go under the Surge name becomes Surge public copy — keep the two apart.
- Same rules apply: nothing sent, published or registered without a per-request go-ahead.

---

## Environment traps

**PowerShell 5.1 `Get-Content -Raw` reads UTF-8 files as ANSI.** Round-tripping a `.md` file through it double-encodes every em-dash and `·`. **Edit markdown with the Edit/Write tools, or with Node, never with a PowerShell read-modify-write.** This has now bitten twice — the first time is recorded in [surge/drafts/5-steps-build-value-carousel-draft.md](surge/drafts/5-steps-build-value-carousel-draft.md).

**This is a git repository as of 2026-09-13** (branch `main`, no remote). Text is tracked; video, the photo tree, `node_modules`, site bundles and the `_archive/` payload are gitignored — so **git is not a backup for those**. Commit before any bulk move or rewrite. The 2026-09-13 reorganisation manifest is [_archive/MOVE-MANIFEST-2026-09-13.csv](_archive/MOVE-MANIFEST-2026-09-13.csv).

`core.autocrlf` is `false` repo-local, deliberately — git must not rewrite line endings here.
