// Theme switch checks: Auto follows the device, Light/Dark stick, the email preview stays light, phone cycles. Usage: node theme-test.mjs (local copy on :8787)
import {spawn} from 'node:child_process';
const port=9341,ch=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,'--user-data-dir=/tmp/omthm-'+process.pid,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await sleep(200)}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const w={};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&w[m.id]){w[m.id](m);delete w[m.id]}};
const send=(method,params={})=>new Promise(r=>{const i=++id;w[i]=r;ws.send(JSON.stringify({id:i,method,params}))});const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true})).result.result?.value;
const bg="getComputedStyle(document.body).backgroundColor";let ok=0,t=0;const chk=(n,c)=>{t++;if(c)ok++;else console.log('FAIL',n)};
await send('Page.navigate',{url:'http://127.0.0.1:8787/#/automations'});await sleep(1200);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await sleep(200);
chk('auto light',await ev(bg)==='rgb(255, 255, 255)');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await sleep(200);
chk('auto dark',await ev(bg)==='rgb(14, 17, 22)');
await ev("document.querySelector('[data-t=light]').click()");await sleep(100);chk('forced light',await ev(bg)==='rgb(255, 255, 255)');
await send('Page.reload');await sleep(1200);chk('light sticks after reload',await ev(bg)==='rgb(255, 255, 255)'&&await ev("document.querySelector('[data-t=light]').getAttribute('aria-pressed')")==='true');
await ev("document.querySelector('[data-t=dark]').click()");await sleep(100);chk('forced dark',await ev(bg)==='rgb(14, 17, 22)');
await ev("location.hash='#/edit/free-class/reminder/light'");await sleep(800);chk('email preview stays light',await ev("getComputedStyle(document.querySelector('.em')).backgroundColor")==='rgb(255, 255, 255)');
await ev("document.querySelector('[data-t=auto]').click()");await sleep(100);chk('auto back',await ev("document.documentElement.dataset.theme")===undefined&&await ev("localStorage.getItem('om-theme')")==='auto');
await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);
chk("phone: one theme button, no sideways scroll",await ev("[...document.querySelectorAll('.thm button')].filter(b=>b.offsetParent).length")===1&&await ev("document.documentElement.scrollWidth")<=390);
await ev("[...document.querySelectorAll('.thm button')].find(b=>b.offsetParent).click()");await sleep(100);chk("phone: tap cycles Auto to Light",await ev("document.documentElement.dataset.theme")==="light");
await ev("[...document.querySelectorAll('.thm button')].find(b=>b.offsetParent).click()");await sleep(100);chk("phone: tap cycles Light to Dark",await ev("document.documentElement.dataset.theme")==="dark");
console.log(`theme checks ${ok}/${t}`);ws.close();ch.kill();process.exit(0);
