# Fact-check log: 365 posts, 15-31 December 2026

Built 16 Nov 2026. Covers the 2 new cards and 2 new photo sets ([posts.md](posts.md)), and the 4 October drafts moved onto December dates. The 12 Dec photo set was built earlier and is not covered here.

## Verified

**Dates**
- Christmas 2026 falls on Friday 25 Dec, so the Thu 24 Dec slot is Christmas Eve. The card says "Merry Christmas" and doesn't say "today".
- Thu 31 Dec is New Year's Eve.

**Holiday captions**
- "Customers who had us out this year" / "in 2026": the job-photo folders on the Sixfold shared drive run September to November 2026, and the job records show paid jobs in 2026.
- "See you in the spring" (New Year): CSU Extension PlantTalk 1505, *Lawn Aeration*, names spring and fall as the best times to core aerate. This was already the source for the November "plan ahead" post. The caption promises no date, slot or price.

**Contact line and hashtags**
- (720) 830-4553 is the 365 number on 365aeration.com (fetched 16 Nov 2026) and in jen-style.md.
- The Facebook and Instagram contact lines are word for word from jen-style.md.
- Instagram ends with exactly `#coloradolawn #lawncare #frontrange`.

**19 Dec landscaping set**
- All three photos are from the job's *After* folder, taken at Kara's job on 17 Sep 2026.
- Memory notes `sixfold-landscaping-standalone` and the customer notes say that job was landscaping only, a clean-up.
- The job's *Content* photos show a shrub pulled out of a rock bed and debris raked and hauled. So "bed clean-up and plant removal" describes work done there.
- 365aeration.com (fetched 16 Nov 2026) lists the landscaping service as "Shrub and hedge trimming, plants and trees taken out, bed clean-up and haul-away".
- "No aeration booking needed" is Matthew's standing rule that landscaping is its own service, never the after-job. The 19 Nov landscaping post used the same wording.

**26 Dec lawn set**
- "Two of this year's jobs" is accurate:
  - Woodland Park, 4 Nov 2026 (1 photo)
  - Kara's job, 17 Sep 2026 (2 photos)
- "Every lawn gets its own quote": standing 365 rule (no flat aeration rate), as in the November posts.

**The 4 moved drafts (words unchanged)**
- Each was fact-checked when written on 26 Oct, in `../365-social-2026-10/job-photo-posts/post-06..09-caption-draft.md`.
- I rechecked them for December:
  - **Thin lawn? Check the soil** (post 06): CSU compaction facts. Not seasonal.
  - **Before you rip it out** (post 07): our own offer only. Not seasonal.
  - **Front lawns to acreage** (post 09): our own quoting. Not seasonal.
  - **What to expect when we come** (post 08): every line was checked against the live 365 agreement terms in `traverse/app/api/rounds.php`, terms t2 to t5:
    - sprinklers, shallow pipes and invisible dog fences
    - gates unlocked, pets inside
    - weather or frozen, waterlogged or very dry ground moves the day
    - 24 hours' notice to reschedule

    All still match. The frozen-ground line reads correctly in December.
- No fact was wrong for December, so no words were changed.

**Photos**
- Every candidate photo was looked at in full: 72 unused October and November job photos, plus Kara's 62 Before, After and Content photos and her 56 WhatsApp copies.
- On the six chosen crops there is:
  - no readable house number, street sign or plate
  - no face or person (the photographer's shadow on IMG_8207 was cropped out)
  - no other company's branding
  - no glare
- Fall colour is cropped out. The 4 Nov photo lost two yellow aspens and a yield sign. No snow.
- Re-saved by sharp at 1440 x 1080: metadata check shows no EXIF, XMP or ICC on all six.
- **Not used before** in any build script, manifest, `loaded.jsonl` or the photo ledger. The ledger records file names, so I matched the 12 Dec set to its sources by image comparison:
  - 4 Nov 876f0343 and 240d7116
  - 28 Oct 6c8824f2
  - 30 Oct 52135127 (cropped)

  Those four were excluded. Kara's IMG_0198 and IMG_0215, used as November card bands, were excluded too.

## Corrected

- Dropped the town names from the 26 Dec caption ("from Woodland Park to Colorado Springs"). The job records give Kara's place as Colorado Springs in one folder and Monument in another. Where the sources disagree and neither is authoritative, the detail is left out.
- Dropped IMG_8211 from the landscaping set. A small yellow flag with a logo sits in the bed, possibly another company's marker.
- The cards and photo-set captions use the current jen-style contact line. The four moved October drafts still end "Text or call (720) 830-4553 for a quote." Their words were left alone on purpose (see Unresolved).

## Unresolved

- **Kara's photos and consent.** Permission for job photos is asked at the job. Her September photos already appear as two card bands on drafts on the calendar, and five more of her photos are used here. Kara is no longer a monthly customer. If anyone has doubts about her consent, swap these sets.
- **Five of the six photos come from one property** (Kara's). That is because the clean pool is used up. The rest of the October and November photos are brown before-shots, fall leaves, plates, house numbers, people, a map screenshot or Halloween decorations. **January photo sets need new job photos.**
- **Tree work stays out.** The pines at Kara's job were limbed up. Colorado Springs licenses paid pruning of trees 15 ft and up, and Sixfold holds no such licence (memory `colorado-springs-tree-licence`). So photos showing fresh cuts were not picked, and no caption mentions tree work.
- **The four moved drafts keep the older contact line** ("Text or call ... for a quote") and their October hashtags. jen-style now asks for "Message us here, or text a picture of your lawn..." and `#coloradolawn #lawncare #frontrange`. The brief was to change their words only if a fact was wrong for December, and none was. Jen can ask for the newer line.
- **People in the moved drafts' pictures.**
  - Post 08 (What to expect) shows a crew member from above, face not visible.
  - Post 09 (Front lawns to acreage) shows two small figures in a drone shot.
  - Both pictures were made and reviewed in October, before the jen-style "no people" wording. Flagged for Jen.
