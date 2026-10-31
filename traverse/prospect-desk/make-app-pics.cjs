// Prospect emails: app pictures instead of the city map (Matthew 30 Oct: "I am not liking the map as much since it feels too pixelated ...
// I think instead we should be just showing the application images"). Three designs x two trades, from the website's real app screenshots
// (marketing-site shots; sample/harness data, owner names hidden), 1120 px wide (crisp at the email's 560), JPEG, into app/m/.
//   node traverse/prospect-desk/make-app-pics.cjs
'use strict';
const path = require('path');
const sharp = require(path.resolve(__dirname, '../../node_modules/sharp'));
const SH = path.resolve(__dirname, '../marketing-site/site/public_html/shots');
const OUT = path.resolve(__dirname, 'app/m');
const BG = { r: 19, g: 41, b: 75 };   /* Traverse navy */
const W = 1120;

/* a screenshot inside a simple device frame: rounded corners, dark bezel, soft shadow */
async function framed(file, { width, height, crop, radius = 36, bezel = 14 }) {
  let img = sharp(path.join(SH, file));
  if (crop) img = img.extract(crop);
  const inner = await img.resize(width - bezel * 2, height - bezel * 2, { fit: 'cover', position: 'top' }).png().toBuffer();
  const r2 = Math.max(4, radius - bezel / 2);
  const mask = Buffer.from(`<svg width="${width - bezel * 2}" height="${height - bezel * 2}"><rect width="100%" height="100%" rx="${r2}" ry="${r2}"/></svg>`);
  const rounded = await sharp(inner).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const frame = Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" rx="${radius}" ry="${radius}" fill="#0b1220"/></svg>`);
  return sharp(frame).composite([{ input: rounded, left: bezel, top: bezel }]).png().toBuffer();
}
const shadow = async (w, h, r) => sharp(Buffer.from(`<svg width="${w + 60}" height="${h + 60}"><filter id="b"><feGaussianBlur stdDeviation="14"/></filter><rect x="30" y="38" width="${w}" height="${h}" rx="${r}" fill="rgba(0,0,0,.45)" filter="url(#b)"/></svg>`)).png().toBuffer();
async function canvas(h, layers) {
  const bg = Buffer.from(`<svg width="${W}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#22426f"/><stop offset="1" stop-color="#13294b"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  return sharp(bg).composite(layers).jpeg({ quality: 82, mozjpeg: true });
}
async function save(img, name) { const f = path.join(OUT, name); const info = await img.toFile(f); console.log(name, info.width + 'x' + info.height, Math.round(info.size / 1024) + ' KB'); }

const PHONE = { roofing: { file: 'phone-door.png', crop: { left: 0, top: 0, width: 780, height: 1540 } }, yards: { file: 'lawn-lot-phone.png', crop: { left: 0, top: 0, width: 390, height: 841 } } };
const DESK = { roofing: { file: 'desk-workspace.png', crop: { left: 0, top: 0, width: 1440, height: 900 } }, yards: { file: 'stats-desktop.png', crop: { left: 0, top: 0, width: 1280, height: 800 } } };

(async () => {
  for (const tr of ['roofing', 'yards']) {
    /* 1. the phone, centred */
    const ph = await framed(PHONE[tr].file, { width: 340, height: 700, crop: PHONE[tr].crop });
    await save(await canvas(780, [{ input: await shadow(340, 700, 36), left: (W - 340) / 2 - 30, top: 40 - 30 }, { input: ph, left: (W - 340) / 2, top: 40 }]), `app-phone-${tr}.jpg`);
    /* 2. the computer, near full width */
    const dk = await framed(DESK[tr].file, { width: 1040, height: 650, crop: DESK[tr].crop, radius: 18, bezel: 10 });
    await save(await canvas(730, [{ input: await shadow(1040, 650, 18), left: 40 - 30, top: 40 - 30 }, { input: dk, left: 40, top: 40 }]), `app-computer-${tr}.jpg`);
    /* 3. both: the computer behind, the phone in front at the right */
    const dk2 = await framed(DESK[tr].file, { width: 900, height: 562, crop: DESK[tr].crop, radius: 18, bezel: 10 });
    const ph2 = await framed(PHONE[tr].file, { width: 270, height: 556, crop: PHONE[tr].crop, radius: 30, bezel: 11 });
    await save(await canvas(700, [
      { input: await shadow(900, 562, 18), left: 40 - 30, top: 40 - 30 }, { input: dk2, left: 40, top: 40 },
      { input: await shadow(270, 556, 30), left: 810 - 30, top: 110 - 30 }, { input: ph2, left: 810, top: 110 },
    ]), `app-both-${tr}.jpg`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
