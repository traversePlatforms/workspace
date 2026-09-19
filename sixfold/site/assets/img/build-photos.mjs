/* Sixfold site — photo pipeline.

   Takes the chosen originals off the Desktop, corrects orientation, crops to a
   sensible aspect, and writes a webp + a jpg fallback into this folder. Run it
   again and it re-derives everything; the originals are never modified.

     node sixfold/site/assets/img/build-photos.mjs

   WHY A SCRIPT. The originals are 2-5 MB iPhone frames sitting in a Desktop
   folder that is not in the repo and not backed up by git. This records exactly
   which frame became which web asset, so the selection survives the folder being
   tidied — and so a re-crop is an edit here, not a hunt.

   WHAT IS DELIBERATELY NOT SELECTED. The Kara set is a real customer's property
   and a lot of it shows an identifiable house from the road. Everything chosen
   below shows the WORK — a crew member, a cut, a bed, material — and not a
   recognisable frontage. That is the safe default; widening it is the customer's
   call to give, not ours to assume. See PHOTOS.md.

   No video. Several originals are Live Photos with a .MOV beside them; only the
   still is used.
*/
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESK = 'C:/Users/Surge Inc/Desktop';
const UPLOAD = join(DESK, 'New work photos/Photos to upload content');
const KARA = join(DESK, 'kara photo dump');

/* out, source, aspect, note. `fit: cover` with the given aspect; `pos` steers
   the crop when the subject is not centred. */
const PHOTOS = [
  // ---- fire mitigation / clearing ----
  { out: 'crew-felling',    src: join(UPLOAD, 'IMG_4617.jpg'),   ar: 3 / 2, pos: 'centre',
    note: 'Two of the crew working a tree with a rope. The best crew-at-work frame in any folder.' },
  { out: 'chipper',         src: join(UPLOAD, 'IMG_5560.JPEG'),  ar: 3 / 2, pos: 'centre',
    note: 'Chipper beside a slash pile — the machine that defines the trade.' },
  { out: 'haul-truck',      src: join(UPLOAD, 'IMG_5558.JPEG'),  ar: 3 / 2, pos: 'centre',
    note: 'Truck bed loaded with slash. This is what "hauled off site" looks like.' },
  { out: 'rounds',          src: join(UPLOAD, 'IMG_5557.JPEG'),  ar: 3 / 2, pos: 'centre',
    note: 'Cut rounds. Texture shot — reads well small.' },
  { out: 'stand',           src: join(UPLOAD, 'IMG_4615.jpg'),   ar: 3 / 2, pos: 'centre',
    note: 'A worked pine stand, one of the crew in frame for scale.' },
  { out: 'slash-line',      src: join(UPLOAD, 'IMG_5530.JPEG'),  ar: 21 / 9, pos: 'centre',
    note: 'Wide slash line across cleared ground. The only frame that works as a banner.' },

  // ---- landscaping (Kara job) ----
  { out: 'trimming',        src: join(KARA, '22.jpeg'),          ar: 3 / 2, pos: 'centre',
    note: 'Crew member in a hard hat cutting at the base of a pine. No property in frame.' },
  { out: 'limbing',         src: join(KARA, '0.jpeg'),           ar: 3 / 2, pos: 'centre',
    note: 'Working a tree base, close. No property in frame.' },
  { out: 'beds',            src: join(KARA, 'WhatsApp Image 2026-09-17 at 5.55.17 PM (5).jpeg'), ar: 3 / 2, pos: 'centre',
    note: 'Gravel bed with plantings and grasses — the landscaping end of the work.' },
];

/* Per-photo width. The cards render about 480px wide, so 1000 is a 2x asset and
   the first pass at 1400 was 3x of nothing. Only the banner needs to span the
   page. Foliage is genuinely hard to compress and these land around 120-190KB,
   which is where detailed greenery sits at this size — pushing quality lower
   starts to mush the needles into porridge. */
const WIDE = 1600, CARD = 1000;

if (!existsSync(HERE)) mkdirSync(HERE, { recursive: true });

let done = 0, skipped = 0, bytes = 0;
for (const p of PHOTOS) {
  if (!existsSync(p.src)) { console.error('MISSING  ' + p.out + '  <- ' + p.src); skipped++; continue; }
  const W = p.ar > 2 ? WIDE : CARD;
  const h = Math.round(W / p.ar);
  const base = sharp(p.src).rotate().resize(W, h, { fit: 'cover', position: p.pos });
  const wp = await base.clone().webp({ quality: 72 }).toBuffer();
  const jp = await base.clone().jpeg({ quality: 76, mozjpeg: true }).toBuffer();
  await sharp(wp).toFile(join(HERE, p.out + '.webp'));
  await sharp(jp).toFile(join(HERE, p.out + '.jpg'));
  bytes += wp.length;
  console.log(`${p.out.padEnd(14)} ${W}x${h}   webp ${String(Math.round(wp.length / 1024)).padStart(4)}KB   jpg ${String(Math.round(jp.length / 1024)).padStart(4)}KB`);
  done++;
}
console.log(`\n${done} photos written, ${skipped} missing. Cards ${CARD}px, banner ${WIDE}px.`);
console.log(`webp total ${(bytes / 1024 / 1024).toFixed(2)} MB — that is the number that matters; the jpgs only serve browsers that cannot take webp.`);
