# Horizon socials on phone and tablet (checked 2026-10-28)

Matthew, 28 Oct: "also review how the socials and websites are function on phone and tablet."

Method: headless Chrome emulating an iPhone (390 × 844, iOS Safari user agent, touch) and an iPad Air portrait (820 × 1180), logged out, the way a job seeker clicking a link without the app sees it. Script: scratchpad hop-social/devices.mjs. Evidence: `<platform>-<phone|tablet>-first-screen.png`, `-scrolled.png`, `.txt`, and devices-summary.json in this folder. Nothing was tapped, logged into or followed.

## What we measured

| Account | Phone (390) | Tablet (820) |
|---|---|---|
| Instagram @horizonhopeinc | A "See full profile in the app" pop-up covers the profile. The bio is cut off at "Helping clients by building scalable sales systems that gen…" and the website link is under the pop-up. | Profile, full bio, website link and post grid all show. Header has Log In / Sign Up only. |
| Facebook (id 61590111627482) | A "See more from Horizon Outreach Partners and Events" log-in pop-up covers the page. Website, phone and email show underneath. | A log-in pop-up again. The URL redirects to /people/Horizon-Outreach-Partners-and-Events/… because the page has no username. |
| X @Horizon_opsales | A "Get the full app experience" pop-up. The 27 Oct hiring post shows under it, and its /apply link can be tapped. | An open-app pop-up. The profile shows. |
| LinkedIn /company/horizon-outreach-partners | A "Sign in to see who you already know" pop-up. Industry, size and website show underneath. | **Sent straight to LinkedIn's sign-in wall (/authwall)**: none of the page shows. |

No account scrolls sideways on either device: page width equals screen width on all 8 views.

## Findings

1. **On a phone, every platform puts a log-in or open-the-app pop-up over the profile.** That is how Instagram, Facebook, X and LinkedIn treat logged-out phone visitors, so it is not Horizon's doing. It matters for recruiting because many applicants arrive from Indeed or Google on a phone. **The website, not social, has to carry the hiring facts and the apply button.**
2. **The Instagram bio speaks to clients, and on a phone it is cut off mid-sentence.** A job seeker sees "Helping clients by building scalable sales systems that gen…" with no sign of hiring. Fix: a bio that leads with "Now hiring in Charlotte", with the link going to the apply page.
3. **The "We Are HIRING" tile prints the apply URL inside the picture,** where nobody can tap it. In the grid the URL runs off both edges of the tile ("https://horizonoutreachpartners.com/apply/" is clipped at left and right on the tablet view). Fix: put the link in the bio and as a link sticker on a Story highlight called "Apply", and keep text inside the image's safe area.
4. **Several post designs don't fit Instagram's portrait grid.** The "Continuous Improvement" tile shows clipped text at the top left ("ce the / of / uous / vement") and a cut-off "horizonoutreachpartn…" at the bottom. On the photo posts, the corner logo is cut in half at the right edge ("H O"). Fix: design at 1080 × 1350 and keep logos and text away from the edges.
5. **On phone avatars the logo's "HORIZON" lettering is small and wide-spaced,** so it is hard to read at profile-picture size. On Facebook the "f" badge covers the final "N". Fix: an avatar version with the skyline only, or larger letters.
6. **LinkedIn shows nothing to a logged-out tablet visitor, and the website links LinkedIn by number,** which also hits the sign-in wall on desktop (social findings). Fix: link the /company/horizon-outreach-partners address and lead with Instagram and the website.
7. **Right:** the hiring tweet's /apply link works and can be tapped on phone. The website, phone and email show on the Facebook page under the pop-up. No account scrolls sideways.

## Fact-check log

| Claim | Evidence | Viewed | Result |
|---|---|---|---|
| Pop-ups on all four platforms on phone | *-phone-first-screen.png; devices-summary.json `dialogs` | 2026-10-28 | Verified |
| IG bio cut off on phone | instagram-phone-first-screen.png | 2026-10-28 | Verified |
| IG grid: apply URL clipped, tile text clipped, corner logo cut | instagram-tablet-first-screen.png | 2026-10-28 | Verified (as rendered in the grid; the full posts were not opened) |
| FB redirect to /people/ URL | facebook-tablet.txt `final` | 2026-10-28 | Verified |
| LinkedIn tablet sent to /authwall | linkedin-tablet.txt `final` | 2026-10-28 | Verified |
| No sideways scroll | devices-summary.json `sw` = `vw` | 2026-10-28 | Verified |
| Pop-ups are platform behaviour, not Horizon's | same pop-ups on every account; general knowledge of these platforms | 2026-10-28 | Inferred |
