# Sixfold 365 job-photo ledger

Started 2026-10-27, after Matthew asked: "If we need to reserve some photos for contents make sure we do that as well."

**What this is.** A list of which of Brad's job photos are reserved, used or still free. Check it before picking photos for a Saturday photo day, so the photo days never take a shot meant for a designed post.

**How photos are named.** By job date and file name only. The files sit in `sixfold/brand/job-photos/<job date> <address>/`. That folder is gitignored and copied nightly, and street addresses stay out of this file.

**The rules:**
- **Designed posts get first pick.** A photo marked **reserved** isn't used anywhere else until its post has gone out.
- **Photo days take only free photos.** These are the Saturday posts: a Facebook album with captions, and an Instagram carousel.
- **Every photo is checked before use.** No readable plate, no house number, no face, nothing that gives away the address. Location data is removed before upload. Permission is asked at the job.

## Reserved: designed Tue/Thu posts not yet posted

| Post | Job date | File |
|---|---|---|
| 02 | 2026-10-16 | 2026-10-22 18.36 d06d9f45.jpg |
| 03 | 2026-10-23 | 2026-10-23 15.01 4fdcbf09.jpg (also on the Facebook page's photos, added 27 Oct before this ledger) |
| 04 | 2026-10-16 | 2026-10-22 18.37 3ef548c7.jpg |
| 05 | 2026-10-26 | 2026-10-26 14.28 c0082e28.jpg |
| 06 | 2026-10-20 | 2026-10-22 18.41 d104b7bc.jpg |
| 07 | 2026-10-20 | 2026-10-22 18.40 2e127622.jpg |
| 08 | 2026-10-16 | 2026-10-23 14.59 e190227b.jpg |
| 09 | 2026-10-12 | 2026-10-23 14.59 6a967a66.jpg |

## Used

| Where | When | Job date | File |
|---|---|---|---|
| Post 01, Facebook and Instagram | 2026-10-27 | 2026-10-16 | 2026-10-22 18.37 deb5ae90.jpg |
| Facebook page photos (no captions yet) | 2026-10-27 | 2026-10-16 | 2026-10-22 18.38 1536d416.jpg |
| Facebook page photos | 2026-10-27 | 2026-10-16 | 2026-10-22 18.38 91976771.jpg |
| Facebook page photos | 2026-10-27 | 2026-10-16 | 2026-10-22 18.36 b4e149c0.jpg |
| Facebook page photos | 2026-10-27 | 2026-10-16 | 2026-10-22 18.37 deb5ae90.jpg |
| Facebook page photos | 2026-10-27 | 2026-10-23 | 2026-10-23 15.01 4fdcbf09.jpg |
| Facebook page photos | 2026-10-27 | 2026-10-23 | 2026-10-23 15.01 50524ed6.jpg |
| Instagram carousel (queued for Sat 31 Oct, 2 pm) | 2026-10-31 | 2026-10-16 | 2026-10-22 18.38 91976771.jpg |
| Instagram carousel | 2026-10-31 | 2026-10-16 | 2026-10-22 18.38 1536d416.jpg |
| Instagram carousel | 2026-10-31 | 2026-10-16 | 2026-10-22 18.36 b4e149c0.jpg |
| Instagram carousel | 2026-10-31 | 2026-10-23 | 2026-10-23 15.01 50524ed6.jpg |
| Instagram carousel | 2026-10-31 | 2026-10-23 | 2026-10-23 15.01 6ba4e4d3.jpg |
| Instagram carousel | 2026-10-31 | 2026-10-16 | 2026-10-22 18.38 8d834d58.jpg |

## Not to use

- **Readable license plates.** Several driveway shots have trucks or cars in them.
- **Close views of house fronts** where a number might show, and **a street sign** (the 26 Oct corner lot).
- **Brown or patchy before-shots.** Keep them for a before/after post.
- **The striped lawns by the road** (16 Oct). They may be artificial turf, so check with Brad first.

## How it runs

- **Photo pull:** new photos come in nightly from the app (overnight check, step 6, `traverse/ops/pull-job-photos.sh`) into `sixfold/brand/job-photos/`, grouped by job.
- **Publishing:** approved posts go out from the server queue, `sixfold-private/social-queue.json`. `sixfold-tools/social-queue.php` runs every 5 minutes, started by the Facebook lead job.
- **Approval:** nothing goes out without Matthew's go for that post.
