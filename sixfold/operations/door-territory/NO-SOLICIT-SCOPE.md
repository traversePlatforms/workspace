# "No soliciting" in the rounds app — scope

**Matthew's idea, 2026-10-01:** *"Maybe we should add a no solicitation option to the
neighborhoods so that teams can mark it as such and others can avoid those areas."*

Good, and the data model takes it cleanly. **But it covers two of three levels, and the one it
cannot cover is the one that produces a fine.** Written up before building so the gap is not
discovered in the field.

---

## ⚑ Three levels, and only two of them are an app problem

| Level | What it is | Fixed by the app? |
|---|---|---|
| **The door** | A "No Soliciting" sign on one house | **Yes** — and this is the valuable half |
| **The neighbourhood** | An HOA or gated community posting it at the entrance | **Yes** — Matthew's ask |
| **The jurisdiction** | A city requiring a **permit per canvasser** | **No. Not ever.** |

**The third one is the one that can produce a fine**, and no amount of marking neighbourhoods
avoids it. If Monument requires a canvassing permit, the crew needs that permit on **every
street in Monument** — the app cannot research its way around a municipal ordinance.
**SX-9f(2) still has to be answered by a phone call**, for Monument, Colorado Springs and
unincorporated El Paso separately.

**Do not let shipping this feature feel like SX-9f is closed.** It is not.

---

## Door-level — the half that matters most

A "No Soliciting" sign is **per house**, the crew sees it standing at the door, and in some
jurisdictions ignoring one is trespass rather than bad manners. This is the level where a
mark is both most accurate and most protective.

**The change is contained.** Door outcomes today are `booked | later | miss`, in an
append-only marks log, validated server-side in exactly one place.

| File | Change |
|---|---|
| `api/rounds.php` ~line 293 | add `nosolicit` to the allowed outcome list |
| `api/rounds.php` ~line 255 | count it as **done**, not as a no-answer — the door is finished, permanently |
| `api/rounds.php` ~line 332/339 | add it to the scoreboard totals so it is not silently dropped |
| `summit-de59ae83/index.html` | a fourth button, and the door leaves the list the way a done door does |
| CSV export | automatic — it already writes `$m['outcome']` |

**It must behave differently from the other three in one respect: it never comes back.**
*Not now* is a door to revisit next season. *No answer* returns the same afternoon.
**No soliciting is permanent**, and the UI should not offer an easy undo on it.

### ⚑ The risk worth designing around: a rebuild can orphan the flag

Marks survive a rebuild because a door's id is a slug of its address. **But a door that drops
out of a rebuild leaves its mark orphaned**, and the report already ignores orphaned marks.

For a *not now* that is harmless. **For a no-soliciting flag it is a protection quietly
disappearing** — the door returns to the walk list and someone knocks it again. Widening the
data is safe; narrowing it is not. **SX-9d widens, so this is safe today**, but the flag should
either be stored outside the ordinary marks log or be explicitly exempted from the
orphan-pruning rule.

---

## Neighbourhood-level — Matthew's ask

A flag on the neighbourhood, settable by any crew member, **visible before anyone drives out**
rather than after. The neighbourhood card already shows counts; this adds a state to it.

**Two questions to settle when building:**

1. **Does flagging a neighbourhood hide it, or warn on it?** Hiding is cleaner but destroys
   information; warning keeps the doors visible with the reason attached. **Warn, probably** —
   an HOA posting at the entrance does not always mean every door is off limits, and a crew
   that can see the warning can make the call.
2. **Who can clear it?** If any crew code can set it, any crew code can unset it, and a wrong
   flag quietly removes a whole neighbourhood from the programme. **Admin-only to clear** is
   the safer split, and the app already separates admin from crew.

---

## Not built. Deferred deliberately

Scoped 2026-10-01, not built — the rounds app is **live and in use**, so a change means code,
upload, and a cache flush, which is the expensive path. **Build it on a fresh day**, and
re-read [DEPLOY-ROUNDS.md](../../site/summit-de59ae83/DEPLOY-ROUNDS.md): flush first, then
compare the plain URL against a busted one, because a cache-busted check alone is a false pass.
