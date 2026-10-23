/* The link-preview picture for the merged Sixfold 365 site (2026-10-23, Matthew: "go ahead and make it from what we have"): what Facebook,
   Messenger, texts and email show under a shared 365aeration.com link. 1200 x 630 (Facebook's size). The lawn photo already on the page,
   the light badge (brand pack PNG, so its lettering does not depend on fonts), the name and the line from the hero.
     node sixfold/site-merged-example/build-share.mjs   ->  share-1200x630.png beside this file */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = join(HERE, '../brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack');
const u = (p) => pathToFileURL(p).href;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url('${u(join(PACK, 'Fonts/Outfit.ttf'))}');font-weight:100 900}
@font-face{font-family:DMSans;src:url('${u(join(PACK, 'Fonts/DMSans.ttf'))}');font-weight:100 900}
*{box-sizing:border-box;margin:0}html,body{width:1200px;height:630px;overflow:hidden;background:#2F5D2C}
.pic{position:absolute;top:0;right:0;width:560px;height:630px;background:url('${u(join(HERE, 'img/hero.png'))}') center/cover}
.fade{position:absolute;top:0;right:440px;width:200px;height:630px;background:linear-gradient(to right,#2F5D2C,rgba(47,93,44,0))}
.left{position:absolute;left:0;top:0;width:700px;height:630px;padding:56px 0 0 64px;color:#FFF8EC}
.badge{width:230px;height:230px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.3))}
h1{font:800 72px/1 Outfit,sans-serif;margin:26px 0 10px;letter-spacing:-.01em}
.sub{font:700 22px/1.2 Outfit,sans-serif;color:#F3A77F;letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px}
p{font:500 26px/1.35 DMSans,sans-serif;color:#E6EEE0;max-width:560px}
.bar{position:absolute;left:0;bottom:0;width:100%;height:10px;background:#E4703A}
</style></head><body>
<div class="pic"></div><div class="fade"></div>
<div class="left"><img class="badge" src="${u(join(PACK, 'Full colour/365-Badge-C-Light.png'))}" alt="">
<h1>Sixfold 365</h1><div class="sub">Land · Aeration &amp; Seeding</div>
<p>Core aeration, overseeding, fertilizing and landscaping all over Colorado.</p></div>
<div class="bar"></div></body></html>`;
const tmp = join(HERE, '.share.html'); writeFileSync(tmp, html);
const out = join(HERE, 'share-1200x630.png');
execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', `--screenshot=${out}`, '--virtual-time-budget=4000', u(tmp)], { stdio: 'ignore' });
console.log(out);
