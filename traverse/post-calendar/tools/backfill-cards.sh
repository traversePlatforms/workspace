#!/bin/bash
# Change photo for the Sixfold cards already on the calendar (19 Nov 2026): gives each upcoming designed draft its card recipe, so Jen's
# "Change photo" button appears on it. Uses the EDITOR sign-in (pc.mjs card): it sets the recipe only; the post's picture, words, date and
# approval stay exactly as they are, and a post whose picture is no longer the card the recipe was built from is refused, not changed.
# Thu 19 Nov (p698c5a0804) is left out on purpose: Matthew handles that one by hand.
#   bash traverse/post-calendar/tools/backfill-cards.sh
set -u
cd "$(dirname "$0")/../../.." || exit 1
N=sixfold/content/november-2026/posts; D=sixfold/content/december-2026/posts; O=sixfold/content/365-social-2026-10/job-photo-posts
while read -r id f; do
  printf '%s %s: ' "$id" "$(basename "$f" .card.json)"
  node traverse/post-calendar/tools/pc.mjs card "$id" "$f" 2>&1 | tail -1
done <<EOF
p32c7e4f30b $N/2026-11-10-jp-real-work.card.json
p9271affb2e $N/2026-11-26-thanksgiving.card.json
pc19baa9d9d $N/2026-11-12-winter-watering.card.json
p881f123c73 $N/2026-11-17-cleanup-followup.card.json
pce03194469 $N/2026-11-24-snow-mold.card.json
p67e1a3ad7d $N/2026-11-19-jp-landscaping.card.json
pa1d00abb55 $O/post-06.card.json
p8647a77958 $O/post-07.card.json
pfe28da70ac $O/post-09.card.json
p3fda7ce986 $D/2026-12-24-christmas.card.json
p20eb76e9e7 $O/post-08.card.json
p8822f921fd $D/2026-12-31-new-year.card.json
p46eb7c1b90 $O/post-02.card.json
p806050493c $O/post-03.card.json
p880768da53 $O/post-04.card.json
pd979151156 $O/post-05.card.json
EOF
