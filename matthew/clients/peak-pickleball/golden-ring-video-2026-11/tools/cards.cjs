// cards.cjs: renders each text card as a 1080x1920 transparent PNG with headless Chrome
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const dir = path.join(__dirname, '..', 'text');
const gold = `background:linear-gradient(180deg,#fff6d6 0%,#f5d27a 30%,#d4a23a 55%,#f7dc8c 75%,#b8862b 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(240,190,80,.55)) drop-shadow(0 6px 10px rgba(0,0,0,.9));`;
const css = `@font-face{font-family:M;src:url(file://${process.env.HOME}/.local/share/fonts/gr/Montserrat-Black.ttf);font-weight:900}
@font-face{font-family:M;src:url(file://${process.env.HOME}/.local/share/fonts/gr/Montserrat-ExtraBold.ttf);font-weight:800}
html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
.w{position:absolute;left:0;right:0;text-align:center;font-family:M;font-weight:900;text-transform:uppercase}
.l{display:block;${gold}}`;
const card = (name, top, lines, size, track = 4) => {
  const body = `<div class="w" style="top:${top}px">${lines.map((t, i) => `<span class="l" style="font-size:${Array.isArray(size) ? size[i] : size}px;letter-spacing:${track}px;line-height:1.08">${t}</span>`).join('')}</div>`;
  write(name, body);
};
const write = (name, body) => {
  const f = path.join(dir, name + '.html');
  fs.writeFileSync(f, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  execFileSync('google-chrome', ['--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', '--window-size=1080,1920', `--screenshot=${path.join(dir, name + '.png')}`, 'file://' + f], { stdio: 'ignore' });
};
card('t1', 1230, ['The ring is', 'everything.'], [84, 118]);
card('t2', 1230, ['Everything is', 'on the line.'], [84, 112]);
card('t4', 1230, ['One ring.', 'One champion.'], [112, 96]);
card('t5', 1230, ['The road to the ring', 'starts here.'], [70, 112]);
// end card: the official logo with the date and the call to action under it
write('end', `<img src="file://${dir}/logo.png" style="position:absolute;left:115px;top:330px;width:850px">
<div class="w" style="top:1150px"><span class="l" style="font-size:74px;letter-spacing:3px">January 15–17, 2027</span>
<span style="display:inline-block;margin-top:44px;padding:22px 64px;border:4px solid #e7c069;border-radius:60px;font-size:54px;letter-spacing:6px;color:#fff;font-weight:800;box-shadow:0 0 30px rgba(231,192,105,.45)">Register now</span></div>`);
console.log('cards done');
