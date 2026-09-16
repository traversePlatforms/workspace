# Surge homepage — rebuild, draft 2

**File:** [index.html](index.html) · **Register:** Company · **Status:** Draft. Not deployed, not
staged, nothing posted. Static HTML on disk, served locally for preview only.

Rebuilt from scratch after the `dev/surge-site/` build was lost with the broken machine. Draft 2
replaces the reconstruction-from-memory in draft 1 with content recovered from saved artifacts.

## `/team/` bios — all third person, length spread halved — 2026-09-15

Matthew's call: *"I think we just keep it all 3rd person for now."* The page had been carrying two
inconsistencies at once — seven bios switching person mid-block (third-person role line bolted onto
first-person copy) and three that were third person throughout. Both gone.

**⚑ The pronoun question resolved without inferring anything, and this is the reusable part.**
Converting seven first-person bios needs a pronoun for each person, and a name does not supply one.
**Every pronoun used here is the one the site's own pre-swap copy used for that person** — the
2026-09-04 enrichment, still in git `HEAD` because the 09-14 swap is uncommitted. So the source is
Surge's own prior published copy, not a guess from a first name. If anyone's pronouns are wrong,
they were wrong on surgeftw.com first and the fix belongs in both places.

**Length spread: 50–124 words (2.48×) → 49–80 (1.63×).** Only two bios were actually trimmed —
Lance 124 → 78 and Cai 93 → 78. Nothing else was padded, because padding means inventing.

What came out of Lance's, for the record: *"I bring foresight"* (redundant beside the 5,000-foot-view
sentence that follows it) and the *"strong pillars — financially, with family, and in my
community"* line. That second one had been a deliberate keep on 09-14 (finances as one of three life
areas is ordinary, not hustle texture). **It came out for length, not for restriction** — but it is
the money-adjacent line in the bio, so the trim is also a risk reduction. Say the word if it should
go back.

**The floor is Paige at 49 and it cannot be raised honestly.** Hers was never swapped, so the
current text *is* the 09-04 version and there is no further source material. Matthew's is 56 and is
his own to extend. Everything else lands 58–80.

### ⚑ Regression I introduced and caught — read this before the next bulk page edit

Rewriting the seven `.person-bio` blocks replaced everything from
`<div class="wrap narrow person-bio">` to the next `
  </div>` — and that block does not only
contain the bio. It also ends with:

```html
<p class="small" style="margin-top:1.6rem"><a href="/team/">&larr; Back to the team</a></p>
```

**So the back-link was deleted from all seven pages.** Restored; all seven verified at exactly one.

**Two lessons, and the second is the important one:**

1. Same shape as the 09-11 footer/header Blog bug: **anchor on what you are replacing, not on the
   container that happens to hold it.** The container held one more thing than expected.
2. **`audit-links.mjs` cannot catch this and never will.** It verifies that links which exist
   resolve; a link that has been *removed* is invisible to it — the page still passes with zero
   broken links. It was clean on all 29 pages throughout, including while seven pages had no route
   back to the roster. **A clean audit is not evidence that nothing was lost.** Worth a
   before/after element count on any future bulk edit, since no tool here does it.

Verified after the fix: zero first-person pronouns across the roster JSON and all ten pages, all ten
roster bios identical to their page copies, back-links present, `audit-links` clean on the usual
four false positives.

## `/team/` pass — Dylan removed, photos measured, roster reordered — 2026-09-15

**Dylan Conger was a co-owner and has left the company.** Ryan Conger, Sales Manager, is his
brother and is correct as listed — photo and role both confirmed by Matthew.
`Dylan-Conger-Updated-Headshot-3-25-2026.webp` moved to
`_archive/people-departed-2026-09-15/` rather than deleted: `brand/photos/` is gitignored, so
deletion there is unrecoverable. Nothing on the site ever referenced it.

**Lance closed.** The LinkedIn URL came to Matthew directly from Lance, and "Lance Axon" is what the
previous site listed. *"If he wants to call himself different things its not for me to decide."*
Name and URL both stand. **Punch item 52 is closed properly now**, not just half-answered.

### ⚑ The headshot set is far less consistent than this file assumed

Measured, not eyeballed — mean RGB of the four corner patches, per image:

| Group | People | bg luma |
|---|---|---|
| Neutral | Myles 220 · Ryan 217 · Lance 196 · Paige 193 · Maya 190 | 190–220 |
| Warm | Cai 181 (R−B = 55, visibly orange) · Nneka 180 | ~180 |
| Dark | Matthew 163 · Brandon 141 | 141–163 |
| **Outdoor** | **Jon 75, green** | **75** |

**Jon is the biggest mismatch on the page, not Brandon** — his is an outdoor portrait against
foliage. It is a good photo (600×600, sharp, well exposed) and it is from a different world than the
studio set. **Left alone deliberately**: Matthew is confirming with administration whether Jon
belongs on the roster at all, and there is no point processing a photo that may come off.

**Resolution is NOT a problem and should stop being raised.** Sources are 384×384, the largest
render is `.team-detail .member__photo` at 176px, so there is 2.18× — ample for 2× displays. What
varies is **compression**: 3KB (Ryan) to 17KB (Myles) at identical dimensions.

### Matthew's headshot — corrected and shipped

**The faults were in the source, not in processing.** His original is an existing cutout composite:
a halo around the hair, speckle across the jacket shoulders, and an orange cast on the face
specifically, relative to his own neck and shirt.

**But the shipped 384 crop was also darker than its own source** — background (169,162,156) against
the original's (217,214,206). Something in the original processing darkened it.

Rebuilt from the 1000×781 kept original with Pillow 12.3.0: median filter for the speckle,
per-channel white balance onto (203,201,198) with a soft knee above 0.85 so highlights roll off
instead of clipping, HSV saturation pulled 30% in the red/orange hue band only (leaves neutrals
alone), square crop at 46% height, Lanczos to 384, WebP q88. **Now `matthew-sharpe.webp`** — the
superseded `.jpg` is deleted and all three references updated.

### ⚑ Brandon cannot be fixed with the tooling here — two attempts, both worse

He asked for the studio background if possible, levelling at minimum. **Both attempts shipped
nothing:**

1. **Feathered ellipse → background plate.** Left brick slivers down both sides and added pale
   vertical banding at the edges that reads as a processing error.
2. **Desaturate and brighten the brick.** Made it *lighter and more prominent*. Worse than current.

**The bind is real and worth recording so it is not re-attempted:** matching his luma to the set
(141 → ~195) necessarily makes the brick louder, and leaving it dark keeps him looking like a
different photo. There is no setting that wins both. Proper background removal needs a segmentation
model; Pillow has none and there is no sharp, ImageMagick or ffmpeg on this machine.

**Left exactly as-is.** The reshoot is the fix and Matthew is getting one.

> **Reshoot spec, so the replacement drops straight in:** plain wall reading **light neutral, luma
> 190–210** (not white, not coloured) · **head and shoulders**, framed like Cai's or Myles's, head
> about 60% of frame height — the current one is face-only and that mismatch is as visible as the
> brick · **≥800px on the short side** · even frontal light, no hard side shadow · shot portrait or
> square so a square crop does not lose the crown.

### Roster reordered to match the page's own strap

The strap says *"Leadership · Management · Training · Coordination — one room"* while the roster
rendered in an order matching none of it. Now it does, which also resolves Myles's placement
(3rd → 7th) that Matthew flagged as arbitrary:

Brandon · Matthew — **Leadership** | Lance · Cai · Ryan · Paige · Myles — **Management** |
Jon · Nneka — **Training** | Maya — **Coordination**

**No section headings added.** The old site used Owners / Team Leader / Administration; "Owners"
would be wrong for Matthew (CTO, not an owner) and reads badly on a direct-sales company page
regardless. Order alone carries it, and the render order is DOM order — the roster JSON order is
irrelevant to display.

**CTA fixed by deletion.** *"The people above are the ones who would actually work your account"* —
wrong verb, since this roster runs accounts and reps work them. The h2 above it already says "That
is who would run yours", so the sentence went rather than getting a new verb.

## `/careers/` FAQ — Matthew's two edit passes, settled at seven — 2026-09-15

Ten drafted, then two rounds of his edits. **Final: seven questions.**

**Cut across the two passes:** "Is every role door to door?" (his read: the site never implies doors
are the primary job, so the question answers an objection the page does not raise) · "What does
onboarding look like?" · **"Is there a path to move up?"** · the social line from the culture answer
· the three-interviews line from the culture answer.

**The advancement question is gone by his decision, twice considered.** *"I just dont like it, like
i said difficult to not make it sound like an mlm."* Recorded because the reasoning is his and it is
consistent: he would rather say nothing than say it imperfectly on this specific terrain.

> **⚑ Consequence for whoever edits this page next.** The body copy still promises advancement in
> two places — the hero (*"Whichever role you are hired into, there is a real path to move up"*) and
> "Why work with us" (*"Whichever seat you start in, there is a way up"*). With the FAQ answer gone,
> **both now stand unexplained.** Not raised as an argument to restore the FAQ — his call is made —
> but those two lines are the ones to look at, because an unexplained promise of advancement is the
> shape the reader fills in themselves.

> **Resolved 2026-09-16.** Matthew asked where to back the promise and how to say it without the
> MLM texture, then said *"do what you think is best."* Backed in "Why work here" (eyebrow renamed
> from "Why work with us" — same words a client pitch uses; the apply-form label went "with" → "at"
> for the same reason), not the FAQ: a Q&A titled *"Is there a path to move up?"* is the sceptic's
> question, so any answer reads as a defence, while a sentence in the body states the mechanism
> unprompted. Added: *"That last one is how people move up here: a rep who can do the work, and
> then show someone else how, becomes a trainer."* Mechanism only — the five tells (recruiting as
> the route, a timeline, pay per rung, attitude criteria, vagueness) all absent. **Withheld as
> unverified:** trainer → team lead (not recorded anywhere) and sideways moves into admin/ops/
> marketing (one known example, Matthew). If he confirms either, they slot in after the trainer line.

**The Tier 2 team-nights flag resolved itself by deletion.** The culture answer no longer mentions
team nights, softball or potlucks, so nothing is pending on that clearance. What is left is two
sentences, entirely fact-based: coaching moves sideways across the floor, and helping the person
beside you is part of the job rather than a favour. §5 wanted culture carried by facts, and that is
now all it carries.

**The "day one is earned last" detail survived, reframed.** It was going to be lost entirely when
the advancement question went. It is now in the differentiator answer as **"a first day is taught by
the most experienced trainers here"** — the same insight as *allocation of teaching* rather than as
*a rung a trainer earns*. **The rationale clause was cut on his final pass** ("because day one is
the highest-stakes teaching in the building"), so the fact now stands on its own without the
explanation. Same instinct as his cut of "rather than a favour" in the culture answer and of the
closing restatement on `/what-we-do/`: **he consistently removes the sentence that explains why the
previous sentence matters.** It reads to him as hedging, and he is right more often than not.
That is precisely the framing `promotion-ladder.md` calls publishable (*"as training design… not
as a career ladder"*) and it carries no ladder, so it survives his objection rather than dodging it.

**The differentiator answer was rebuilt to carry the weight he asked for.** *"Add something in that
really makes us sound like we excell at the teaching method… we need to place strong emphasis on our
trainng methods."*

- **What was NOT written: "the best training in the industry."** §4 bars that phrase by name, and
  §1 bars any unique-method claim. **The permitted route is specificity, and it is also the stronger
  one** — §1's own table: *don't* "our proprietary sales system", *do* "here's how we teach
  objection handling to someone in week one."
- So the emphasis is carried by concrete facts: training precedes work in every role, nobody is
  handed a script and pointed at a customer, it continues every morning, the trainers came off the
  floor, day one goes to the most experienced.
- **"It does not taper off once you are competent, which is where most sales training stops"** is
  the load-bearing line, and it is sanctioned rather than a swipe: §1 gives *"this is the part most
  training skips, and it's why reps stall in month two"* as a model DO. No competitor is named (§3).
- His framing that teaching is the only real differentiator was kept as the opener. It is the
  *opposite* of a uniqueness claim — it concedes the method is commodity and puts the weight on
  transfer, which is exactly the §1 position.

**⚑ "Our reps are high performing" was requested and left out.** Unsourced performance claim: §2
wants scope, date and a pullable source; Tier 3 records that no usable Surge metric exists yet; §4
notes vague breadth is what reads as confirmation. **Lance's export (item 18) is what unlocks it** —
with a real figure it becomes the strongest sentence on the page.

**"Employees all over" was narrowed.** He wanted the page to say people are stationed beyond
Englewood. §5 bars footprint and scale framing, so the published version states the fact without the
claim: *"Our home base is Englewood, Colorado, and that is where most of the team is. Some roles are
based elsewhere."* "From home" removed on his instruction — he does not want remote work implied,
since most roles start in the office before that trust exists.

**Also settled:** "we manage you" cut from the client/Surge answer as controlling (now *"your
trainer and your team lead are Surge people"*) · the sales-experience answer softened from a flat
"No." · "most conversations end in a no" cut from the success answer, and "the people who last" with
it, which he read as implying churn.

### Tooling note — do not re-chase

`verify-bundle.mjs` run against **the repo** reports `UNBALANCED` on `careers/index.html
<details> 14/13` and on `about/index.html <section>`/`<li>`. **All false.** It does not strip HTML
comments before counting, and `careers/index.html` line 96 mentions `<details>` inside a build
comment. Stripped: 13 open, 13 close — balanced. **Both `verify-bundle` and `audit-links` are
documented to take an EXTRACTED bundle, not the repo**, precisely because the repo still has
comments in it. Run them on the zip's extracted copy and both come back clean.

## `/careers/` FAQ rebuilt from Matthew's eleven questions — 2026-09-15

He sent eleven candidate questions, said to scrap the existing five, use "these or a mix of", drop
any already answered clearly above, order them, and answer them all. Result: **ten questions**, of
which two are kept from the old set and two of his were removed as already answered.

### Two spec conflicts hit on the way, both resolved against the specs

**1. ⚑ "What does a typical day look like?" is a barred format, not a judgement call.**
`brand-voice-company.md` §6 withdrew it by name on 2026-08-06 — *"It's now a hard no… No clock
times, no shift boundaries, no weekly-hours framing in any draft."* RESTRICTED Tier 2 is blunter:
**"No 'day in the life' format in any variant."** The reason is on record: the real schedule
documents roughly an hour of employer-directed activity before the paid day starts, and "long hours
for low effective hourly rate" is a criticism §5 names specifically.

**Reframed rather than dropped**, because the question underneath it is one every candidate has and
the page should answer. Now **"What does the work actually involve?"** — the morning development
block described without clock times (explicitly Clear to use), then the work itself by channel. It
answers *what will I be doing*; it does not publish a timetable. The distinction is the one
RESTRICTED already draws: *the morning routine is excellent material; the timetable is off-limits.*

**2. ⚑ `promotion-ladder.md` contradicts RESTRICTED.md, and RESTRICTED.md wins.**
That file's own "Not publishable" section bars *"the advancement structure as a career path"* and
says *"the pedagogy survives; the ladder doesn't."* But the **2026-08-15 revision at the top of
RESTRICTED.md moved "Advancement and promotion as a career path — quota gates, the rung structure,
'how you move up'" to Clear to use**, and RESTRICTED.md states it is authoritative over the
restriction headers on individual notes files.

So the ladder is publishable and `promotion-ladder.md` is **stale on its own subject** — the same
failure mode as the CLAUDE.md client line and the `brand-voice-company.md` air/HVAC line. Worth
correcting at source; flagged to Matthew, not changed unasked.

**The quota figure stayed out anyway, and that is a separate call from the restriction.** 12
sign-ups a week, hit twice consecutively, is now cleared to publish — but it dates from Matthew's
own tenure as a rep, has no current internal source, and §2 wants scope and date on any published
number. A specific weekly quota on a careers page also reads as a target a candidate is measured
against before they have applied. The answer describes the gate as **competence** instead: you move
up by selling well, then by showing you can teach.

**That framing is also the §5 move.** "Answer structurally instead — specificity about the actual
job." A ladder gated on *can you teach a first day yet* is the counter-argument to the recruitment
accusation, made by description rather than by denial. Nothing in the answer mentions the
accusation, argues with it, or uses the word.

### The pay answer is gone

*"I dont want any talk of pay on my site."* So **"Is it commission only?" is removed** — it was
item 42, closed 09-12 on his delegated call, and this reverses it. It carried no figure, only the
structure: base plus commission, paid weekly, paid training, 401(k) matching.

**Worth him knowing what the silence costs**, since the original reasoning ran the other way: that
question is the single most common thing a candidate wants to know about a field-sales role, the
company already answers it publicly in its own ad, and **silence on it is itself read as an
answer** — usually as *yes, it is commission only.* His call and it is made; recorded so it is a
decision rather than a drift. RESTRICTED Tier 2 is unchanged either way.

**EPEWA drops out of his scope entirely** — it governs job *postings*, and he does not control the
Indeed listing (see below) and publishes no pay on the site.

### Removed as already answered above

| His question | Why removed |
|---|---|
| What roles does Surge hire for? | "The roles" section sits directly above the FAQ with **six openable role descriptions**. |
| What training does Surge provide? | "How you are trained / Trained first, coached after" is the page's second-largest section, directly above. |

### Merged

*"What does success look like in this role?"* and *"What kind of person thrives at Surge?"* are the
same answer asked twice — same cluster problem as the three "whose people" questions on
`/what-we-do/`. Now one: **"What does doing well here look like?"**

### Kept from the old set, against "scrap the rest"

- **"Is every role door to door?"** — kept on **his own argument from the same message**: the Indeed
  ad omits doors, the ad drives traffic here, so the site carries the full scope. Deleting this
  would remove the exact line that does that job.
- **"Where would I be working?"** — a candidate has to know. Reworded: the old answer said *"Every
  campaign Surge runs is run out of that office,"* which is the small-office framing he cut from
  `/what-we-do/` answer 1 earlier today. Now names Englewood as the base and lets the role decide
  where the work happens (field, phone, office, home).

### The Indeed ad is not his — correction to the record

*"I do not control the indeed ad. That is created by our development team, so the pay structure,
and the term ambassador isnt my wording."* **Punch items 45, 46 and 48 are therefore not his tasks**
and should stop being ranked as his. His position: the listings drive the most traffic to the site,
so what the ad omits, the site supplies in full. That is a coherent strategy and it makes
`/careers/` the counterweight — which raises the stakes on the door-to-door answer above rather
than lowering them.

## `/what-we-do/` FAQ reordered and extended to nine — 2026-09-15

Matthew sent nine questions for this page and asked for an order plus answers. **Five of them were
already on the page**, four of those near-verbatim, and one ("what does an engagement cost") was
listed twice in his message. So the job was three new answers, a reorder, and a wording pass — not
nine drafts. Worth recording *because* he arrived at the existing set independently: that is the
strongest evidence so far that the FAQ is asking the right things.

**The three genuinely new ones**, all sourced from copy already on the page rather than invented:

| Question | Sourced from |
|---|---|
| How do you prepare reps before a campaign launches? | stage 02 scope + stage 03 "brought up to speed on your offer and its objections" + job 01 "continuously… already moving by the time you need one" + job 03 daily training |
| How do you keep the brand accurate across different reps and channels? | stage 02 "what a good conversation about it sounds like" + job 03 drilling + the existing "present as your team" answer |
| How do you track performance day to day? | stage 05 "every shift logged and reported the same day" + "logging every door" + the visibility band |

**Order, and the reasoning.** Nine `<details>` need an arc or they read as a pile:

1-2 **qualify** (geography, timing) — the two that decide whether a reader keeps reading.
3 **how it gets built** (prep).
4-6 **whose people, whose brand** — deliberately adjacent. Three questions orbit this and separating
them is what would make them read as repetition; as a block they read as one subject examined from
three angles. Same fix as the "jobs you stop doing" / "jobs we run" de-duplication.
7 **while it runs** (reporting). 8 **after the sale** (accounts). 9 **cost**, last, after the value
is on the page.

**Question wording moved to second person** — his were "How does Surge…", the page's existing six
are "Can you…", "Do reps…". Kept the page's register. "How fast can a campaign start?" took his
plainer "How long does it take to get a campaign live?"

**Spec checks.** §1: no proprietary-method claim anywhere — the brand-accuracy answer deliberately
describes *one brief and daily drilling*, which is execution, not invention. §2: no figures, no
client named. §4: no hedges — "we can usually", "if that fits" and similar stayed out; "a cohort is
already moving" matches the page's own line rather than softening it. Tier 2: **no clock times, no
shift boundaries, no KPI targets and no conversion figures** — the tracking answer names activity
*categories* (doors worked, conversations had, sales confirmed), all three of which the page already
states, and stops short of what any of them has to reach. Contractions off (item 22).

**⚑ The one inferred line was cut the same day.** *"When one of them gets it wrong, the correction
lands in the next morning's coaching."* I had flagged it as the only clause not traceable to
existing page copy. Matthew cut it for a different and better reason: **it plants the idea that reps
will get it wrong.** *"While its always possible its not worth mentioning."* Both readings point the
same way, so it is gone.

### Matthew's edit pass, same day — five of nine changed

He answered in order. 4, 5, 7 and 9 were passed without change.

**1 — the Englewood clause is out.** *"We are trying to avoid referencing us as a small office."*
Was "…managed by the same Englewood team and reported on the same way." Now: **"Yes. We run
campaigns for clients in multiple states. Which markets a campaign covers is part of the scope."**
The settled service-area phrase survives intact; what goes is the sentence that answered a
geography question by describing the size of the operation. **This is a standing instinct worth
generalising: reassurance that routes through "the same small team handles it" is not reassurance.**

**2 — the answer leaned on us instead of on them.** *"What it really comes down to is their
information. What their goals are, what time frame they are looking to, or simply saying also that
each client is different."* Now opens on the client — what you are selling, the goal, the timeframe —
and demotes continuous hiring to the second half, where it answers "is recruiting the bottleneck"
rather than standing as the whole answer.

**3 — "cohort" was doing too much work.** He counted it: once in answer 2, twice in answer 3. Answer
3 now says "the reps who will work your account", and the continuous-hiring sentence came out of it
entirely — that point now lives only in answer 2, so the two answers stopped overlapping as a side
effect of the word fix. **FAQ uses of "cohort": 3 → 0.**

**8 — "the work transfers to your team" implied unfinished work.** *"The term work makes it seem
like theres more to be done."* Now: "the customer is yours from there. You keep the product and the
delivery." Says the same thing about who owns the relationship without handing the reader an
impression of a backlog arriving with it.

**Three uses of "cohort" remain outside the FAQ and were left alone** — not part of what he was
reviewing. `/what-we-do/` job 01 ("a cohort is already moving by the time you need one") and the
stage 03 heading ("Hire and onboard a cohort"), plus the homepage hero alt text ("A cohort standing
through the morning development block"). The stage-03 heading is the one place the word is precisely
right. **The alt text is the weakest of the three** — alt text is read aloud, and "a group of reps"
is plainer than a term of art. Offered, not changed.

Item 8 stays open — he is still taking the FAQ himself before launch.

## Role sentence restored to all ten bios + bundle rebuilt — 2026-09-15

**Punch item 49, final sub-item — closed on Matthew's go-ahead.** The 09-14 bio swap left the
roster saying nothing about what anyone does: a prospective client got a job title and two
paragraphs of personality. Ten people now open with one sentence of role, then their own words.

**Nothing was written fresh.** Every sentence is lifted from that person's *pre-swap* bio, which is
still in git `HEAD` — the working tree carries the 09-14 swap uncommitted, so
`git show HEAD:surge/website/build/team/index.html` is the 2026-09-04 enrichment verbatim. That
copy was built from surgeftw.com plus Matthew's input, so it is sourced, not inferred. Recovering it
was the whole reason not to draft new role lines: the CLAUDE.md failure mode here is inventing a
plausible detail, and seven role descriptions is exactly the shape that failure takes.

| Person | Role sentence now leading the bio |
|---|---|
| Ryan Conger | Runs the sales floor — territory, targets, and the coaching that goes with them. |
| Jon Wallace | Trains reps: the pitch, the objections, and the parts that only click with repetition. |
| Nneka Smith | Trains and coaches, focused on how a rep reads a doorstep and adjusts in the moment. |
| Lance Axon | Runs operations — scheduling, territory, what has to be in place before a team goes out. |
| Maya Ogea | Coordinates events — books and staffs event and booth placements, handles the venue side. |
| Myles Zoutte | Brand and admin — the back office, and how Surge presents itself across its materials. |
| Cai Silva | Leads talent acquisition — writes the ads, screens applicants, first person a candidate speaks to. |

Brandon, Matthew and Paige already led on the work (they were never swapped), so all ten are now
consistent rather than seven personality bios sitting next to three descriptive ones.

**⚑ One clause deliberately dropped, and it is worth a look.** Cai's pre-swap bio said she *"runs
first interviews."* That predates item 43, where Matthew gave the real process: the phone call, then
the **operations manager**, then a **trainer or team lead**, then the **CEO**. "First interviews"
either contradicts that or means the phone screen, and I could not tell which — so the clause is out
and the rest of the sentence, which is consistent either way, stands. **If Cai does run the phone
screen, say so and it goes back in.**

**Register note.** A third-person role line in front of a first-person bio is a deliberate mix, not
an oversight — it is the standard "role line, then their own voice" pattern, and it is the only way
to add the role without rewriting words people wrote about themselves. Contractions stayed off
(item 22). Nothing added touches pay, hours, headcount, client names or growth language.

Applied by a script keyed per slug, guarded so a bio edit cannot overrun into the next person's
record; the roster JSON was patched surgically rather than reserialised, so entities and escaping
are untouched. Verified: JSON parses, ten bios, all seven pages carry the line, `audit-links` clean.

**Punch item 51 closed the same day — blog CTAs stay off.** Matthew's call. The three carried-over
WordPress posts keep the site convention that posts carry no CTA, so all six are consistent.

**Punch item 52 — the name is confirmed, the link is not.** Matthew: leave it as Lance Axon if that
is what the previous site had. It is — `wp-restore/recovered-copy/company-team.md` reads "Lance
Axon, Operations Manager". That capture carries **no LinkedIn URLs at all**, so it does not vouch
for `linkedin.com/in/lance-jozefkowicz-52b16671`. Name closed, link left exactly as it is.

**Bundle rebuilt twice — `deploy/dist/surge-site-2026-09-15.zip`.** Once before this change and
once after. 83 files, ~6,070 KB, comments stripped from 9 files. `verify-bundle`: 28 pages, tags
balanced, no comments. `audit-links`: no broken internal links, assets or anchors. Re-checked by
hand: no retired folders, `blog/_template` absent, `api/uploads/` holds only its two dotfiles,
`submissions.log` not in the zip, sitemap 26 URLs, no `.md` shipped, `noindex` still on all 28
(correct — staging until launch day).

**The four `audit-links` hits on the repo are false and should not be re-chased.** The auditor does
not strip HTML comments, so it reports the inert hero-video `<source>` lines and the `NEXT.jpg`
rotator placeholder as broken assets. Both are commented out; the bundler strips comments, so the
extracted bundle audits clean. Confirmed both ways today.

**Redirects can now be tested locally after all.** Item 7 says the local preview ignores the
`.htaccess` 301s — that stopped being true when `serve-surge.mjs` moved into `deploy/` on 09-14
and took the redirect table with it. All five verified: `/how-it-works/`, `/training/`,
`/careers/apply/`, `/sectors/` and `/sectors/roofing/` each 301 to the right target. **This does
not replace the post-upload test** — what it checks is that the redirect map is correct, not that
Apache is reading `.htaccess`. A dotfile that silently fails to upload still 404s everything.

---

## Review pass round 2 — the rest of the site, 2026-09-14 (Matthew, one batch)

Thirteen items across `/what-we-do/`, `/about/`, `/careers/`, `/team/` and `/blog/`. Eleven
changed, two logged as pre-launch tasks. Ordered as he raised them.

### `/what-we-do/`

**1. The page-head photo — deferred, his call.** The `field-kiosk.jpg` frame is "not super
flattering for Paige"; he will pick a replacement as more photos land. Not changed. **Punch-list
item, same cluster as the homepage rotator's `morning-block-b.jpg` swap** — both wait on the larger
photo batch, both are pre-launch.

**2. "The jobs you stop doing" (home) vs "The jobs we run" (here).** He asked whether we want the
near-repeat one click apart, and left it to judgement. **Changed the second one, not the first.**

The two sections are not redundant in content — the homepage is one paragraph plus a four-icon row,
this page is four detailed cards — but they were redundant in *framing*: same four jobs, same four
icons, same order, and two headings that are the same sentence in two grammatical persons. He read
it as repetition rather than as a deliberate mirror, which is the answer to whether it was working.

The fix is not to cut either section. Both have to name the four jobs, because the four jobs *are*
the offer. The fix is to let each heading do a different job: the homepage sells the outcome ("the
jobs you stop doing"), this page describes the mechanism. This page's eyebrow ("What moves to us")
and its intro ("each of these moves to us in full — here is what that covers") already framed it as
the detail view; only the h2 was still restating the offer.

| | Was | Now |
|---|---|---|
| `/what-we-do/` h2 | The jobs we run. | **What each job covers.** |
| Nav dropdown label (×29 pages) | The jobs we run | **What each job covers** |
| Anchor | `#the-jobs` | unchanged |

Homepage untouched. Anchor deliberately left alone — it carries no count and no stale wording, and
renaming it again would churn 29 files for nothing. Audited clean.

**3. ⚑ "depending on what you hand us" implied clients supply the leads.** Matthew: *"we do lead
generation and dont require any client to give us leads."* The Phone outreach cell read "new leads,
warm follow-up, or both, depending on what you hand us" — which makes the client the source of the
list and makes Surge's own lead generation invisible. Now: "cold prospecting, warm follow-up, or
both. **We generate the list ourselves, or work from one you already have.**" States the capability
and keeps the client's option open, without making it a precondition.

**4. Stage 04 — "with a trainer alongside them" → reps and trainers work the territory.** His
wording. Was "Reps work assigned territory with a trainer alongside them"; now "Reps and trainers
work the assigned territory." Trainers are on the territory, not shadowing it.

**5. "The rest runs without you in it." — removed.** His reasoning: it reads as a limit on how
involved a client is allowed to be. It also sat two sections above the band claiming "you get the
visibility an in-house manager would have," so the page was arguing with itself. Replaced with
"Past that you are as involved as you want to be," which keeps the actual point (you do not have to
*run* it) and drops the exclusion.

**6. FAQ — deferred.** He will work it before launch. Punch-list item, not touched.

**7. Team section — deferred.** Same. (Distinct from item 12 below, which is the bios.)

### `/about/`

**8. "These two let us show their mark." — cut.** He found it unneeded. It was also a public claim
about consent resting on verbal permission, which the rebuild log had already flagged as worth
cutting on its own. The remaining sentence — "Most of the organisations we work with are referred
to by sector only" — still explains why only two marks appear, and asserts nothing about who gave
what. The prose rule is unchanged: no sentence, heading, caption or alt text calls an organisation
a client.

### `/careers/`

**9. "coach you, not just a manual" twice — he was right.** Two instances, one section apart:
"Trained first, coached after" ended on *"the coaching is about the conversation you actually had,
not the one in a manual"*, and "Why work with us" opened on *"trainers and team leads whose job is
to coach you, not just a manual."* Kept the first (it is the more specific of the two — it names
what the coaching is *about*), reworded the second to "whose job includes developing you."

**10. "You leave better at the work than you arrived." — reworded.** His objection: "leave" implies
people leave the company, which is not the message a careers page should carry. Now **"You get
better at the work here."** The same word appeared in the body — "the skills you build carry
between roles **and between jobs**" — and "and between jobs" was cut for the same reason. The
transferable-skills point survives intact in "carry between roles."

**11. ⚑ How applying works — the old step 03 was factually wrong.** The biggest correction in this
batch. The page said a candidate spends a day with the room and **goes out in the field** before
either side decides. Matthew: *"This is extremely incorrect. We would never put someone out with us
before they are even hired."* Removed outright, not softened.

The real process, his description: the phone call, then an interview with the **operations
manager**, then an interview with a **trainer or team lead** (sometimes with a second person
sitting in), then a final interview with the **CEO** — three interviews.

Kept at four steps rather than expanding to six, by grouping the three interviews into one step
titled **"Three interviews"**. That is also how a candidate experiences it, and it keeps the count
in the lede honest — `/careers/` is the one place the count-in-a-label rule does not apply, because
this list is genuinely numbered on the page. The lede's old promise, *"You see the job and we see
you working before either side commits,"* went with the field day (it described exactly the thing
that does not happen) and is now "You meet the people you would be working with before either side
commits."

No pay, hours or earnings language added — Tier 2 unchanged.

**12. Candidate FAQ — deferred.** He will do it before launch. Punch-list item.

### `/team/`

**13. Bios replaced with the previous site's own-words versions.** Matthew: *"I want them to write
their own bios but its taking to long for them to get it together so we will just make those
changes as it comes."* So this is an interim, and each person's real bio replaces theirs as it
arrives.

Source: `website/wp-restore/recovered-copy/company-team.md` — the July-2026 audit capture of the
old WordPress Company page. Seven bios swapped, in `#team-data` (the roster JSON) and in each
`team/<slug>/index.html`.

| Swapped | Left alone | Why left alone |
|---|---|---|
| Ryan Conger, Jon Wallace, Nneka Smith, Lance Axon, Maya Ogea, Myles Zoutte, Cai Silva | Matthew Sharpe, Paige Bennett | His instruction |
| | Brandon Long | **The old site had no bio for him** — only an icebreaker answer ("The Off Grid Day"), which the current bio already contains in full. There was nothing to transfer. |

**Three edits applied to the source text across the board, and they need his eye:**

1. **Contractions expanded** ("I'm" → "I am"). The no-contractions rule is sitewide and settled;
   leaving these in first person with contractions would make seven bios the only exception.
2. **The closing epigraph quote dropped from every bio.** The old page gave each person a
   motivational quote — Churchill, Marianne Williamson, Robertson Davies, Pharrell, Zig Ziglar. A
   wall of motivational quotes on a direct-sales company's team page is the exact texture
   `brand-voice-company.md` §5 names, and the Zig Ziglar one ("you can have anything you want if
   you will just help enough other people get what they want") was already flagged in the recovered
   copy itself.
3. **Four money lines cut.** Each is listed so he can put any of them back:

| Person | Cut |
|---|---|
| Nneka Smith | "On the financial side, I'm all about making my money work for me and not the other way around." |
| Myles Zoutte | "…which is probably why my next goal is buying my first McLaren within three years." |
| Ryan Conger | "…and I want to build enough that my wife gets to choose whether she works out of want, not necessity." |
| Jon Wallace | "and income", from "helping them take control of their skills and income" |

The first two were already marked as devilcorp tells in the recovered-copy file. The second two
were not, and are my call, on the same reasoning: a personal-income aspiration in a sales
employee's bio is what the standing test is for. Lance Axon's "building strong pillars —
financially, with family, and in my community" was **kept** — finances as one of three life areas
is ordinary, not hustle texture.

**⚑ One thing worth his second look.** The old bios are pure personality; the ones they replaced
opened with what the person actually does ("Ryan runs the sales floor…", "Lance runs operations…").
A prospective client reading the roster now learns the job title and nothing else about the work.
The job title is still displayed separately on every card, so nothing is broken — but if he wants,
the fix is one sentence of role per person in front of their own words, and I can put those back
without touching the personal half.

### `/blog/`

**14. "the occasional widely-repeated number that turns out not to say what everyone thinks it
says" — reworded.** He did not find it clear. It had also stopped being accurate: with the three
recovered posts added, half the hub is practice writing rather than source-checking. Lede and
`og:description` now: "Research, technique, and what running a sales team actually teaches you."

**15. The provenance disclaimer below the post list — removed.** *"A post goes up only once its
source has been read first-hand rather than from a summary, and every figure carries the date it
was published."* His call, and it would have become a false blanket claim the moment posts without
a Source panel joined the list. The promise still lives where it belongs: each sourced post's own
Source panel.

**16. The three old WordPress posts carried over.** He wants real content on the rebuild so his
boss and coworkers can see how the site functions. Recovered from the `wp_posts` rows of the
2026-08-12 AI1WM export via `website/wp-restore/rebuild-copy/blog.md` — genuine published posts,
already RESTRICTED-checked clean in that file (no client names, no earnings language).

| New page | Old slug kept | Published |
|---|---|---|
| `/blog/leadership-skills/` | `leadership-skills` | 2026-04-17 |
| `/blog/entering-new-markets/` | `entering-new-markets` | 2026-03-31 |
| `/blog/scale-your-team/` | `scale-your-team` | 2024-05-29 |

Built by a one-shot script that took the head/header/footer verbatim from `/blog/talk-ratio/` so
the chrome could not drift, substituting only the `<head>` meta and `<main>`. Not kept —
`/blog/_template/` is the route for the next post. Added to `sitemap.xml`, **now 26 URLs** (23 + 3).
**Slugs kept identical to the WordPress originals** so anything pointing at them still resolves
after launch.

**Three decisions inside this, all reversible:**

- **Headlines rewritten into site voice.** "How to Build a Scalable Team for Long-Term Business
  Growth" → "Building a team that can scale with you."; "How to Conduct Market Research Before
  Expanding Into a New Market" → "What to check before you expand into a new market."; title case
  dropped from the leadership one. The originals are SEO-listicle shaped and sat badly next to "The
  talk-time rule is nine years out of date." **Original titles preserved in `blog.md`** — say the
  word and they go back.
- **No Source panel on these three.** They make no factual claims, cite no figures and reference no
  study. Nothing to source, so adding an empty panel would be worse than omitting it.
- **The closing CTA paragraphs dropped.** Posts 1 and 2 ended with a link to
  `surgeftw.com/contact/`. Site convention is that posts carry no CTA, deliberately, and the hub
  lede still says "written for people doing the work, not about us." Flagging it because it is a
  conversion path removed, not just copy: if he wants it back, the `.band--cta` component is
  already on every other page and would drop straight in.

**Bug found and fixed while generating these.** All three existing blog posts carried
`aria-current="page"` on the **About** nav link as well as the Blog one — so a screen reader
announced two current pages and the nav highlighted About on every post. The `_template` was
correct, so it predates the template. Fixed in all six posts.

**Audit:** `node deploy/audit-links.mjs surge/website/build` — **29 pages, zero broken links, zero
unresolved anchors.** The four reported "BROKEN SRC" are the known commented-out `hero.mp4/webm`
and `NEXT.jpg` placeholders; the auditor does not strip HTML comments.

---

## Homepage review pass — 2026-09-14 (Matthew, page-by-page round 2)

First page of a new page-by-page review. Six items raised; five changed, one logged as a
pre-launch task.

**1. "What we take over" — the four/several contradiction.** The intro said "several jobs at once"
and then "we take **all four** off your plate," and the four cards below are unnumbered, so the
count was doing no work and contradicting the sentence before it. Matthew's reasoning: each of the
four cards can contain several jobs within itself, so the number is wrong as well as jarring. Count
dropped — "We take them off your plate." The inline list (hiring, onboarding, training,
day-to-day management) also came out of that sentence, because the hero states it one screen above
and the four cards state it immediately below; it was the third time in ~80 words.

> **RESOLVED same day — Matthew: "Make it say that jobs we run."** The count is out of the nav
> label, the `/what-we-do/` h2, and the anchor itself. Done sitewide across 26 files:
>
> | Was | Now | Count |
> |---|---|---|
> | `href="/what-we-do/#the-four-jobs"` | `#the-jobs` | 26 |
> | `id="the-four-jobs"` | `id="the-jobs"` | 1 |
> | "The four jobs we run" (nav label ×24 + the h2 ×1) | "The jobs we run" | 27 |
> | "Where the four jobs above start on your account" | "Where the jobs above…" | 1 |
> | "that is what the four have in common" | "that is what they have in common" | 1 |
>
> **The anchor was renamed, not just the label** — leaving `#the-four-jobs` would have kept the
> count visible in the address bar every time someone used the nav dropdown. Safe to rename here
> because the site is staging-only and `noindex`; no public inbound link can break. Verified with
> `node deploy/audit-links.mjs surge/website/build`: **26 pages, zero broken links and zero
> unresolved anchors.** The two stale `site.css` component comments were updated to match.
>
> **The last row is a different four** — that sentence is about the four *channels*, not the four
> jobs, so it was outside Matthew's instruction. Changed anyway on the same reasoning: the count
> was doing no work, and "they" reads better directly after the list that names them.
>
> **Left alone deliberately:** `/careers/` "Four steps. You see the job and we see you working…" —
> that list *is* numbered on the page, so the count is load-bearing there rather than decorative.

**2. Duplicate link + duplicate wording.** "See how each one runs." (channels paragraph) and the
"How we run it" button (teaching section) both pointed at `/what-we-do/` and read almost the same.
Split by destination and by subject: the channels line now goes to `/what-we-do/#channels` as
"See how each **channel** runs" (matching the nav label exactly), and the teaching button goes to
`/about/#teaching` as "How we **teach** it" — which is where the teaching material actually lives,
and whose H2 ("The method is not the differentiator. The teaching is.") is the same argument the
homepage section makes.

**3. CTA buttons swapped appearances on hover.** Matthew: "Book a consultation is highlighted black
and when you hover over it it goes to transparent and looks exactly like Start a conversation."
Confirmed in `site.css` — `.btn--onGreen:hover` went `background:transparent;color:black`, which is
the *resting* state of `.btn--onGreenGhost`, and the ghost's hover was the primary's resting state.
The two roles traded places under the cursor. Fixed: the filled primary stays filled and lifts to
`--lift` on hover, the ghost stays outlined and tints to `rgba(0,0,0,.12)`. Neither ever wears the
other's resting look. **Sitewide** — the `band--cta` component is on 15 pages.

**4. "Coverage" row — the Colorado-only problem, again.** Matthew: *"it just seems so limiting and I
feel like it scares off out of state companies… companies in like virginia might not want to, even
though we are still very capable of running it."* The row read "Every campaign runs out of
Englewood, Colorado, including for clients in other states" — leading with the limitation and
burying the capability in a subordinate clause.

The fix is already written on this page: the hero comment at `index.html:113` records **Matthew's own
rule from 2026-09-11** — *Englewood/Colorado appears only where we are talking about where we are
located, the office itself, or hiring.* The Coverage row broke it, since its subject is the account
team, not the office. Rewritten as **"Your location — We run campaigns for clients in other states,
with the same team and the same daily reporting."** Capability first, single team reads as
consistency rather than confinement, no location in a non-location context.

**The balance applied across the board**, per his instruction that it has to be consistent:

| Page | Was | Now |
|---|---|---|
| `/` | "Coverage — Every campaign runs out of Englewood, Colorado…" | "Your location — We run campaigns for clients in other states…" |
| `/about/#how-we-work` | H2 "**Run from one place**, reported on daily." + "Every account runs out of our Englewood office…" | H2 "One team on your account, reporting every day." + "We run accounts for clients in other states and in Colorado alike." |
| `/team/<10 bios>` | "…all work out of the same **Englewood** office." | "…all work out of the same office." |
| `/what-we-do/#common-questions` | "Can you work outside Colorado?" → "Yes. Every campaign runs out of Englewood, including…" | "Yes. We run campaigns for clients based in other states, managed by the same Englewood team and reported on the same way." |
| `/careers/` | "Where would I be working? Englewood, Colorado. Every campaign…" | **Unchanged on purpose** — a candidate asking where they will work is a location question, and the rule permits it in hiring context. |

The `/what-we-do/` FAQ keeps the location word because the question itself is about location — but it
had the worst version of the pattern: it answered "Yes" and then immediately re-raised the doubt the
reader had just been reassured about. Answer first, capability in the main clause.

### Second pass, same day — "other states" → "multiple states"

Matthew, on reading the above: *"instead of saying clients in other states, say clients in multiple
states… when you say in other states it sounds like it excludes colorado."* Correct — "other" takes
Colorado as the reference point and reads as *everywhere but here*, which is the same
Colorado-shaped framing the first pass was trying to remove, just inverted.

**Settled phrase, sitewide: "clients in multiple states."** All five occurrences updated (`/`,
`/about/`, `/what-we-do/` ×2, `/careers/`). No instance of "other states" remains in page copy.

**His second option, "across the US", was not used — and should not be.** RESTRICTED Tier 2 names
*nationwide framing* specifically, alongside footprint, scale and growth claims. "Multiple states"
is a **service-area** statement, and the 2026-08-15 correction to that same entry explicitly carves
service area out of the restriction ("this entry restricts *structure*, not *service area*"). The
distinction is the whole reason one is usable and the other is not. Flagged to Matthew.

**Fact-check on the claim itself.** "Multiple states" is supported: `brand/notes/clients.md` lists
active nonprofit clients in two different states. **The states must never be named together** —
clients.md:148 records that the sector-plus-the-two-states combination identifies both organizations
in one line, which is exactly what the Tier 4 prose rule exists to prevent. "Multiple states"
carries the reassurance without the identification, which is why it is the right phrase on the
merits and not only on Matthew's ear for it.

**One extra instance found in this pass** that the first sweep missed, `/what-we-do/` §How we work:
"We staff from one office in Englewood, Colorado, and **that is a fact about how we build a team,
not a limit on where we sell** — campaigns run for clients in other states out of that same office."
The defensive middle clause argued against a doubt the reader had not raised, which `brand-voice-
company.md` §4 treats as planting it. Cut to: "We staff from one office in Englewood, Colorado, and
run campaigns for clients in multiple states out of it."

Location is still in the footer, the JSON-LD, `/about/` §Based, `/contact/` §Office and the page
titles/meta — i.e. everywhere the subject genuinely *is* the location. Nothing here claims a
footprint, an office elsewhere, or nationwide reach; RESTRICTED Tier 2 (structure and scale) is
untouched. This is the "silence about a limitation is fine, asserting the opposite is not" move from
`brand-voice-company.md` §4.

**5. Teaching-section rotator, frame 2 — PRE-LAUNCH TASK, not yet actioned.** Matthew: *"the second
photo on the reel has a lady bent over, I think we can put something better there."* That is
`/assets/img/morning-block-b.jpg` (IMG_8374 from the 2026-09-11 batch, cropped 4:3 from a portrait
original — see the comment at `index.html:210`). He is uploading a larger photo batch on 2026-09-14,
so the replacement waits on that. **Swap the frame before launch.** Note the existing crop
constraints when picking the replacement: it must keep the `$39,000` GOALS whiteboard and the
"F✱CK AVERAGE" wall out of shot.

**6. Hero video — known, in progress.** Matthew is working on the file. The `<video>` slot is live
and commented at `index.html:~95`; the still is the guaranteed floor until `hero.mp4` lands in
`assets/video/`. No change needed.

## Additive colour rolled out to the inner pages — 2026-09-08

The homepage "lighten within dark" starter set (green funnel viz, `.mini-icons` row, one
`band--green`, green `.record` diamonds — logged in the theme section below and in the
`surge-site-rebuild` memory) tested well, so Matthew asked to apply the same treatment to the rest
of the pages, using **Cydcor** and **Smart Circle** as the reference for how a sales-outsourcing
site uses icons / infographics to lift a page. Those two both do the same simple thing: 1.6px
monochrome line icons paired with a heading (icon top or left), numbered process steps, and plain
big-number callouts — no decorative fills, no illustration. That is exactly the register of the
homepage kit, so this was a rollout, not a redesign. Nothing in the ground, type, bands or copy
changed; every addition is a green line-icon component or a tinted band on top of the existing dark
build.

**New CSS** (appended to `assets/site.css` under a dated header, after the homepage starter block):
`.card__ico` (line icon above the number on a numbered `.card`), `.chan__ico` (icon above a channel
label), `.job-list--stepped` (a green rail down the number gutter so a numbered `job-list` reads as
a stepper — ≥620px only, hidden on the last row), `.mini-icons--5` (5-up variant of the icon row),
`.audience .a-ico` (green line icon inside each option of the contact audience picker), and
`.contact-rail dt` diamond markers (parallel to the `.record` markers). One selector fix:
`.audience input:checked + .a-text` → `~ .a-text` because the icon now sits between the radio and
the text.

**Per page:**
- **`/what-we-do/`** — "The four jobs we run." section `band--lift` → `band--green`, each of the
  four numbered cards gets a `.card__ico` (reusing the homepage mini-icon paths:
  hiring/onboarding/training/management). Channels section: each `.chan` gets a `.chan__ico`
  (door / headset / pennant / market stall). "How an engagement runs." `job-list` →
  `job-list job-list--stepped` (green rail linking 01–05).
- **`/about/`** — "The work" section `band` → `band--green` + a 4-up `.mini-icons` row
  (Doorsteps / Phone / Events / Booths, matching the channels named in that paragraph). The
  `.record` plate on the page-head already carries the green diamonds from the homepage rollout.
- **`/careers/`** — "The roles we hire for." `band--lift` → `band--green` + a 5-up
  `.mini-icons mini-icons--5` row (Sales / Inside sales / Customer service / Administration /
  Operations — the role range from the copy). "How applying works." `job-list` → `--stepped`.
- **`/contact/`** — "Tell us which one you are." section `band` → `band--green`; each audience
  option gets an `.a-ico` (building for the client, person for the applicant). Contact rail gains
  the diamond markers via the shared CSS.
- **`/book/`** — "The person who would run it." section `band--black` → `band--green`; the intro
  contact rail gains the diamond markers.
- **`/team/`** — "One room, every campaign." `band--black` → `band--green` + a 4-up `.mini-icons`
  row (Leadership / Management / Trainers / Coordinators, matching the "Leadership and management"
  roster eyebrow). The roster grid itself is left alone — the headshots are the page's colour.

**Not touched:** the utility pages (`/privacy/`, `/terms/`, `/thank-you/`, `/404.html`) — legal /
transactional text with nothing to lighten. First "Events" icon tried was a triangle-with-centre-
line tent that read as a caution sign at small size; swapped to a pennant flag on both
`/what-we-do/` and `/about/`. Verified every page with headless-Chrome screenshots
(`scratchpad/shot.mjs` — plain-node CDP; **run with `MSYS_NO_PATHCONV=1`** or Git Bash turns the
`/what-we-do/`-style path arg into a Windows path and Chrome rejects the nav URL).

**Green-tint deepened, then the repeated grid broken up — 2026-09-08 (same day, Matthew review).**
Two follow-ups after seeing the rollout:
1. `band--green` read as faded → `color-mix(--lift 88%, --brand-green)` (≈`#283628`) deepened to
   `color-mix(#1e1e1e 74%, --brand-green)` (≈`#294829`) — ~26% green over a base a step below
   `--lift`, same luminance, clear green cast, still well short of the CTA. One rule, all six pages.
2. Matthew: "the same stylized black blocks of 4 in a row is used multiple times." True — the
   `.mini-icons` row plus the two `/what-we-do/` grids meant four near-identical dark 4-up grids
   down the site. Each group now has its own form; the homepage `.mini-icons` row is the one kept
   as-is (canonical), everything else diverges:
   - **`/what-we-do/` "four jobs"** `.card-grid.cols-4` → `.card-grid.card-grid--jobs`: 2×2, not
     4-across, with the step number as a large faint Anton watermark (`color-mix(--brand-green 26%,
     transparent)`) in the card corner.
   - **`/what-we-do/` channels** `.chan-grid`/`.chan` → `.chan-strip`/`.cs-item`: unboxed, on a
     single top hairline with a green node dot per channel (dots hidden <720px), bigger icon,
     Anton small-caps label. Reads as an index, not four cards. `.chan-grid` / `.chan__ico` CSS
     left as harmless orphans.
   - **`/about/` "The work"** — the `.mini-icons` row (which duplicated the channels) replaced by
     `.flow`: a three-step hand-off diagram, You → Surge → You (hand over a product + goal / build
     + staff + sell it / take the confirmed sale and deliver), green chevrons between steps that
     fade in after the section reveals. Claims all already on the page; matches "we run the sales
     function, you keep the business."
   - **`/careers/` roles** `.mini-icons--5` → `.role-chips`: wrapping outlined pills (thin green
     border, faint green fill, icon + mono label). The `.mini-icons--5` rule was removed.
   - **`/team/` "One room"** — the `.mini-icons` row cut entirely; replaced by one mono `.taxo`
     line ("Leadership · Management · Training · Coordination — one room."). The roster grid is the
     page's visual; it did not need a decorative row under it.
   New motion (gated `.anim` + `prefers-reduced-motion`): `.chan-strip` node dots pop in along the
   line; `.flow` chevrons fade in after the steps rise. `.mini-icons` is now homepage-only.

## Home / What-we-do de-duplication — 2026-09-08

Matthew's review note: following the top nav Home → What we do, the reader hits three sections that
echo in the same order, same layout, same stagger animation — "The jobs you stop doing." (identical
h2), the four-channel grid (same four cells, same order), and the "Worth saying plainly" eyebrow.
The Hiring card's first sentence was verbatim on both; Onboarding both ended "a structured start.";
Training both ended "it does not stop after onboarding." `/what-we-do/` adds a 5-stage engagement
timeline and an FAQ that are genuinely its own, but its first two sections were a longer retread of
the homepage's, so the fresh content did not arrive until the page already felt repetitive.

**Direction chosen (Matthew): compress the homepage; `/what-we-do/` owns the detail.**

Homepage (`index.html`):
- **Jobs section compressed.** Kept the eyebrow ("What we take over") + h2 ("The jobs you stop
  doing." — one of the strongest headings on the site, per the Copy Audit, so kept). Dropped the
  four numbered `.job-row`s, the `data-stagger`, and the `.job-tail`. Replaced with one `.job-intro`
  paragraph that names all four jobs and keeps three concrete beats pulled from the old cards
  (hiring runs continuously, training every morning, reporting without the people management), then
  links to `/what-we-do/` ("See how each one runs."). The full 01–04 breakdown is now the payoff
  for clicking through, not a preview of it.
- **Channels section shrunk, then merged into Jobs (Matthew, same day).** First pass dropped the
  4-cell `.chan-grid` + `data-stagger` and left a one-sentence standalone section (eyebrow "How the
  work happens" / h2 "Every channel ends with a person."). Matthew: it "feels empty" — and it was,
  literally: `--paper` and `--lift` are both `#1c1c1c` in the consolidated palette, so the standalone
  Channels band sat on the *same* background as the Jobs band directly above it with almost no
  content. **Removed the standalone section entirely; the channel line is now a second short
  paragraph inside "The jobs you stop doing."** ("The selling itself is direct — door to door, phone
  outreach, events and staffed booths. The channel only changes where the conversation happens; a
  person still has it.") The "See how each one runs." link moved onto that paragraph. "Every channel
  ends with a person." as a headline is gone from the homepage; the detailed channel grid lives only
  on `/what-we-do/`.
- Net: two stagger-grids and a dead one-line panel are gone; the homepage is shorter and reads more
  like a front door. Page flow now Hero → KPI → Jobs + channels (one band--lift section, two short
  paragraphs) → Teaching (split w/ photo) → Campaign team (record) → CTA.

`/what-we-do/`:
- **h2 "The jobs you stop doing." → "The four jobs we run."** — the old line is the homepage's;
  the new one is operational and pairs with the existing "What moves to us" eyebrow.
- **`.job-intro` reworked** so it no longer opens with the homepage's "Building a sales team is
  several jobs at once …" shape: now "Hiring, onboarding, training and management usually sit with
  one person who already has another job to do. On an engagement, each of these moves to us in full
  — here is what that covers."
- **Eyebrow "Worth saying plainly" → "Where we actually differ."** Per the 2026-09-07 ownership
  principle, that eyebrow was meant to go homepage-only; `/what-we-do/` was the last page still
  using it. The homepage Teaching section keeps "Worth saying plainly" (it owns it).
- The detailed job cards, channel grid, engagement timeline and FAQ are untouched — this page is
  where all of that should live. The identical-sentence problem in the Hiring/Onboarding/Training
  cards resolved itself: the homepage no longer has cards to collide with.

**Brand-voice check:** the "method is not proprietary" concession stays on both pages (§1 requires
it; the homepage Teaching section is its primary home). All changes are compression and relabeling —
no substantive claim changed, nothing that trips RESTRICTED.

**Dead CSS left in place:** `.job-tail` (site.css:238–239) — the homepage was its only consumer.
Left as-is, consistent with the `.sector-list` / `.sector-note` orphans from the sectors cut.

## /about/ — bare statement band folded into a real section — 2026-09-08

Matthew flagged the `.statement` pull-quote ("The method is not the differentiator. The teaching
is.") a second time — "idk if i like that the method heading is just by its self." He was told on
2026-09-04 it was a deliberate one-off component; raising it again = he wants it changed. Two
problems: (1) it sits with no eyebrow and no body, and (2) the section directly below it ("How we
work") already made the same not-proprietary / teaching-is-the-thing point in full sentences, so
the page said it twice in a row.

Chosen (Matthew): **fold it into a real section.** The line is now the h2 of its own `band`
section (eyebrow "Teaching") with the moved paragraph under it ("The sales method itself is not
something we invented … Teaching it well is what we are built on — onboarding, daily coaching, and
time in the field with someone who has done the job."). The bare `.statement` band is gone.
"How we work" keeps its eyebrow + h2 + only the operational note (Englewood, planners run it,
reported daily) — its second paragraph was the one that moved.

- New section order: page-head → The work → How we work (`band--black`) → Teaching (`band`) →
  The team (`band--lift`) → CTA. Backgrounds alternate; no two adjacent bands share a colour.
- The `.statement` component is now used nowhere on the site. CSS left in place (dead, harmless) —
  same treatment as the other consolidation orphans.
- §1 not-proprietary concession still on the page (now stated once, with context, instead of
  twice). No RESTRICTED interaction.

## Theme explored 3 ways, kept dark + added colour — 2026-09-08

**This notes file was restored from `_surge-site-dark-backup/` during the revert below, so it does
NOT carry the full Path C / Scheme B / Scheme C write-ups** — those live in
`drafts/_surge-site-scheme-c/index-draft-notes.md` and `_surge-site-scheme-b/index-draft-notes.md`,
and the summary is in `brand/guidelines/README.md` + the `surge-site-rebuild` memory.

Sequence: after the "dark ramp widened" work below, Matthew asked for a light re-theme.
**Scheme C** (all-light, `#faf8f3`) — his read: "too white / generic." **Scheme B** (dark hero +
dark header framing a warm-greige body, Anton-caps `h2`) — closer, still a re-theme. Final call:
**revert to the dark build and lift the darkness *additively*** — coloured icons, a funnel
infographic, faint green-tinted bands, green list markers — keeping the palette.

- **Revert:** `drafts/surge-site/` restored from `_surge-site-dark-backup/`. Scheme B saved to
  `_surge-site-scheme-b/` first. Three states kept: `_surge-site-dark-backup/` ·
  `_surge-site-scheme-c/` · `_surge-site-scheme-b/`.

### Starter set — HOMEPAGE ONLY (test before rolling wider)

- **KPI band → `.funnel-viz`.** The figures 106,000 → 37,600 → 8,900 are a funnel; replaced the
  loose `.kpi-grid` with three green bars at true proportions (100% / 36% / 9%), number + label
  above each, and the two conversion rates as green connector lines with a down-chevron. Numbers
  stay `--text` (mark carries the hue, not the text). Single hue — no CVD-palette concern.
- **Jobs section: `band--lift` → `band--green`** — a faint green-tinted band
  (originally `color-mix(--lift 88%, --brand-green)` ≈ `#283628`; **deepened 2026-09-08** to
  `color-mix(#1e1e1e 74%, --brand-green)` ≈ `#294829` after Matthew read the first mix as faded —
  same luminance, clearer green cast, still well short of the solid CTA band). One tinted section
  per page.
- **`.mini-icons` row** added to the Jobs section — hiring / onboarding / training / management as
  green 1.6px line icons + mono labels in dark recessed cells. A visual index, not a re-expansion
  of the content compressed earlier (icons + one word each).
- **`.record` green diamond markers** — `::before` rotated square on each `<dt>` in the
  campaign-team list.
- CSS appended to `site.css` under a dated header; bar-grow motion gated behind `.anim` +
  `prefers-reduced-motion`.

Verified via headless screenshots. Green now appears in four distinct forms + the CTA band, vs.
only thin eyebrow rules before. **Rollout done 2026-09-08** — see "Additive colour rolled out to
the inner pages" at the top of this file: `band--green` per page, `.card__ico` / `.chan__ico` on
`/what-we-do/`, `job-list--stepped` on the `/what-we-do/` + `/careers/` numbered lists,
`.mini-icons` rows on `/about/` `/careers/` `/team/`, `.a-ico` on `/contact/`, `.contact-rail`
diamonds on `/contact/` + `/book/`.
**Back with the revert:** the `.record` padding-top strip quirk (near-invisible on dark); the
`hero-bg.*` image is in use again.

## Dark ramp widened — image-less pages read "dark on dark" — 2026-09-08

Matthew: "some of it runs pretty dark when there's no image, like the contact page, it's dark on
dark." Diagnosis was quantitative — the greyscale ramp had tiny steps: ground `#0a0a0a` → `--lift`
`#1c1c1c` was 18 levels, `--line` `#262626` 28 levels, and form inputs
(`color-mix(ink 85%, lift)` ≈ `#0e0e0e`) sat ~4 levels above the ground. Pages with a photo get
relief from the image; `/contact/`, `/careers/`, `/book/` have none, and on `/contact/` the contact
rail cells and audience radio cards were set to `--ink` — the *same* colour as the page ground —
separated only by faint hairlines.

Chosen (Matthew): **widen the ramp + lift the panels**, staying dark-only.

- `--lift` `#1c1c1c` → **`#232323`**; `--line` `#262626` → **`#333333`** (both sitewide, token
  level). `--paper` / `--paper-line` legacy mirrors bumped to match.
- New token **`--field` `#1a1a1a`** for `.form input/textarea/select` fills (was the ~`#0e0e0e`
  color-mix); input border `var(--line)` → **`#3d3d3d`** so a field reads as a field.
- `.contact-rail div` and `.audience label` backgrounds `var(--ink)` → `var(--lift)` — they now
  read as panels sitting on the ground, not voids cut into it. `.audience label:hover` `var(--lift)`
  → `#2d2d2d` to keep a hover delta.
- Ground `--ink` `#0a0a0a` and the true-black `--black` `#000` band are unchanged — the page is
  still dark, it just has depth now.

Verified with headless-Chrome screenshots of `/contact/` (rail + audience cards + applicant form
open) and `/careers/` (the `band--lift` / `band--black` alternation is now legible where before
`#1c1c1c` vs `#0a0a0a` was barely distinguishable). Source-of-truth ramp table in
`brand/guidelines/README.md` updated. **Minor, not actioned:** `/careers/` has two `band--black`
(`#000`) sections back to back ("Trained first" / "You leave better") that merge into one black
block — pre-existing, separate from this pass.

**Screenshot tooling rebuilt this session** (`scratchpad/shot.mjs`, ephemeral): plain-node CDP
driver for system Chrome `--headless=new`. Gotchas that cost time — (1) Git Bash mangles a
`/contact/`-style arg into a Windows path, so the nav URL came out invalid; run with
`MSYS_NO_PATHCONV=1`. (2) Chrome's own `--screenshot=` flag is denied write access on this machine
(sandbox/policy) in every dir tried — capture via CDP `Page.captureScreenshot` and write the file
from Node instead. (3) `CLICK_JS` env var runs a `Runtime.evaluate` click after load, for
form-open / interactive states.

## Insights tabled — 2026-09-04

Matthew asked what the Insights section's underlying idea actually was. Working through it: only the
training-retention piece ties directly back to an existing practice (the morning block); talk-time
ratio and discovery-questions are closer to "we checked a widely-repeated industry stat and it
doesn't hold up" than to "this is where our training comes from." No content was changed based on
that conversation — Matthew's call instead was to **table the whole section** (the hub + all three
pieces) and anything tied to it elsewhere (`training/`'s "How we read the training research" button)
until the concept itself is refined. Nothing on the live site was touched — this is a review-sequencing
decision, not a content edit. Reflected in the review-queue artifact as a separate, non-interactive,
greyed-out block, and in the `surge-site-rebuild` memory so a future session doesn't treat it as an
open gap to fill in on its own.

## /training/ rework — 2026-09-07

Matthew: most of the page read MLM (the "ladder / rungs / climbed" framing) and most of it repeated
the not-proprietary / "we compete on teaching" thesis that is already on the homepage, `/about/`
(×2) and `/what-we-do/` — said **twice on this page** (lede + "Worth saying plainly"). He greenlit a
rework.

- **h1** "Do the job. Explain the job. Teach the job." → **"Trained every morning, coached in the
  field."** The old h1 was the anchor for the ladder section; new one names the two things the page
  actually covers.
- **Lede** — dropped the not-proprietary restatement entirely. Now: "The training here has two
  parts: a development block every morning, and coaching that continues in the field. Both run well
  past onboarding."
- **"The ladder" section → "The trainers."** Killed "rungs / climbed this ladder / come up the same
  three rungs" and the 01/02/03 `job-list` (the numbered format itself reads as a climb). Reframed
  as prose: a trainer worked a territory as a rep first, which is why the coaching is specific
  (about the real conversation, not the manual); in the field they go out on live doors with newer
  reps. Same honest content, no climb pitch. **If "worked a territory as a rep first" still reads
  too climb-y to Matthew, it cuts to just "trainers have worked the field".**
- **"Worth saying plainly" section — cut.** The eyebrow was on 5 pages (homepage, what-we-do,
  training, sectors/roofing, sectors/nonprofit) and the content re-said this page's own lede. The
  not-proprietary point now lives only on higher-traffic pages (ownership principle below).
- **Morning block section** — kept (Matthew: "fine"), just trimmed "It runs every day, and it does
  not stop after onboarding" (now covered by the lede). Band changed `band` → `band--lift` for
  rhythm after the section reorder. Both photos (`training-cohort-notes` page-head,
  `trainer-presenting` morning block) are unique to this page — `trainer-presenting` was de-duped
  off the homepage + `/careers/` earlier.
- New order: page-head → morning block → the trainers → green CTA.

**Repetition-ownership principle (Matthew, 2026-09-07):** each recurring point is owned by the
**highest-traffic page that needs it** (homepage first, then `/what-we-do/` / `/contact/` /
`/careers/`); deeper pages defer and drop it. First assignments: not-proprietary/teaching →
homepage + `/about/` statement band; same-day reporting → `/how-it-works/` step 5 + homepage KPI;
full morning-block description → `/training/` only; continuous hiring → `/what-we-do/` hiring card;
"Worth saying plainly" eyebrow → homepage only, rename on the other 4.

**PAGE CONSOLIDATION — executed 2026-09-07 (Matthew approved).** The repetition was downstream of
~16 content pages selling ~4 points.

- **`/how-it-works/` retired** — 5-stage sequence + "your part" folded into `/what-we-do/` as a new
  `#how-an-engagement-runs` section after the channels band.
- **`/training/` retired** — morning-block detail + "trainers have done the job" folded into
  `/careers/`'s "How you are trained" section (`id="how-you-are-trained"`); the client training
  point was already on `/what-we-do/`'s Training card.
- **`/careers/apply/` retired** — 4 steps folded into `/careers/` as a `band--lift` `#apply`
  section; green CTA now points straight at the `/contact/` applicant form.
- Retired dirs **moved, not deleted**, to `drafts/_surge-site-pages-removed/` — re-addable.
- Footer "Pages" column: "How it works" + "Training" links stripped from all live pages (sed).
  `sitemap.xml` trimmed. `.htaccess` 301s added for the 3 old URLs. Homepage hero + teaching-band
  buttons and `/book/`'s two inline links repointed. Dev mock server does not read `.htaccess` so
  the 3 URLs 404 locally — production 301s.

**`/sectors/` TABLED — 2026-09-07 (Matthew).** Aeration is still undefined and he has little on it
himself; dropping aeration would leave two sections, not enough for a sectors area. So the whole
thing is shelved until the range of work widens. Done: `sectors/` dir (hub + nonprofit + roofing +
aeration) → `drafts/_surge-site-pages-removed/sectors/`; homepage "The sectors we run now." section
**deleted**; `/about/` record-row `<dt>Sectors</dt>` deleted and its meta "Sector only, never client
names" → "Clients are never named."; "Sectors" footer link stripped sitewide (sed); 4 URLs out of
`sitemap.xml`; `.htaccess` `^sectors(/.*)?$` → `/what-we-do/` 301. **Side effect flagged:** the
homepage now shows only nonprofit as an industry (the KPI-band scope line "our nonprofit fundraising
work", kept because §2 requires the figures state their scope). The sectors block was the one place
roofing/aeration showed. If nonprofit-heavy is a problem, the KPI band is what to revisit — no
non-nonprofit metrics exist. Dead CSS left in place: `.sector-list`, `.sector-note`.

**`/book/` KEPT — 2026-09-07 (Matthew): "We want to keep the booking/contact."** The `/book/` →
`/contact/` merge is OFF. `/book/` stays as its own page, footer-linked, with its calendar/slot
picker. So the lean set is 7 content pages: home, what-we-do, about, team, careers, contact, book.

## /how-it-works/ pass — 2026-09-07

Matthew's review.
- **Lede** dropped "reported back to you every day" — same-day reporting is stated on step 05
  where it belongs, plus homepage KPI note / `/what-we-do/` / `/sectors/nonprofit/`. Now "From the
  first call to a team in the field. Five stages, and we run all five ourselves."
- **Meta description** rewritten — it carried both the reporting redundancy and "we keep the
  personnel problems".
- **Step 03** "Hiring runs continuously, so growing the team later is not a restart." →
  "Hiring runs continuously rather than in a single intake." Matthew flagged the phrase as awkward
  and it echoed the homepage/`/what-we-do/` continuous-hiring framing.
- **Step 04** — removed "for roofing and storm restoration we also run the inspection, same day,
  on the spot." Matthew: roofing/inspection is just another product Surge sells, not a speciality,
  does not need its own statement — and the same call was already made on `/what-we-do/` ("field
  funnel de-roofed"); the detail lives on `/sectors/roofing/`. Also reworded "Trainers coach in
  the field every day" → "with a trainer coaching alongside them" (another "every day" + training
  mention).
- **Step 05** "We keep the personnel problems." → "Managing the team day to day stays on our
  side." Same fix the homepage Jobs-04 card got — a phrase that reads as expecting personnel
  trouble.
- **"Before you ask" section removed entirely** (eyebrow + h2 "Two things we will not put a single
  number on." + the cost / start-speed `<details>`). Matthew: over-transparent, that is a
  first-call conversation. Consistent with §4 (a heading the reader can answer "no" to, that plants
  a doubt and then does not resolve it). The green CTA already carries "Channel, timeline and price
  get worked out on the first call." **Side effect:** that section held the only inline link to
  `/what-we-do/` ("What we take over") — gone now; nav + footer still cover it. Re-add to the
  stages section if wanted.
- **Photo removed.** `office-floor-wide.jpg` was the *same gathering* as `office-floor-b.jpg` (the
  `/about/` "The team" shot) — same people, same moment, wider crop, "GRIT NOUN" + "TRAVEL/money"
  posters **more** legible, at the top of the page. Matthew: remove it (repetition + the poster
  concern we'd already had). Page-head is now text-only like `/careers/` / `/contact/`.
- **New "Your part" section** to replace the lost bulk (page was down to page-head + 5 stages +
  CTA). `band` section after the stages: eyebrow "Your part", h2 "The ends are yours. The middle is
  ours." — the client is on stage 1 (call), stage 2 (scope sign-off) and stage 5 (reporting); 3-4
  run without them; "Handing the sales function over is meant to take the day-to-day decisions off
  your desk, not only the work." A genuinely additive client's-eye beat, not a rehash of the
  stages. It also re-homes the `/what-we-do/` ghost link ("What we take over") that was lost with
  "Before you ask".
- **Header full stops** — Matthew asked whether big headers ("How an engagement runs.") need the
  period. It is a committed sitewide device (every heading, all ~32 pages; logged in the Work-Up
  fixes). Recommended keeping — consistent, reads as a deliberate declarative style; half-and-half
  would look worse. Reversible as a mechanical sweep if he wants it gone.

## /about/ — culture section added — 2026-09-07

Matthew: `/about/` references no team culture, goes straight into work and methods. Pasted old-site
copy as an example of the *kind* of section he means — none of it usable: "**award-winning**"
(unverified, no award in the notes), "professionals **in Denver**" ×4 (factual error — Englewood),
"**measurable success** / **increased ROI** / **drives real results**" (§2 — unsourced metrics),
"**data-driven approach** / personalized outreach strategies" (§1 — no differentiated-method
claim), "Centering ourselves around **gratitude and POSITIVITY**… environment where members can
thrive" + vision/mission boilerplate (§5 vibes-culture texture).

First two drafts were **culture-as-practice** (the morning development block as a whole-company
habit; "everyone here is still in training, including the trainers"). Matthew rejected both — too
work/training-flavoured, and repetitive (the morning block is on 4 other pages). He then asked
explicitly for "drive, hospitality, teamwork, partnership, collaboration, comradery". Flagged that
that word-list is precisely the §5 vibes-culture ban + the RESTRICTED standing test (Surge has a
live r/Devilcorp accusation; "drive"/"goal-driven" was the old-site h1) — near-zero upside
(wallpaper for every company) and a real screenshot cost for Surge specifically.

He asked for a **structural** version to react to. Live section — `band--lift`, "The team", after
"How we work", before the green CTA:
- h2 "One floor, and everyone is on it." Flat + co-located: reps, campaign planners, leadership in
  one room; no management floor, no separate ops team; "a change gets made by turning around rather
  than routing a request". Para 2: no departmental handoffs — planners and reps are "the same
  people, in the same room, on the same day". Para 3 is **employee-facing** (his critique that the
  section read client-only): see the whole operation from your seat, not locked into your starting
  role, "what you move into has more to do with what you are good at than with an org chart".
- Per his react: **dropped "from the same room in Englewood"** — it read "small one-office company";
  "one room" alone reads as a way of working. Cut "same small group" → "same people".
- "How we work" para 2 keeps its "onboarding, daily coaching, time in the field" tail (the earlier
  trim was for the rejected training-flavoured draft; not needed now).

**Photo — Matthew's explicit call.** Flagged that the orphan `office-floor-b.jpg` ("people in the
room") has a **legible "GRIT" definition poster + "TRAVEL/money" poster on the wall** — the same
motivational wall text that got the hero office shot rejected for `og:image`, and the visual form
of the devilcorp texture kept out of the copy. He said *"use the GRIT photo. If it doesn't look
right I will make the call."* Placed as the "The team" `.split` photo (text-left / photo-right),
plain `<img>` (no `.webp` for that file), figcaption "The floor &middot; Englewood office". "Take a
job here and" reworded to "If you work here," per his react.

Tried an `object-position` / aspect crop to push the posters out of frame — **abandoned**: the
posters and the people's heads occupy the same horizontal band, so any crop that loses the posters
also decapitates the group. Photo sits with the standard `.split__media` 3:2 centred crop, posters
visible. **Swap in a wall-text-free office shot if one is ever taken.**

## /careers/ — "Why work with us" section — 2026-09-07

Matthew asked for a "why work with us" section (was on the old site; common pattern) and pasted the
old-site copy to adapt. Assessed clause by clause — almost none of it survives the brand rules:
"team in **Denver**" is a factual error (the office is Englewood; Denver is an affiliate room);
"**competitive compensation and benefits**" is a §5 hard-no (atmospheric earnings on recruiting
copy); "dedicated to **innovation**" contradicts §1 (not-proprietary); "dynamic / collaborative /
fosters growth / values its people / driving success" is the vibes-culture texture §5 names as what
critics screenshot.

The honest "why work here" is already the page's substance (trained first, coached daily,
transferable skills, a route up), so rather than add a 4th section that restates the three above it,
**reframed "Who does well here" → "Why work with us"**: h2 "You leave better at the work than you
arrived."; kept the "want to get good, not just hold a job" + transferable-skills lines; added one
new beat — "you work alongside trainers and team leads whose job is to coach you, not just a
manual" — and a closing "there is a way up". Same `band--black` section, same position (last content
band before the "Want in?" CTA). If Matthew wants it as a genuinely separate section, flagged that
it will necessarily repeat the roles / how-trained / who-fits content.

## /contact/ pass — 2026-09-07

Matthew's page-by-page review, contact page. Copy + the applicant form.

**Copy**
- Audience lede: "companies who need a sales team, and people **who want to sell**" →
  "…and people **looking to join one**." Broadened without reaching for "grow a career" /
  "professionals who want to grow" — that vague-growth phrasing is what brand-voice-company.md §5
  and [[recruiting-copy-register]] rule out. `meta description` + `og:description` matched.
- "Which one are you?" → **"Tell us which one you are."** (§4 — a heading the reader can shrug at).
- Dropped "Say which one you are and you get the right form." from the lede — it duplicated the new
  h2 and the helper line under the radios said the same thing a third time.
- **Hours row removed** from the contact rail *and* the homepage footer's Contact column (the only
  two visible spots; JSON-LD never had `openingHours`). Reason: published office clock times sit in
  RESTRICTED Tier 2, and "9:00–5:00" didn't match the real schedule anyway — Matthew: it "varies",
  he'd call it 9–6, so nothing goes on the page. **Flag #9 updated below.**

**Required fields** — none existed client-side before (only `submit.php` enforced name/email/
message). Added `required` across both forms. Server now also checks the two consent boxes on
`job` and `client`, and the timeline select on `client`.

**Applicant form rebuilt** (several requests from Matthew): now role-agnostic, not field-sales-only.
- "Sales experience" select (None yet / Some / Several years) → **"Role you're interested in"**
  (Sales / Inside sales / Customer service / Administration or operations / Not sure yet). Field
  `name` `experience` → `role`; `submit.php`'s extra-field whitelist updated to match.
- "Why field sales, and why now?" → **"Why do you want to work with Surge?"**
- Radio subline "I want to sell, and to be trained to do it" → **"I want to work here, and to be
  trained to do it."**
- **Added:** earliest-start-date picker (`type=date`; `site.js` sets `min` to today), a
  LinkedIn/website/portfolio text field (optional), a **résumé upload** (`accept=.pdf,.doc,.docx`,
  5 MB, `aria-describedby` hint) — **optional**, matching `/careers/apply/`'s "welcome but not
  required" (I first set it `required`, then removed that to stay consistent), and two **required**
  consent checkboxes — contact-permission (links `/privacy/`) and info-accuracy.

**Client (prospective-client) form** — Matthew's asks:
- **Your role or title** — plain text input (`name=title`, `autocomplete=organization-title`).
- **How did you hear about us?** — optional text input (`name=heard`).
- **Timeline** — `required` select: ASAP / Within 2 weeks / Within 30 days / Planning ahead /
  Unsure. Purpose stated in a `field-hint`: "helps us prioritise." Server requires it.
- **Anything we should see** — optional file input (`name=document`,
  `.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg`, 10 MB).
- **Same two consent checkboxes as the applicant form** (wording "this enquiry" not "this
  application"), both `required`.

**Backend — written, NOT run. Wire and test before launch, or switch to a hosted form service.**
No PHP on the dev machine; the local mock server accepts the POST and shows success but saves no
file. What changed:
- `assets/site.js` — the AJAX submit sent URL-encoded bodies (drops file inputs). Now sends
  multipart `FormData` when a file is attached, URL-encoded otherwise. Applies to both forms.
- `api/submit.php` — shared `save_upload($cfg, $key, $exts, $max)` helper, called for `resume`
  (`job`) and `document` (`client`): extension + MIME + size check, random filename,
  `move_uploaded_file` to `api/uploads/`, stored name in the notification email (not an
  attachment). A missing / oversized / wrong-type / unwritable upload is flagged and **never
  blocks the submission**. Also: consent + client-timeline validation; `$extra` whitelist gained
  `title`, `start`, `links`, `timeline`, `heard`.
- `api/config.php` — `upload_dir`; `max_upload` (5 MB) + `allowed_ext` (résumé); `max_upload_doc`
  (10 MB) + `allowed_ext_doc` (wider — client document).
- `api/uploads/.htaccess` (new) — `Require all denied` + PHP engine off. Retrieve files by SFTP /
  File Manager.
- `deploy/make-bundle.mjs` — skips `api/uploads/` contents (applicant/client PII), keeps the
  folder + its `.htaccess`.
- `deploy/DEPLOY.md` — "File uploads" section: folder must be writable by PHP, host must have
  `file_uploads = On` and `upload_max_filesize` / `post_max_size` ≥ 10 MB, no rate limiting
  beyond the honeypot.

**`/careers/apply/` broadened to match** (2026-09-07): `<title>` / `og:title`
"Field sales, Englewood CO" → "Englewood, CO"; `og:description` "applying for a field sales role"
→ "applying to Surge"; step 1 "why field sales" → "why you want to work here".
**Left alone, on purpose:** the homepage `<title>`/positioning and the footer tagline
"manage field sales teams" — those describe Surge's *service* (field/direct sales: door-to-door,
calling, events, booths), not hiring scope. Broadening them to "sales teams" would blur the core
positioning. Recruiting scope ≠ service scope.

**"Book a consultation" prominence (Matthew, 2026-09-07)** — he wanted it louder in the footer.
Done CSS-only: `footer .fcol a[href="/book/"]` renders as a filled green button (brand-green bg,
black text, padding; hover inverts to outline) instead of a plain link at the bottom of the Pages
column. One `site.css` rule, applies to all ~32 pages, no per-page HTML edit. Header nav left lean
(5 links + phone pill; site serves job-seekers too, so a booking CTA in global nav skews client-
only). **Eyeball:** on pages ending with the green CTA band, the footer button is a 3rd stacked
green element; and the homepage hero's `/book/` button is still `btn--ghost` (outlined), so the
footer CTA now reads louder than the hero one.

## Team bios enriched from surgeftw.com, filtered — 2026-09-04

Matthew asked to pull the live site's bios in for the respective people. Pulled all ten via the same
`/wp-json/wp/v2/pages?slug=team` REST approach used for the Jon Wallace photo. **Flagged before
touching anything**: the live bios are heavy with exactly the "devilcorp-tell" texture this rebuild's
bios were deliberately rewritten to strip (see the `## Team page` section of [[surge-site-rebuild]]
memory and brand-voice-company.md §5) — Myles's "buying my first McLaren within three years," Cai's
closing Zig Ziglar quote ("help enough other people get what they want"), Nneka's "making my money
work for me," Jon's "take control of their skills and income," Ryan's build-enough-that-my-wife-
doesn't-have-to-work framing, and inspirational-quote closers on most of the rest. Dylan Conger and
Brandon Long's "bios" turned out to be icebreaker-question answers (a favorite animal; a company
holiday idea), not real bios, and Dylan is off the roster entirely already.

Matthew's call, given the options: **pull the genuine personal-interest specifics, drop every
money/quote line.** Added to eight bios (team-data JSON on `team/index.html` plus each person's own
`/team/<slug>/` page, kept in sync): Brandon (the off-grid-day company-holiday idea, reframed as a
tech-detox aside), Ryan (ancient-alien conspiracy theories), Jon (dad jokes, freestyle rap), Nneka
(musical theater), Lance (family of cooks, a culinary-chef sister), Maya (building a music management
company and recording studio), Myles (four-wheelers/need for speed &mdash; the McLaren line itself
was not reused), Cai (ballet/tap/jazz training, a homestead goal). **Paige Bennett and Matthew Sharpe
left unchanged** — Paige's live-site content was entirely generic uplift language with no concrete
detail to extract; Matthew wasn't on the old roster at all, no source bio exists.

## Jon Wallace headshot added — 2026-09-04

Found on the live surgeftw.com (WordPress) via its `/wp-json/wp/v2/pages?slug=team` REST response,
which carries the real `wp-content/uploads` image URL — the rendered page only ever serves a
lazy-load placeholder gif. Cropped square, saved to `assets/img/people/jon-wallace.jpg`, original
archived in `brand/photos/people/`. Replaces the "JW" monogram in the roster grid, the in-page bio
browser, and `/team/jon-wallace/index.html`. **Not independently verified as actually him** — pulled
because the live site's own markup ties that URL to his name, not because I confirmed the face
against a reference photo. Full provenance in the `surge-site-rebuild` memory.

## /team/ pass — 2026-09-04, revised same day

**Revised: no featured default person after all.** My first fix (below) defaulted the detail panel
to Brandon Long so there was never an empty box to explain. Matthew's correction: the page should
open on the roster grid itself, nobody pre-picked, not featuring whoever happened to be first in the
list. Reverted the server-rendered Brandon Long content back to an empty `<article>`, removed his
`is-active` roster class, and — the part that actually solves it — **changed `.team-detail.is-empty`
from a partially-hidden-but-still-boxed state to `display:none`**, so the whole panel now takes zero
space until a card is clicked, rather than rendering an empty bordered box. That's what makes "no
featured person" work without reintroducing the empty-box problem the Brandon Long default was
built to avoid. Verified both states by driving headless Chrome: a plain visit shows only the roster
grid, and a scripted click on Ryan Conger's card correctly reveals his full bio at the top with his
card ring highlighted — same interaction as before, just starting from nothing instead of someone.

## /team/ pass — 2026-09-04

- **"Everyone at Surge and what they do"** was wrong — the roster is leadership and management, no
  reps. Matthew caught it. Lede shortened to "Surge's leadership and management, and what they do,"
  and the eyebrow directly above the roster grid ("Everyone") changed to "Leadership and management"
  for the same reason — same inaccuracy, he only named the lede but it applied there too.
- **UI self-narration removed**: the lede's "Pick anyone from the row and their bio loads here — the
  row stays put..." sentence, and the detail panel's empty-state prompt "Pick anyone from the row
  below to read their bio." Matthew's read: no other team page explains its own interaction pattern,
  and it reads as unnecessary hand-holding. Rather than just deleting the prompt and leaving a blank
  box before any click (which reads as broken, not restrained), **the page now server-renders Brandon
  Long's full bio into the detail panel by default** — real photo, name, role, social row and both
  bio paragraphs, with his roster card marked active. This removes the empty state entirely rather
  than papering over it: nothing needs explaining because there's never a moment with nothing to
  read. Deep links (`/team/#slug`) still override the default via the existing JS, unchanged.
- **Social-placeholder disclaimer removed** ("Social links on this page are placeholders in this
  draft.") — per Matthew, doesn't need to be said; the `href="#"` links themselves are untouched.
- **"One room, every campaign" section reworded.** Body previously repeated the "runs out of one
  office, including clients in other states" line already used (and separately flagged) elsewhere —
  Matthew called this instance both repetitive and too transparent. Rewritten to talk about the
  people actually shown on this page instead of geography: "The people above run the room day to
  day, campaign after campaign — not a rotating cast." Eyebrow changed from "Who you deal with" (also
  used verbatim on the homepage's campaign-team section, for a related but not identical claim) to
  "Who runs it," so the two pages read as distinct rather than echoing each other.
- Screenshotted the page to confirm the new default-selected layout renders right — two-column with
  photo, all green "active" ring styling on Brandon Long's card. It does.

## /about/ pass — 2026-09-04, dialing back the candor pass

Matthew's read: the page's "radical transparency" voice — explicitly the point of the candor pass
noted earlier in this file and in [[surge-site-rebuild]] — reads as over-transparent in practice,
reveals things that undercut confidence (young company, one office, can't relocate a team), and in
one section reads like internal policy documentation rather than external copy. This is a genuine
direction change for this page, not a mechanical fix — noting it plainly since it partly reverses a
choice made deliberately earlier. It's also consistent with brand-voice-company.md §4's existing
rule that operational limits belong in a conversation, not a published line — so it's an extension
of a standing principle more than a break from it.

- **H1** — "A sales company that says what it is." (the candor pass's thesis line) →
  "A sales and marketing company built on training." States identity and the one real
  differentiator (§1) without branding the page around "we tell you everything."
- **Based row** — "Englewood, Colorado — one office, and it runs every campaign" →
  "Englewood, Colorado." The longer version is now cut everywhere on this page; the underlying fact
  isn't false, it's just not being led with as a qualifier anymore.
- **"The work" section** — cut "The work then transfers to the client's own workforce to deliver"
  (Matthew: not true for every client) and the entire second paragraph about running from one office
  and being unable to station a team elsewhere (same reasoning as the `what-we-do/` cut earlier this
  session — Surge has expansion plans that could make the limit untrue, and it reads smaller than
  intended).
- **"Where we do and do not compete" section removed entirely**, not reworded. Matthew disliked the
  framing (the word "compete," specifically) and disliked stating "we are a young company and do not
  have decades to point at" in public copy — reads as inexperience. Nothing unique was lost: the
  section's actual claim (method isn't proprietary, teaching is what's checkable) survives immediately
  after in the "The method is not the differentiator. The teaching is." statement band, which Matthew
  explicitly likes and which was kept untouched.
- **On that statement band** — Matthew flagged it as feeling incomplete, "like there's supposed to be
  something underneath." Checked the CSS: it's a deliberate one-off "pull-quote" component
  (`.statement`, used nowhere else on the site) — big Anton text, generous padding, no body copy by
  design, meant as a standalone rhythm break. Not a bug. Screenshotted the page after the other
  edits on this pass to confirm it still reads fine in the new, shorter flow — it does. Flagging
  this reasoning here rather than changing it, since Matthew said he likes the line itself.
- **"Two things we are careful about" → "Worth knowing."** Eyebrow reworded (the old one editorializes
  about the company's own caution, which is part of what read as internal-documentation tone).
  **Clients**: "No client hired Surge in order to become marketing material, and that was never our
  call to make" cut — that's Surge explaining its own reasoning to the reader, which is the
  internal-memo texture Matthew flagged. New version states the same mechanism (sector not org,
  unless the client says otherwise in writing) without the justification. Matches his note that nothing
  should read as limiting a client who *wants* to be named. **Numbers**: trimmed "and who reported it"
  as redundant with the sentence that follows it; scope + source kept, since brand-voice-company.md §2
  still requires both on any figure.

## Sitewide repetition + thin-section pass — 2026-09-04

Matthew asked for a careful read across all ~32 pages: reduce cross-page repetition, and cut/deepen
anything as thin as the field funnel turned out to be. Grepped for exact and near-exact repeated
blocks rather than relying on memory of each page. Four real findings, all fixed; two lookalikes
deliberately left alone.

**1. The green CTA band was word-for-word identical on 8 pages** (homepage, `how-it-works/`,
`training/`, `team/`, and all four `sectors/` pages) — same h2 "Tell us what you need sold.", same
body sentence ("Anything that sells in a conversation, we can sell..."). Worst case: the three sector
subpages, readable back to back, hit the identical paragraph three times in a row. Kept the h2 as a
consistent tagline (repetition there reads as identity, not laziness) and kept the homepage's body
sentence as-is — it's the exact line brand-voice-company.md §4 holds up as the model. Reworded the
other 7 body sentences to tie to that page's own content instead of restating the generic promise:
`how-it-works/` references "the five stages above," `training/` references the training itself,
`team/` references "the faces above," the sector pages each get a line specific to that sector
(nonprofit: cause and ask; roofing: storm urgency; aeration: "whatever you sell"). None of the new
lines use a question the reader could answer "no" to — checked against the same §4 rule already
applied sitewide.

**2. "Plenty of companies run the same model... from the same playbook. Anyone who tells you their
field sales process is proprietary..."** opened the "worth saying plainly" section on **three**
pages (homepage, `training/`, `what-we-do/`) in near-identical wording — training/'s copy differed
from the homepage's only by missing "we do." Kept homepage's version (first point of contact).
Reworded `training/`'s to open as a callback to the ladder/morning-block content just above it on
that same page rather than re-opening the premise from scratch. Reworded `what-we-do/`'s to a
different sentence shape entirely. `about/index.html`'s version of this same claim was already
distinct ("The playbook is not ours...") — used as the model for how the other two should differ.

**3. Homepage and `what-we-do/` had the identical H2 "Every channel ends with a person"** over the
same four-channel grid, with `what-we-do/` (the page meant to go deeper) actually carrying *less*
body per card than the homepage's teaser version — backwards for a page whose eyebrow is "How the
selling happens." This one had no linking "read more" button connecting the two sections (unlike the
Teaching→`/training/` and Insights→`/insights/` homepage sections, which share their headline with
their destination page deliberately, as a breadcrumb — those were left alone, see below). Reworded
`what-we-do/`'s H2 to "How each channel actually runs." and gave all four cards real operational
detail instead of a two-word tag.

**4. `what-we-do/`'s Hiring card became a near-duplicate of the homepage's Hiring card** as a
side-effect of an earlier edit this session (removing the turnover reference by reusing the
homepage's phrasing). Reworded with its own angle (hiring running continuously "in the background"
so a cohort is already moving) rather than repeating the homepage's "not waiting on a hiring round."

**Deliberately left alone — not repetition, this is wayfinding:**
- Homepage's Teaching section H2 ("Anyone can get the method. The difference is the teaching.") and
  `training/`'s own H1 use the same line — but the homepage section links through with a "How the
  training works" button, so landing on the identical headline confirms you arrived where the button
  said you would. Same pattern for homepage's Insights H2 ("We check the numbers everyone repeats.")
  and `insights/index.html`'s H1, linked by an "All insights" button.
- The "development happens before anyone speaks to a customer" fact appears on the homepage,
  `what-we-do/`, `careers/`, and `training/` — each in different words already, restating the same
  fact rather than copy-pasted, which is the intended pattern for the one real differentiator
  (brand-voice-company.md §6).

No other thin, field-funnel-style sections turned up on a full read — the sector pages, careers
pages, insights pieces, and process/step lists elsewhere all carry real body per item already.

## /what-we-do/ pass — 2026-09-04, Matthew's page-by-page review, page 1 of the review queue

- **Lede/section-header repetition** — page lede opened "You hand over the sales function," section
  right below it was headed "What you hand over." Eyebrow changed to "What moves to us."
- **"Because this channel turns over" cut from the Hiring card.** This was a direct turnover
  reference — brand-voice-company.md §4 holds turnover for a meeting, not a published line, and
  Matthew independently flagged it the same way before I pointed to the rule. Replaced with the
  homepage's existing framing for the same card ("...so you are not waiting on a hiring round when
  you want to grow"), so the two Hiring cards now agree instead of drifting.
- **Training card** — "It is the part of this we compete on" (ambiguous pronoun, and "compete on"
  read as unclear) → "This is the area we thrive on," Matthew's own wording.
- **Management card cadence conflict fixed** — card said "reported back to you each week," the page
  lede two sections up says "report back on it every day." Card changed to "every day," matching the
  lede and the "same day" reporting claim used consistently elsewhere on the site (homepage KPI note,
  `sectors/nonprofit/`, `how-it-works/`).
- **Cold calling channel** — "lead follow-up and outreach" → "lead generation, follow-up and
  outreach."
- **Field funnel de-roofed.** Step 01 dropped "Damaged property" as the lead example (was implicitly
  roofing-only); now "A neighborhood, a lead list, an event floor, a booth line." Step 05 dropped
  "For roofing and storm restoration we also run the inspection, same day, on the spot" — that
  content already lives properly, with more detail, on `sectors/roofing/index.html`'s own handover
  rail, so nothing was lost, just de-duplicated and the shared funnel made sector-neutral.
- **"Worth saying plainly" reworded**: "What we are accountable for is the transfer" → "Where we
  thrive is how well the method is taught" (Matthew's wording, typo corrected).
- **"What we cannot do is station a permanent team somewhere else" removed**, per Matthew: Surge has
  expansion plans (more staff, possibly offices in other states) that could make this untrue later,
  and it reads as more limited than the company wants to sound. Nothing was added in its place — an
  affirmative expansion/footprint claim ("we're expanding to multiple states") was deliberately not
  written in, since that's exactly what brand-voice-company.md §5 rules out (no scale/footprint/growth
  claims) and the plans aren't a sourced, datable fact yet. If Matthew wants that claimed
  positively once plans firm up, it needs its own pass, not a default add here.
  **Same sentence still exists verbatim in this page's own FAQ** ("Can you work outside Colorado?"
  answer) — not touched, since Matthew's reworking the FAQ himself (see below).
- **Two-audience note, not yet acted on**: Matthew flagged that this page (like most of the site) is
  read by both prospective clients and prospective employees, and that recruiting is arguably the
  single biggest priority — so wording has to land for both, not just the client pitch. Nothing
  rewritten specifically for this yet; worth re-reading the page with a jobseeker's eyes on a future
  pass, not just a client's.
- **"The field funnel" section removed entirely.** Matthew's read: bleak, thin, not much body to
  it — right call. After de-roofing it (above), the five steps were one short phrase each with
  nothing sector-specific left to anchor them, and it duplicated the more substantial 5-step process
  already on `how-it-works/index.html` ("How an engagement runs"), just at a different zoom level
  (a single conversation vs. a whole engagement). The one claim worth keeping — a rep closes to a
  confirmed sale, not a booked appointment — already exists on `how-it-works/`'s "Run the campaign"
  step, so nothing unique was lost. Page now goes straight from the channels section into "Worth
  saying plainly." Screenshotted to confirm the pacing still reads fine with one fewer section.
- **FAQ section — Matthew is rewriting it himself.** Explicitly not touched this pass beyond what
  already existed. **Standing reminder: revisit before launch**, or whenever he's short on what to
  work on next. Also logged in the `surge-site-rebuild` memory so it resurfaces even in a new session.

## Voice calibration — 2026-09-04

Matthew is finishing this rebuild on a machine that doesn't have the earlier, more-polished pass —
this section exists so the calibration survives that gap. It's an addendum to
[brand-voice-company.md](../../brand-voice-company.md), scoped to this site (that spec covers social
copy; the site is longer-form and a first impression, so it earns its own register note rather than
inheriting the social spec's contractions-on default wholesale).

**Resolved:**
- **No contractions anywhere on the site** — a notch more buttoned-up than the social voice.
  Supersedes the earlier design-system note ("Contractions ON") in [[surge-site-rebuild]] / this
  file's design-system section. Sweep needed across all ~32 pages, not just the homepage (see below).
- **Homepage hero, final wording:** H1 "We will handle your entire sales team so you can focus on
  building your business." — merges the old positioning line (previously flagged "kept for a
  bio/ad/deck, not the web") onto the current H1, replacing the shorter "We'll handle your entire
  sales team." + a now-redundant lede tail. Lede trimmed to "The whole function — hiring, onboarding,
  training and day-to-day management." to avoid stacking two "so..." clauses back to back. Applied to
  `index.html` and its `og:description`. The Copy Audit's alternate rewrite ("We hire, train and run
  your field sales team.") is passed over, not deleted — still on record above if this changes again.
- **Structure confirmed as-is:** capability-first (what Surge does, right after the hero) over
  problem-first or proof-first. No change needed.
- **Assertiveness:** flat, declarative capability statements ("we hire, train and manage your sales
  team," not "we can help with..."), each followed by a concrete specific where one exists (a number,
  a named step, a piece of the actual process) rather than left to stand alone unsupported. Same rule
  as brand-voice-company.md §4 ("confidence in the verb, never the scope") — this just states how it
  should read on longer-form site copy specifically.

**Reference research — internal calibration only, never named or cited in the copy itself** (the
site already excludes competitor names/citations per brand-voice-company.md §3 — this is Matthew
reading their structure, not the copy quoting them):
- **[Cydcor](https://www.cydcor.com/)** — closest business-model analog (outsourced face-to-face
  customer acquisition via a network of sales companies). Hero is a 6-word capability subhead,
  minimal contractions, flat declarative claims ("Cydcor operates..."), capability-first with proof
  (client roster, awards) arriving after.
- **[Toptal](https://www.toptal.com/)** — capability-first hero, near-zero contractions, unhedged
  numeric claims ("98% trial-to-hire success rate," "Hire in under 48 hours") sitting right next to
  the capability statement rather than in a separate proof section.
- **[ADP](https://www.adp.com/)** — capability-first, but *does* use contractions ("we've") for
  approachability, with a dedicated proof block (client count, years operating) directly under the
  first capability section rather than folded into it.

The pattern that generalizes: capability-first with the claim and its proof kept close together reads
stronger than capability alone or proof pulled into its own separate section — that's the assertive
option applied above. Surge's own proof (metrics) is still gated on brand-voice-company.md §2/§8's
open item (no headline numbers cleared yet), so the "specific" attached to a claim right now has to be
a process detail, not a figure, until that's resolved.

**No-contractions sweep — done, all ~32 pages (2026-09-04).** 169 contractions expanded on the first
pass (`don't`→`do not`, `we're`→`we are`, `we'll`→`we will`, etc.), mechanical and case-preserving. A
second pass caught what the first missed: `he's`/`she's` were absent from the expansion map (fixed on
`team/ryan-conger/`), and the team-bio JSON on `team/index.html` stores its apostrophes as `'`
escapes rather than literal `'`, so `you're`/`he's`/`who's` inside those three bios didn't match a
plain-text regex at all (fixed; the two genuine possessives in that JSON, `Surge's`/`company's`, were
left alone). Verified with a broad `[A-Za-z]+'[a-z]+` sweep across every file — everything remaining
is a legitimate possessive (`client's`, `Gong's`, `charity's`, `homeowner's`). Script was ephemeral
(session scratchpad) — if a similar sweep is needed again, rebuild it as a case-preserving map applied
with `\b` word boundaries, and remember to check any inline JSON separately for `'`.

**Page-by-page "claim + immediate proof" walkthrough — done, all ~32 pages (2026-09-04).** Read every
page's body copy (SVG logo markup excluded) looking for a capability or comparative claim standing
without a specific next to it. Most of the site already does this well — `index.html`, `about/`,
`how-it-works/`, `training/`, all three `sectors/` pages, `careers/` and `careers/apply/` pair every
claim with a concrete detail already; `sectors/nonprofit/` and the homepage KPI row are the strongest
examples (scoped, sourced numbers right in the claim). The three `insights/` pieces are the standard
the rest of the site is aiming for — a source panel with a "Checked" and often a "Not used" line on
every one. No rewrites were needed on any of these.

**Homepage pass, item by item (2026-09-04), Matthew going section by section on his own read:**
- **Hero H1 font size** — was inheriting the sitewide `h1{clamp(2.6rem,...,5rem)}`, tuned for short
  page titles elsewhere. At the merged hero line's length it wrapped to 3 lines and dominated the
  viewport. Added a `.hero h1` override: `clamp(2.1rem,1.3rem + 3.4vw,3.6rem)`. Scoped to the hero
  only — every other page's H1 is untouched.
- **KPI eyebrow** — "Nonprofit campaigns, 2026 to date" → "2026 campaigns to date," dropping the
  sector word so a for-profit prospect does not read the homepage as nonprofit-only. **Flag on this
  one:** the underlying numbers (106,000 / 37,600 / 8,900) genuinely are nonprofit-fundraising-only
  (per `about/index.html`'s own §-2-style note and `company-facts.md`) — that scope is still stated,
  just moved into the `kpi-scope` line beneath instead of the eyebrow above. Worth Matthew's eyes
  once, since brand-voice-company.md §2 wants a figure's scope legible, not just present.
- **37,600+ / 8,900+ labels** trimmed: "Became a full presentation, delivered face to face" →
  "Full presentations delivered face to face"; "New supporters signed on after a presentation" →
  "New supporters signed on."
- **172 "Days in the field" tile removed, not replaced.** No second confirmed, scoped figure exists
  yet to put there — `company-facts.md`'s Numbers section is still empty pending the metrics from
  Matthew's manager (brand-voice-company.md §8, item 1). Grid dropped from 4 to 3 columns
  (`.kpi-grid` breakpoint at 1000px: `repeat(4,1fr)` → `repeat(3,1fr)`) rather than leave a gap.
  Revisit when a real number exists.
- **`kpi-scope` paragraph reworded** to read as an explanation rather than a disclaimer, same facts
  intact (nonprofit scope now lives here, the four-partner aggregation, same-day reporting, ratios
  are derived not separately tracked).
- **Client list section removed entirely** — with real permission from zero current clients (the one
  historical case, Instabuzz, is a RESTRICTED Tier-4 hit on the *old* WordPress site, not a green
  light here — see [[surge-wordpress-backup]]), and a single logo reading worse than none, an empty
  section had no job left to do.
- **Jobs 03 Training** — cut "It is the part of this we compete on." Confusing pronoun reference,
  and the same claim already lives properly supported in the Teaching section further down this same
  page (and on `/training/`).
- **Jobs 04 Management** — "You get the reporting; we keep the personnel problems" → "...the
  day-to-day people management is ours to run." Same handoff, without a phrase that reads as
  expecting personnel trouble.
- **Trainer photo verified cut off, and fixed.** Screenshotted the live page: the source photo
  (`trainer-presenting.jpg`) is a tall portrait crop; `.split__media img`'s `object-fit:cover` at
  `aspect-ratio:3/2` with default center positioning showed floor and knees, not the trainer or the
  whiteboard. Added `.split__media img[src*="trainer-presenting"]{object-position:50% 8%}` — applies
  everywhere this photo is used (`index.html`, `training/`, `careers/`), confirmed by re-screenshot.
- **"Who you deal with" → "Where" row reworded to "Coverage."** Not removed: `company-facts.md`
  carries a standing correction ("the website had claimed we cannot put a team in another state for
  you, which was false") specifically about this fact going missing or reading as a limitation — this
  is the only spot on the homepage that states it. Reworded to lead with "Every campaign runs..."
  rather than "One room in Englewood..." so it reads as reach, not a size disclaimer, without
  claiming scale/footprint (§5 still applies — no "nationwide").
- **Insights section note reworded** — "with the source, and what we checked and threw away, printed
  on every piece" → "the source is printed on every piece, along with any numbers we checked and
  ruled out." Same meaning (the source panels' "Checked"/"Not used" lines on each insights piece),
  clearer phrasing.

**Not changed, answered instead:**
- **Sectors section** — recommended keeping it. It is short, and it is the one place on the homepage
  that visibly shows Surge sells into roofing and aeration, not just nonprofit fundraising — which
  directly answers the "don't want to look nonprofit-only" concern behind the KPI-eyebrow edit above.
- **Adding Sixfold as a sector** — recommended against. Sixfold is a genuinely separate company (own
  brand, own clients, wildfire mitigation, not sales/marketing) — see [[three-entities-surge-sixfold-horizon]],
  which explicitly says not to over-infer the relationship from shared ownership. Surge does not run
  an outsourced-sales campaign for Sixfold the way it does for a nonprofit, roofing or aeration
  client, so listing it under "The sectors we run now" would assert something false, not just blur a
  brand line.
- **Footer link column** — screenshotted; three columns, ten links, reads as a standard site footer,
  not oversized. Left as-is.

**Older items, fixed earlier (2026-09-04):**
- `what-we-do/index.html`'s "Worth saying plainly" section no longer opens with *"If you need
  national coverage today, we are not the right fit"* — that disqualifying line is cut per §4
  (*"we may not be a fit" is a conversation for a meeting, not a published line*). The paragraph now
  states the same underlying fact the FAQ already gets right: one office in Englewood, campaigns run
  for clients in other states out of it, cannot station a permanent team elsewhere — factual, not
  self-disqualifying, and doesn't drift into a footprint claim either (§5).
- `thank-you/index.html`'s H1 is now **"We have your details."**, lede trimmed to drop the
  now-redundant "got" ("Someone will be in touch shortly. If it is urgent, call…"). Reads as a plain
  declarative heading instead of the awkward expanded idiom. The inline form-success messages on
  `/contact/` and `/book/` ("Thanks — that is with us…") were left alone — that phrasing sits inside
  a sentence rather than standing as a bare heading, so it doesn't have the same problem.

## Sources this draft was rebuilt from

| Source | What it gave |
|---|---|
| [The surgeftw.com File](https://claude.ai/code/artifact/2460ae8b-bca0-4d54-826b-80e422b371c1) | Old→new comparison; new build was 24 pages incl. 3 sectors; forms replaced phone as first action; team roster current; Dylan Conger (ex Co-Owner) left and is off the roster; InstaBuzz Media is the one client with branding permission |
| [Thirteen Pages, One Shape](https://claude.ai/code/artifact/9541ee60-9faa-470b-aa6c-417fd2f732f0) | The 13-page set and nav order (About 2nd, Insights 4th); homepage band rhythm — image hero → ink → lift → black+KPI → lift → paper → green; design system: dark-first, Anton display + Archivo body, `#4abe4a` accent; `/insights/` = 3 live + 2 held, each printing source + corpus + date; DEMO_MODE forms have no endpoint |
| [Homepage Work-Up](https://claude.ai/code/artifact/aec1cef8-943e-4983-92ac-d858c34342c1) | The homepage copy, line by line, plus fixes it had already specified (below) |
| [Surge Motion Inventory](https://claude.ai/code/artifact/693ec75d-2f9c-483a-9276-f35ffcb5f4eb) | Every animation on the lost build: hero entrance on load, staggered card arrival (90ms), photo settle (starts 8% larger), condensing header, hover lift; all plain CSS, hard `prefers-reduced-motion` off-switch, visible with no JS; two `do-not-build` items — count-up numbers and an animated map |
| `brand/photos/Screenshot 2026-08-14 171412.png` | Near-final **Contact** page: phone **720-719-5495**, email **info@surgeftw.com**, header CTA is a bordered phone pill, nav = What we do / About / Team / Careers / Contact, green hairline above a pure-black footer, no founding year, footer tagline wording |
| [Surge Site Copy Audit](https://claude.ai/code/artifact/40e034fe-af30-4d30-8bab-a3753d697f51) | **The homepage h1 decision** (below); shipped title tags; British to American sweep; "would" hedge cuts; which negation headings were kept vs converted; og:image is a composed card not a photo; schema is `ProfessionalService` |
| [Seams and Paper Breaks](https://claude.ai/code/artifact/6a758cb8-2e19-4243-8454-566e084401c2) | Lifted panel lightened `#141414` to `#1c1c1c`; 1px hairline on every dark panel's top edge, none on white/green; header phone button outlined not filled, hover to green wash with no lift; darker green `#1c6b1c` for accents on light sections |
| [site-comparison/homepage.src.html](../source-material/site-comparison/homepage.src.html) | The four KPI figures the lost build published |

## Work-Up fixes applied to this draft

- **Training card** now reads "It is the part of this we compete on." — not the hedged "the part we
  are actually good at."
- **Onboarding card** ends at "a structured start." — the swipe at how other firms onboard is cut
  (§3).
- **Hiring card** subject made explicit: "Hiring runs continuously…"
- **All headings end with a full stop** — the device the page is committed to.
- **"You will know everyone…" section** uses `office-floor-b.jpg` (people in the room), not the
  empty-bullpen shot the lost build had there by mistake.
- **Sectors heading** is "The sectors we run now." — "Three" dropped (hard-coded count trap).
- **Sectors lede** replaced with the Work-Up's suggested line about the offer and the customer.
- **Founding year dropped.** The Work-Up flags that "Founded 2024" concedes the "too new to trust"
  axis. Footer gives location only, matching the Contact screenshot.

## Copy Audit applied (this resolves the h1 flag)

- **Hero h1 is now "We hire, train and run your field sales team."** — the Copy Audit's finding 01,
  Option A, which it recorded as *applied* as a new `HEADLINE` constant. The old positioning line
  ("We'll handle your entire sales team so you can focus on building your business.") was kept in
  `src/site.ts` for a bio/ad/deck, not retired. My earlier invented h1 is replaced.
- **Hero lede** is the Copy Audit's confirmed rewrite: "The whole function — hiring, onboarding,
  training and day-to-day management — for businesses that do not have the infrastructure to run it
  themselves." (A later draft swapped the tail to "so you can focus on what you do best," which the
  Work-Up then flagged; its suggested fix "so selling stops being your problem to staff" is a good
  alternative if you want more punch.)
- **Title tag** is the Copy Audit's shipped one: "Outsourced Field Sales Teams in Colorado | Surge".
  It argued "in Colorado" is a location statement, not a footprint claim (the FAQ already says "in
  and around Colorado"). **The later site-comparison doc raised a reservation** — that the title
  reads like a service area — and left it as a yes/no. Flagged, not re-decided.
- **"Four jobs you stop doing."** — the "Four" is restored. The Copy Audit calls this "the strongest
  heading anywhere on the site" and explicitly keeps it; only the *sectors* heading dropped its
  number.
- **British → American** — "fulfil" → "fulfill"; nothing else visitor-facing. ("organisations",
  "practise", "enquiry", "footfall" were all in the lost build and all fixed there.)
- **og:image / Twitter card** — `twitter:card` is `summary_large_image` and needs an `og:image`.
  The lost build used a *composed card* (`public/og-image.png`), never a photo — the hero office
  shot was rejected for legible "GRIT / HUSTLE, PASSION AND PERSEVERANCE" and "TRAVEL" wall text.
  Meta tags are in; the image asset has to be rebuilt before launch.
- **Schema** is `ProfessionalService` (a LocalBusiness subtype). `areaServed` and `openingHours`
  are **left out on purpose**: the Copy Audit added them, but `clients.md` (one day later) records
  `areaServed` being *removed* pending the reps-travel-vs-phone question, and published office hours
  sit near the Tier 2 rep-schedule restriction. Locality only (Englewood, CO) — no street, no geo,
  neither exists in the notes.

## Design detail applied (Seams and Paper Breaks)

- `--lift` is `#1c1c1c` (up from `#141414` — 10 points off the background was not enough separation
  in a run of four dark sections).
- Top hairline on every dark band; **removed** from the paper band and the green CTA (they separate
  themselves; a dark rule over white just looks like a mark).
- Header phone button: outlined, and its hover now goes green (outline, icon, number) over a faint
  green wash with **no lift** — a button that jumps inside a fixed bar reads as a glitch.
- Paper-band links use the darker green `#1c6b1c` (brand green is 2.3:1 on white, under the 3:1
  floor).

## Motion (from the Motion Inventory)

Rebuilt as ~1 KB of inline JS + CSS, no libraries. Hero entrance on load (eyebrow → h1 → lede →
buttons); staggered arrival on the four card grids (90ms steps, fires once); photo settle on the
split images (start 1.08 scale, ease to true size); condensing sticky header (solid + green rule +
shadow past 8px); hover lift on cards. All of it is behind an `.anim` class that JS adds, so a
no-JS visitor sees everything in place, and behind `prefers-reduced-motion: no-preference`, with a
`reduce` block that force-shows every animated element. **Not built, per the inventory's own
do-not-build list:** count-up stat numbers (would invite an unsourced figure) and an animated
map / location pins (footprint claim in motion). Page-to-page cross-fades and the headline wipe are
multi-page / non-homepage effects and are deferred to the inner-page build.

## Constraints check (company spec)

Clears: no proprietary-method claim (the teaching section concedes it, per §1 — and the Work-Up
says that concession must stay); no MLM material and no rebuttal of it; no client named (consent
reason, not roster-size reason); no office-footprint / scale / growth framing ("one room in
Englewood," no city list); no pay, hours, earnings, or careers bleed on the page; "aeration" left
with no sector texture (lawn/soil vs water still open — [clients.md](../../brand/notes/clients.md));
insights claims are sourced; photos are `YES` register entries.

## Flags — need your call

1. ~~The hero h1 is invented.~~ **Resolved** from the Copy Audit — it is "We hire, train and run
   your field sales team." (that doc's finding 01, Option A, recorded as applied). In place.

2. ~~The four KPI figures are carried over, not verified.~~ **Source given, 2026-08-31.** Matthew
   supplied the full figure set from the team that runs the nonprofit events ("2026 IMPACT — TO
   DATE"). The homepage KPI band now uses conversations / presentations / supporters / days with the
   scope line "2026 year to date, across four nonprofit fundraising partners… reported by the team
   that runs those campaigns; every shift logged and reported the same day."
   **Held back from client-facing pages** (scale-adjacent, §5): "37 communities across 4 states" and
   "120+ host locations and community events staffed". **Clean and available if wanted:** 59,800+
   stopped to learn · 4 nonprofit partners · 60 fundraisers trained and certified · daily averages
   (620 conversations, 218 presentations, 52 supporters) · the engagement funnel (56% stop → 63%
   become a full conversation → ~1 in 4 end in support). Standard the numbers are published at: a
   current, team-reported figure set — not an audited/filed report. Worth noting on the record.

3. **Title tag says "Colorado."** Using the Copy Audit's shipped "Outsourced Field Sales Teams in
   Colorado | Surge" — it argued this is a location, not a footprint claim. The later site-comparison
   doc pushed back that it reads like a service area. Your yes/no.

4. **Contractions.** The 25-page site was mostly "do not / cannot / you will," but the Contact
   screenshot's footer uses "don't." This draft is mostly un-contracted, footer included, for
   consistency. Still an open question from 2026-08-17 — one decision, whole site.

5. **Nav.** Reconstructed as What we do · About · Team · Insights · Careers · Contact + phone pill.
   The screenshot (pre-Insights) shows no Sectors in the top nav, so Sectors sits in the footer and
   is reached from the body. Confirm.

6. **Photo register correction (not mine to make).** The Copy Audit found that
   [photos-notes.md](../../brand/photos/photos-notes.md) describes `2026-08-13-office-floor-session-a.jpg`
   as "No board in frame" — there *is* a whiteboard at the left edge, illegible at 7× so the `YES`
   probably still holds, but the note is wrong. That file is this page's full-bleed hero. Worth
   fixing the register line.

7. **Routing.** Every link points at a page not built yet (`/what-we-do/`, `/about/`, `/team/`,
   `/insights/…`, `/careers/`, `/contact/`, `/how-it-works/`). The lost build's forms ran in
   DEMO_MODE with no endpoint — that has to be wired before launch regardless.

8. **Image weight.** `office-floor-a.jpg` / `-b.jpg` are ~7 MB each from the library. Fine for a
   local preview; downscale + `webp` + `srcset` before serving anywhere.

9. **Not carried in, on purpose:** InstaBuzz Media (the surgeftw.com File says branding permission
   is confirmed and they are nameable — but whether to name any client is a positioning call for
   you, and sector-only is the safe default). ~~The Contact page's published office hours
   ("Mon–Fri 9:00–5:00 MT")~~ **— resolved 2026-09-07: the hours row was removed from `/contact/`
   and the homepage footer (Tier 2 clock times; also inaccurate). See the `/contact/ pass` section.**

## Fact-check log

| Claim on the page | Status | Source |
|---|---|---|
| Outsourced sales and marketing: hiring, onboarding, training, management of a field sales team | Verified | [brand-voice-company.md](../../brand-voice-company.md) §1; [company-facts.md](../../brand/notes/company-facts.md) "confirmed" |
| Channels: door to door, cold calling, events, booths | Verified | [company-facts.md](../../brand/notes/company-facts.md) "confirmed" |
| Rep carries the conversation to a confirmed sale; client's workforce delivers | Verified | [clients.md](../../brand/notes/clients.md) — Matthew, 2026-08-15 |
| Roofing & storm restoration includes same-day, on-the-spot inspection | Verified | [clients.md](../../brand/notes/clients.md) "CONFIRMED 2026-08-18"; [via-client-profile.md](../../brand/notes/via-client-profile.md) |
| Englewood, Colorado — base, runs every campaign incl. out-of-state | Verified | [company-facts.md](../../brand/notes/company-facts.md); [clients.md](../../brand/notes/clients.md) "RESOLVED 2026-08-15" |
| Phone 720-719-5495, email info@surgeftw.com | Verified | `brand/photos/Screenshot 2026-08-14 171412.png` (near-final Contact page) |
| Method is not proprietary; the differentiator is the teaching | Verified | [brand-voice-company.md](../../brand-voice-company.md) §1; Work-Up "the concession section stays exactly as it is" |
| Sectors: nonprofit, roofing & storm restoration, aeration | Verified | [RESTRICTED.md](../../brand/notes/RESTRICTED.md) "Clear to use"; [clients.md](../../brand/notes/clients.md) |
| Insights cards 1–3 (Gong 326k; Gong 519k; Ebbinghaus / Murre & Dros 2015) | Verified first-hand per the set | [../sales-research-set/README.md](../../drafts/sales-research-set/README.md) re-verification note, 2026-08-20 |
| "this channel turns over" (Hiring card) | Verified as general fact, unquantified | [company-facts.md](../../brand/notes/company-facts.md) — no figure used |
| Four KPI figures | **Unresolved — carried from prior build, flagged on-page** | [site-comparison/homepage.src.html](../source-material/site-comparison/homepage.src.html); no pullable internal source in this folder |
| KPI ratios "about 1 in 3" / "roughly 1 in 4" (added 2026-09-03) | **Derived, not sourced** — arithmetic on the four unresolved "+" figures (37,600/106,000 ≈ 0.35; 8,900/37,600 ≈ 0.24); written loose and labelled on-page as "totals divided through". Inherits the KPI figures' unresolved status | — |
| Photo captions / "none of it is stock" footer line (added 2026-09-03) | Verified against the image files themselves — office + booth shots are real Surge photos; no dates asserted because none are known | `assets/img/*.jpg` inspected directly |
| Hero h1 "We hire, train and run your field sales team." | Verified against the lost build | Surge Site Copy Audit finding 01 — Option A, recorded as applied as the `HEADLINE` constant |
| Title tag "…in Colorado \| Surge" | Verified as shipped; later reservation logged | Copy Audit finding 02 (defends it); site-comparison doc (questions it) |
| Founding year, headcount, office count, revenue | **Not used** | Restricted or unverified; deliberately absent |

## Cut lines (kept for reuse)

- Hero, longer: "…and do not have twelve years of doorstep experience to train them with." Cut —
  edges toward a superiority claim the teaching section already carries without it.
- Campaign-team: "No account managers you have never met, no offshore floor." Cut — defines Surge by
  a dig at an unnamed competitor (§3), the same move the Work-Up cut from the Onboarding card.
- Close: "Most of what we sell, someone was told could not be sold in a conversation." Cut —
  unprovable as written.
- KPI band alt heading: "Benchmarks, not results" — the label prior assets used while numbers were
  missing. Use it if you would rather label the placeholder than show the carried-over figures.

## Next (multi-page)

Scaffold onto this shell and palette, in the lost build's order: `/what-we-do/`, `/about/` (opens
"as a record"), `/team/` (roles only — reps, trainers, managers — no headcount), `/careers/`
(photo-led) + `/careers/apply/` (four steps, no timings), `/training/`, `/sectors/` +
`/sectors/nonprofit/` (field funnel), `/sectors/roofing/` (handover rail), `/sectors/aeration/`
(contrast pair, no sector specifics), `/insights/` + the 3 live pieces, `/contact/` (audience split,
per the screenshot), `/how-it-works/`.

---

## Batch 1 — inner pages built 2026-08-31

**Refactor:** shared styles moved to `assets/site.css`, motion + contact-form JS to
`assets/site.js`. Pages are `drafts/surge-site/<page>/index.html` so URLs are clean. All asset
refs are now root-absolute (`/assets/...`). The homepage was rewritten to use the shared files;
it renders identically.

**Pages now live on the local server:**

| Page | Title tag | Shape | Notes |
|---|---|---|---|
| `/what-we-do/` | How an outsourced sales team works \| Surge | head → jobs → channels (paper) → **field funnel** → "run in the open" concession (black) → FAQ → green CTA | Funnel is the page's unique module. FAQ answers are non-committal on price and launch time (deliberate). "run properly" → "run in the open" per Copy Audit. |
| `/about/` | About Surge — outsourced sales, Englewood CO \| Surge | head as a **record plate** → the work → not-method-not-tenure (paper) → **statement band** → clients & numbers (black) → green CTA | Founding year is stated here on purpose (record framing; it is in RESTRICTED "Clear to use"). "That is the whole footprint, and we say so" per Copy Audit finding 05. Statement band: "The method is not the differentiator. The teaching is." |
| `/contact/` | Contact Surge \| Outsourced sales, Englewood CO | contact-head (heading + rail) → "Which one are you?" audience split + two forms → green rule → footer | Rebuilt from the near-final screenshot. **Forms do not submit** — on submit they show an inline "draft build, call or email" message (honest; the lost build faked a success). Green CTA band deliberately omitted — the screenshot goes straight from the audience block to the green footer rule. |

**Still flagged on these pages:**
- ~~**Contact hours**~~ — **removed 2026-09-07** (from `/contact/` and the homepage footer). Tier 2
  clock times, and the figure did not match the real schedule. See the `/contact/ pass` section.
- **Forms** — `/contact/` + `/book/` now POST to `api/submit.php` (PHP `mail()`), and the applicant
  form takes a resume upload as of 2026-09-07. The `$_FILES` handler is **written but never run**
  (no local PHP). **Pre-launch: wire & test on SiteGround, or move to a hosted form service** —
  `deploy/DEPLOY.md` "Forms" + "Resume uploads".
- Nav links to `/team/`, `/insights/`, `/careers/`, `/how-it-works/`, `/sectors/*` still 404 —
  built next.

**Contractions:** still un-contracted across the new pages, matching the rest. Open question.

---

## EXACT TARGET — the new-build homepage, from the comparison doc screenshots (2026-08-31)

The 17 screenshots embedded in `drafts/site-comparison/homepage.html` were extracted (base64 → jpg,
in the session scratchpad `cmp/`). The right-hand "new build" frames are the exact thing to mimic.
**Palette committed:** one dark palette, no light mode, no cream "paper" bands. Done in `site.css`
this session. The rest below is copy/layout still to apply.

### Confirmed from the screenshots
- **Contractions: YES.** The real copy is full of them — "isn't", "it's", "they're", "you're",
  "That's", "doesn't". Resolves the open contractions question. Loosen the whole site to match.
- **Footer shows "© 2026 Surge Inc. Founded 2024."** bottom-left, with "Privacy policy · Terms"
  bottom-right. Founding year IS in the footer of the real build — add it back.
- **Nav:** What we do · About · Team · Insights · Careers · Contact + phone pill. (Matches current.)
- Eyebrows: green, letter-spaced uppercase, with a short green dash before the text (`—`). Keep.
- Footer PAGES column includes **Team, Training, and "Book a consultation"** in addition to the rest.

### Section-by-section (right-hand frames)
1. **Hero** — photo bg (office floor), dark gradient. Eyebrow "Outsourced sales and marketing ·
   Englewood, CO". **h1 "We'll handle your entire sales team."** (screenshot shows the positioning
   line as the h1 — this CONFLICTS with the Copy Audit, which recorded it replaced by "We hire,
   train and run your field sales team." Matthew to settle; the screenshot is his stated exact
   target so default to it.) Lede: "The whole function — hiring, onboarding, training and day-to-day
   management — so selling stops being your problem to staff." Buttons: "Start a conversation"
   (solid green) + "How an engagement runs" (outlined).
2. **KPI band "What the work adds up to."** eyebrow "Nonprofit campaigns, 2026 to date". Four
   figures 106,000+ / 37,600+ / 8,900+ / 172, each with a short green rule above the number, label
   below. Small scope line beneath. On black (or barely-lifted).
3. **"The jobs you stop doing."** (NO "Four"). eyebrow "What we take over". Intro paragraph:
   "Building a sales team isn't one job — it's ten. And in-house, those jobs get stacked on someone
   who already has a full-time role. We take all of that off your plate, starting with these. Before
   a single rep starts, we define exactly what's being sold and what a great conversation about it
   sounds like." Then a **stacked vertical list** (not a card grid): full-width hairline dividers,
   big green Anton number in a left column, heading + dim description right:
   - **01 Hiring** — "We write the ads, screen the applicants and run the interviews. Hiring runs
     continuously rather than as a one-off intake, so you're not waiting on a hiring round when you
     want to grow. You don't sit in on any of it."
   - **02 Onboarding** — "New reps learn your offer, the objections and the channel before they're
     put in front of anybody — a structured start."
   - **03 Training** — "Development happens every morning, before anyone speaks to a customer, for as
     long as somebody works here. It's the part of this we compete on."
   - **04 Management** — "Territory allocation, coaching in the field, and tracking against targets.
     You get the reporting; we keep the personnel problems."
   Trailing dim line + green link: "Every job on this list is about the same thing — who talks to
   your customer, and how good they are when they get there. Work that fits that description moves
   across too. Tell us what you need."
4. **"Every channel ends with a person."** on a lifted DARK band (#1c1c1c). eyebrow "How the work
   happens". Sub: "Our channels are direct, and they differ only in where the conversation happens.
   That's the whole of it." Four **dark near-black cards** (border), heading in **Archivo bold
   sentence case** (not Anton): "Door-to-door" / "Cold calling" / "Events" / "Booths" + dim descs
   ("Canvassing worked territory by territory — houses, apartment blocks, office buildings and local
   businesses." / "Outbound phone outreach against a defined list." / "Conversations at organized
   events where your customers already are." / "Staffed retail and venue placements with live foot
   traffic.")
5. **"Anyone can get the method. The difference is the teaching."** black ground, **text LEFT /
   photo RIGHT** (conference-table training photo). eyebrow "Worth saying plainly". Para 1: "Plenty
   of companies run the same model we do, from the same playbook. Anyone who tells you their field
   sales process is proprietary is selling you the idea rather than the result." Para 2 (smaller,
   dimmer): "What actually varies between one company and the next is how well the material gets
   taught, and how fast a new rep can use it in the field. That's what we work on every morning, and
   it's the part worth comparing us on. Ask us about it." Button "How the training works" (outlined).
6. **"The sectors we run now."** black. eyebrow "In practice". Para: "What changes between them is
   the offer and the customer. What doesn't change is how the conversation gets started." List with
   **green diamond markers**, items in **Anton uppercase white**: "Nonprofit organizations" /
   "Roofing and storm restoration" / "Aeration services". Dim consent line + green link: "The
   industry matters less than whether a person can start the conversation. That's the whole test.
   Start here."
7. **"You'll know everyone working on your campaign."** black, text LEFT / photo RIGHT (rep at
   whiteboard). eyebrow "Who you deal with". Button "Meet the team" (outlined). Ends "Based in
   Englewood, Colorado."
8. **"We check the numbers everyone repeats."** black. eyebrow "Insights". Intro. Three dark cards:
   source label ("Gong" / "Gong" / "PLOS ONE") + heading ("The talk-time rule is nine years out of
   date." / "Eleven to fourteen questions, and the part nobody quotes." / "What survives training
   week.") + "Read →". Button "All insights →" (outlined).
9. **"Tell us what you need sold."** GREEN band (#4abe4a), black text. Body: "Anything that sells in
   a conversation, we can sell. One call is enough to work out how." Buttons: "Start a conversation"
   (black) + "Call 720-719-5495" (outlined black).
10. **Footer** black, green rule on top. Logo + tagline. Columns CONTACT + PAGES (green headers).
    Bottom bar: "© 2026 Surge Inc. Founded 2024." left, "Privacy policy · Terms" right.

### Still to do next session
- Apply all of the above copy/layout to `index.html` (new `.job-list` stacked component,
  rewrite channels cards, flip teaching/campaign-team to text-left/photo-right, sectors list with
  green diamonds, insights source labels, CTA copy, footer bottom bar + extra page links).
- Then propagate the committed-dark palette + these components to the inner pages already built
  (`/what-we-do/`, `/about/`, `/contact/`) and loosen their copy to contractions.

---

## Applied 2026-08-31 (post-compact prep)

**Palette committed to dark, everywhere** (`site.css`): removed light-mode + `[data-theme=light]`
blocks, `color-scheme:dark`, `--paper*` tokens now resolve dark so `.band--paper` renders as a
normal lifted dark band. `.chan` cards are now dark near-black with Archivo bold sentence-case
headings (not Anton). Old `.sector-cols` chip styles deleted.

**Homepage rebuilt to the comparison-doc screenshots:**
- Section order: hero → KPI → jobs → channels → teaching → sectors → campaign team → insights → green CTA → footer.
- Hero: eyebrow "Outsourced sales and marketing · Englewood, CO", h1 **"We'll handle your entire sales team."** (screenshot's h1 — conflicts with the Copy Audit's "We hire, train and run your field sales team."; using the screenshot per instruction, Matthew to settle), lede "…so selling stops being your problem to staff.", buttons "Start a conversation" / "How an engagement runs".
- KPI: new `.kpi` style — figure with a short green rule above it, label below, no box. Eyebrow "Nonprofit campaigns, 2026 to date". Scope line attributes the nonprofit-events team.
- Jobs: new `.job-list` stacked component (big green Anton number, heading + dim desc, hairline rows) + intro paragraph + trailing line. Heading "The jobs you stop doing." (no "Four"). Exact copy from the screenshot.
- Channels: dark cards, exact copy.
- Teaching + campaign team: text-left / photo-right (`.split`, no `--media-left`). Exact copy, "How the training works" / "Meet the team" ghost buttons.
- Sectors: `.sector-list` with green diamond markers, Anton items — "Nonprofit organizations / Roofing and storm restoration / Aeration services" + consent note with "Start here." link.
- Insights: 3 cards with source label ("Gong · 326,000 calls" etc.; piece 3 sourced "PLOS ONE · Murre & Dros, 2015"), headline, "Read →". "All insights →" ghost button.
- CTA: green band, "Anything that sells in a conversation, we can sell. One call is enough to work out how." + "Start a conversation" (black) / "Call 720-719-5495" (outlined).
- Footer: added `.foot-legal` bottom bar ("© 2026 Surge Inc. Founded 2024." / "Privacy policy · Terms"), Training + "Book a consultation" links, contact hours line, tagline uses "don't".
- **Contractions** now used throughout the homepage — the screenshots confirmed the real site uses them. Open question resolved.

**Inner pages (`/what-we-do/`, `/about/`, `/contact/`):** inherit the dark palette from shared CSS; footers updated to match (legal bar, Training + Book links, "don't" tagline). **Still to do:** a full contractions pass on their body copy, and align `/what-we-do/` and `/about/` section styling to the exact-target components where they overlap.

**Next:** `/sectors/` hub + nonprofit/roofing/aeration, `/team/`, `/careers/` + `/careers/apply/`,
`/training/`, `/insights/` hub + the 3 pieces, `/how-it-works/`, plus stub `/privacy/` and `/terms/`.

---

## Batch 2 — remaining pages built 2026-08-31

All 15 remaining pages built onto the shared `assets/site.css` + `assets/site.js` shell, clean
URLs, committed dark palette, contractions on. Generated by `scratchpad/build.ps1` (holds the
header/footer + wordmark SVG once; each page is a body fragment). Re-run that script to regenerate.
Local preview server from batch 1 is still bound to `http://localhost:8080` and serves these.

**Three small components added to `site.css`:** `.rail` / `.rail__step` / `.rail__hand` (roofing
handover), `.contrast` / `.contrast__col` (aeration pair), `.source-panel` (insights source block).

| Page | Title tag | Shape / unique module |
|---|---|---|
| `/sectors/` | Sectors we run field sales for \| Surge | hub → 3 `.ins-card` links → common-thread → green CTA. "Three" dropped from the lede (matches the homepage count-trap fix). |
| `/sectors/nonprofit/` | Nonprofit field fundraising \| Surge | **field funnel** (`.funnel`, Approach→Stop→Conversation→Sign-up→Hand over) + the engagement-rate line (56% / 63% / ~1 in 4) with scope + date + "reported by the team that runs those campaigns" + "current team figures, not an audited filing". Held-back scale phrases ("37 communities…", "120+ host locations") **not** used. |
| `/sectors/roofing/` | Roofing and storm restoration field sales \| Surge | **handover rail** (`.rail`) — three Surge steps, a marked handover, two client steps. Same-day on-the-spot inspection stated (verified, `clients.md` CONFIRMED 2026-08-18). |
| `/sectors/aeration/` | Aeration services field sales \| Surge | **contrast pair** (`.contrast`) — stays-the-same vs changes. **No sector specifics**: "seasonal / route-based / home service" framing was drafted then stripped — the aeration kind is still open (CLAUDE.md), so the page commits to nothing beyond "sold door to door" and "the client's to describe". |
| `/team/` | The team that runs your campaign \| Surge | roles only — Reps / Trainers / Managers as 3 cards, "three jobs, one room", plus an explicit "no headcount, no org chart" section. **No names.** The "no account manager / no offshore floor" dig was cut (same §3 move the homepage cut). |
| `/careers/` | Field sales jobs at Surge \| Englewood, CO | photo-led (`page-head--media-left` + two `.split` photos: canvassing, trainer). Names the work "field sales… direct sales" plainly (personal §9). **No** earnings / hours / advancement-ladder framing. Training described with no clock times. |
| `/careers/apply/` | How to apply to Surge \| Field sales, Englewood CO | four `.job-list` steps (send details → phone conversation → a day with the team in the field → decision both ways). **No timings anywhere.** Points at the contact-page applicant form. |
| `/training/` | How the training works \| Surge | the reverse trainer ladder as pedagogy — **do the job / explain the job / teach the job** (`.job-list`), trainers are former reps. Morning development block described by content (goal-setting, whiteboard drilling, a taught subject, paired practice, trainer coaching) with **no clock times**. "LOAs" jargon changed to "the fundamentals". Keeps the §1 not-proprietary concession. |
| `/insights/` | Insights — sales and training research, checked \| Surge | hub → 3 live `.ins-card`s + a line that more are queued and go up only once the source is read first-hand (pieces 4 & 5 stay held, per `sales-research-set/README.md`). |
| `/insights/talk-ratio/` | The talk-time rule is nine years out of date \| Surge | **finding → "What we take from it" → source panel.** Content from `sales-research-set/01-talk-ratio-linkedin-draft.md` + its fact-check log. Gong 326k, 60/57/62, low performers 54→64, "five points not seventeen" flagged as arithmetic. |
| `/insights/discovery-questions/` | Eleven to fourteen questions… \| Surge | same shape. From piece 02. Gong 519k, 11–14 band, front-load vs spread, the B2B-vs-doorstep caveat kept in the body, "fourteen questions at the top" flagged as our illustration. |
| `/insights/training-retention/` | What survives training week \| Surge | same shape. From piece 03. Murre & Dros 2015 (PLOS ONE 10(7):e0120644), Roediger & Karpicke 2006 (PubMed 16507066), Ebbinghaus 1880s. "70% in 24 hours" / "61% vs 40%" explicitly listed as **not used**; no per-interval percentage printed. |
| `/how-it-works/` | How an engagement runs \| Surge | 5-step `.job-list` (first call → scope → hire/onboard → run → report & hand over) + a 2-item FAQ that stays non-committal on price and start time. This is the target of the homepage hero's "How an engagement runs" button. |
| `/privacy/`, `/terms/` | Privacy \| Surge · Terms \| Surge | honest stubs — "draft build, full policy before launch", forms inert so nothing is stored, contact route given. |
| `/book/` | Book a consultation \| Surge | **consultation-request form** (added 2026-08-31 on request — display only). `contact-head` layout: heading + a `contact-rail` "what the call covers" list, then a `.form` (name/company, email/phone, **calendar date + time-slot picker**, call format + channel, what-you-need-sold). Client-facing; points job-seekers to `/careers/apply/`. Inert on submit — reuses the shared `.form` / `.form-msg` markup so `site.js`'s generic submit handler shows the "draft build, call or email" notice with no JS change. |

**`/book/` calendar picker (added 2026-08-31):** a self-contained month calendar + time-slot
selector, ~90 lines of plain JS inlined at the foot of the page body (no libraries, same house
style as `site.js`). Styles are `.booking` / `.cal*` / `.slot*` in `site.css`. Weekdays only, past
dates disabled, can't page before the current month. Slots are hourly **9 AM–4 PM MT** — this
sits in the same "office reachability" band as the contact page's published `Mon–Fri 9–5 MT` hours
line (flagged, kept). **If that hours line is ever pulled, revisit the slot range here too.** It's
display only: selecting fills two hidden fields (`date`, `time`) and shows "Selected: …"; the form
still submits nowhere.

**"Book a consultation" placement (2026-08-31, on request):**
- **Homepage hero** now has three buttons: `Start a conversation` (solid, `/contact/`) ·
  `Book a consultation` (ghost, `/book/`) · `How an engagement runs` (ghost, `/how-it-works/`).
  Three CTAs in the hero is dense and deviates from the EXACT-TARGET screenshot's two — flagged
  for Matthew; easy to drop back to two.
- **Contact page** — inside `#form-client` (the form shown only when someone picks "I'm a
  prospective client"), a green-rule callout: "fill in the form below, or book a consultation and
  pick a date and time." So the booking route is offered to prospective clients specifically, not
  to job applicants.
- Footer "Book a consultation" link on **all 20 pages** now points to `/book/` (was `/contact/`).

**Also done this batch:**
- **Contractions pass on `/what-we-do/`, `/about/`, `/contact/` body copy** — "do not / cannot /
  we are / there is / would rather" → contracted throughout. Kept uncontracted on purpose: the
  `/about/` statement band ("The method is not the differentiator. The teaching is.") for its
  parallelism.
- **British → American** on the same three: `fulfils`→`fulfills`, `neighbourhood`→`neighborhood`
  (Copy Audit sweep), plus the same fix on new pages (`agonise`, `enquiry`).
- **Footer "Pages" column** synced across the homepage + all inner pages: added **How it works**
  and **Sectors**, reordered so it reads What we do · How it works · About · Team · Sectors ·
  Training · Insights · Careers · Contact · Book a consultation. Sectors is still **not** in the
  top nav (flag 5) — footer + body only.

---

## Team page rebuilt as a named roster — 2026-08-31

**This reverses the batch-2 `/team/` ("roles only, no headcount, no org chart").** Matthew asked
for the full named roster with headshots, grouped like the old site, and chose it against that
trade-off knowingly (he is the sole gate, §7). Recorded here so it isn't mistaken for drift.

**`/team/`** — headshot "bubble" grid (circular photos), name + role + a LinkedIn / Facebook /
Instagram icon row per person. Built on the committed dark palette — the mockup Matthew sent was a
light template; only its bubble + social-row layout was taken.

**Layout revised 2026-08-31 (iterated to a 4th pass):** group headers dropped, roster is a
**compact picker strip** directly under the detail panel in the same `band--lift` — both in view
without scrolling (the big 3-col card grid is gone). Each strip item: a **96px circular avatar** +
name + job title + a small LinkedIn/Facebook/Instagram row beneath. Order: leaders first (Brandon, Matthew,
then Ryan/Jon/Nneka/Paige, then Lance/Maya/Myles/Cai). **The detail panel starts empty** — a plain
visit to `/team/` shows a "pick anyone" prompt and nobody is selected; clicking an avatar swaps in
that person (photo, name, role, social row, bio), the panel nudges to the top, the avatar gets a
green ring. `/team/#slug` deep-links still open that person directly. All 10 bios embedded as JSON
(`<script id="team-data">`), swap is ~50 lines inline JS.

**`/team/<slug>/`** — the 10 individual pages still exist and are the no-JS fallback: the roster
cards are real `<a href="/team/<slug>/">` links that JS hijacks, so with scripting off they just
open the standalone page.

Generated by `scratchpad/build.ps1` from a `$PEOPLE` array — edit that and re-run. Headshots
copied to `assets/img/people/` (clean slugs) from `brand/photos/people/`. New CSS: `.team-grid`,
`.member*`, `.person-head`, `.person-role` in `site.css`.

**Decisions applied, and what still needs Matthew:**
- **Dylan Conger excluded** — on the old page and in the photo folder, but off the roster per
  CLAUDE.md / notes. Not on the new page.
- **Bios are my plain rewrites** of the old team-page bios, stripped of the wealth / hustle /
  motivational-quote framing (McLaren, "make my money work for me", "my wife gets to choose
  whether she works", "Learn earn and grow", the quote sign-offs) — that texture is what §5 and
  `company-facts.md` both name as reading like devilcorp confirmation. **Every bio needs
  Matthew's review**; Brandon's and Matthew's were written from role only (no source bio).
- **Social links are all `href="#"` placeholders.** Matthew chose LinkedIn + Facebook + Instagram
  but no URLs exist yet. The team page carries a visible "placeholders in this draft" line.
  Personal FB/IG for staff is consent-sensitive — worth a second look before real URLs go in.
- **Jon Wallace has no headshot** in the folder — his card and page use a "JW" monogram bubble.
- **Headshot backgrounds — matched 2026-08-31 via local background removal.** The studio set (Cai,
  Lance, Maya, Myles, Paige, Ryan) was already on a light wall; **Brandon** (tight crop on red
  brick), **Nneka** (full outdoor scene) and **Matthew** (washed passport shot) did not match.
  Fixed by cutting the subject out and recompositing onto a studio-grey gradient (`#e4e1da`→
  `#cecbc3`, matches Cai/Maya). Toolchain, all in the session scratchpad (no system installs):
  portable **Node v22** at `C:\Users\Surge Inc\ndjs\`, and `scratchpad/imgproc/` with
  **`@imgly/background-removal-node`** (on-device ONNX model, no API) + **`sharp`**. Script:
  `scratchpad/imgproc/cutout.mjs` — `node cutout.mjs <in> <out> [maxSize] [--tighten] [--precrop=N]`.
  Commands: Matthew `... 1000`; Nneka `... 900 --tight` (`--tight` = trim transparent margin +
  reframe as head-and-shoulders so she fills the circle at the same scale as the studio set — her
  first pass composited her small in a tall frame). **Brandon was reverted to his original photo.**
  His source is a 395×333 face-only crop with no shoulders/margin; every cutout attempt left a
  ragged matte and a disembodied floating face ("broken"-looking). Original brick photo is sharp
  and real, just a mismatched background — better than a glitchy cutout. **Brandon needs a proper
  headshot** (studio wall, head-and-shoulders) to match the rest. Originals in
  `brand/photos/people/` untouched; only `assets/img/people/{matthew-sharpe.jpg,nneka-smith.webp}`
  are the processed versions now. CSS is a light face-bias `object-position` + soft rim-vignette.
  **This toolchain also unblocks the site-wide image work the flags list wants** (downscale + webp
  + `srcset` for the 7 MB office shots) — same `sharp`.
- **Avatar sizing** iterated on request: strip circles now 120px (name + title + social row
  under each), detail-panel photo 176px.
- **Headcount / org structure is now public on this page** (~10 named, three tiers). That sits
  against `company-facts.md`'s "11–50 band and a five-office footprint are in tension" note and
  the general "no scale/footprint" rule. Flagged; it was Matthew's call.
- **`Matthew-Sharpe-Headshot.jpg`** used (not the `-AI-PLACEHOLDER` one).
- Titles: "Brandon Long, Co-Owner" matches the old team-page screenshot (RESTRICTED.md calls him
  "CEO" — using the page's own wording).

**Still open / unchanged by this batch:**
- Nav is still 6 items + phone pill; Sectors deliberately footer-only pending Matthew's call (flag 5).
- Hero h1 conflict (flag 1-in-EXACT-TARGET), title-tag "Colorado" (flag 3), contact hours line.
- Nothing deployed, nothing posted, no social account touched. Static files on disk + local preview.

## Made functional for hosting — 2026-09-04

On Matthew's instruction ("start making this a functioning website … get it running … full
permission"). Built to be uploaded to **SiteGround**; **still not deployed** — the go-live step
and a content/RESTRICTED review are held for his call. Full runbook:
[deploy/DEPLOY.md](deploy/DEPLOY.md).

- **Forms wired.** `/contact/` (client + applicant) and `/book/` now POST to `api/submit.php`
  (honeypot `_hp`, `_form` type field, validation, emails `to` in `api/config.php`, backs up
  every submission to `api/submissions.log`). `site.js` does a `fetch()` with an inline
  success/error line; no-JS falls back to a native POST that redirects to the new
  **`/thank-you/`** page. The old "draft build — not connected" notice is gone. Deliverability
  of PHP `mail()` is unproven — DEPLOY.md covers the SMTP / Formspree fallback (fields already
  suit either).
- **Images optimised.** 18.3 MB → ~1.8 MB. Originals moved out of the web root to
  `drafts/_surge-site-img-originals/`. Re-run `scratchpad/imgproc/build.mjs` (portable node v22 +
  `sharp`). `<picture>`+WebP on the two photos where WebP wins (`trainer-presenting`,
  `canvassing`); `loading="lazy"`/`decoding="async"` on content images; hero is
  `fetchpriority="high"`. Orphan `team.png` deleted.
- **Launch files.** `favicon.svg` (the S mark) + PNG sizes + `apple-touch-icon` +
  `site.webmanifest`, linked into every page `<head>`. `404.html`, `sitemap.xml` (30 URLs),
  `robots.txt` (**`Disallow: /` for staging**), `.htaccess` (HTTPS + www→non-www redirect,
  ErrorDocument, blocks `.md`/`.log`/dotfiles, cache + security headers, gzip).
- **`noindex` still on every page** — deliberate. `deploy/toggle-noindex.mjs off` strips it at
  launch (and reminds you to fix `robots.txt`).
- **Bundle:** `node deploy/make-bundle.mjs` → `deploy/dist/surge-site-<date>.zip` (~2 MB, 63
  files, forward-slash entries, excludes notes/deploy/log/backups). Drag-drop into
  `public_html` via SiteGround File Manager → Extract.
- **Local preview** is now `scratchpad/serve-surge.mjs` on **:8080** — static + clean URLs + a
  mock form endpoint that logs. Replaces the old PowerShell server.
- The generators (`scratchpad/imgproc/build.mjs`, `scratchpad/site-tasks.mjs`,
  `scratchpad/serve-surge.mjs`) live in the ephemeral scratchpad; `deploy/*.mjs` are in-repo.

## Mobile nav added — 2026-09-03

The header had `@media(max-width:860px){nav.primary a:not(.nav-cta){display:none}}` and **no
replacement** — under 860px every nav link vanished, leaving only the wordmark + phone pill, with
no way to reach the rest of the site. Surfaced when previewing in the VS Code Simple Browser
(a narrow panel). Fixed:

- **Markup:** a `<button class="nav-toggle">` (CSS-drawn hamburger, morphs to an X) inserted before
  `<nav class="primary">` in all 32 pages; the nav got `id="site-nav"` for `aria-controls`.
- **CSS** (`assets/site.css`, replaced the old display:none rule): `.nav-toggle` hidden ≥861px. Under
  860px the header `.wrap` wraps, the button shows, and `nav.primary` becomes a full-width drop
  panel — `max-height` 0→80vh transition on `.is-open`, links stacked with hairlines, the phone CTA
  a centered pill. `.site-head:has(.nav-toggle[aria-expanded="true"])` forces the solid `--ink`
  background so the panel isn't see-through.
- **JS** (`assets/site.js`, new IIFE): click toggles `aria-expanded` + `.is-open`; closes on link
  tap, Escape, and on resize back above 860px. No-JS behaviour is unchanged from before (panel
  stays closed) — still a gap for the no-JS + narrow case, matching the rest of the site's JS-gated
  interactions.
- Desktop header unchanged; verified at 700px (closed/open) and 1280px, on `/` and inner pages.

## Candor pass — homepage — 2026-09-03

Three quick moves to bring the "says what it is" posture (already on `/about/`) onto the homepage,
so it's not just an About-page voice. All draft; Matthew's copy calls flagged below.

**1. The "empty logo wall", explained.** New `<section class="band">` between the KPI row and the
jobs list on `index.html`: eyebrow "The client list", h2 **"This is where the logos would go."**,
a `.logo-wall` grid of six empty framed cells (each an em-dash), and a `.note` that gives the
consent reason ("their call, not for lack of a list … names come up on a call, with permission").
Mirrors the `/about/` "Clients." paragraph. CSS: `.logo-wall` in `site.css`, cols 2 / 3 / 6.
*Copy is mine — new section, needs review.*

**2. KPI figures carry their denominator.** The homepage KPI row was four standalone numbers; now
the middle two print the ratio underneath in green mono (`.kpi .r`): 37,600 presentations =
"About 1 in 3 of those conversations"; 8,900 supporters = "Roughly 1 in 4 of those presentations".
Labels reworded to read as a funnel ("Became a full presentation…", "New supporters signed on
after a presentation"). `kpi-scope` gains a sentence: *"The one-in-three and one-in-four are those
totals divided through, not counts kept separately."* Numbers themselves unchanged — still the
approved 2026-to-date nonprofit figures, four partners, aggregated. The ratios are arithmetic on
the published "+" figures, so they're written loose ("about" / "roughly"), not as separate
stats. *Original KPI copy kept as a cut line below; relabelling is a Matthew call.*
  - **Cut line (original KPI labels):** "Full presentations delivered face to face" / "New
    supporters signed on" / "Days in the field", no ratio lines.

**3. Photos captioned as real, not stock.** Every content image now carries a documentary-style
`figcaption` (place + what it is, no invented dates): `index` "Morning session · Englewood office",
"The Surge floor · Englewood"; `careers` hero + "Morning session · Englewood office"; `training`
"Morning development block · Englewood office". `.ph-media figcaption` styling added (was unstyled).
One site-wide line appended to the footer brand column on all 32 pages: *"Every photo on this site
was taken in our office or in the field — none of it is stock."*
  - **Alt-text corrected while here:** `canvassing.jpg` was alt "canvassing a residential street"
    but the photo is two reps mugging at a **staffed booth outside a home-improvement store**
    (client material on the table blurred) — alt + caption now say "Staffed booth · retail
    placement". `office-floor-b.jpg` was alt "a rep working through material at a whiteboard"; it's
    a group standing around the office floor — alt fixed.

### Weak spots this pass exposes (for Matthew)
- **`careers` hero photo** (`canvassing.jpg`) is a goofy shot — one rep cradling another, thumbs
  up — under the headline "The job is field sales. In person." The honesty framing invites a closer
  look at it; a straight door-knock or booth-working photo would carry the page better.
- **`office-floor-a` (hero) and `office-floor-b`** both show the wall posters the Copy Audit
  flagged for the og:image — legible **"GRIT"** and **"TRAVEL / Money Buys… Time Doesn't"**, plus a
  faux championship trophy and a red-carpet rope. That texture is the §5 "devilcorp tell" the team
  bios were scrubbed of; it's just quieter in a dim background photo. New captions don't point at
  it, but "none of it is stock" is an invitation to zoom in.
- Footer legal line still reads **"© 2026 Surge Inc. Founded 2024."** — the founding year was
  dropped from the footer tagline (Work-Up §, "too new to trust" axis) but survives in the legal
  line. Pre-existing; not touched here.

## Palette consolidation — 2026-09-03

The stylesheet had ~10 colour values around the four official brand colours
(`brand/guidelines/README.md`): six greys (three tinted different directions),
an invented amber `#e0b341`, an invented red `#e0533f`, an unused `--sink`, and
`#0a0a0a` / `#0a2a0a` / `#fff` hardcoded into a CTA band's inline styles on 13
pages. Green (`#4abe4a`) was already correct and matches the reference board.

Done — no visual redesign, consolidation only:

- **Greys collapsed onto the brand grey.** `--soft` `#b0b4b0` → **`#ababab`** (the
  brand grey, exactly); `--faint` `#85858c` → **`#8a8a8a`** (a darkened brand
  grey, neutral). Six ad-hoc footer hex (`#b3b3b8`, `#d0d0d3`, `#6c716c`, `#222`,
  two more) now resolve to `--soft` / `--faint` / `--line`. Contrast checked:
  `--soft` ≥7:1 on both `--ink` and `--lift`; `--faint` ~5.7:1 on ink, ~4.8:1 on
  lift (both up slightly from before).
- **Invented amber + red removed.** `--flag` deleted. `.form-msg` base is now a
  neutral `--line` bar on `--lift`; `.form-msg--err` is a 4px `--white` bar on a
  faint white wash — no stoplight hue (the palette has none). `--ok` stays green.
  Flagged in the guidelines to revisit if user testing shows people miss errors.
- **`--white` / `--black` added** as explicit tokens = two of the four brand
  colours. `#000` is used only for the footer and `.band--black` (a step *below*
  the `#0a0a0a` ground) and for text on green fills.
- **`--ink` `#0a0a0a` and `--text` `#f4f4f4` kept** but now documented in
  `brand/guidelines/README.md` as intentional near-black / near-white, so they
  don't get "corrected" to `#000` / `#fff`.
- **`--sink` deleted** (unused). **Deep green `#2e8b2e`** (reference board's
  second green) documented in the guidelines for light surfaces; not used on the
  dark site, where `#4abe4a` clears 8:1.
- **CTA band inline styles tokenised** across all 13 pages (`#0a0a0a`→`var(--black)`
  etc.). The meta `theme-color="#0a0a0a"` is left literal — meta tags can't take
  CSS vars, and it deliberately matches `--ink`.
- **Follow-up not done:** the green CTA band still carries ~8 inline style
  props per page (layout, not colour). Worth extracting to a `.band--green`
  class in one pass; out of scope for a palette-only change.

## Homepage repeated photo — 2026-09-04

Matthew noticed the hero background and the "You'll know everyone…" section
photo are the **same scene** — `office-floor-a.jpg` (hero, darkened) and
`office-floor-b.jpg` (campaign-team, full) are two frames of one office
gathering (same GRIT/TRAVEL posters, foosball table, red rope). Reads as the
same picture twice.

**Fix:** dropped the photo from the campaign-team section and rebuilt it as a
`.record` plate (Your reps / Their trainer / Your manager / Where), which suits
"the same people first shift to last" better than a crowd shot anyway. The
"one room, Englewood, incl. out-of-state clients" line folded into the "Where"
row — no content lost. The `.split` became a plain `.wrap`. Homepage now has
two photos: the hero bg and `trainer-presenting.jpg` in the Teaching section.

This reverses the earlier spec note ("'You will know everyone…' section uses
`office-floor-b.jpg` (people in the room)") — that predates spotting the dupe.
**If Matthew has a distinct office/team photo**, it drops straight back into a
`.split__media` figure here and the record plate comes out.

### Photo supply is the real constraint (for Matthew)
Only four web images exist (`assets/img/`): two near-identical office shots,
`trainer-presenting`, and `canvassing`. Plus three client-cleared field shots
(`brand/photos/field-cleared/`), all nonprofit, two already placed. Everything
in `brand/photos/Office and work/` is raw/unvetted and may carry KPI whiteboards
(Tier 2). **Separately:** `assets/img/canvassing.jpg` is `canvassing-25` — the
frame its own README calls "cleared but unplaced… tone does not fit any page" —
while `canvassing-24` (the one the README assigns to `/careers/`) isn't wired
in. Worth reconciling.

## Careers page — softer register for candidates — 2026-09-05

Matthew's call: "say what it is plainly" holds for **client-facing** copy, but
candidate-facing copy should not be as blunt. Door-to-door / cold calling scares
people off before they meet the team; the page should lead with opportunity and
growth prospects to get them in the door, and rely on the in-person meeting to
convert. Flagged §5 of `brand-voice-company.md` (recruiting copy: no earnings or
atmospheric income framing, no vague growth/scale claims, no "build your own
team", no low-turnover claim). Resolved by going **specific** rather than
atmospheric — the growth story is real and already on the site.

Changed (page-head + head meta only this pass):
- **h1** "The job is field sales. In person." → "Start in field sales. Build the
  career from there."
- **lede** dropped the "if that is the work you want" framing; now names the
  channels once, states every trainer here started as a rep (already claimed at
  the training section, backed by `/team/`), "coached every morning, not sent to
  a door cold", ends on an invitation to come meet the team.
- **meta description** and **og:description** reworded to match — coaching,
  "trainers who did the job first", "come meet the team before you decide".

Held inside §5: no income/earnings language, no downline/"build a team", no
retention claim. h1 "build the career from there" reads as internal role
progression (rep → trainer → floor roles), not ownership — kept clear of
"never imply a rep is an owner/partner/exec".

**Not yet done — needs Matthew's go-ahead:** sections 2 ("What you would
actually be doing" / "the people who do well here are the ones who wanted that
job, not a different one with a nicer name") and 4 ("Straight about the fit" /
"comfortable being told no in person and coming back the next day") still carry
the blunt client-register tone and now clash with the softened opening.

## trainer-presenting.jpg was on three pages — 2026-09-05

Matthew spotted the morning-session photo on `careers/` and the homepage; it was
also on `training/`. All three sat in a near-identical "how we train" section, so
a home -> careers -> training visitor saw the same picture and message three
times. Same root cause as the office-shot dupe above: only four vetted web images.

Fix: kept it on `training/` (its subject page), removed the `<figure>` from the
homepage Teaching section and the careers "How you are trained" section. Both
`.wrap split` containers collapsed to plain `.wrap` and the now-redundant inner
`<div>` was unwrapped — matches every other text-only band on those pages. No
copy changed, no new assets. If a second training photo turns up it drops back
into either section as a `.split__media` figure.

## Photo pass, batch 1 — 2026-09-07

Follows the **RESTRICTED.md "Revision — 2026-09-07"** unlock (client branding
and restricted-board content cleared for website/social use on word-of-mouth
client permission; children, `canvassing-11` Houston, and non-consenting
members of the public still held). Goal: the site ran on three content photos
across 31 pages; this adds five, one per page, all in the existing
`page-head--media-left` + `.ph-media` component (same as `careers/`).

New assets in `assets/img/` (portable node + sharp, `scratchpad/imgproc/`),
1440x1080 4:3, JPG q80 + WebP:

| Asset | Source frame | Page | alt / figcaption |
|---|---|---|---|
| `field-booth-event` | `client-branded-DO-NOT-PUBLISH/2026-07-25-charity-booth-two-client-brands.jpg` (4:3 native) | `/sectors/` | three reps at an outdoor community-event booth / "Event booth · community outreach" |
| `field-booth-nonprofit` | `client-branded-DO-NOT-PUBLISH/canvassing-08.jpg` (portrait, windowed crop top=0.34) | `/sectors/nonprofit/` | one fundraiser at a store-forecourt booth / "Staffed booth · face-to-face fundraising" |
| `office-floor-wide` | `Office and work/2026-08-13-office-floor-session-b.jpg` (4:3 native) | `/how-it-works/` | the floor between sessions / "One room · Englewood, Colorado" |
| `team-corridor` | `Team/IMG_0505-scaled.png` (4:3 native) | `/about/` | staff in the corridor under the wall lettering / "The team · Englewood office" |
| `training-cohort-notes` | `Office and work/IMG_7636.jpg` (centre crop) | `/training/` | cohort around the table taking notes / "Cohort session · the development block" |

Client marks are visible in the two `field-booth-*` frames (tablecloth,
shirts). Per the revision that is now allowed in a picture; the alt text and
captions name no organisation and no page copy calls anyone a client. Verified
by headless screenshot on `/sectors/nonprofit/`, `/about/`, `/training/` —
media-left grid renders correctly.

**`/training/` now carries two photos** (this page-head one plus the existing
`trainer-presenting` in the morning-block split). Different subjects (cohort at
a table vs. trainer at a whiteboard), not a repeat — but flag for Matthew to
cut one if it reads heavy.

**`field-kiosk` (canvassing-01) was processed and dropped** — the portrait
frame has the rep's head near mid-height and the kiosk base near the bottom, so
no 4:3 window keeps both, and there is a lens smudge across the lower-left.

**Not touched this batch, still thin:** `/what-we-do/` (needs a field or office
frame — batch used up the clean landscape shots), homepage body sections
(CHANNELS, TEACHING, SECTORS have no photo; TEACHING lost its figure in the
2026-09-05 de-dup and could take the morning-block board shot as a `.split`),
`/sectors/roofing/` and `/sectors/aeration/` (no sector-specific photography
exists — a storm-restoration shoot is the only fix), `/careers/` (still on the
retouched `canvassing.jpg`; the un-retouched original is now usable if wanted).

## Team page — title + order changes, 2026-09-07

Matthew's instruction, verbatim intent:
- **Brandon Long: "Co-Owner" -> "CEO"** everywhere (`team/index.html` roster label
  + team-data JSON; `team/brandon-long/index.html` title, meta description,
  og:title, og:description, `person-role`). His bio still opens "Brandon
  co-owns Surge..." and "He started the company in 2024" — left as-is, not
  contradicted by the CEO title; change on request.
- **Matthew Sharpe: "CTO" -> "Chief Technology Officer"** everywhere, including
  the bio sentence "Matthew is Surge's CTO." (his instruction was "change my
  text", i.e. the body copy too). Same six spots + JSON.
- **Roster order** is now: Brandon, Matthew, Myles, Lance, Cai, Maya, Ryan,
  Paige, Jon, Nneka. Reordered the ten `.team-strip__item` blocks in
  `team/index.html` (`scratchpad/reorder-team.mjs`, deterministic — verified
  card order + labels after). The in-page bio browser is unaffected (keyed by
  `data-slug`, DOM order drives only the active-state toggle).

**Not changed:** the `team-data` JSON object still lists people in the old key
order (brandon, matthew, ryan, jon, nneka, paige, lance, maya, myles, cai).
Purely cosmetic — it is a lookup dict, nothing iterates it in display order —
but flag if Matthew wants source tidiness. Individual `/team/<slug>/` pages
have no order to change.

Verified by headless screenshot: grid renders 6 + 4, "CEO" and "Chief
Technology Officer" labels show.

## 2026-09-07 — bio reword, Houston frame cleared

- **Brandon's bio reworded to match the CEO title.** `team/brandon-long/index.html`
  and the team-data JSON: "Brandon co-owns Surge and runs the business side of it"
  -> "Brandon is Surge's CEO and runs the business side of it". Kept "He started
  the company in 2024 from a direct-sales background" (biography, not a title;
  flag if it should go). Matthew's bio already opened "Matthew is Surge's Chief
  Technology Officer" after the earlier pass — no further change.
- **`canvassing-11` (Houston SPCA kiosk) cleared by Matthew** ("you have my
  permission to use the houston org"). Processed to `assets/img/field-kiosk.*`
  (1440x1080, windowed crop) and placed on **`/what-we-do/`** page head via
  `page-head--media-left`. Caption/alt say nothing about Houston or geography;
  the RESTRICTED.md structure/scale rule on *words* is unchanged. Rep's ID badge
  is illegible at shipped size. This is the third animal-welfare booth image on
  the site (`field-booth-event`, `field-booth-nonprofit`, now `field-kiosk`) —
  worth watching that the site doesn't read as pet-charity-only; the fix is a
  roofing/other-sector shoot, still outstanding.
- **`canvassing-41` and `2026-07-31-rep-with-member-of-public` stay out** —
  Matthew's explicit instruction, "do not use the photo with the identifiable
  person."

## 2026-09-07 — first real social links + Paige's bio

Matthew supplied five profile URLs (utm share-params stripped) and a new bio.

| Person | Slot | URL |
|---|---|---|
| Brandon Long | LinkedIn | linkedin.com/in/brandon-long-75b555129/ |
| Matthew Sharpe | LinkedIn | linkedin.com/in/mcsharpe/ |
| Lance Axon | LinkedIn | linkedin.com/in/lance-jozefkowicz-52b16671 |
| Cai Silva | LinkedIn | linkedin.com/in/cai-silva |
| Paige Bennett | Instagram | instagram.com/paigebennett.3/ |

Wired into: the roster-grid cards (`team/index.html` `.team-strip__social`), the
per-person `/team/<slug>/` pages, and — this needed a code change — the in-page
detail panel. That panel had **one shared set of 3 social anchors**; `show()`
only relabelled them. Added a `social` object per person to the `team-data`
JSON and extended `show()` to set `href` + `target="_blank" rel="noopener
noreferrer"` from it (falls back to `#` when absent). Also loosened the
click-suppressor: it now `preventDefault`s only anchors whose `href` is still
`#`, checked at click time, so the real links work. All other icons stay `#`
placeholders as before. Verified by CDP: clicking Lance sets his LinkedIn href
live, FB/IG stay `#`.

**Lance's LinkedIn vanity slug is `lance-jozefkowicz`** — different surname from
his site display name "Lance Axon". Used as given; flag if that is a problem.

**Paige's bio replaced** (`team/index.html` JSON + `team/paige-bennett/index.html`),
three paragraphs, verbatim from Matthew except **contractions expanded**
("I've"->"I have", "I'm"->"I am") to match the site's no-contraction style, and
the em-dash spaced to house style. Two things to note for review: it is **first
person** (every other bio is third person), and it leans motivational
("dream bigger than you thought possible", "work hard ... have a lot of fun") —
close to the texture the earlier bio pass stripped out, but these are her own
words and Matthew asked for them verbatim.

## 2026-09-07 — social-icon hover: only real links react

`assets/site.css`. Both social groups (`.member__social` boxed icons, and
`.team-strip__social` bare icons) now scope their `:hover` to
`a:not([href="#"])` — an icon with a real profile URL lights up, a `#`
placeholder does nothing on hover and gets `cursor:default`. This works for the
JS-driven detail panel too, since `show()` sets empty slots back to `href="#"`.

The lit state is a **stronger green than the old plain colour swap**, but still
the brand green (`--green` / `rgba(74,190,74,*)`, same values `is-active`
already uses — no new palette colour): bare icons get a green
`drop-shadow` glow; boxed icons add a faint green fill + a green ring +
outer glow. Verified with forced `:hover` over CDP — wired icon computes
`color rgb(74,190,74)` + green filter, placeholder stays `rgb(138,138,138)` /
`filter none`. If Matthew wants a literally brighter/lighter green hex on
hover that is a deliberate palette addition (would also go in
`brand/guidelines/README.md`) — not done without his say-so.

## 2026-09-07 — photo pass batch 2 + first deploy bundle

**Homepage TEACHING section is now a `.split` with a photo.** New asset
`morning-block.jpg/.webp` (1440x960 3:2, from
`restricted-boards-DO-NOT-PUBLISH/2026-08-13-training-boards-b.jpg` — board
content cleared 2026-09-07). This section lost its figure in the 2026-09-05
de-dup; it now carries the standing-cohort shot with the SURGE wall behind it.
Markup: `wrap` -> `wrap split`, text wrapped in a `<div>`, `<figure
class="split__media">` added — same shape as `/training/`'s morning block.

**`/careers/` image swap considered and rejected.** The plan was to replace the
retouched `canvassing.jpg` with the un-retouched `canvassing-25` original now
that client marks are cleared. But the retouching also removed a handwritten
daily-goal **dollar** board and softened an open ledger on the table — dropping
those back in would put a "$1500" goal board on the recruiting page, which sits
badly against the no-earnings rule even though the 2026-09-07 clearance
technically allows board figures in photos. Kept the retouched frame.
`canvassing.jpg/.webp` were re-encoded from
`drafts/_surge-site-img-originals/canvassing.jpg` (the retouched master) at
slightly higher quality; visually identical to before.

**Left text-only, no good image available:** homepage CHANNELS and SECTORS
bands, `/sectors/roofing/`, `/sectors/aeration/`. Every cleared field photo is a
single-rep-at-a-pet-charity-kiosk variant; adding another would just repeat
`field-booth-event` / `field-kiosk`. Needs new source photography (a roofing /
storm-restoration shoot is the specific gap).

**First deploy bundle built:** `deploy/dist/surge-site-2026-09-07.zip`, 74
files, ~5.5 MB (up from the ~2 MB in DEPLOY.md — the batch-1/2 photos add
~3 MB). Verified contents: all 28 pages, `assets/`, `api/{config,submit}.php`,
`.htaccess`, `robots.txt`, `sitemap.xml`, `404.html`, favicons/manifest.
Correctly excludes every `.md` (this file included), `deploy/`, `_*` paths, and
`api/submissions.log`. `office-floor-b.jpg` (pre-existing orphan, ~272 KB,
unreferenced) is still in `assets/img/` and rides along — harmless, delete when
convenient.

**Not touched, still the launch steps:** `noindex` is still on every page and
`robots.txt` is still `Disallow: /` (flip with `deploy/toggle-noindex.mjs off`);
form endpoint decision (`mail()` vs Formspree, see DEPLOY.md); a RESTRICTED.md
re-read of the final copy.

## 2026-09-07 — homepage review pass (Matthew), round 1

Changes made:
- **KPI scope: "four partner organizations" -> "multiple".** His call — a
  number reads as either too small ("only 4") or too busy ("no time for me"),
  and it fits the less-transparent direction. Applied in all three places the
  count appeared, for consistency: `index.html` (KPI scope), `about/index.html`
  ("aggregated across multiple partners"), `sectors/nonprofit/index.html`
  (funnel scope line). The "so none is identifiable" logic is actually stronger
  without the number.
- **Channels: dropped "That is the whole of it."** Added nothing; the sentence
  before it is complete on its own.
- **Teaching section:** "That is what we work on every morning, and it is the
  part worth comparing us on." -> "That is where we thrive and what we work on
  every morning &mdash; it is the part worth comparing us on." Per Matthew —
  emphasise teaching skill / experience as the differentiator (the method is
  not). Note: "where we thrive" is a touch more assertive than the page's
  usual measured voice, but it is deliberate and not a restriction issue (it
  is a competence claim about teaching, not a proprietary-method claim).

Open — options given, awaiting his pick:
- **Hero background photo** — he finds it pulls attention off the text.
- **"not one job — it is ten"** vs only four items listed.
- **Training row: "for as long as somebody works here"** — reads as doubt about
  tenure.
- **"Cold calling"** label — clear to clients, but off-putting to prospective
  reps who also read this page.

Tabled by Matthew for now (left as-is): the "In practice" / Sectors band and the
"Coverage" row in "Who you deal with".

## 2026-09-07 — homepage review round 2

- **"not one job — it is ten" -> "it is several".** Matthew's pick: a loose
  amount, no count for a reader to check against the four items listed.
- **"Cold calling" -> "Phone outreach"** everywhere it appeared: homepage +
  `/what-we-do/` channel cards (and its `<head>` meta), `/careers/` lede,
  `/about/` Channels row, `/book/` form option. Reasoning is his: the page is
  read by prospective reps as well as clients, and "cold calling" reads as
  daunting to an applicant while "phone outreach" still tells a client exactly
  what it is. Sub-text on the homepage card also softened ("Outbound calls
  worked against a defined list").
- **Hero background** — built a comparison artifact (A no photo / B photo pushed
  back / C photo alongside / D current photo dialled down), rendered in the
  site's real Anton/Archivo + colour tokens:
  https://claude.ai/code/artifact/4dfb6cae-c3df-48c1-9f1a-e5111fe7dc6b
  Recommendation stands at A. Awaiting his pick before touching `.hero` in
  `index.html` / `site.css`.

Still open from round 1: the training-row line "for as long as somebody works
here" (he did not rule on the options yet).

## 2026-09-07 — homepage review round 3

- **"for as long as somebody works here" -> "and it does not stop after
  onboarding"** (Matthew's pick). Applied on the homepage Training row and, for
  consistency, the two other places the same phrasing appeared: `/training/`
  ("It runs every day, and it does not stop after onboarding.") and `/careers/`
  ("...paired practice with a trainer who did the rep job before you did. It
  does not stop after onboarding.").
- **Hero:** recommended **A (no photo)** — it is the only one of the four that
  actually fixes the stated problem (attention on the photo, not the text);
  the others keep an image he is lukewarm on. Fits the plain, direct brand
  voice, and closes the decision before launch. B is the fallback if a human
  element is wanted. Awaiting his final word before editing `.hero`.

## 2026-09-07 — hero: option B applied

Matthew picked **B** (photo pushed back). Interim — he plans to add more Surge
photography and may swap the hero image later; the treatment is what's fixed.

- New asset `assets/img/hero-bg.jpg` + `.webp` (1800x1013, ~117 KB / ~70 KB) —
  a wide crop of the **empty** office floor (`Office and work/IMG_3257`, the
  "safest single asset" per photos-notes: no people, no motion, no clearance
  issue). Replaces the busy `office-floor-a` frame (people mid-stride) that was
  pulling focus.
- `index.html` hero `<img>` -> `<picture>` (webp + jpg), src now `hero-bg`.
- `site.css`: `.hero__bg img` filter `brightness(.34) saturate(.9)` ->
  `brightness(.26) saturate(.55) blur(3px)` + `transform:scale(1.05)` (the
  scale hides the blurred edge; `.hero` clips it). Overlay gradient darkened
  `.55->.82` to `.72->.9`. Added `.hero__bg picture{display:block;width/height:100%}`.
- To swap the photo later: replace `hero-bg.jpg`/`.webp`, same dimensions, done.
- **Orphans now:** `office-floor-a.jpg` (was the hero) and `office-floor-b.jpg`
  are unreferenced. Left in place in case the hero photo is reverted; drop them
  from `assets/img/` at launch cleanup if unused.

Deploy bundle (`deploy/dist/surge-site-2026-09-07.zip`) is now stale — rebuild
with `node deploy/make-bundle.mjs` once the page-by-page review is done.

## 2026-09-07 — /what-we-do/ review (Matthew), aligned to the homepage pass

- **Page-head lede: "We run it out of one room" -> "We run it end to end."**
  "One room" read as a ceiling. The honest "one office in Englewood, not a
  limit on where we sell" point still lives in this page's "Worth saying
  plainly" section, which is where it belongs. Same phrase on `/how-it-works/`
  ("we run all five out of one room" -> "we run all five ourselves") changed
  for consistency &mdash; flag for Matthew when he reviews that page.
- **"What moves to us" section, aligned to the homepage JOBS section:**
  - h2 "Four jobs you stop doing." -> "The jobs you stop doing." (matches homepage)
  - added a short intro paragraph (homepage has one; this page jumped straight
    to the cards): "Building a sales team is several jobs at once, and in-house
    they get stacked on someone who already has a full-time role. These are the
    four that move first." &mdash; echoes, does not copy, the homepage intro.
  - Training card dropped "This is the area we thrive on" (the word "thrive"
    already appears in this page's "Worth saying plainly" section) and now
    carries the homepage's phrasing: "...every morning before anyone knocks a
    door &mdash; and it does not stop after onboarding."
  - eyebrow "What moves to us" and the closing "You keep the product..." line
    left as-is &mdash; deliberate variation from the homepage, not a mismatch.
- **"How the selling happens" section:**
  - "There is no funnel step where software does the talking." **removed** &mdash;
    Matthew's point: nothing else on the site sets up a software/automation
    comparison, so it was answering a question no one asked. Replaced with a
    positive line that echoes the homepage's "every channel ends with a person"
    thesis: "Whichever channel it starts on, a person has the conversation
    &mdash; that is what the four have in common."
  - h2 "How each channel actually runs." -> "How each channel runs." (dropped
    the faintly defensive "actually").
- **"Worth saying plainly" section:** "plenty of companies run something close
  to it" -> "run the same model" (matches the homepage's directness). The two
  "Worth saying plainly" sections are otherwise consistent-but-different on
  purpose &mdash; homepage = teaching is the differentiator; this page = not
  proprietary + one office is not a limit.
- **Homepage:** "Door-to-door" -> "Door to door" in the channels grid, to match
  `/what-we-do/`, `/about/` and `/careers/`. (The hyphenated form stays in two
  `<meta>` descriptions where it is used as a compound adjective &mdash; correct there.)

## 2026-09-07 — /about/ review (Matthew)

- **Page-head photo felt too small beside the tall headline + 5-row record
  list.** Added a `.ph-media--fill` modifier (site.css, in the
  `.page-head--media-left` >=900px block): the figure `align-self:stretch`es
  and the image fills the full column height (`aspect-ratio:auto`,
  `object-fit:cover` keeps the crop clean). Applied to `/about/` only. Below
  900px it is an ordinary 4:3 `.ph-media`. No text was shrunk — the record
  list is genuinely useful content and stays. If the taller crop shows too
  much floor, nudge `object-position` — one line.
- **"The work" section — dropped "cause".** "A company hands us the product and
  the cause." -> "A company hands us the product and the goal. We build the
  approach around it and put trained people in front of real customers ... A
  rep carries each conversation through to a confirmed sale." "Cause" read as
  nonprofit-only; "goal" covers a roofing contract and a monthly-donor target
  alike. Added the "we build the approach" beat Matthew wanted (fills the
  section out slightly too).
  - OPEN: "confirmed sale" has the same commercial-only lean as "cause" did.
    Left as-is for site-wide consistency; flag for the sector review.
- **Removed the "Clients and numbers." section** — Matthew: it reads like a
  disclaimer, and the clients / figures point is an in-person conversation, not
  website copy. Replaced (same section wrapper, same visual rhythm) with
  **"How we work / Run from one place, reported on daily."**:
  - every campaign runs out of the Englewood office, including out-of-state
    clients (also covers the CLAUDE.md "one office is not a service area"
    correction);
  - the people who plan a campaign run it, client hears daily;
  - the method is not proprietary — the work goes into teaching it
    (satisfies brand-voice-company § on not claiming a unique process).
  No metrics, no invented origin story — nothing that needs a source.
- **Sectors:** left as-is per Matthew. He wants a full pass over every
  sector mention on the site to decide include vs. table. PENDING — affects
  `/about/` record row, homepage, `/sectors/` + `/sectors/*`, nav/footer.

### 2026-09-07 — /about/ "How we work" wording (Matthew, round 2)

- "campaign" -> "account" (both instances). Matthew: "campaign" leans nonprofit.
  "Every account runs out of our Englewood office... The people who plan the work
  are the people who run it..."
- "The part we put the work into is teaching it well" -> "Teaching it well is
  what we are built on". Matthew: the tentative phrasing undercut the confidence
  the rest of the page carries; and it now echoes the page h1 ("A sales and
  marketing company built on training.") on purpose.

## 2026-09-07 — /careers/ rewrite (Matthew)

Matthew's brief: the page was too transparent for recruiting; too narrowly about
door-to-door field sales when Surge hires across several role types; and the copy
needs to *excite* and read as an invitation, not a warning. Register call is
logged in the recruiting-copy-register memory. Rewrite done inside
brand-voice-company.md §5 (not part of the candor walk-back — still binds on
recruiting): no earnings/income framing even atmospheric, no vague growth/scale,
no "build a team", no low-turnover claim, no rep=exec implication.

- **Page-head is now text-first** — the 4:3 photo-left figure (`canvassing.jpg`
  staffed-booth) was removed. Two reasons: it hammered the door-to-door image
  Matthew wants de-emphasised, and it was one of **seven** pages opening with the
  identical `page-head--media-left` block (about, what-we-do, how-it-works,
  careers, training, sectors, sectors/nonprofit). See the layout note below.
- **H1:** "Start in field sales. Build the career from there." -> "Learn to sell.
  Build a career on it." (keeps Matthew's "career" ask, drops "field").
- **Lede** rewritten: leads with "learn to sell properly, coached every morning by
  people who have done the job", the rep -> training -> floor-roles path ("the
  people in those jobs now started exactly where you would"), and a "come spend a
  morning with us" invitation. Dropped "door to door, phone outreach, events and
  booths" and "sent to a door cold".
- **Section 2 "The work, plainly / What you would actually be doing"** -> **"The
  roles / Sales is the way in, not the ceiling."** Now covers the range: reps
  (field, phone, or from home), plus administration, customer service, inside
  sales, and roofing-sector inspection work. "Which roles are open depends on the
  clients we are running, so it changes through the year" — this is Matthew's
  "we hire different positions as we expand" rendered as present-tense fact, not
  a growth/scale claim (§5). Kept one honest line — "It is a sales job and we call
  it one" — because obscuring that the entry role is sales is the "misleading job
  ad" problem (Tier 1 sensitivity), but dropped "not a different one with a nicer
  name" and all the doorstep detail.
- **Section 3 "How you are trained"** — h2 "Every morning, before any customer."
  -> "You will be coached every day." Reworded off "sent to a door cold",
  "objections", "the channel", "drilling". Kept the morning development block
  (cleared material, strongest in the folder) described without clock times:
  "a taught subject, practice on it, and one-on-one time with a trainer who has
  done the job ... it runs every day you are here."
- **Section 4 "Who it suits / Straight about the fit"** -> **"Who does well here /
  For people who want to get good at something."** Dropped "rewards people who are
  comfortable being told no in person and coming back the next day". Reframed on
  growth, transferable skills (explaining clearly, reading a room, teaching it on),
  and the learn -> train -> lead path.
- **Closing CTA** "Want to sell?" -> "Want in?" (broader than sales).
- **`<title>`/meta/og** changed from "Field sales jobs at Surge" to "Careers at
  Surge" and reworded to match.

**How the §5 tension was threaded (flagged to Matthew, not re-litigated):** the
excitement is carried by *specifics* — daily coaching, the real rep->trainer->floor
path with people visibly on it, skills that transfer — not by earnings language or
"join a fast-growing team". Those two are the §5 lines the softening does not lift,
and they are also what reads as confirmation to a reader primed by the reputation
problem. Concrete confidence, not vague breadth.

**Still not touched on /careers/:** `/careers/apply/` (the 4-step apply page — may
still be sales-specific in wording; Matthew to review). The homepage careers
mention and footer "field sales teams" tagline still say "field sales" — consistency
pass needed if this page's broader framing is kept.

### Layout repetition — 7 pages open with photo-left / text-right

Matthew flagged it (he counted 3; it is actually 7). My take: it is a legitimate,
common pattern but seven in a row makes the site feel templated. Recommendation:
keep `page-head--media-left` where the photo does real work (about = the team,
sectors = the field, arguably what-we-do), and vary the rest — photo-right,
a full-width band, or text-first (careers is now text-first, so that is 6). Not
actioned beyond careers; worth a dedicated pass with a visual comparison like the
hero one if Matthew wants it.

### Fact-check log — /careers/

- Role types (administration, customer service, inside sales, work-from-home
  sales, roofing-sector inspection work): stated by Matthew directly, 2026-09-07,
  as CTO. No published Surge job listing was used as a source. If a public
  careers/job board listing exists, reconcile the role list against it before
  launch.
- "coached every morning" / development block: `brand/notes/daily-process.md`
  via RESTRICTED.md "Clear to use" (morning development block, no clock times).
  No times used.
- rep -> trainer -> management path: RESTRICTED.md 2026-08-15 unlock (advancement
  as a career path). The team page shows real trainers/managers; not named here.
- No metric, earnings figure, headcount, location count, or hours claim appears
  on the page.

### 2026-09-07 — /careers/ round 2 (Matthew)

- Lede: "coached every morning by people who have done the job themselves" ->
  "coached by our experienced team of trainers and leaders" (his wording; the
  old phrase read as under-confident). "Come spend a morning with us before you
  decide." **cut** — Matthew: reads desperate, like the job needs a chance given
  to it. Lede now ends on the "the people in those roles now started exactly
  where you would" line. "roles that run the floor" -> "training and management".
- Section 2 h2 "Sales is the way in, not the ceiling." -> "The roles we hire
  for." Body reworked so admin / customer service / inside sales are not
  afterthoughts: "Surge hires across the whole operation. Sales reps are the
  largest team ... and alongside them we hire in inside sales, customer service,
  administration, and inspection work for the roofing sector." Dropped "that is
  the job to get good at first, because everything else here builds on it" and
  "It is a sales job and we call it one" — both re-subordinated the other roles.
  New p2 sets up section 3: "Whichever role you start in, the setup is the same:
  taught the work, coached as you go, shown a path to move up."
- Section 3 h2 "You will be coached every day." -> "Trained first, coached
  after." Opens universal ("Whatever the role, you are taught the work before you
  are expected to do it on your own ... Nobody is dropped in on the first day and
  left to figure it out"), then the morning development block is given as the
  sales-team specific ("For the sales team, that carries on every morning...") —
  kept because Matthew said explaining the morning training is fine, but it is no
  longer the whole section. Removed "handed a script", "how the conversation
  usually goes".
- Section 4 unchanged (Matthew approved that direction in round 1).

### 2026-09-07 — /careers/ round 3 (Matthew) — de-sales-ified further

Matthew: the page still presumes a sales hire in places, which pre-filters the
audience. Broadened again.
- h1 "Learn to sell. Build a career on it." -> "Learn the work. Build a career on
  it." ("learn to sell" flagged as restrictive to who reads the site).
- Lede: removed "you will learn to sell properly" and "the people in those roles
  now started exactly where you would" (presumes the reader's future role matches
  a leader's origin role). New lede: taught before you perform, coached by the
  trainers/leaders "most of whom came up through the company themselves",
  "whichever role you are hired into, there is a real path to move up".
- Roles section: dropped "inspection work for the roofing sector" (too narrow,
  and names a sector) -> "...administration, and operations". Removed "Which roles
  are open at any time depends on the clients we are running" entirely — Matthew:
  reads as inside information and injects uncertainty. NB: did not replace it with
  a "new roles open as we grow" line — vague growth claims stay out of recruiting
  copy per the register memory / §5.
- How you are trained: the morning development block is NOT sales-only — Matthew
  attends it himself and he is not sales. Reworded: "Mornings here open with a
  development block ... It is not only for the sales floor; coaching is part of
  every role here, direct or indirect." (his "direct or indirect" phrasing).
- Who does well here: h2 "For people who want to get good at something." ->
  "For people building a career." Body reframed on developing a professional
  career, transferable skills (added "staying organised under pressure" for the
  non-sales roles), and promotion from within.
- `<meta name="description">` / `og:description` rewritten to drop "learn to
  sell" / "every morning" / "come spend a morning with us".

---

## Competitor review (Cydcor / Smart Circle) — Matthew's notes, 2026-09-11

Matthew reviewed cydcor.com and smartcircle.com against this site and raised ~14 items.
Two were explicit build instructions and were actioned this session. The rest are
recommendations pending his call — full write-up went back to him in conversation, and
anything he greenlights lands on the punch list.

### Cydcor's structure, for reference
- Nav: Home / **About** (Leadership, FAQ, Reviews) / **How Cydcor Works** (Our Process,
  How Clients are Supported, Field Sales Programs) / **Services** (B2B, Retail, Residential,
  Event Services & Management, Become a Client) / Media / **Careers** (Openings, Office Tour)
  / Contact. Dropdowns on four of seven.
- Homepage section order: hero ("Customer Acquisition Solutions" / "Connecting Your Brand to
  Proven Field Sales Teams") → "Trusted Partner of Fortune 500 Companies Since 1994" →
  "– Recognized by –" → "– Featured in –" → "Why Choose Cydcor" (5 cards: Acquire New
  Customers / Grow Market Share / Penetrate New Territory / Retain Customers / Increase
  Customer Value) → "How We Work" (3 steps) → "Where We Drive Results" (4 channels) →
  "Cydcor in the Media" → "Scale Your Customer Acquisition" → FAQ.
- Repeated CTAs: **"Become a Client"** and "Explore a Partnership", on nearly every page.
- Contact page is five routed options, not one form: Become a Client / Event Services &
  Staffing / Media Inquiries / Feedback, Questions & General / Careers.
- Footer: nav links + legal + 5 social icons (IG, YouTube, FB, X, LinkedIn) + a **Google
  Review button** + address + back-to-top.
- Smart Circle nav for comparison: Who We Are / What We Do / How We Do It / Smart Blog /
  Contact (Client Inquiries, Customer Inquiries, Distributor Feedback, FAQs).

### DONE 1 — footer social rail, sitewide (21 pages)
New `.social-rail` component in `site.css`, injected as a 4th footer column after the
"Pages" column on every page. Deliberately **not** the generic round-bubble row Cydcor and
the old WP site both use:
- Square tiles (this site has no circles outside the team headshots), hairline border,
  hover knocks the icon out to black on a green fill — the same move as every other CTA.
- Under each tile is a green **riser** bar that steps up 3/6/9/12px left to right. That is
  the ascending-bars mark from `drafts/social-kit/` rendered as the underline of the row.
  It is the bit that makes this Surge's rather than a stock icon strip.
- Footer grid went `1.4fr 1fr 1fr` → `1.3fr 1fr 1fr` at 720px and `1.3fr 1fr 1fr auto` at
  960px so the icon column takes its own width.
- Tiles: LinkedIn, Instagram, Facebook, YouTube. **Only Instagram has a real URL**
  (`instagram.com/surge.ftw`, per the July-2026 analytics doc). The other three render as
  inert `<span class="s-tile">` — not focusable, not clickable, per Matthew's "if you don't
  have the URLs just make the icons not lead anywhere". Risers are green on all four
  regardless: whether an account is linked yet is a temporary state and three greyed-out
  icons read as a broken footer. **Swap the `<span>` to an `<a>` when he supplies URLs** —
  re-run `scratchpad/inject-social.mjs` after editing its `ICONS` table, or sed the 21 files.
- **Google Review button deliberately NOT copied** from Cydcor's footer. The Google
  Business Profile is stuck at ~1★ (see the baseline-analytics doc) — a footer button
  pointing every site visitor at a one-star listing is an own goal. The review QR collateral
  in `drafts/review-qr/` exists precisely so that ask goes to satisfied clients in person.

### DONE 2 — client wall on `/about/`
New `.client-wall` component + a Clients section placed between "How we work" and
"Teaching" (`band--lift`, so the black → lift → band → lift alternation still holds).
- Eyebrow "Clients", h2 **"Some of the names we run for."**, one-line lede: *"Most of our
  clients are referred to by sector only — that is their call to make, not ours. These gave
  us permission to use their mark."* Framed that way on purpose: it makes two logos read as
  *the two who said yes*, not as *we only have two clients*. It is also deliberately ONE
  line — the 2026-09-04 candor-cut removed an empty-logo-wall section that explained the
  no-names policy at length, and this must not reintroduce that.
- Cells sit on the dark ground behind a hairline, not on white plates: the InstaBuzz mark is
  white-and-yellow with a black keyline, already built for a dark surface. A future mark that
  only works on white gets `.cw-plate` on its own `<li>`, not a row-wide switch.
- `InstaBuzzMedia-logo.webp` copied from `brand/photos/client-logos-DO-NOT-PUBLISH/` to
  `assets/img/clients/instabuzz-media.webp`.
- **VAA cell is commented out in the markup** — no artwork exists anywhere in this repo and
  the org could not be confirmed from a search (several similarly-named veterans
  organizations; no official site located). Needs the file or an authoritative URL from
  Matthew before it goes in. Do not guess at this one.
- **This is an exception to `RESTRICTED.md` Tier 4 ("Client identity, at any resolution.
  Sector only") and needs a written revision in that file before launch.** It rests on
  Matthew's word that both organizations gave permission. Mitigating fact: the *current live*
  WordPress site already publishes a `/clients/` page naming InstaBuzz Media with this same
  logo (see `drafts/surge-wp-restore/recovered-copy/clients.md`), so InstaBuzz is not a new
  exposure. VAA would be. The `gig-logo-*` files in the same folder stay out — the Gig
  relationship is Tier 2 restricted on its own separate grounds.
- Moving the block to the homepage is a cut-and-paste of the whole `<section>`; it carries no
  page-specific styling. Recommended against for now — two logos directly under the hero
  reads thin, and the homepage KPI funnel already does the proof work.

### Tooling
`scratchpad/shot.mjs` rebuilt again (plain-node CDP, `prefers-reduced-motion: reduce`
before navigate, optional `clipTop`/`height` args for cropped captures). Run with
`MSYS_NO_PATHCONV=1`. `scratchpad/inject-social.mjs` is the idempotent footer injector.

### Same-session follow-ups, 2026-09-11

**Instagram tile sat a few px low — fixed.** Matthew spotted it. Cause was a specificity
collision, not the stagger: `footer .fcol a` (0,2,1) sets `margin:.35rem 0` and out-specified
the bare `.social-rail .s-tile` (0,2,0). It only hit Instagram because that was the one tile
rendered as an `<a>` — the other three were `<span>` placeholders and never matched the rule.
Reset added at 0,3,0: `footer .social-rail .s-tile{margin:0}`. Verified by reading geometry off
the live page (`scratchpad/measure.mjs`, CDP `getBoundingClientRect`) rather than eyeballing:
all four tiles now `top:3702.8`, `h:41.6`, `margin-top:0px`, 50.4px pitch.

**All four socials linked.** Matthew supplied the URLs: LinkedIn
`linkedin.com/company/surgeftw/` (his link had a trailing `/home/` — dropped, the bare company
URL is the canonical one), Facebook `facebook.com/profile.php?id=61594078987428`, YouTube
`youtube.com/channel/UC48K-UlylYw_Ye9ioO9UYyg`. Instagram `instagram.com/surge.ftw/` was already
in. `scratchpad/link-socials.mjs` promoted the `<span>` placeholders to anchors — 21 files,
63 tiles. No placeholders remain, so the "inert span" branch of the component is now unused
(kept in the CSS comment for whenever a new platform gets added before its URL exists).

**VAA logo sourced and placed.** Matthew confirmed the org: **vetsaa.org**, Veterans Association
of America Inc, a 501(c)(3) veterans services nonprofit (legal, housing, employment, discharge
upgrades, medical, family outreach). **Their site has no clean logo asset** — checked the header,
og tags and every image URL in the page source. The only mark is a 755x127 JPEG banner
(`baner.jpg`) with the flag background and the tagline "Serving those who've served this country"
baked in; the two other "Veterans Association of America Inc" files on their CDN are 1920x1080
stock photography, and the favicon is 16px. Pulled the 755px original, trimmed the 2px dark
keyline with PowerShell `System.Drawing` → `assets/img/clients/vaa.jpg` (751x123, q92).
Because it is banner-shaped with its own background it needs more room than a flat wordmark, so
it gets a `.cw-wide` modifier (19rem min-width, 4rem max image height) rather than being squeezed
to the 2.6rem wordmark height, where the tagline turned to mush. **Ask VAA for a real logo file
and swap it** — this is the best that exists publicly, not a good asset.

**RESTRICTED.md revised — 2026-09-11 section added.** Matthew widened the client rule: logos and
client branding (including Surge people in client merch) are cleared for marketing use *as
logos*, not just incidentally inside a photo; naming a client in text stays barred. Tier 4's
client entry retitled "Client identity **in words**" with a pointer. The
`client-logos-DO-NOT-PUBLISH/README.md` was rewritten — it previously instructed the exact
opposite — and now scopes its prohibition to the `gig-logo-*` files only, which are restricted
under the separate Tier 2 Gig entry and are NOT covered by the client clearance.
**Two open items recorded there:** (1) `CLAUDE.md` still says "Clients: never named, sector only"
and needs correcting since it loads every session; (2) `alt` text on a client logo — the
2026-09-07 revision named alt text specifically, and the wall currently carries
`alt="InstaBuzz Media"` / `alt="Veterans Association of America"` on the reading that alt is part
of the mark, not copy. Flagged for Matthew's ruling; presumed cleared meanwhile.

### The four unblocked Cydcor items — actioned 2026-09-11

Matthew: "Start with the unblocked four and we will work through them all slowly."

**1. Booking CTA on every page + the CTA band componentised.**
The band was hand-rolled inline on 5 pages with drifting values. It was deliberately left alone
on 2026-09-09 ("pure churn, no user benefit") — that no longer held once 15 pages needed the same
new button, so it is now a real component, `.band--cta`, with `.btn--onGreen` (filled, black on
green) and `.btn--onGreenGhost` (outlined) for the two button roles. The site's normal
`--brand-green` buttons are invisible against this band, hence the separate pair.
- **Copy stays different on every page.** That is what stops a repeated CTA reading as
  boilerplate; only the mechanism is shared. Two h2s changed to kill a genuine repeat: three
  pages all said "Tell us what you need sold." — the homepage keeps it (repetition-ownership
  principle, 2026-09-07), `/what-we-do/` → "We will tell you how we would run it.", `/team/` →
  "That is who would run yours." (its body had also repeated the phrase a second time).
- **Audience-matched, which is where Cydcor gets it wrong** — they put "Become a Client" on
  careers pages too. `/careers/` ends in the applicant form and gets **no** booking button;
  a candidate has no use for a client consultation.
- **The 10 `/team/<slug>/` bio pages had no terminal CTA at all** — they ran straight into the
  footer. All 10 now end in "The rest of the team." → Book + See the full team. Shared copy
  across the 10 on purpose (low-intent pages, same useful next step from each). No headcount in
  that copy — RESTRICTED.md Tier 2 covers headcount and scale.
- `/contact/` and `/book/` deliberately have none: they are the destination.
- Utility pages (privacy, terms, thank-you, 404) have none. Left that way; flag if wanted.
- **Bug found and fixed in my own new CSS:** `.band--cta>.wrap>p` (0,2,1) out-specified
  `.band--cta .cta-tel` (0,2,0), so the small "Or call…" line was rendering at the lede's
  1.1rem and 46ch. Caught by measuring the element, not by looking at it. Now
  `>.wrap>p:not(.cta-tel)`.

**2. Nav relabel: "What we do" → "How Surge works".** 42 links across 21 pages (header nav +
footer Pages column). Matthew's read was right and the page already agreed with him — its
`<title>` and `<h1>` have said "How an outsourced sales team works" all along, so the nav label
was the odd one out. Header measured after the change: nav 601px inside a 1024px wrap, fits with
room at every breakpoint down to the 860px hamburger.
- **Not changed:** the URL is still `/what-we-do/` (a rename means redirects, canonicals,
  sitemap and every inline link — worth doing only if he wants it, flagged to him); and
  `/about/`'s `<dt>What we do</dt>` record row, which is descriptive prose, not a nav label.
- **Open question raised with him:** `/what-we-do/`'s own page eyebrow still reads "What we do"
  above an h1 of "How an outsourced sales team works." Left alone — matching it to the nav would
  put "How Surge works" directly above "How an outsourced sales team works."

**3. Third contact route: feedback / general.** The one route worth taking from Cydcor's five
(not Media — an empty press route is a tell; not Event Services until events is a real offer).
The actual argument for it: **it gives an unhappy person somewhere to go that is not Google.**
The Business Profile sits at ~1★, so a low-friction private channel has direct value.
- New `feedback` radio + `#form-feedback`: name, email, topic select, optional phone, message.
  **Deliberately the lightest of the three forms** — no upload, no consent checkboxes (the
  backend only gates job/client on those). Someone with a complaint should meet the least
  friction available, not the most.
- `api/submit.php`: `feedback` added to `$titles`, `topic` added to the `$extra` whitelist.
  Lints clean. The handler already tolerated unknown `_form` values, so nothing else changed.
- **`.audience` grid was hard-coded `1fr 1fr`.** It paints its dividers with `gap:1px` over a
  `--line` background, so a third item would have left an empty cell reading as a broken tile.
  Now: 1 col stacked, 2 cols with the last spanning full width at 720px, 3 abreast at 1040px.
- **Deep links added.** Each `<label>` carries an id (`#client`, `#apply`, `#feedback`);
  `site.js` maps the hash to the radio, checks it, opens that form and scrolls to it, and also
  listens for `hashchange`. With JS off the hash still scrolls to the right option. `/careers/`
  now links `/contact/#apply` so a candidate is not asked "which one are you?" twice.
  Verified all four cases (`#apply`, `#client`, `#feedback`, no hash) via `scratchpad/test-hash.mjs`.

**4. Role chips → an openable role list on `/careers/`.** This is the answer to "should we build
a job board": it tells a candidate what each role actually is, with nothing that goes stale when
no listing is open, and no ATS decision required.
- Native `<details>` — no JS, keyboard support and semantics for free, and every role still
  opens with JS off. A **grid**, not the old wrapping flex row: an open item grows its own cell
  instead of shoving its neighbours to the next line.
- `.role-chips` CSS is kept, not deleted — still the right component anywhere a label just
  needs naming.
- **All six descriptions need Matthew's fact-check, and the markup says so.** Sales and Inside
  sales are derived from what the page already states; Marketing, Customer service,
  Administration and Operations are generic-function descriptions because **no Surge-specific
  detail for those roles exists anywhere in this repo** and inventing one is the exact failure
  CLAUDE.md warns about. No comp, no growth language (§5). Sales is not re-centred — equal
  weight, per the three 2026-09-07 rounds.
- **Caught and removed before it shipped:** a closing line I had drafted, "Which of these are
  open changes," is a restatement of "which roles are open depends on the clients we are
  running" — which Matthew cut on 2026-09-07 as reading like inside info and injecting
  uncertainty. Dropped entirely rather than reworded.

**Verification.** `scratchpad/smoke.mjs` loads 12 representative pages headless and asserts nav
label, CTA presence, book-button presence, social-tile count and role count per page while
collecting console errors and failed requests. All 12 correct, **no console or network errors**.
`scratchpad/shot.mjs` gained an `EVAL_JS` env hook for capturing open/expanded states.

**Also fixed this session:** the client-wall cells had a green border-on-hover copied in from the
`.card` convention — Matthew asked why it was there. They are not links, so it promised a click
that does not exist. Removed. And the social risers now start at 5px rather than 3px: below ~4px
the bar antialiases into a hairline and reads as a dim rule rather than the short end of a step.

**Deploy bundle is stale** — rebuild with `node deploy/make-bundle.mjs` before any redeploy.

### Blog scaffolded + hero video slot built — 2026-09-11

Matthew: URL stays `/what-we-do/` (confirmed, not renaming). Blog and hero video both wanted as
**templates/holders to fill in later**, and both added to the pre-launch punch list.

**Hero video slot — built, inert, zero regression.** `index.html`'s `.hero__bg` now holds a
`<video data-hero-video>` **above** the existing `<picture>`, with both `<source>` lines commented
out. The still image is the guaranteed floor, and the video only reveals itself (`.is-playing`,
0.9s fade) once it is genuinely playing.
- `site.js` bails immediately if the `<video>` contains no `<source>` — so the slot ships empty and
  nothing 404s. It also bails on `prefers-reduced-motion`, on `max-width:720px` (a background video
  is data a phone visitor spends on decoration they can barely see), on `navigator.connection`
  save-data / 2G, and on a rejected `play()` promise (blocked autoplay). Any failure = the still.
- CSS gives `.hero__video` the identical treatment to `.hero__bg img`
  (`brightness(.26) saturate(.55) blur(3px) scale(1.05)`) so the swap is invisible, and
  `.hero__bg::after` gained `z-index:1` so the darkening gradient lands on the video too.
- **`assets/video/README.md`** carries the full brief: 8–15s, silent, must loop, under ~3 MB,
  1280×720 (it is blurred to 3px — more resolution is wasted bytes), first frame should resemble
  `hero-bg.jpg`, and nothing legible in frame (the RESTRICTED.md photo rules apply to video).
- To activate: drop `hero.mp4` in and uncomment two lines. Nothing else.

**Blog — `/blog/` hub + `/blog/_template/`.** Built by `scratchpad/build-blog.mjs`, which reuses
`about/index.html`'s head/header/footer so the chrome stays in sync and then swaps the per-page
meta. Named **"Blog"**, not "Insights" — that name was part of what made the old section read as
consultancy showboating.
- Hub h1 "Things worth knowing if you sell for a living.", lede ends "**Written for people doing
  the work, not about us**" — the rule that fixes what went wrong the first time, stated on the page.
- Reuses the **orphaned `.ins-grid` / `.ins-card` / `.source-panel` / `.sector-note` CSS** from the
  removed Insights section rather than adding new components. Punch-list item 20 (dead CSS) shrinks
  accordingly.
- The template is a complete, working post carrying a 5-point publishing checklist in an HTML
  comment (head fields, sourcing, conflicting sources, "Surge is not the subject", add the card +
  sitemap entry) and the finding → what-to-do-with-it → Source-panel structure.
- **`_template` never ships** — `make-bundle.mjs` already excludes any path segment starting with
  `_`. Side effect recorded on punch item 4: the hub's "Start here" card is a dead link in
  production until real posts replace it.
- **Footer only, not the header.** A header link to an empty blog is a bad first impression, and
  the header is deliberately lean. Punch item 34 covers promoting it once there are 3+ posts.
- `sitemap.xml`: `/blog/` added (23 URLs now), `_template` deliberately absent.
- **Nothing from the old Insights work was resurrected** — that is Matthew's call. The three built
  pages are still in `_surge-site-insights-removed/` and the sources in `sales-research-set/`.

**Bug caught in my own tooling.** The script that added the footer Blog link keyed on
`      <a href="/careers/">Careers</a>` — **the header nav and the footer Pages column use the
same six-space indentation**, and `String.replace(string, …)` only replaces the first match. So
Blog went into the *header* on all 23 pages instead of the footer. Corrected with a second pass
that strips it from inside `<nav class="primary">` and re-inserts it against the `<h4>Pages</h4>`
block. Verified per-page: 0 pages with Blog in the header, 23 with it in the footer. **Lesson for
any future sitewide link injection here: anchor on the surrounding block, not on an indented
`<a>` that appears in both chromes.**

**Punch list updated** — https://claude.ai/code/artifact/e194c7f4-9f6e-4c49-a116-211d03147f4b
Now 35 items, with a new tier "New — from the Cydcor review, mostly yours to do" (28–35): write
blog posts or remove the blog (gate), shoot the hero video, fact-check the six role descriptions,
get a proper VAA logo, **get the two logo permissions in writing**, the CLAUDE.md + alt-text
rulings, Blog-in-header decision, the `/what-we-do/` eyebrow. Existing items 1, 2, 4, 5, 13, 14,
19 and 20 were updated where this session's work changed them (notably: the feedback form is a
**fourth untested form**, and the RESTRICTED.md content pass needs re-running).

Re-verified after all of it: `scratchpad/smoke.mjs` over 12 pages — nav label, CTA, book button,
social count and role count all correct, **no console or network errors**.

### Insights resurrected as blog posts + nav dropdown — 2026-09-11

Matthew: *"You can ressurect the insights pieces just pass them off at blogs rather then something
to compare us to or relate us too. Just educational pieces meant for the public to enjoy."* He also
plans to write his own "editor discussion type" posts later.

**Three posts live at `/blog/talk-ratio/`, `/blog/discovery-questions/`, `/blog/training-retention/`.**
Built by `scratchpad/blog-posts.mjs`, which lifts the `<main>` from
`drafts/_surge-site-insights-removed/` but **rebuilds the chrome from a current page** — those files
predate the social rail, the Blog footer link, the "How Surge works" relabel and the CTA component.
Reframing applied:
- **"What we take from it" → "What to do with it"** on all three. The old heading was itself the
  problem: it framed every piece as being about Surge's reading rather than the reader's use.
- **`/blog/discovery-questions/`** — "Our reps work doorsteps and events, where the conversation is
  shorter" → "A conversation at a door, a booth or a counter is shorter". Same caveat, stated
  generally. Source-panel `<dt>Our illustration</dt>` → `<dt>Illustration</dt>`.
- **`/blog/training-retention/`** — this was the piece that read as "here is where our methods come
  from". Its whole closing paragraph ended *"The morning block is drilling and paired practice for
  exactly this reason"*. **Replaced entirely** with a general reading: the trade between re-reading
  (comfortable, raises confidence, retains less) and recall from memory (unpleasant, works), and
  that anyone designing a training week is choosing between those two. No Surge reference remains.
- Eyebrows "Insights" → "Blog"; back links → `/blog/` "← All posts".
- **The build script asserts every replacement landed** and then greps the output for
  `/Our reps/`, `/morning block/`, `/what we take from it/`, `/\/insights\//`. That caught a real
  miss on the first run — a 6-vs-4-space indentation mismatch meant the discovery-questions
  paragraph was silently not replaced, and the script refused to call it clean. Worth keeping that
  pattern for any content transform: assert, do not assume.
- **Sitemap** now lists the three posts (26 URLs). Hub cards replaced the template card; the
  template is deliberately **not** linked from the hub, since `make-bundle.mjs` excludes
  underscore-prefixed paths and a card pointing at it would be dead in production.
- **No CTA band on the individual posts** — deliberate. The pieces only work if they are not
  selling; the footer already carries the Book button on every page. The hub keeps its one. One
  block to add if Matthew wants them.
- **British spelling caught in my own new copy:** "realise" → "realize" (and a stray "re-centred"
  in a careers comment). The site was swept to American English long ago.

**Nav dropdown — the answer to "services section" and "about dropdown" without new pages.**
This is the recommendation from the competitor review made concrete: Cydcor's navigability comes
from **dropdowns**, and its dropdown entries mostly lead to thin separate pages. Surge gets the same
affordance with every entry as an **in-page anchor on a page that already exists**, so the
2026-09-07 page-count cut is not quietly undone.
- `/what-we-do/` gained section ids: `#the-four-jobs`, `#channels`, `#common-questions`
  (`#how-an-engagement-runs` already existed).
- Header nav's "How Surge works" is now `.nav-item.has-sub`: the **link still navigates** to the
  page, and a separate `.sub-toggle` chevron button opens the panel. That split matters — hover
  alone is useless on touch and awkward on a trackpad, and a parent link that only opens a menu is
  a common accessibility failure. Injected on all 26 pages.
- CSS: desktop opens on `:hover`, `:focus-within` **or** `[data-open]` from the button; a
  `.has-sub::after` hover-bridge spans the margin gap so the panel does not close in transit.
  Under 860px the panel becomes a **static indented block** inside the existing hamburger drop
  panel, hover rules explicitly disabled, revealed by the chevron only.
- `nav.primary a:not(.nav-cta):first-child{border-top:0}` no longer matched — the `.nav-item`
  wrapper is now the first child. Replaced with `> a:first-child, > .nav-item:first-child > a`.
- `site.js`: button toggles, Escape closes, click-away closes, following a panel link closes.
- **`html{scroll-padding-top:5.5rem}`** added — the header is sticky, so every one of these anchors
  would otherwise land underneath it. Measured: section top 88px vs header bottom 66px. Clears.

**Verification.** New `scratchpad/test-nav.mjs` — 11 assertions, all passing: four anchor targets
exist, the anchor clears the sticky header, the button opens the panel, Escape closes, click-away
closes, the parent link still points at `/what-we-do/`, and at 420px the panel is hidden until
toggled then opens `display:block; position:static`. `smoke.mjs` still clean across 12 pages, no
console or network errors.

**Two tooling notes, both cost time today:**
1. `.subnav` transitions `visibility` over .16s, so reading `getComputedStyle` in the same tick as
   the click reports the *pre*-transition value. A test that clicks and immediately asserts will
   report a false failure. `test-nav.mjs` now settles 400ms first.
2. **`loading="lazy"` images render blank in a `captureBeyondViewport` screenshot** when they sit
   far below the fold — the client-wall logos looked missing at 420px and were not. Confirmed by
   reading `img.complete` / `naturalWidth` after a real `scrollIntoView` (both fine: 1640×300 and
   751×123). Check the DOM before believing a blank box in a tall capture.
`scratchpad/shot.mjs` and `measure.mjs` both gained a `WIDTH`/`HEIGHT` env hook for emulating
narrow viewports.

### About dropdown + photo rotator + shot list — 2026-09-11

Matthew: *"Continue with the list, I will make an effort to add more photos to what we have so we
can fill out the pages more."*

**`/about/` dropdown added**, same pattern as "How Surge works". Section ids added to `/about/`
(`#the-work`, `#how-we-work`, `#clients`, `#teaching`, `#the-team`), five entries, all verified to
resolve. Two labelling decisions:
- The culture section (`#the-team`, h2 "One floor, and everyone is on it.") is labelled **"How the
  office runs"**, NOT "The team" — `/team/` is already a top-level nav item and an entry by that
  name pointing at an `/about/` anchor would send people somewhere they did not expect.
- "The work" → **"What we run"**, which reads as a destination rather than a category.
Header measured after both dropdowns: nav 652.6px inside a 1024px wrap. Still fits.
**The injection script scopes to the `<nav class="primary">` block** rather than string-replacing
the first `<a href="/about/">About</a>` — the footer has an identical line at identical indent, and
that is exactly the bug that put the Blog link in the header earlier today.

**Photo rotator built — `.rot`.** Matthew's "rotate between photos so pages show more without
getting longer". Design decision that makes it useful now rather than later: **one frame behaves
exactly like a plain figure** — no stacking, no dots, no timer, `site.js` skips it entirely — and a
**second `<picture>` is what switches it on.** So a slot can be converted before the photos exist.
- Frames share one grid cell (`grid-area:1/1`), so the slot keeps a single photo's height however
  many frames are in it. Verified: with two frames both images measure identically (461.6×346.2 at
  the same origin) and the figure height does not change.
- Auto-advance 5.2s, **suppressed entirely under reduced-motion** (dots still work), pauses on
  hover and on `focusin` so it cannot move under someone reading the caption or tabbing.
- Dot buttons are generated by JS with real `aria-label`s, so no-JS gets no orphan controls.
- **Wired as a reference on `/what-we-do/`'s page-head** with its single existing frame plus a
  commented-out second `<picture>` and instructions. Renders pixel-identical to before (4:3,
  dots 0×0). Tested by temporarily injecting a real second frame — rotation, dots and the
  unchanged slot height all confirmed — then reverted.

**`brand/photos/SHOT-LIST.md` written.** The point is that a photo session produces usable frames
rather than fifty that fit no slot. Covers: the five absolute rules (no children, no identifiable
public, no legible personal info — and the two things that ARE now cleared, client branding and
board content); technical requirements (**landscape 4:3**, ≥1440px, shoot wider than needed, avoid
the backlit-window silhouettes several existing office frames suffer from); then slots in priority
order — rotator sets of 3, the four "why choose us" frames with what each must show, hero video,
replacing `canvassing-25`, **Brandon's headshot** (his 395×333 face-only source will never cut out
cleanly; five minutes against a plain wall fixes the one roster gap), and the **channel coverage
gap** — door-to-door and phone outreach have no usable frame at all, and phone outreach is entirely
in-office. Ends with what already exists so nothing gets re-shot.

**Still not built: "why choose us" (punch 37).** Now understood to be photo-blocked as well as
placement-blocked — Matthew's original ask was for a section "that has photos and details", and the
four frames it needs do not exist. Sequencing it after the shoot rather than building a text-only
version of a section whose whole point is the photography.

Verification: `test-nav.mjs` 11/11, the five `/about/` anchors resolve, `smoke.mjs` clean over 12
pages, no console or network errors.

### Punch-list fixes 5, 6, 10, 11, 12, 15, 16, 35 — 2026-09-11

Matthew: photos are a couple of days out, so worked the unblocked backlog instead.

**Item 5 — 28 dead social icons on `/team/`, plus 25 more found on the bio pages.**
Previously every network a person had no account on rendered as `<a href="#">`, which looks like a
link and jumps the page to the top. Now they are **removed, not neutered**.
- `show()` sets `el.hidden` and strips `href`/`target`/`rel` rather than pointing at `#`.
- CSS: `.member__social a[hidden],.team-strip__social a[hidden]{display:none!important}` — needed
  because the existing `display:flex`/`inline-flex` on those anchors defeats the `hidden` attribute.
  The two `a:not([href="#"]):hover` rules were simplified to `a:hover` since no `#` anchors remain.
- `scratchpad/strip-dead-social.mjs` removed the hard-coded ones: **28 from the roster strip and
  25 across the ten bio pages, 53 total.** Zero `href="#"` left anywhere under `/team/`.
- **Caught an over-removal.** The script's container regex also matched the detail panel's
  `<div class="member__social" data-td-social>`, whose three anchors are the *template* `show()`
  populates — so the first run emptied it and every person showed zero icons. A behavioural test
  caught it (not a screenshot: the panel is `display:none` until a card is clicked). Restored the
  three, now marked `hidden` with no `href` so nothing dead exists before JS runs or if it never does.
- Verified per person: Brandon → LinkedIn, Cai → LinkedIn, Paige → Instagram, Ryan → none. No
  visible icon without a real href. Roster: 10 social blocks, **5 real anchors** — exactly the five
  known URLs.

**Item 6 — `/book/` consent.** Both consent checkboxes added, matching the Contact forms, and
**`book` added to the server-side consent gate in `submit.php`** — until now the handler only
checked `job` and `client`, so the Book form could be submitted without consent even once the
boxes existed. Lints clean. Note the feedback form is deliberately *not* gated (see its own note).

**Item 10 — "reported every day". It was four times on the page, not three.** The punch list
recorded the lede, the Management card and stage 05; the "Where we actually differ" section had a
fourth ("the numbers from every shift the day they happen"). **Stage 05 now owns it alone:**
- Lede: "We run it end to end and report back on it every day." → "We run it end to end."
- Management card tail: "reported back to you every day" → "the part that does not stop once a
  team is hired" (kept the card from going thin, without repeating).
- Differ section: clause removed.

**Item 11 — hiring said twice.** Stage 03 read "Ads, screening and interviews" — verbatim the
Hiring card three sections above. Rewritten to what the stage actually contributes: *"Where the
four jobs above start on your account."* The cards own the detail of each job; the stepped list
owns where each sits in time.

**Item 12 — third restatement of the not-proprietary thesis, cut.** The differ section's
"what varies between one company and the next is how well the material gets taught…" is now gone;
the homepage and `/about/` own that point per the 2026-09-07 ownership principle. What remains is
what the h2 ("run in the open") actually claims — visibility — with a third concrete added so the
sentence still lands: who is on your account, what the morning training covers, and what each of
them is being coached on.

**Item 15** — `/book/` h1 "Put a time in the diary." → **"Put a time on the calendar."** (British.)
**Item 16** — `/team/` h2 "One room, every campaign." → **"One room, every account."**, and the
paragraph under it, per the /about/ steer that "campaign" reads nonprofit-heavy.
**NOT swept further:** `/what-we-do/` still says "campaign" throughout (stage 04 "Run the campaign",
the channel copy). That is a whole-page decision, not a one-line fix — flagging rather than doing.

**Item 35** — `/what-we-do/` eyebrow "What we do" → **"The engagement"**. Deliberately not
"How Surge works": that is the nav label and would sit directly above an h1 of "How an outsourced
sales team works."

Verification: `smoke.mjs` 12 pages clean, `test-nav.mjs` 11/11, no console or network errors.
Repetition rechecked by grep — daily-reporting now appears once in body copy on `/what-we-do/`
(stage 05), and the not-proprietary point twice sitewide (homepage, `/about/`) instead of three times.

### Location rule applied + KPI scope call — 2026-09-11

**Matthew's rule, verbatim:** *"Colorado and englewood should only be mentioned when we are talking
about where we are located, the office we are in, and references to hiring someone (that way they
know where we are at)."* Audited all 96 mentions sitewide and classified each. Most were already
compliant — address rows, figcaptions, the careers/contact titles. **Five were not**, all of them
attaching the location to *what Surge does* rather than to where it is, which is the exact
service-area misread:
- **Homepage hero eyebrow** "Outsourced sales and marketing · Englewood, CO" → **"Outsourced sales
  and marketing"**. The highest-impact one: it paired service with location in the first words on
  the site.
- Homepage `meta description` and `og:description` — "Based in Englewood, Colorado." tails removed.
- `/team/` `<title>` and `og:title` "| Englewood, CO" → "| Surge"; meta "Based in Englewood,
  Colorado." dropped. The team page is about people, not location.
- `/blog/` meta description — "company in Englewood, Colorado" → "company".
- **Sitewide footer `.tag`** — dropped "Englewood, Colorado." from the end of the service sentence
  on 25 pages. It was **redundant as well as mis-scoped**: the footer's own Contact column, two
  columns over, already says "Englewood, CO".

**Kept, and why:** `/careers/` title + meta (hiring — his explicit carve-out); `/contact/` and
`/about/` titles + meta (contact and company-identity pages state where the company is); the
`<dt>Based</dt>` / `<dt>Office</dt>` rows; "Englewood office" figcaptions; the ten team-bio metas
("X is Y at Surge in Englewood, Colorado" is a location statement); the JSON-LD `PostalAddress`;
Terms' "laws of the State of Colorado"; the homepage **Coverage** row and `/what-we-do/`'s "one
office … not a limit on where we sell", both of which exist precisely to *counter* the misread.
The `/what-we-do/` FAQ mentions were left alone — Matthew is rewriting that section.
**SEO note:** local signal is unaffected — the JSON-LD address, the footer, `/contact/` and
`/about/` all still carry it. What was removed was duplication, not the location itself.

**Punch item 13 — KPI band reading nonprofit-only. Matthew: "use your best judgement."**
Kept the band. It is the only scoped, dated, sourced figure set Surge has, and §2 requires the
scope be stated, so the sector cannot simply be dropped to make the band read broader. Added one
sentence instead: *"The same office runs accounts outside that sector; those are not represented
here."* That is true (six active clients, four nonprofit), it is consistent with the client wall on
`/about/` which now shows a commercial mark, and it **names no sector** — `/sectors/` is still
tabled and naming one here would reopen that. No figures are claimed for the other work, because
none exist in usable form. Opening clause also changed "This is our nonprofit fundraising work" →
"These are the figures from our nonprofit fundraising work", so the scope reads as bounding the
*numbers* rather than the business.

**Punch item 14 closed — Matthew: three CTAs in the hero is fine.** No change.

### Photo batch sorted, HEIC solved, first rotator set live — 2026-09-11

**HEIC: yes, with a converter — no, not directly.** The Read tool does not treat `.heic` as an
image, and **Windows on this machine has no HEIF codec** (PowerShell `System.Drawing` and WIC both
fail `0xC00D5212`). Solved with **`heic-convert`** — pure JS + WASM libheif, no system codec needed.
Installed under `scratchpad/heic/` with the portable node v22; `convert.mjs` takes an out-dir and a
list of files. This matters going forward: iPhone stills default to HEIC, so every future batch will
need this step. 54 HEIC files were already in `brand/photos/`; 51 already had jpg siblings.

**Duplicate sweep.** `scratchpad/dupes.mjs` (sha1) found **30 identical groups, 47 MB**. Two kinds:
already-parked ones in `_duplicates-2026-08-13/` (left alone) and genuine repeats.
`scratchpad/park-dupes.mjs` **moved 28 files, 16.8 MB**, to a new `_duplicates-2026-09-11/` —
**moved, not deleted**, matching the existing precedent so it is one `mv` from undone. It scores
candidates and keeps the better copy: filed-in-a-folder beats loose-in-the-root, descriptive name
beats camera-roll gibberish, dated names score higher. Dry-run first, then `--go`; re-scan confirms
zero remaining. The big finds: eight loose camera-roll files in the photos root that were byte-identical
to already-named frames in `client-branded-DO-NOT-PUBLISH/`, and **thirteen identical copies** of
`spring-cleaning-hiring-01.jpg` in the Instagram export.

**Videos pulled out of `brand/photos/`.** Ten in total. Matthew asked for a video section he could
review later. `brand/videos/2026-09-11-unreviewed/` now holds the five real clips (his new
`IMG_8379.MOV` plus four strays dating back to May) with a README naming each and pointing at the
hero-video brief. The other five were **iPhone Live Photo motion halves**, not clips — they went to
`brand/videos/live-photo-motion/`, and their stills stay in `brand/photos/` under the same name.

**The batch itself — and a constraint that outlives it.** Full write-up in
`brand/photos/2026-09-11-REVIEW.md`. The headline: **the office wall reads "F✱CK AVERAGE / BE
LEGENDARY"** (painted, asterisk in the original), there is **a $100 bill taped up by the dartboard**,
and a GOALS whiteboard carries a legible **"$39,000"** weekly figure. None of that breaks a
restriction — the 2026-09-07 revision cleared board content and dollar figures in photographs — but
it is squarely the standing test: *would this read as confirmation to someone who already suspects
the worst?* **This constrains every future shoot in that room**, not just this batch.
- `IMG_8376` and `IMG_8377` are out (profanity fully legible / $100 bill, and 8377 is 9:16).
- `IMG_8375` held — profanity hidden behind the subject, but the struck-through AVERAGE/LEGENDARY
  signage is still §5 texture.
- `IMG_8374` used.

**First live rotator set.** `IMG_8374` → `assets/img/morning-block-b.jpg` (1440×1080, 263 KB, in
line with the 252 KB frame beside it), added as the second frame on the homepage Teaching block's
`morning-block.jpg` — same subject, so it reads as a set rather than a slideshow. The crop takes the
**left 1900px specifically to exclude the GOALS board and its $39,000**. Verified: both frames
measure identically (487.6×325.1 at the same origin), two labelled dot buttons, `.split__media`'s
3:2 `aspect-ratio` applies cleanly over `.rot`. **It is a usable photo, not a strong one** — ~45% of
the frame is still empty carpet — so treat it as proof the rotator works and swap it after the shoot.

**All four stills were portrait** (3024×4032 and 1980×3520) against a site whose every photo slot
crops to 4:3 landscape. That was the first technical line in `SHOT-LIST.md`; it is now also the
first note in the batch review. Second-order fix recorded there too: shoot from inside the
semicircle at chest height rather than from standing height across an empty floor, which is why the
carpet dominates every frame in this set.

### Delegated judgement calls — settled 2026-09-11

Matthew: *"Use what you think is best for the metrics and contractions and any other thing you had
concern about."*

**Contractions — staying OFF.** No change made. The flat un-contracted register is a real part of
why this copy reads better than the competitors' (theirs hedges: "conversations that *can* build
relationships", "campaigns *seeking to* identify"), and contractions would soften it toward that
texture. It is also applied consistently across 26 pages and every bio, so reversing is a large
sweep with genuine regression risk for a marginal gain.

**Metrics — reframed, because it was never a decision.** The figures are fine as published: scope
and date are stated and the page says plainly they are team-reported. What is missing is a
**pullable source** — "reported by the team that runs it" is honest but is not a document. Only
Matthew can fetch the tracking export. Two things surfaced while reviewing:
- The nonprofit-only limitation is a *separate* gap that cannot be written around, and it is what
  keeps punch item 13 a workaround rather than a fix.
- **The band is labelled "2026 campaigns to date".** "To date" is relative — it goes stale silently
  the moment the year turns, and the research standard says check the date on every number. **It
  needs a real as-of date before launch.** I did not invent one.

**`CLAUDE.md` corrected.** The "What Surge does" section said *"Clients: never named, sector only"*,
half-true since the 2026-09-11 RESTRICTED revision and loading into every session. Now states both
rules explicitly — in text never named, logos and branding cleared — with a pointer to the revision
that governs, and the one-line summary "A mark on the page, a name in the copy — never the second."

**"campaign" → "account", on a principle rather than a sweep.** The `/about/` steer (campaign reads
nonprofit-heavy) applies to the **client relationship**, not to the unit of field work. The tell is
the possessive: *your* campaign is the engagement; *a* campaign is the work. Five changed —
homepage "everyone working on your account", `/book/` "on your account", `/team/`'s CTA plus its
lede and meta description (its h2 already said "every account", so the page contradicted itself).
**Deliberately left:** "Run the campaign" (stage name), "Every campaign runs out of Englewood"
(coverage), "2026 campaigns to date" (those really are fundraising campaigns), Lance's and
Brandon's bios, the `/contact/` feedback option (a neighbour means the field activity), the
`/what-we-do/` FAQ and the `/careers/` role blurbs (Matthew owns both).

**"field sales" de-narrowed, finishing the 2026-09-09 pass.** The sitewide footer `.tag` was the
documented "one place still to decide" — decided: **drop it.** A sitewide footer is the broadest
surface on the site, so it over-narrows more than anywhere else, and it contradicted the homepage
title and meta which dropped "field" in September. 28 substitutions across 26 pages, covering the
footer tag, `/about/`'s record row, `/about/`'s og:description and `/what-we-do/`'s meta (that one
listed "phone outreach" as a *field* channel, which it is not). **Kept:** the homepage's "anyone
who tells you their field sales process is proprietary" (about the industry, not Surge's scope) and
Paige's "three years in field sales" (a fact about her). Earlier single-line searches missed these
because the text wraps mid-phrase — worth remembering for any future copy sweep here.

**Blog promoted to the header nav** (three posts was the threshold I set). Marked current on the hub
and every post. **This forced a breakpoint change:** with six nav items, two dropdown chevrons and
the phone pill, the header had **zero slack at 880px** — it needed exactly the full wrap width.
Hamburger threshold moved **860px → 940px** in both `site.css` and `site.js`. Verified: hamburger
showing at 900px, full nav with 92px slack at 960px. (The unrelated `.contact-head` 860px
breakpoint on line 507 was left alone.)

**Checked and found already resolved:** `/careers/` two adjacent `band--black` sections (the note
predated later edits — the sequence is now green / band / black / lift / cta).

**`alt` text on client logos** stays as the organisation's bare name — that is how the mark reaches
a screen-reader user, and suppressing it is an accessibility regression on a meaningful image.

Verification: `smoke.mjs` 12 pages clean, `test-nav.mjs` 11/11, no console or network errors.

### RESTRICTED re-check, privacy, dead CSS, bundle — 2026-09-12

Matthew confirmed both client logo permissions are given (InstaBuzz and VAA), with VAA's clean PNG
and the metrics tracking export both expected Monday. Worked the three items that needed nothing
from him: punch 2 (RESTRICTED re-check), punch 19 (privacy vs the fourth form), punch 20 (dead CSS),
and rebuilt the bundle (punch 4).

**The re-check ran against extracted page text, not markup.** `scratchpad/extract-text.mjs` strips
every shipping page to what a visitor actually reads, with `alt`, `aria-label` and `<meta content>`
pulled inline so they are reviewed too. Grepping the raw HTML was useless — the inline social SVGs
are thousands of characters of path data and they swamped every match.

**Copy is clean on every restricted category.** No client name in prose anywhere (the only hits are
the two logo `alt` attributes, which the 2026-09-11 revision clears); no Gig; no compensation, pay
or hours language; no clock times outside the `/book/` slot picker, which is a booking control; no
headcount, office count, footprint or other-city reference; no 55/38/7; no cancel-any-time; no
lineage jargon — `/what-we-do/` says "logging every door", which is Surge's own description of
door-to-door and not the canon phrase; no MLM or devilcorp material.

**The real finding was not in the copy. It was in the comments, which ship.** Twenty-eight HTML
comments were going out in view-source, and several carried material that is restricted in its own
right:

- `index.html` — the rotator note recorded that the 4:3 crop deliberately excludes a GOALS
  whiteboard carrying a legible **"$39,000"** week. A Tier 2 figure, published as an explanation of
  why it was cropped out.
- `about/index.html` — the client wall note named `brand/notes/RESTRICTED.md`, called the wall "a
  deliberate exception to the sector-only rule", and recorded that it rests on "Matthew's word" that
  permission was given. The VAA note called the organisation "the client" and said its mark was
  pulled off their own site.
- `careers/index.html` — ">> ALL SIX DESCRIPTIONS NEED MATTHEW'S FACT-CHECK", telling any reader
  who opens source that the role copy is unverified.
- `book/index.html` — a note describing a consent gate that was missing from the handler until
  2026-09-11. A fixed hole, but not one to publish.
- `index.html` — the "DRAFT rebuild — not deployed" banner, which the 2026-09-07 pass was supposed
  to have cleared.

**Fixed at the bundler, not in the sources.** The notes are worth keeping for whoever edits these
pages next; they are worth nothing to a visitor. `make-bundle.mjs` now strips HTML and CSS comments
into a staging copy on the way into the zip, so the repo keeps every note and the shipped site
carries none. Verified: every shipped page's markup is byte-identical to its source with comments
removed, and all 466 CSS rules survive unchanged.

**One trap worth recording, because it looked equivalent and was not.** The first CSS stripper
parked quoted strings with a regex and then removed comments. An apostrophe *inside* a comment —
"the wall of logos we don't put up" — opens a string match that runs to the next apostrophe
hundreds of lines later, so real rules got parked inside a comment span and deleted with it. That
silently cut `site.css` from 59KB to **9KB** and it would have shipped as a site with no styling.
Whether a quote opens a string depends on not already being inside a comment, which is state a
single left-to-right scan carries and a pair of regexes cannot. Replaced with a scanner. JS is
deliberately left alone: `//` inside a URL makes line-comment stripping a good way to break a
working file, and nothing in `site.js`'s comments is sensitive.

**Three stale comments were also factually wrong, and fixed at source rather than just hidden:**
`site.css` and `book/index.html` both still said the booking form "submits nowhere" — untrue since
the 2026-09-08 live test and actively misleading to the next editor — and `site.css` labelled the
sector list "the wall of logos we don't put up", written before the wall existed.

**Punch 19 — privacy.** The fourth form's `topic` field was undeclared, and so were three fields on
the client enquiry form (role, timeline, how-you-heard) and its optional upload; only the applicant
form's file was described. "What we collect" now names what each of the four forms takes.

**Punch 20 — dead CSS.** Removed `.sector-list`, `.funnel`/`.funnel__step`, `.statement`,
`.rail`/`.rail__step`/`.rail__hand`, `.contrast`/`.contrast__col` — 49 lines. `.rail` and
`.rail__hand` were **not** on the punch list's list; checking exact class tokens against every
`class="..."` in the site found them, where the earlier substring search had not. Kept and verified
still in use: `.sector-note`, `.funnel-viz` (the homepage KPI bars — a different component that a
substring search for "funnel" would have destroyed), `.record`, `.ins-*`, `.source-panel`.

**Punch 4 — bundle rebuilt**, 80 files. Retired paths absent, `blog/_template/` absent,
`api/uploads/` holds only its guard files, no `submissions.log`.

**Punch 4's sitemap count was wrong.** It said to confirm 26 URLs; the correct number is **23**.
The site ships 25 HTML files, and `404.html` and `/thank-you/` are correctly excluded from a
sitemap. Checked URL by URL against the shipped pages: 23 is right, "22 + blog + 3 posts" was a
miscount. Punch list corrected.

**Flagged for Matthew, not actioned — the client wall's heading.** See the next section.

### The client wall's copy — flagged, not changed, 2026-09-12

The two logos are cleared and are not the issue. The three lines of copy above them are, and this
is Matthew's call rather than mine because he approved the wall knowing what it is.

As it stands, `/about/#clients` reads:

> **Clients** / **Some of the names we run for.** / *Most of our clients are referred to by sector
> only — that is their call to make, not ours. These gave us permission to use their mark.*

**On the letter of the rule it passes.** RESTRICTED.md bars *naming* a client in body copy,
headings or captions; no organisation is named in any of those three lines. The names live in the
logos' `alt` attributes, and the 2026-09-11 revision cleared those specifically.

**What it does not survive is how a screen reader renders it.** That clearance was argued on the
grounds that `alt` is the accessible equivalent of the mark — "the organization's name and nothing
more, no 'client' assertion." That reasoning holds only while the copy around it supplies no
assertion. Read the section aloud in order and it comes out as: *"Clients. Some of the names we run
for. InstaBuzz Media. Veterans Association of America."* For a blind visitor the page is not showing
two marks next to a heading; it is speaking a sentence that names two clients. A sighted visitor
infers the relationship from layout, which is what a logo wall is for and what Matthew cleared. A
screen-reader user gets it as prose, which is the thing the rule bars.

**Separately, and the part I would cut whatever he decides about the rest:** *"These gave us
permission to use their mark."* That is a public claim about consent, printed on the page, resting
on a verbal permission with nothing in writing behind it as of today. It invites the one question
punch item 32 exists to close, and it earns the site nothing — a visitor does not need to be told
the logos are licensed, and the two organisations did not ask to have their consent published.

**Proposed minimal rewrite** — keeps the wall exactly as it is, removes the assertion from the text:

> **Clients** / **Who we run for.** → *Most of the organisations we work with are referred to by
> sector only. These two let us show their mark.*

That is still weaker than I would like on the screen-reader point. The version that actually clears
it drops the eyebrow and heading to something that describes the *page section* rather than the
relationship, and lets the marks do the asserting, which is the division the revision draws:

> **In the field with** / **Marks we are cleared to show.**

**Not applied.** Matthew asked for a client wall after the competitor review and a wall with no
relational copy is a weaker wall. The tradeoff is his. What is worth knowing is that the
accessibility argument that cleared the `alt` text is load-bearing, and this copy is leaning on it.

### FAQ rewritten on /what-we-do/, candidate FAQ added to /careers/ — 2026-09-12

Matthew released the FAQ ("Draft it, I'll edit") and asked for a second one on `/careers/`. Punch
items 8 and 9 are closed by this; two new flags come out of it.

**The diagnosis was not "too transparent".** Both problem answers *narrated the refusal* — "We
would rather tell you in the first meeting than publish a single number…", "We price it against
your goal on the first call rather than publishing a rate that would not fit most of them." The
reader is not told a price; the reader is told in a full sentence that a decision was made not to
tell them. That is what reads as evasive. §4's rule covers it exactly — **cut the hedge, keep the
bound** — and in both cases the bound was already there in the first sentence and was fine.

**Item 9, the Colorado line, is resolved by deletion.** §4: *"Silence about a limitation is fine;
asserting the opposite is not."* "What we cannot do is place a permanent, locally stationed team
somewhere else" is now gone rather than reworded. The answer is one sentence and says yes.

**A third problem the punch list did not have.** The last answer ended *"Some clients restrict how
their brand appears in photos and video, and we follow that."* Internal policy in client-facing
copy, answering a question nobody asked, and partly out of date since the 2026-09-11 revision. Cut.

**⚑ And a fourth, which is a research-standard hit rather than a voice one.** The cost answer said
pricing depends on *"whether you pay against a target or per result."* That is the **revenue
model** — Tier 2 restricted *and* Tier 3 unverified, where Matthew's own framing was "from my
understanding" and "through the grapevine". It was asserting a pricing structure nobody has
confirmed. Replaced with "It depends on the channel and how long the campaign runs. We price each
account against the goal you give us" — which keeps the useful part and drops the mechanism.

**One question added:** *"Are the reps your people or ours?"* — a standard outsourcing question the
page never answered, and a §5 "answer structurally" opportunity. Worded to avoid asserting
employment status (W2 vs 1099 is not on record anywhere): "Ours. We hire them, train them and
manage them." Easy to delete if Matthew does not want it.

**`/careers/` candidate FAQ — four questions, and the three that matter most are missing.**
Reuses the `.faq` component with no new CSS, sits as a plain `band` between `#apply` and the CTA so
the alternation stays green / band / black / lift / band / cta. It deliberately restates nothing
from the roles list, the training section or the four apply steps.

The four: do I need sales experience (no — the training assumes not) · is every role door to door
(no) · where would I be working (Englewood, consistent with the client-facing answer) · would I
work for Surge or for a client (for Surge; you represent the client's brand in front of a customer).

**What is not there, and why it matters.** The three questions a candidate actually opens a careers
page with are **what does it pay, what are the hours, and is it commission only.** All three are
Tier 2 in RESTRICTED.md, and the answer that would most help — a guaranteed weekly base, no buy-in,
no training fee — sits in `hiring.md`, which is marked context-only, never content. So they are
absent, and the markup says so. **This one needs Matthew's ruling**, and it is worth noting that
silence on "is it commission only" is the costliest of the three: it is the devilcorp-adjacent
question, and §5's own conclusion is that specificity is the only thing that improves that position.

**Also flagged, not changed:** apply step 03 says the day includes going "out in the field to see
the work up close." For an Administration or Customer service applicant that is either untrue or
means something different. Matthew owns the apply steps; not invented around.

Verification: both pages balance (`<details>`/`</details>`/`<summary>` 6/6/6 and 10/10/10 in the
shipped, comment-stripped output), no duplicate ids, section tags balanced, bundle rebuilt.

### brand-voice-company.md carries two stale facts — 2026-09-12

Found while reading it before drafting. Not fixed, because it is a spec and Matthew owns it.

- **§1 lists the sectors as "nonprofit organizations, a roofing company, an air/HVAC company."**
  `CLAUDE.md` and `clients.md` both record that **Surge does not work in air/HVAC and never did** —
  it was a mis-transcription of *aeration* that survived months as a confirmed fact. The spec is
  still propagating the version that was corrected on 2026-08-15.
- **§2 says "no clients or logos… without explicit written permission"** and reasons from **"with
  three clients"**. Both are superseded: the roster is six active plus one prospect, and the
  2026-09-11 RESTRICTED revision cleared client logos for use as logos. The spec loads before every
  company draft, so it will keep steering toward the old rule.

### Quick-call sweep — items 13, 14, 16, 21, 39 — 2026-09-12

Five items were on the list as "your call". **Three of them were not decisions at all** — two were
already done and the third had been overstated. Worth recording, because the punch list had been
carrying them as open for over a week.

**Item 21 — already resolved.** The homepage `<title>` is `Outsourced Sales Teams | Surge`; "in
Colorado" came out on 2026-09-09 in the de-"field" pass and the punch list was never updated. The
three titles that still carry the location — `/about/`, `/careers/`, `/contact/` — are exactly the
contexts Matthew's own rule allows (the office, or hiring). Nothing to change.

**Item 13 — already resolved.** The KPI note already closes with *"The same office runs accounts
outside that sector; those are not represented here."* That is precisely the one neutral sentence
the 2026-09-11 judgement call specified. The list recorded the call but not that it had been carried
out.

**Item 16 — one word, not a whole-page decision.** All seven "campaign" uses on `/what-we-do/` were
checked against the possessive rule from 09-11 (*your* campaign = the engagement → "account";
*a* campaign = the unit of field work → keep). **Six were already correct.** The only wrong one was
"how many people **your** campaign needs" — a line written earlier the same day in the FAQ rewrite.
Changed to "the campaign". The punch list's framing of this as a page-wide sweep was wrong.

**Item 14 — Matthew's call: cut "Book a consultation" from the hero.** Three CTAs became two. Book
is not off the site or even off the homepage — it is the terminal CTA band at the foot of this page
and a button in the footer of all 26 pages, so the homepage still carries two links to it. What is
left in the hero is one low-commitment conversion path plus a route for the reader who is not ready
to talk, which is most first-time traffic for a company nobody has heard of.

**Item 39 — Matthew's call: the minimal rewrite.** The wall stays and reads as a client wall; the
consent claim goes.

> Clients / **Who we run for.** / *Most of the organisations we work with are referred to by sector
> only. These two let us show their mark.*

The dropped sentence — "These gave us permission to use their mark" — was a public claim about
consent resting on a verbal permission. Note the screen-reader point from the earlier section is
**softened, not closed**: the eyebrow still says "Clients" above two named marks. Matthew chose this
knowing that; the stronger option (describe the section, not the relationship) is recorded above if
he changes his mind.

**Two build comments corrected at the same time,** both now false and both of the kind that mislead
the next editor: the client-wall note still said the block "needs a written revision in
RESTRICTED.md before the site goes live" (that revision happened on 2026-09-11 and now governs), and
the VAA note said to ask the client for a logo without recording that it has been asked for. The
client-wall note now states the rule it is implementing and warns against adding a naming sentence.

**Tooling, again, and this one is written down twice now.** The bundle verification was first
written as `node -e "..."` and every open-tag count came back 0 — bash ate the `\b` in the regex and
the check passed 52 "failures" that were all artefacts. Rewritten as
`scratchpad/verify-bundle.mjs`. **Do not use `node -e` for anything containing a regex escape.**
Result: 25 shipped pages, all tags balanced, no comments left.

### Item 42 answered from Surge's own job ad — 2026-09-12

Matthew supplied the live Indeed listing for the sales role (Brand Ambassador | Community Outreach)
and, asked whether to publish the answer, said *"Do what you think is best."* Treated as a
**delegated call on one sentence**, not as a Tier 2 unlock. Added to the `/careers/` FAQ:

> **Is it commission only?** No. The sales role pays a base wage plus commission, paid weekly, and
> the training period is paid. There is 401(k) matching.

**The argument for publishing it.** Every fact in that sentence is already stated publicly by Surge
in its own job ad, so the site discloses nothing new — it stops being silent where the company is
already speaking. Silence on "is it commission only" is read as an answer, and §5's own conclusion
is that specificity is the only thing that improves the reputation position.

**Deliberately no figure.** The ad publishes `$800–$1,100 per week`. The site does not, because a
pay band is transient and the site is durable, and §2 would want scope and a date on any published
number. "A base wage plus commission" answers the question completely without pinning a figure the
page would have to maintain.

**RESTRICTED.md was NOT changed and must not be treated as changed.** Pay figures and hours remain
Tier 2. If Matthew wants this to be a standing rule rather than one sentence, that needs his
explicit word and a revision line in that file.

**⚑ public ≠ cleared, and the ad is the proof.** The listing's *facts* are public; its *framing* is
a catalogue of what the specs bar, in some cases word for word:

| In the ad | Rule it trips |
|---|---|
| "Expected First-Year Earnings: $40,000–$75,000+" | §5 — no earnings claims, explicit or atmospheric, on recruiting content |
| "uncapped commissions", "travel opportunities" | RESTRICTED Tier 2 names **these two specifically** as atmospheric income claims |
| "Supportive, high-energy team culture" | §5 — no vibes culture; "high energy" is also in the Tier 2 compliance cluster |
| "nationally recognized nonprofit organizations" | §5 — no scale framing, and it characterises the clients |

None of that crossed to the site; the bundle was re-scanned for every one of those phrases and is
clean.

### Findings on the job ad itself — 2026-09-12

Not site work, and mostly not Matthew's to change alone (Talent Acquisition owns it), but recorded
because all three are live recruiting exposure right now.

**1. The ad's two pay figures do not reconcile.** `$800–$1,100 per week` is **$41,600–$57,200** a
year. The floor matches the advertised "$40,000". The ceiling does not: **$75,000 is $1,442/week**,
roughly $342/week above the top of the band stated in the same posting. Either the weekly band
excludes commission — in which case the two fields contradict each other — or the $75,000+ is an
outlier projection. It is checkable arithmetic on a single page.

**2. Denver, but the ZIP is Englewood.** The ad says "Denver, CO (Local Candidates Only)" and
"Ability to Commute: **Denver, CO 80110**". 80110 is Englewood (verified against zip-codes.com and
zipdatamaps). Metro-name targeting in a job ad is ordinary, but it is the same Denver error that is
live on the WordPress careers page, the rebuild says Englewood throughout, and `company-facts.md`
flags Denver as an affiliate room rather than Surge's office.

**3. The ad and the site describe different work, and this is the one that matters.** The ad is
"Brand Ambassador | Community Outreach", working "community events and outreach campaigns". The
site lists **door to door first** among the channels. Nothing in the ad is false; the omission is
the issue, and §5 names misleading job ads specifically as a criticism critics cite. An omission is
harder to defend than a claim.

> Worth noting the new FAQ now sits as a partial counterweight: *"Is every role door to door? No.
> Field work is one channel of several"* — the site says doors plainly, immediately under the pay
> answer. The gap that remains is on the ad side.

**Item 30 is not closed by this.** The ad gives real detail for the sales role only. Marketing,
Customer service, Administration and Operations are still the generic descriptions.

### Pre-launch integrity pass + the two check tools made permanent — 2026-09-12

Six files were edited today across two sessions of work, including deleting CSS classes and cutting
a hero CTA. Nothing had checked the site end to end afterwards, so that ran now.

**Result: clean.** 25 shipped pages, no broken internal links, no missing assets, no dead
`#anchors` — including every nav-dropdown target on `/what-we-do/` and `/about/`, which are the
most fragile links on the site because they point into page sections rather than at pages.

**One false positive, worth recording so it is not re-chased.** `/team/` builds its detail-panel
image by string concatenation in JS, so a raw scan reports
`src="/assets/img/people/' + d.photo + '` as a broken asset. The auditor now strips `<script>`
bodies before scanning.

**⚑ One real finding, and it is a person's identity so it is not mine to change.**
Lance Axon's LinkedIn on `/team/` and `/team/lance-axon/` points at
`linkedin.com/in/lance-jozefkowicz-52b16671`. The site calls him Lance Axon; the profile slug is a
different surname. There are ordinary reasons for that and it may be entirely correct — but a
displayed name that does not match the profile it links to is worth one confirmation, because the
failure mode is linking a colleague to the wrong person. Every other social link matches its person
(`cai-silva`, `brandon-long-75b555129`, `mcsharpe`, `paigebennett.3`).

**The tooling problem is fixed rather than complained about again.** Both checks now live in
`deploy/` next to `make-bundle.mjs`, so they survive the scratchpad:

- `deploy/verify-bundle.mjs <dir>` — tag balance, no comments left in shipped output.
- `deploy/audit-links.mjs <dir>` — internal links, assets, anchors; lists external URLs for eyeball.

Both take an **extracted** bundle, not the repo — what ships is what matters. `deploy/DEPLOY.md`
now documents them as a step between building the bundle and uploading it, and also records that
the bundler strips comments.
