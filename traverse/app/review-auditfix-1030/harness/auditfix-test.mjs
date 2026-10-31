/* The 30 Oct audit fixes, in the page and the API, edition and Sixfold mode: 1 the ClickUp check is Sixfold's only; 2 the aerial photos' new
   mosaic ids and the message instead of grey; 3 the trade's units and the House lookup line; 4 no people in the built editions; 5 the update bar
   at the bottom with a close; 6 Hail's link-buttons spaced; 7 Customers asks for backups as the admin only; 8 a manager not on a team is told
   without a 403; 9 Setup on the computer's home; 10 At the property on the editions' Stats; 11 Setup > Email's quick way on phone and desktop.
   Each step stands alone (a failed wait is one FAIL, the rest still run). Throwaway harness codes only, never printed.
   Usage: SHOT_TAG=after node auditfix-test.mjs [edition|sixfold|both] */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DIR, ORIGIN, R, t, call, signin, mode, browser, sleep, jars } from './lib1030.mjs';
const TAG = process.env.SHOT_TAG || 'after', WHICH = process.argv[2] || 'both';
const PAGE = DIR + '/www/summit-de59ae83/index.html', COF = DIR + '/sixfold-data/rounds/company.json';
const DIST = 'C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-ac2f5f575c12bc49b/traverse/editions/dist/public_html';
const U = String(Date.now()).slice(-6).replace(/\d/g, (c) => 'abcdefghij'[c]);
const agree = async (who, s) => { if (s && s.terms && s.terms.due) await call(who, 'termsaccept', null, { terms: s.terms.terms, agreement: s.terms.agreement || '' }); };
const step = async (label, fn) => { try { await fn(); } catch (e) { t(false, label + ': ' + (e && e.message)); } };
const B = await browser(8987);
const tileClick = (txt) => B.js(`(()=>{const e=[...document.querySelectorAll('button.tile')].find(x=>{const b=x.querySelector('.tt b');return b&&b.textContent.trim()===${JSON.stringify(txt)}});if(e){e.click();return true}return false})()`);
const openGroup = (key) => B.js(`(()=>{const b=document.querySelector('button.ogrp[data-group=${JSON.stringify(key)}]');if(b&&b.getAttribute('aria-expanded')!=='true'){b.click();return 'opened'}return b?'open':'none'})()`);
const home = async (who, w = 390, h = 844) => { await B.openAs(who, w, h); await B.waitFor(`!!document.querySelector('.choose, .ohome, .dhome')`, who + ' home'); };
async function run(M) {
  const ED = M === 'edition';
  console.log('== ' + M + ' mode');
  mode(M); if (ED) execFileSync('node', [DIR + '/preaccept.cjs']);
  const A = await signin('admin', '222222'); await agree('admin', A); t(A.ok && A.role === 'admin', 'the admin signs in');
  let L = {};
  await step('1 leads', async () => {
    L = await call('admin', 'leads');
    t(L.ok && (ED ? !('cucheck' in L) : 'cucheck' in L), ED ? '1 edition: the leads answer carries no cucheck' : '1 Sixfold: the leads answer still carries cucheck');
    const ok1 = await call('admin', 'cucheckok', null, { key: 'app:nothing' });
    t(ED ? ok1._status === 403 : ok1._status !== 403, ED ? '1 edition: Leave it (cucheckok) is refused' : '1 Sixfold: Leave it (cucheckok) still answers');
  });
  await step('3/10 api', async () => {
    if (ED) {
      const P = await call('admin', 'prc');
      const u = Object.keys(P.units || {}), all = Object.keys(P.unitsAll || {});
      t(P.ok && u.includes('roofsq') && u.includes('roofft') && u.includes('flat') && !u.includes('lawn') && !u.includes('kw') && !u.includes('lawnft'), '3 edition (roofing): the units offered are the roof\u2019s, none of the lawn or solar (' + u.join(', ') + ')');
      t(all.includes('lawn') && all.includes('kw'), '3 edition: every unit\u2019s words still come along (unitsAll) for older lines');
      const S1 = await call('admin', 'statspage');
      const door = (S1.sources || []).find((s) => s.key === 'door');
      t(S1.ok && door && door.label === 'At the property', '10 edition: the Stats page\u2019s source reads "At the property" (' + (door && door.label) + ')');
    } else {
      const S1 = await call('admin', 'statspage'); t(S1.ok && !JSON.stringify(S1).includes('At the property'), '10 Sixfold: its Stats keep their words (no "At the property")');
    }
  });
  await step('3 lookup tile', async () => {
    await home('admin');
    const look = await B.js(`[...document.querySelectorAll('button.tile')].map(x=>x.textContent).find(x=>/Type an address:/.test(x))||''`);
    t(ED ? /the roof, the lot/.test(look) : /the lawn, the lot/.test(look), '3 ' + M + ': House lookup says "' + (look.match(/Type an address: [^]*?and what to ask/) || [''])[0] + '"');
  });
  await step('5 update bar', async () => {
    await sleep(7000);   /* the version check runs 4 s in and remembers the page's tag */
    const src = readFileSync(PAGE, 'utf8');
    writeFileSync(PAGE, src + '\n<!-- changed under the open app -->\n');
    try {
      await B.js(`document.dispatchEvent(new Event('visibilitychange'))`);
      await B.waitFor(`!!document.getElementById('updbar')`, 'update bar', 12000);
      const pos = await B.js(`(()=>{const b=document.getElementById('updbar').getBoundingClientRect(),h=document.getElementById('hdr');const hr=h&&!h.hidden?h.getBoundingClientRect():null;return {top:b.top,bottom:b.bottom,hdrBottom:hr?hr.bottom:null,win:innerHeight,x:!!document.querySelector('#updbar .updx')}})()`);
      t(pos.x && (pos.hdrBottom === null || pos.top >= pos.hdrBottom) && pos.bottom > pos.win / 2, '5 ' + M + ': the update bar sits low (top ' + Math.round(pos.top) + ' of ' + pos.win + '), under the top bar, with a close');
      await B.shot(`${TAG}-${M}-01-update-bar-phone`);
      if (ED) { await sleep(21000); t(!(await B.js(`!!document.getElementById('updbar')`)), '5 edition: the bar is gone by itself after 20 seconds'); }
      else { await B.js(`(()=>{const x=document.querySelector('#updbar .updx');if(x)x.click();return 1})()`); t(!(await B.js(`!!document.getElementById('updbar')`)), '5 Sixfold: the close takes it away'); }
    } finally { writeFileSync(PAGE, src); }
  });
  await step('1 pipeline', async () => {
    await home('admin');
    await openGroup('office'); await openGroup('sales'); await tileClick('Pipeline');
    await B.waitFor(`!!document.querySelector('.p2list, .door.lead, .pipe2, .msg')`, 'pipeline');
    await sleep(1500);
    const cu = await B.js(`!!document.querySelector('.cucheck')`);
    t(ED ? !cu : (cu || !(L.cucheck && L.cucheck.items && L.cucheck.items.length)), ED ? '1 edition: no "ClickUp and the app" box in the Pipeline' : '1 Sixfold: the box still shows in its Pipeline' + (cu ? '' : ' (nothing to look at in the harness)'));
    await B.shot(`${TAG}-${M}-02-pipeline-phone`);
  });
  if (ED) {
    await step('6 hail', async () => {
      /* the harness company hides the hail card: switched on for this step, put back after */
      const co0 = readFileSync(COF, 'utf8'); const co1 = JSON.parse(co0); co1.card = Object.assign({}, co1.card, { hail: true, roof: true }); writeFileSync(COF, JSON.stringify(co1));
      try {
        await home('admin'); await sleep(1500); await home('admin');   /* the fresh company lands on the second open */
        await openGroup('office'); await openGroup('storms'); t(await tileClick('Hail'), '6 edition: the Hail tile is on the home');
        await B.waitFor(`!!document.querySelector('.hailc') || /No hail file|No storms/.test(document.body.innerText)`, 'hail list');
        const gap = await B.js(`(()=>{const c=document.querySelector('.hailc');if(!c)return null;const l=[...c.querySelectorAll('button.lnk')];if(l.length<2)return {one:true};const a=l[0].getBoundingClientRect(),b=l[1].getBoundingClientRect();const lr=[...document.querySelectorAll('button.back')].filter(x=>/Live radar map|Storm call list/.test(x.textContent));const g2=lr.length===2?lr[1].getBoundingClientRect().left-lr[0].getBoundingClientRect().right:null;return {gap:b.left-a.right,sameRow:Math.abs(a.top-b.top)<4,g2}})()`);
        t(gap && (gap.one || !gap.sameRow || gap.gap >= 12) && (gap.g2 === null || gap.g2 >= 12 || gap.g2 < 0), '6 edition: Hail\u2019s link-buttons are apart (' + JSON.stringify(gap) + ')');
        await B.shot(`${TAG}-${M}-03-hail-phone`);
      } finally { writeFileSync(COF, co0); }
    });
    await step('2 photos', async () => {
      await home('admin');
      B.on['Fetch.requestPaused'] = (p) => B.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }).catch(() => {});
      await B.send('Fetch.enable', { patterns: [{ urlPattern: '*planetarycomputer*', requestStage: 'Request' }] });
      try {
        await openGroup('office'); await openGroup('setup'); await tileClick('Sample property');
        await B.waitFor(`!!document.querySelector('.door') && !!document.querySelector('#dock button')`, 'sample property');
        await B.js(`(()=>{const b=[...document.querySelectorAll('#dock button')].find(x=>/Map/.test(x.textContent));if(b){b.click();return 1}return 0})()`);
        await B.waitFor(`!!document.querySelector('.leaflet-container .mapsw')`, 'map with the look switch');
        await B.js(`(()=>{const b=document.querySelector('.mapsw button[data-m="1"]');if(b)b.click();return 1})()`);
        let note = null; try { await B.waitFor(`!!document.querySelector('.satnote')`, 'the photos note', 20000); note = await B.js(`document.querySelector('.satnote').textContent`); } catch {}
        t(!!note && /street map/.test(note), '2 edition: when the photos fail the map says so: "' + note + '"');
        await B.shot(`${TAG}-${M}-04-photo-note-phone`);
      } finally { await B.send('Fetch.disable'); delete B.on['Fetch.requestPaused']; }
      const page = readFileSync(PAGE, 'utf8');
      t(/pc1\\\.\\d\{6,14\}\\\.\[a-f0-9\]\{8,64\}/.test(page) && page.includes("'fe04cec383767467e9a31d04fab20050'"), '2: the register\u2019s pc1 ids are accepted and the 9 Oct fallback is kept');
    });
    await step('11 setup email phone', async () => {
      await home('admin');
      await openGroup('office'); const g = await openGroup('setup'); t(g === 'opened' || g === 'open', '11 edition: the home\u2019s Setup group opens (' + g + ')');
      t(await tileClick('Setup checklist'), '11 edition: the Setup checklist tile is there');
      await B.waitFor(`!!document.querySelector('.kitstep')`, 'setup checklist');
      const step1 = await B.js(`(()=>{const r=document.querySelector('.kitstep[data-k="email"]');return r?{cls:r.className,tag:r.tagName,label:r.querySelector('b').textContent}:null})()`);
      t(step1 && step1.label === 'Your email' && /\bkitstep\b/.test(step1.cls), '11 edition: the email step is "' + (step1 && step1.label) + '" (' + (step1 && step1.tag.toLowerCase() + '.' + step1.cls.replace(/ /g, '.')) + ')');
      await B.js(`document.querySelector('.kitstep[data-k="email"]').click()`);
      await B.waitFor(`!!document.querySelector('.mailset .mailgobtn')`, 'email quick way');
      const mail = await B.js(`(()=>{const a=document.querySelector('.mailset .mailgobtn'),o=document.querySelector('.mailset .mailoauth');return {btn:a&&a.textContent,href:a&&a.href,oauth:o?o.textContent:null,oauthShown:!!(o&&!o.hidden)}})()`);
      t(mail.btn && /apppasswords/.test(mail.href), '11 edition, phone: the quick way renders: "' + mail.btn + '"; Sign in slot: ' + (mail.oauth || 'none') + (mail.oauthShown ? ' (shown)' : ' (hidden: no OAuth keys on this server)'));
      await B.shot(`${TAG}-${M}-05-setup-email-phone`);
    });
  }
  await step('9 desktop', async () => {
    await home('admin', 1440, 900); await sleep(1200);
    const chips = await B.js(`[...document.querySelectorAll('.dh-chip')].map(x=>x.textContent.trim())`);
    t(ED ? chips.includes('Setup') : !chips.includes('Setup'), ED ? '9 edition, desktop: Setup is on the home\u2019s tool row' : '9 Sixfold, desktop: no Setup chip (no quote kit there)');
    await B.shot(`${TAG}-${M}-06-desk-home`);
    if (ED) {
      await B.js(`[...document.querySelectorAll('.dh-chip')].find(x=>x.textContent.trim()==='Setup').click()`);
      await B.waitFor(`!!document.querySelector('.kitstep')`, 'setup checklist (desktop)');
      t(true, '9 edition, desktop: Setup opens the checklist from Home');
      await B.js(`document.querySelector('.kitstep[data-k="email"]').click()`);
      await B.waitFor(`!!document.querySelector('.mailset .mailgobtn')`, 'email quick way (desktop)');
      t(true, '11 edition, desktop: Setup > Email\u2019s quick way renders');
      await B.shot(`${TAG}-${M}-07-setup-email-desk`);
    }
    await sleep(2500);   /* let the desktop home's late calls land before another account's screens are judged */
  });
  const O = await call('admin', 'accountadd', null, { name: 'Olive Office ' + U, role: 'office' });
  const Mg = await call('admin', 'accountadd', null, { name: 'Milo Manager ' + U, role: 'manager' });
  t(O.ok && Mg.ok, 'an office account and a manager (on no team) are added');
  await step('7 office customers', async () => {
    const so = await signin('office', O.code, 'm'); await agree('office', so);
    await home('office'); await sleep(1500); B.refused.length = 0;   /* only this screen's calls count */
    await openGroup('officerole'); if (!(await tileClick('Customers'))) await B.js(`(()=>{const b=[...document.querySelectorAll('.ohome button.otool')].find(x=>/^Customers/.test(x.textContent.trim()));if(b){b.click();return 1}return 0})()`);   /* the office's own home (Lead desk) lists Customers among its tools */
    await B.waitFor(`!!document.querySelector('.cexp') || /Customers|customer/.test(document.body.innerText)`, 'customers');
    await sleep(2000);
    t(!B.refused.includes('backups'), '7 ' + M + ': the office\u2019s Customers screen makes no refused backups call (refused: ' + (B.refused.join(', ') || 'none') + ')');
    await B.shot(`${TAG}-${M}-08-office-customers`);
  });
  await step('8 manager', async () => {
    const sm = await signin('mgr', Mg.code, 'm'); await agree('mgr', sm);
    t(sm.ok && sm.onteam === false, '8 ' + M + ': the sign-in says the manager is on no team yet (onteam false)');
    await home('mgr'); await sleep(1000); B.refused.length = 0;
    await openGroup('myteam'); await tileClick('Team sign-ins');
    await B.waitFor(`/not on a team yet/.test(document.body.innerText)`, 'not on a team message');
    await sleep(800);
    t(!B.refused.includes('accounts'), '8 ' + M + ': Team sign-ins says so without a refused accounts call (refused: ' + (B.refused.join(', ') || 'none') + ')');
    await B.shot(`${TAG}-${M}-09-manager-no-team`);
  });
  await call('admin', 'accountremove', null, { id: O.id }); await call('admin', 'accountremove', null, { id: Mg.id });
  t(!B.errors.length, M + ': no JavaScript errors (' + B.errors.slice(0, 2).join(' | ') + ')');
  B.errors.length = 0;
}
try {
  if (WHICH !== 'sixfold') await run('edition');
  if (WHICH !== 'edition') await run('sixfold');
  /* 4. the built editions' pages */
  if (existsSync(DIST)) {
    const names = ['Jen', 'Brandon', 'Brad', 'SiteOne', 'Cai', 'Nneka', 'Bryce'];
    let hits = 0, clickup = 0, pages = 0;
    for (const d of readdirSync(DIST)) { if (d === 'api') continue; const p = DIST + '/' + d + '/index.html'; if (!existsSync(p)) continue; pages++; const s = readFileSync(p, 'utf8'); for (const n of names) hits += (s.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length; clickup += (s.match(/\bClickUp\b/g) || []).length; }
    t(pages === 5 && hits === 0, '4: the five built edition pages name none of Sixfold\u2019s people (' + hits + ' hits in ' + pages + ' pages)');
    t(clickup === 5, '4: ClickUp appears once per page, as a product in Sync from another system (' + clickup + ' in all)');
  } else t(false, '4: no built editions at ' + DIST);
} catch (e) { t(false, 'crashed: ' + (e && e.message)); try { await B.shot(`${TAG}-fail`); } catch {} }
finally { B.close(); try { mode('edition'); } catch {} }
console.log(`auditfix-test: ${R.pass} passed, ${R.fail} failed`);
