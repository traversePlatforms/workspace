/* Outbox automations mock for Peak Pickleball (24 Nov 2026). A static, clickable mock: nothing here sends, saves to a server or reads
   real data. Every number and name is made up (sample data). Changes made on screen live in this tab only and are gone on reload.
   Screens (hash routes): #/automations (list + drawer), #/edit/<automation>/<step> (email editor), #/approvals, #/results, #/settings. */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SD = '<span class="sd" title="Every number and name on this screen is made up">Sample data</span>';
const nf = n => n === null || n === undefined ? '<span class="dash">–</span>' : Number(n).toLocaleString('en-US');
const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '';
const SIG = '— The Peak Pickleball Team';
const SAMPLE = {first_name: 'Alex', class_time: '6:00 pm'};

/* ---------- the data (all sample) ---------- */
const st = (id, label, when, status, subject, pre, head, body, btn, link, design) => ({id, label, when, status, subject, pre, head, body, btn, link, design: design || 'light'});
const N = (sent, del, open, click, reply, joined, opt, bounce, fail) => ({sent, del, open, click, reply, joined, opt, bounce, fail});
const DASH = N(null, null, null, null, null, null, null, null, null);

const A = [
 {id: 'free-class', setup: true, name: 'Free-class reminder and follow-up', desc: 'Booked on the free Intro class', type: 'Triggered', status: 'Running', on: true,
  last: 'Today, 4:00 pm', next: 'Tomorrow, 8:00 am', updated: 'Mon 23 Nov', n: N(78, 77, 49, 21, 2, 11, 1, 1, 0), n7: N(19, 19, 12, 6, 0, 3, 0, 0, 0),
  how: [['WHEN', 'Someone books the free Intro to Pickleball class in CourtReserve. The reminder goes the day before the class, at 4 pm.'],
        ['WHO', 'Free-class sign-ups with no paid plan, opted in to marketing email. Not staff, not guests.'],
        ['THEN', 'Reminder email (Light design). The follow-up the next morning at 8 am. A day-7 email if they haven\'t joined.'],
        ['EXIT', 'They start any paid plan.']],
  steps: [
   st('reminder', 'Reminder', 'The day before, 4 pm', 'Running', 'Your free Intro to Pickleball class is tomorrow! 🏓', 'Here\'s what to expect, and what to bring.',
      'See you tomorrow at Peak!',
      'Hi {first_name},\n\nYou\'re booked for the free Intro to Pickleball class tomorrow at {class_time}. We can\'t wait to get you on court.\n\nWhat to bring: [what to wear and bring: Cammie to confirm].\n\nWhen you arrive, check in at the front desk and our coaches will take it from there. No experience needed.\n\nCan\'t make it? Please cancel in the CourtReserve app [by the cancel cutoff] so someone on the waitlist can take your spot.\n\nSee you on the courts!',
      'See my booking', '[CourtReserve booking link]'),
   st('follow-up', 'Follow-up', 'Next morning, 8 am', 'Running', 'You did it, {first_name}! Here\'s your next step 🎉', 'A membership made for Intro grads.',
      'From Intro to game on',
      'Hi {first_name},\n\nThanks for joining us for Intro to Pickleball! You\'ve now unlocked Peak Starter, a membership just for players who\'ve completed Intro.\n\n[Starter price and what\'s included: Tyler to confirm]\n\nQuestions? Our front desk team is happy to help.',
      'Start my Starter membership', '[CourtReserve Starter link]'),
   st('day-7', 'Day 7, not joined yet', 'Day 7, if they haven\'t joined', 'Waiting for approval', 'Ready for round two, {first_name}?', 'Guided Open Play is the easiest way to keep going.',
      'Keep the momentum going',
      'Hi {first_name},\n\nIt\'s been a week since your Intro class. The best time to play again is now, while it\'s all fresh.\n\nGuided Open Play is made for new players: real games, with a coach nearby to help. [Schedule: Peak to confirm]\n\nYour Starter offer is still waiting for you. [Deadline, only if Tyler sets one]',
      'See Guided Open Play', '[CourtReserve Guided Open Play link]')],
  stepN: {'reminder': N(41, 41, 28, 6, 1, null, 0, 0, 0), 'follow-up': N(37, 36, 21, 15, 1, 11, 1, 1, 0), 'day-7': DASH}},

 {id: 'new-member', setup: true, name: 'New-member welcome', desc: 'A paid plan starts', type: 'Triggered', status: 'Running', on: true,
  last: 'Today, 8:00 am', next: 'Tomorrow, 8:00 am', updated: 'Mon 23 Nov', n: N(38, 38, 24, 9, 3, null, 0, 0, 0), n7: N(9, 9, 6, 2, 1, null, 0, 0, 0),
  how: [['WHEN', 'A paid plan starts in CourtReserve (a new plan, not a change between paid plans). The next morning, 8 am.'],
        ['WHO', 'New paid members, opted in to marketing email. Not staff, not sponsors.'],
        ['THEN', 'The welcome, then day 3, day 14 and day 30.'],
        ['EXIT', 'Their plan ends.']],
  steps: [
   st('welcome', 'Welcome', 'Next morning, 8 am', 'Running', 'Welcome to Peak, {first_name}! 🎉', 'Everything you need for your first week.', 'Welcome to the Peak family',
      'Hi {first_name},\n\nThanks for joining Peak. Your membership is active, and we can\'t wait to see you on court.\n\nThe CourtReserve app is where you book courts, sign up for Open Play and check in.\n\n[Your plan\'s court rate and notice period: Tyler to confirm]\n\nSee you on the courts!',
      'Get the CourtReserve app', '[CourtReserve app link]'),
   st('day-3', 'Day 3: find your game', 'Day 3, 10 am', 'Waiting for approval', 'Make your first week count', 'The easiest ways to find games at your level.', 'Find your game',
      'Hi {first_name},\n\nHere are the easiest ways members find regular games at Peak.\n\nOpen Play: drop in, rotate, and meet players at your level.\n\nLeagues: a regular group, a regular night and friendly competition. [League details: league lead to confirm]',
      'See the Open Play schedule', '[CourtReserve Open Play link]'),
   st('day-14', 'Day 14: how\'s it going?', 'Day 14, 10 am', 'Draft', 'How\'s it going, {first_name}?', 'Just hit reply.', '',
      'Hi {first_name},\n\nYou\'ve been a Peak member for two weeks. How\'s it going? Just hit reply and tell us anything: what you love, what\'s confusing, what you\'d like more of.', '', ''),
   st('day-30', 'Day 30: share the free class', 'Day 30, 10 am', 'Draft', 'One month in 🏓', 'Know someone who\'d love it?', 'One month at Peak',
      'Hi {first_name},\n\nOne month at Peak! Thanks for being part of the community. Know someone who\'d love it? The free Intro to Pickleball class is the best way to start.',
      'Share the free class', '[Free class page link]')],
  stepN: {'welcome': N(38, 38, 24, 9, 3, null, 0, 0, 0), 'day-3': DASH, 'day-14': DASH, 'day-30': DASH}},

 {id: 'new-account', setup: true, name: 'New free-account welcome', desc: 'A free Drop In account is created', type: 'Triggered', status: 'Approved', on: false,
  last: null, next: 'When switched on', updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', 'A new free (Drop In) account is created in CourtReserve. The next morning, 9 am.'],
        ['WHO', 'New free accounts, opted in to marketing email. Not staff.'],
        ['THEN', 'One email, with a button to book the free Intro class.'],
        ['EXIT', 'They book the free class or start a paid plan.']],
  steps: [st('welcome', 'Welcome', 'Next morning, 9 am', 'Approved', 'You\'re in! Drop in and play whenever it works for you', 'And a free class if you\'re new to the game.', 'You\'re in!',
      'Hi {first_name},\n\nYour Peak account is ready. You can book a court or drop in to Open Play whenever it works for you. [Drop-in price: Tyler to confirm]\n\nNew to pickleball? Start with our free Intro to Pickleball class. Paddles and balls are on us.',
      'Book the free class', '[Free class booking link]')]},

 {id: 'google-review', setup: true, name: 'Google review request', desc: 'Check-in at the front desk', type: 'Triggered', status: 'Waiting for approval', on: false,
  last: null, next: 'After approval', updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', 'A check-in in CourtReserve: [the 5th check-in, or the first visit: Cammie to choose]. The next morning, 8 am.'],
        ['WHO', 'People who checked in, opted in to marketing email. Once per person.'],
        ['THEN', 'One short email with one button to Peak\'s Google review page.'],
        ['EXIT', 'After the one email.']],
  steps: [st('ask', 'Review ask', 'Next morning, 8 am', 'Waiting for approval', 'Thank you for visiting today!', 'Would you share how it went?', 'Thanks for playing at Peak',
      'Hi {first_name},\n\nThanks for coming in. If you enjoyed it, a quick Google review helps other players find us. It takes about a minute.',
      'Leave a Google review', '[Peak\'s Google review link]')]},
];

/* the rest of the write-up, as drafts: one draft email each, wording to redo with Cammie */
const D = (id, name, desc, type, when, who, subject, line, design) => ({id, name, desc, type, status: 'Draft', on: false, last: null, next: 'Not set up', updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', when], ['WHO', who], ['THEN', 'Draft email from the write-up. Wording, layout and timing to redo with Cammie.']],
  steps: [st('draft', 'Draft email', when, 'Draft', subject, '', '', 'Hi {first_name},\n\n' + line, '', '', design || 'light')]});
A.push(
 D('birthday', 'Birthday', 'Birthday month', 'Triggered', 'Birthday month, 10 am.', 'Everyone with a birth date, split: paid members and free accounts.', 'Happy birthday, {first_name}! 🎉', 'Happy birthday from all of us at Peak! [Birthday offer: Tyler to choose]', 'full'),
 D('win-back', 'Lapsed-member win-back', 'Plan ended', 'Triggered', 'Days 14, 45 and 90 after a paid plan ends.', 'Ex-paid members. Not staff, sponsors or prepaid annual.', 'We miss you on the courts, {first_name}', 'We noticed your membership ended, and we\'d love to know why. [Reason to come back: an offer or an event, Tyler to choose]', 'full'),
 D('cancel-save', 'Cancellation save', 'An end date is set', 'Triggered', 'The morning after an end date is set on a paid plan (check that CourtReserve shows it).', 'Paid plans with an end date in the future.', 'Before you go, {first_name}', 'We saw your membership is set to end on [end date]. Before it does, is there something we could do better? Just reply.'),
 D('failed-payment', 'Failed payment', 'Dues past due', 'Triggered', 'Days 1, 5 and 9 past due (check that CourtReserve shows it).', 'Paid plans with an unpaid dues charge.', 'Quick fix needed: your Peak payment didn\'t go through', 'Your membership payment didn\'t go through. This usually just means a card expired or was replaced. [Where to update it]'),
 D('annual-renewal', 'Prepaid annual renewal', '30 and 7 days before renewal', 'Triggered', '30 days and 7 days before the next payment date.', 'Prepaid annual members.', 'Your Peak annual membership renews on [date]', 'Thank you for a year at Peak! Your [plan] renews on [date] at [price].'),
 D('event-reminder', 'Event reminder, release your spot', 'Booked on an event', 'Triggered', '26 hours before the event starts.', 'Open Play, Social, leagues and events. Not the free class.', 'See you tomorrow at [event]', 'You\'re on for [event] tomorrow at [time]. Plans changed? Please cancel in the CourtReserve app by [cutoff] so a waitlisted player gets in.'),
 D('referral', 'Referral ask', '60 days on a paid plan', 'Triggered', '60 days on a paid plan, 10 am.', 'Active paid members.', 'Who should play at Peak next?', 'You\'ve been playing at Peak for two months. Who in your life would love it? [Reward: only if Tyler sets one]'),
 D('drop-in', 'Drop-in regular to member', '3rd check-in in 30 days', 'Triggered', 'The 3rd check-in within 30 days, next morning 9 am, at most once every 90 days.', 'People with no paid plan.', 'You\'re playing a lot, {first_name}. Here\'s how to pay less 🏓', 'You\'ve been on court at Peak a lot lately, and we love it. [Plan comparison: Tyler to confirm prices]'),
 D('no-show', 'No-show follow-up', 'Marked no-show', 'Triggered', 'The morning after a no-show, at most once a month.', 'Anyone marked No-Show.', 'We missed you yesterday', 'We saved you a spot at [event] yesterday but didn\'t see you. [No-show policy: Tyler decides]'),
 D('starter-upgrade', 'Starter upgrade', '75 days on Starter', 'Triggered', 'Day 75 on Starter, then day 120.', 'Active Starter members.', 'Ready for your next level, {first_name}?', 'You started at Peak with Intro and Starter. If you\'re playing more, there\'s a plan that fits. [Plans and prices: Tyler to confirm]'),
 D('monthly-nudge', 'Monthly note to free accounts', 'Every month', 'Recurring', 'Once a month, 9 am.', 'Free Drop In accounts, opted in.', '[Subject to write with Cammie]', '[What\'s on at Peak this month]', 'full'),
 D('miss-you', 'We miss you (visitors)', 'No check-in in 35 days', 'Triggered', '35, 60 and 90 days after the last check-in.', 'Visitors with no paid plan.', 'We haven\'t seen you in a while, {first_name}', '[Reason to come back: an event or an offer]'),
 D('lapsed-visitor', 'Lapsed visitor, 7 weeks', 'No check-in in 7 weeks', 'Triggered', 'About 7 weeks after the last visit.', 'Visitors with no paid plan.', '[Subject to write with Cammie]', '[Wording to write with Cammie]'),
);

const LAST = [['Alex Sample', 'Follow-up', 'Today, 8:00 am', 'Clicked', 'Joined'], ['Jordan Example', 'Reminder', 'Yesterday, 4:00 pm', 'Opened', ''],
  ['Sam Placeholder', 'Follow-up', 'Yesterday, 8:00 am', 'Opened', ''], ['Riley Testcase', 'Reminder', 'Sun 22 Nov, 4:00 pm', 'Delivered', ''], ['Casey Demo', 'Follow-up', 'Sun 22 Nov, 8:00 am', 'Clicked', 'Joined']];

const byId = id => A.find(a => a.id === id);
const sCls = s => 'st st-' + s.toLowerCase().split(' ')[0];
const pill = s => '<span class="' + sCls(s) + '">' + esc(s) + '</span>';
function rollup(a) { // the automation's status follows its steps
  const S = a.steps.map(s => s.status);
  if (a.on && S.includes('Running')) return a.paused ? 'Paused' : 'Running';
  if (S.every(s => s === 'Approved' || s === 'Running')) return 'Approved';
  if (S.includes('Waiting for approval') && !S.includes('Running')) return 'Waiting for approval';
  return a.paused ? 'Paused' : S.includes('Running') ? 'Running' : 'Draft';
}
function waiting() { const W = []; A.forEach(a => a.steps.forEach(s => { if (s.status === 'Waiting for approval') W.push([a, s]) })); return W }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600) }
function badge() { $('#nbA').textContent = waiting().length || '' }

/* ---------- routing ---------- */
let drId = null, drTab = 'messages';
function route() {
  const h = (location.hash || '#/automations').slice(2).split('/');
  const r = h[0] || 'automations';
  $$('#nav a').forEach(a => a.toggleAttribute('aria-current', false));
  const cur = $('#nav a[data-r="' + (r === 'edit' ? 'automations' : r) + '"]'); if (cur) cur.setAttribute('aria-current', 'page');
  badge();
  if (r === 'edit') return drawEditor(h[1], h[2], h[3]);
  drClose(true);
  if (r === 'approvals') return drawApprovals();
  if (r === 'results') return drawResults();
  if (r === 'settings') return drawSettings();
  drawList(); if (h[1]) drOpen(h[1], h[2]);
}
window.addEventListener('hashchange', route);

/* ---------- 1. the Automations list ---------- */
const COLS = [['channels', 'Channels'], ['enabled', 'Enabled'], ['status', 'Status'], ['type', 'Type'], ['last', 'Last run'], ['next', 'Next run'],
  ['sent', 'Sent', 1], ['del', 'Delivered', 1], ['open', 'Opened', 1], ['click', 'Clicked', 1], ['reply', 'Replies', 1], ['joined', 'Joined', 1, 'Started a paid plan within 7 days of the email (read from CourtReserve)'],
  ['opt', 'Opt-outs', 1], ['bounce', 'Bounces', 1], ['fail', 'Failed', 1]];
const F = {ch: '', st: '', ty: '', q: '', sort: '', dir: 1};
function chans(a) { return '<span class="ch">Email</span> <span class="ch ch-later" title="Texts are not set up yet">Text · later</span>' }
function sw(a) {
  const s = rollup(a), can = s === 'Running' || s === 'Paused' || s === 'Approved';
  return '<button class="sw' + (a.on && !a.paused ? ' on' : '') + (can ? '' : ' ro') + '" role="switch" aria-checked="' + !!(a.on && !a.paused) + '" data-sw="' + a.id + '" aria-label="Enabled: ' + esc(a.name) + '"'
    + (can ? '' : ' title="Cammie approves it before it can be switched on"') + '><span></span></button>';
}
function cell(a, k) {
  const n = a.n;
  switch (k) {
    case 'channels': return chans(a);
    case 'enabled': return sw(a);
    case 'status': return pill(rollup(a));
    case 'type': return '<span class="ty ty-' + a.type.toLowerCase().replace(/\W/g, '') + '">' + esc(a.type) + '</span>';
    case 'last': return a.last ? esc(a.last) : '<span class="dash">–</span>';
    case 'next': return esc(a.next);
    case 'sent': case 'del': case 'reply': case 'joined': case 'bounce': case 'fail': case 'opt': return nf(n[k]);
    case 'open': case 'click': return n[k] === null ? nf(null) : nf(n[k]) + '<small>' + pc(n[k], n.del) + '</small><span class="rb"><u style="width:' + Math.round(100 * n[k] / n.del) + '%"></u></span>';
  }
}
function sumN(k, R) { return R.reduce((t, a) => t + (a.n[k] || 0), 0) }
function drawList() {
  let R = A.filter(a => (!F.st || rollup(a) === F.st) && (!F.ty || a.type === F.ty) && (F.ch !== 'Text' ) && (!F.q || (a.name + ' ' + a.desc).toLowerCase().includes(F.q.toLowerCase())));
  if (F.sort) R = R.slice().sort((x, y) => { const k = F.sort; const v = a => k === 'name' ? a.name : k === 'status' ? rollup(a) : k === 'type' ? a.type : (a.n[k] ?? -1); const p = v(x), q = v(y); return (p > q ? 1 : p < q ? -1 : 0) * F.dir });
  const run = A.filter(a => a.n.sent !== null);
  const sc = (c, l, v, s) => '<div class="sc ' + c + '"><span>' + l + '</span><b>' + v + '</b><small>' + s + '</small></div>';
  const T = k => sumN(k, run), del = T('del');
  let h = '<section class="card secc"><h2>Peak Pickleball · Automations <span class="cnt">' + A.length + ' automations</span>' + SD + '</h2>'
    + '<p class="lead">Peak\'s member emails, started by what happens in CourtReserve. The first four are being set up with Cammie; the rest are drafts from the 23 Nov write-up. <b>Nothing goes live until Cammie approves it.</b></p>'
    + '<div class="strip">' + sc('sc-sent', 'Sent', nf(T('sent')), 'last 30 days') + sc('', 'Delivered', nf(del), pc(del, T('sent')) + ' of sent') + sc('sc-open', 'Opened', nf(T('open')), pc(T('open'), del) + ' of delivered')
    + sc('sc-click', 'Clicked', nf(T('click')), pc(T('click'), del) + ' of delivered') + sc('sc-reply', 'Joined', nf(T('joined')), 'paid plan within 7 days') + sc('', 'Opt-outs', nf(T('opt')), pc(T('opt'), del) + ' of delivered')
    + sc('sc-bounce', 'Bounces', nf(T('bounce')), 'and ' + T('fail') + ' failed') + '</div></section>';
  const o = (id, lab, list, v) => '<label class="f">' + lab + '<select id="' + id + '"><option value="">All</option>' + list.map(x => '<option' + (x[0] === v ? ' selected' : '') + ' value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>').join('') + '</select></label>';
  h += '<section class="card list"><div class="bar">' + o('fch', 'Channel', [['Email', 'Email'], ['Text', 'Text (later)']], F.ch)
    + o('fst', 'Status', ['Running', 'Approved', 'Waiting for approval', 'Draft', 'Paused'].map(x => [x, x]), F.st) + o('fty', 'Type', [['Triggered', 'Triggered'], ['Recurring', 'Recurring']], F.ty)
    + '<label class="f grow">Search<input id="fq" type="search" placeholder="Name or trigger" value="' + esc(F.q) + '"></label></div>';
  const sb = (k, l) => '<button class="sb" data-sort="' + k + '" aria-sort="' + (F.sort === k ? (F.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + l + ' <i>' + (F.sort === k ? (F.dir > 0 ? '▲' : '▼') : '↕') + '</i></button>';
  h += '<div class="tw"><table class="lt"><thead><tr><th class="nm">' + sb('name', 'Name') + '</th>' + COLS.map(c => '<th' + (c[2] ? ' class="num"' : '') + (c[3] ? ' title="' + esc(c[3]) + '"' : '') + '>' + (['channels', 'enabled', 'last', 'next'].includes(c[0]) ? c[1] : sb(c[0], c[1])) + '</th>').join('') + '<th class="act"><span class="sr">View</span></th></tr></thead><tbody>';
  const row = a => '<tr><td class="nm"><button class="lnk" data-open="' + a.id + '">' + esc(a.name) + '</button><small>' + esc(a.desc) + '</small></td>'
    + COLS.map(c => '<td data-c="' + c[0] + '"' + (c[2] ? ' class="num"' : '') + '>' + cell(a, c[0]) + '</td>').join('')
    + '<td class="act"><button class="eye" data-open="' + a.id + '" aria-label="View ' + esc(a.name) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button></td></tr>';
  const span = COLS.length + 2;
  if (!R.length) h += '<tr><td colspan="' + span + '" class="empty">' + (F.ch === 'Text' ? 'Texts come later: none are set up yet.' : 'Nothing matches these filters.') + '</td></tr>';
  else if (!F.sort) {
    const a1 = R.filter(a => a.setup), a2 = R.filter(a => !a.setup);
    if (a1.length) h += '<tr class="grp"><td colspan="' + span + '">The first four, set up with Cammie</td></tr>' + a1.map(row).join('');
    if (a2.length) h += '<tr class="grp"><td colspan="' + span + '">From the write-up: drafts, to go through later</td></tr>' + a2.map(row).join('');
  } else h += R.map(row).join('');
  h += '</tbody></table></div><p class="note tiny" style="padding:0 14px">' + R.length + ' of ' + A.length + ' shown. Numbers are the last 30 days (sample data). <span class="dash">–</span> means nothing sent yet. Joined means a paid plan started in CourtReserve within 7 days of the email. Opens run high because of Apple Mail.</p></section>'
    + '<p class="foot">Outbox · Matthew Sharpe · mock for review, 24 Nov 2026</p>';
  $('#view').innerHTML = h;
  $('#fch').onchange = e => { F.ch = e.target.value; drawList() }; $('#fst').onchange = e => { F.st = e.target.value; drawList() }; $('#fty').onchange = e => { F.ty = e.target.value; drawList() };
  $('#fq').oninput = e => { F.q = e.target.value; const p = e.target.selectionStart; drawList(); const q = $('#fq'); q.focus(); q.setSelectionRange(p, p) };
  $$('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; if (F.sort === k) { if (F.dir > 0) F.dir = -1; else { F.sort = ''; F.dir = 1 } } else { F.sort = k; F.dir = 1 } drawList() });
  $$('[data-open]').forEach(b => b.onclick = () => { location.hash = '#/automations/' + b.dataset.open });
  $$('[data-sw]').forEach(b => b.onclick = () => flip(b.dataset.sw));
}
function flip(id) {
  const a = byId(id), s = rollup(a);
  if (s === 'Approved') { a.on = true; a.paused = false; a.steps.forEach(x => { if (x.status === 'Approved') x.status = 'Running' }); a.next = 'Tomorrow, 9:00 am'; toast('Switched on in this mock only. Nothing sends.') }
  else if (s === 'Running') { a.paused = true; toast('Paused in this mock only.') }
  else if (s === 'Paused') { a.paused = false; toast('Running again in this mock only. Nothing sends.') }
  else { toast('Cammie approves it first. Then it can be switched on.'); return }
  if ((location.hash || '').startsWith('#/automations')) { drawList(); if (drId) drDraw() }
}

/* ---------- 2. the drawer ---------- */
function drOpen(id, tab) { const a = byId(id); if (!a) return; drTab = tab || (drId === id ? drTab : 'messages'); drId = id; $('#dr').classList.remove('hide'); $('#drbg').classList.remove('hide'); document.body.classList.add('drawer'); drDraw(); setTimeout(() => { const x = $('#drx'); if (x) x.focus() }, 0) }
function drClose(quiet) { if (!drId) return; drId = null; $('#dr').classList.add('hide'); $('#drbg').classList.add('hide'); document.body.classList.remove('drawer'); if (!quiet && location.hash.split('/').length > 2) history.replaceState(null, '', '#/automations') }
$('#drbg').onclick = () => drClose(); document.addEventListener('keydown', e => { if (e.key === 'Escape' && drId) drClose() });
function drDraw() {
  const a = byId(drId), s = rollup(a);
  let h = '<div class="dh"><div><h2 id="drt">' + esc(a.name) + '</h2><div class="row">' + pill(s) + '<span class="ty ty-' + a.type.toLowerCase() + '">' + esc(a.type) + '</span><span class="ch">Email</span><span class="soft tiny">Updated ' + esc(a.updated) + '</span></div></div><button id="drx" class="x" aria-label="Close">Close</button></div>';
  h += '<div class="ctl"><div class="row"><span><b>Enabled</b> <span class="soft tiny">' + (s === 'Running' ? 'Sending as each trigger happens.' : s === 'Approved' ? 'Approved by Cammie. Ready to switch on.' : s === 'Paused' ? 'Paused. Nothing sends.' : 'Cammie approves each email before it can be switched on.') + '</span></span>' + sw(a) + '</div></div>';
  h += '<h3>How it works</h3><ol class="how">' + a.how.map(x => '<li><span class="k k-' + x[0].toLowerCase() + '">' + x[0] + '</span><span>' + esc(x[1]) + '</span></li>').join('') + '</ol>';
  h += '<div class="dtabs" role="tablist">' + [['messages', 'Messages'], ['flow', 'Flow'], ['stats', 'Stats']].map(t => '<button role="tab" data-dt="' + t[0] + '" aria-selected="' + (drTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div><div role="tabpanel">' + drPanel(a) + '</div>';
  $('#dr').innerHTML = h;
  $('#drx').onclick = () => drClose();
  $$('[data-dt]').forEach(b => b.onclick = () => { drTab = b.dataset.dt; drDraw() });
  $$('#dr [data-sw]').forEach(b => b.onclick = () => flip(b.dataset.sw));
}
function drPanel(a) {
  if (drTab === 'messages') return a.steps.map((s, i) => '<div class="msg"><div class="ml">' + (i + 1) + '. ' + esc(s.label) + ' <span class="stepst">' + pill(s.status) + '</span></div><dl><dt>When</dt><dd>' + esc(s.when) + '</dd><dt>Subject</dt><dd>' + esc(s.subject) + '</dd>'
    + (s.pre ? '<dt>Preview</dt><dd>' + esc(s.pre) + '</dd>' : '') + '<dt>Design</dt><dd>' + (s.design === 'full' ? 'Full design (promotions)' : 'Light (logo, colours, mostly text)') + '</dd>' + (s.btn ? '<dt>Button</dt><dd>' + esc(s.btn) + '</dd>' : '') + '</dl>'
    + '<div class="btnrow"><a class="button' + (i === 0 ? ' main' : '') + '" href="#/edit/' + a.id + '/' + s.id + '">Open in the editor</a></div></div>').join('');
  if (drTab === 'flow') return flowHTML(a);
  return statsHTML(a);
}
function fn(k, t, p, extra) { return '<div class="fn fn-' + k.toLowerCase() + '"><div class="fx"><span class="k k-' + k.toLowerCase() + '">' + k + '</span>' + (extra || '') + '</div><p>' + t + '</p>' + (p ? '<p class="soft tiny">' + p + '</p>' : '') + '</div>' }
const ar = '<div class="fa" aria-hidden="true">↓</div>';
function flowHTML(a) {
  const S = id => a.steps.find(s => s.id === id);
  const ed = s => pill(s.status) + ' <a class="tiny" href="#/edit/' + a.id + '/' + s.id + '">Edit</a>';
  if (a.id === 'free-class') {
    return '<div class="flow">' + fn('WHEN', 'Books the free Intro to Pickleball class in CourtReserve', 'Free-class sign-ups with no paid plan, opted in to marketing email.')
      + ar + fn('WAIT', 'Until the day before the class, 4 pm') + ar
      + fn('SEND', '<b>Reminder:</b> ' + esc(S('reminder').subject), 'Light design', ed(S('reminder'))) + ar
      + fn('WAIT', 'Until the next morning, 8 am (after the class)') + ar
      + fn('SEND', '<b>Follow-up:</b> ' + esc(S('follow-up').subject.replace('{first_name}', '{first_name}')), 'Light design. The button goes to Starter.', ed(S('follow-up'))) + ar
      + fn('WAIT', 'Until day 7 after the class') + ar
      + fn('CHECK', 'Have they joined? (a paid plan in CourtReserve)') + ar
      + '<div class="fork">' + fn('EXIT', '<b>Yes:</b> they leave the flow. Nothing more is sent.') + fn('SEND', '<b>No:</b> day-7 email: ' + esc(S('day-7').subject), 'Light design', ed(S('day-7'))) + '</div>'
      + '<p class="note tiny">At any step, starting a paid plan ends the flow.</p></div>';
  }
  let h = '<div class="flow">' + fn('WHEN', esc(a.how[0][1]), esc(a.how[1][1]));
  a.steps.forEach((s, i) => { h += ar + fn('WAIT', esc(s.when)) + ar + fn('SEND', '<b>' + esc(s.label) + ':</b> ' + esc(s.subject), s.design === 'full' ? 'Full design' : 'Light design', ed(s)) });
  const ex = a.how.find(x => x[0] === 'EXIT'); if (ex) h += ar + fn('EXIT', esc(ex[1]));
  return h + '</div>';
}
function bars(lab, n) {
  const L = [['Sent', n.sent], ['Delivered', n.del], ['Opened', n.open], ['Clicked', n.click], ['Joined', n.joined]].filter(x => x[1] !== null), mx = n.sent || 1;
  return '<div class="sbx"><h4>' + lab + '</h4>' + L.map(x => '<div class="br br-' + (x[0] === 'Joined' ? 'replies' : x[0].toLowerCase()) + '"><span>' + x[0] + '</span><div class="bt"><i style="width:' + Math.round(100 * x[1] / mx) + '%"></i></div><b>' + nf(x[1]) + (x[0] !== 'Sent' && x[0] !== 'Delivered' ? ' <small>' + pc(x[1], x[0] === 'Joined' ? n.del : n.del) + '</small>' : '') + '</b></div>').join('') + '</div>';
}
function statsHTML(a) {
  if (a.n.sent === null) return '<p class="note">Nothing has been sent yet: ' + (rollup(a) === 'Approved' ? 'it is approved and waiting to be switched on.' : 'Cammie approves it first.') + ' The numbers show here once it runs.</p>';
  let h = '<div class="row" style="margin-bottom:8px">' + SD + '<span class="note tiny">Made-up numbers to show the layout.</span></div><div class="sgrid">' + bars('Last 7 days', a.n7) + bars('Last 30 days', a.n) + '</div>';
  if (a.n.joined !== null) h += '<p class="note tiny">Joined within 7 days is read from CourtReserve: a paid plan that started within 7 days of the email. Rates are out of delivered.</p>';
  h += '<h3>By email, last 30 days</h3><div class="tw"><table class="t"><tr><th>Email</th><th class="num">Sent</th><th class="num">Opened</th><th class="num">Clicked</th><th class="num">Joined</th><th class="num">Opt-outs</th></tr>'
    + a.steps.map(s => { const n = a.stepN[s.id]; return '<tr><td>' + esc(s.label) + '</td><td class="num">' + nf(n.sent) + '</td><td class="num">' + nf(n.open) + '</td><td class="num">' + nf(n.click) + '</td><td class="num">' + nf(n.joined) + '</td><td class="num">' + nf(n.opt) + '</td></tr>' }).join('') + '</table></div>';
  if (a.id === 'free-class') h += '<h3>Last sends</h3><div class="tw"><table class="t"><tr><th>Person (made up)</th><th>Email</th><th>Sent</th><th>Result</th></tr>' + LAST.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + (r[4] ? ' <span class="tag">' + esc(r[4]) + '</span>' : '') + '</td></tr>').join('') + '</table></div>';
  return h;
}

/* ---------- 3. the email editor ---------- */
const FLOW = ['Draft', 'Waiting for approval', 'Approved', 'Running'];
function body2html(t, mf) {
  const m = s => esc(s).replace(/\{(first_name|class_time)\}/g, (x, k) => mf ? '<span class="mfv">' + esc(SAMPLE[k]) + '</span>' : x).replace(/\[([^\]]+)\]/g, '<span class="brk">[$1]</span>');
  return t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + m(p).replace(/\n/g, '<br>') + '</p>').join('');
}
function fill(t) { return esc(t).replace(/\{(first_name|class_time)\}/g, (x, k) => '<span class="mfv">' + esc(SAMPLE[k]) + '</span>').replace(/\[([^\]]+)\]/g, '<span class="brk">[$1]</span>') }
function emailHTML(s) {
  const ft = '<a href="#" onclick="return false">Unsubscribe</a> · Peak Pickleball · <span class="brk">[address and phone, as in Peak\'s footer]</span>';
  const btn = s.btn ? '<a class="btn" href="#" onclick="return false">' + fill(s.btn) + '</a>' : '';
  if (s.design === 'full') return '<div class="em full"><div class="top"><img src="img/logo-fit-white.png" alt="Peak Pickleball"></div><img class="hero" src="img/open-play-action.webp" alt="">'
    + (s.head ? '<div class="band"><h1>' + fill(s.head) + '</h1></div>' : '') + '<div class="in">' + body2html(s.body, true)
    + (btn ? '<div class="cta">' + btn + '</div>' : '') + (s.id === 'reminder' ? '<div class="cards"><div><b>When</b>Tomorrow, <span class="mfv">' + SAMPLE.class_time + '</span></div><div><b>Where</b><span class="brk">[Peak\'s address]</span></div></div>' : '')
    + '<p>' + esc(SIG) + '</p></div><p class="tag">Learn. Play. Connect. Belong.</p><div class="ft">' + ft + '</div></div>';
  return '<div class="em light"><img class="lg" src="img/logo-fit-black.png" alt="Peak Pickleball">' + (s.head ? '<h1>' + fill(s.head) + '</h1>' : '') + body2html(s.body, true)
    + (btn ? '<p style="margin:20px 0">' + btn + '</p>' : '') + '<p class="sig">' + esc(SIG) + '</p><div class="ft">' + ft + '</div></div>';
}
function stepper(cur) {
  const i = FLOW.indexOf(cur);
  return '<div class="stp" aria-label="Approval steps">' + FLOW.map((x, j) => (j ? '<b class="' + (j <= i ? 'done' : '') + '"></b>' : '') + '<span class="' + (j < i || (j === i && x === 'Running') ? 'done' : j === i ? 'cur' : '') + '"><i>' + (j < i || (j === i && x === 'Running') ? '✓' : j + 1) + '</i>' + x + '</span>').join('') + '</div>';
}
function drawEditor(aid, sid, look) {
  const a = byId(aid); const s = a && a.steps.find(x => x.id === sid);
  if (s && (look === 'full' || look === 'light')) s.design = look;
  if (!s) { $('#view').innerHTML = '<section class="card"><p>That email is not in this mock. <a href="#/automations">Back to Automations</a></p></section>'; return }
  drClose(true);
  const mfb = t => '<div class="mf">Insert: <button type="button" data-mf="' + t + '" data-k="first_name">{first_name}</button><button type="button" data-mf="' + t + '" data-k="class_time">{class_time}</button></div>';
  let h = '<div><p class="crumb"><a href="#/automations">Automations</a> › <a href="#/automations/' + a.id + '">' + esc(a.name) + '</a> › ' + esc(s.label) + '</p>'
    + '<div class="ph" style="margin-bottom:12px"><h2 style="font-size:20px">' + esc(s.label) + '</h2>' + pill(s.status) + '<span class="soft tiny">' + esc(s.when) + '</span></div></div>'
    + '<div class="ed"><div style="display:grid;gap:14px">'
    + '<section class="card"><h2>The email</h2>'
    + '<div class="fld"><label for="e-subject">Subject</label><input id="e-subject" data-f="subject" value="' + esc(s.subject) + '">' + mfb('e-subject') + '</div>'
    + '<div class="fld"><label for="e-pre">Preview text</label><input id="e-pre" data-f="pre" value="' + esc(s.pre) + '"><div class="hint">The grey line shown after the subject in the inbox.</div></div>'
    + '<div class="fld"><label for="e-head">Headline <span class="soft">(optional)</span></label><input id="e-head" data-f="head" value="' + esc(s.head) + '"></div>'
    + '<div class="fld"><label for="e-body">Body</label><textarea id="e-body" data-f="body" rows="12">' + esc(s.body) + '</textarea>' + mfb('e-body')
    + '<div class="hint">A blank line starts a new paragraph. {first_name} and {class_time} are filled in for each person. Anything in [square brackets] is for Peak to decide and is never sent as is. The sign-off and footer are added for you.</div></div>'
    + '<div class="two"><div class="fld"><label for="e-btn">Button label</label><input id="e-btn" data-f="btn" value="' + esc(s.btn) + '"></div><div class="fld"><label for="e-link">Button link</label><input id="e-link" data-f="link" value="' + esc(s.link) + '"></div></div>'
    + '<div class="fld"><label>Design</label><div class="seg" role="group" aria-label="Design"><button type="button" data-d="light" aria-pressed="' + (s.design !== 'full') + '">Light</button><button type="button" data-d="full" aria-pressed="' + (s.design === 'full') + '">Full design</button></div>'
    + '<p class="segnote" id="segnote"></p></div>'
    + '<div class="btnrow"><button class="main" id="save">Save</button><button id="test">Send me a test</button><span class="note tiny">Saving keeps it in this tab only. The test button does nothing in the mock.</span></div></section>'
    + '<section class="appr" id="appr"></section></div>'
    + '<div class="pvw"><section class="card"><div class="pvh"><h3>Live preview</h3><span class="note tiny">Shown with a made-up person: ' + esc(SAMPLE.first_name) + ' Sample, class at ' + esc(SAMPLE.class_time) + '</span></div><div class="inbox" id="pv"></div></section></div></div>';
  $('#view').innerHTML = h;
  const pv = () => {
    $('#segnote').textContent = s.design === 'full' ? 'Full design: photo, colour bands and a big button. For promotions (birthday, win-backs, newsletters). Expect it in the Promotions tab.' : 'Light: logo, Peak colours, mostly text and one button. Reads like a note from a person, so it is more likely to reach the main inbox.';
    $('#pv').innerHTML = '<div class="ih"><span class="tabi' + (s.design === 'full' ? ' pr">Likely: Promotions' : '">Likely: Primary inbox') + '</span><b>Peak Pickleball</b> &lt;hello@mail.peak.example&gt;<br><b>' + fill(s.subject) + '</b>' + (s.pre ? ' <span>– ' + fill(s.pre) + '</span>' : '') + '<br><span style="font-size:12px">To: alex.sample@example.com</span></div><div class="ib">' + emailHTML(s) + '</div>';
  };
  pv(); appr(a, s);
  $$('[data-f]').forEach(el => el.oninput = () => { s[el.dataset.f] = el.value; pv() });
  $$('[data-d]').forEach(b => b.onclick = () => { s.design = b.dataset.d; $$('[data-d]').forEach(x => x.setAttribute('aria-pressed', x === b)); pv() });
  $$('[data-mf]').forEach(b => b.onclick = () => { const el = $('#' + b.dataset.mf), t = '{' + b.dataset.k + '}', p = el.selectionStart ?? el.value.length; el.value = el.value.slice(0, p) + t + el.value.slice(el.selectionEnd ?? p); el.focus(); el.setSelectionRange(p + t.length, p + t.length); el.oninput() });
  $('#save').onclick = () => { a.updated = 'Just now'; if (s.status === 'Approved' || s.status === 'Running') { toast('Saved in this mock. A change after approval goes back to Cammie.') } else toast('Saved in this tab only. Nothing sends.') };
  $('#test').onclick = () => toast('Mock: no test was sent.');
}
function appr(a, s) {
  const b = {Draft: '<button class="main" data-to="Waiting for approval">Send to Cammie for approval</button>',
    'Waiting for approval': '<button class="main" data-to="Approved">Approve (as Cammie)</button><button data-to="Draft">Ask for changes</button>',
    Approved: '<button class="main" data-to="Running">Switch on</button><button data-to="Draft">Back to draft</button>',
    Running: '<button data-to="Approved">Pause this email</button>'}[s.status] || '';
  const say = {Draft: 'Matthew is still writing this one. When it is ready, send it to Cammie.', 'Waiting for approval': 'Waiting for Cammie. She reads it, sends herself a test, then approves it or asks for changes.',
    Approved: 'Cammie approved it. It goes live when it is switched on.', Running: 'Live. Any change goes back to Cammie for approval before it sends.'}[s.status];
  $('#appr').innerHTML = '<h3>Cammie approves before it goes live</h3><p class="note" style="margin:0">' + say + '</p>' + stepper(s.status)
    + '<div class="btnrow">' + b + '</div><div class="cmt"><label for="cm" style="margin:0 0 4px">Note for Cammie</label><textarea id="cm" rows="2" placeholder="For example: changed the button to Starter, as we agreed"></textarea></div>';
  $$('#appr [data-to]').forEach(x => x.onclick = () => {
    s.status = x.dataset.to;
    if (s.status === 'Running') { a.on = true; a.paused = false; if (!a.last) a.next = 'Tomorrow, 9:00 am' }
    a.status = rollup(a); badge(); appr(a, s);
    const h = document.querySelector('.ph .st'); if (h) h.outerHTML = pill(s.status);
    toast({'Waiting for approval': 'Sent to Cammie (in this mock only).', Approved: 'Approved (in this mock only).', Draft: 'Back to draft.', Running: 'Switched on in this mock only. Nothing sends.'}[s.status]);
  });
}

/* ---------- 4. Approvals ---------- */
function drawApprovals() {
  const W = waiting(), R = []; A.forEach(a => a.steps.forEach(s => { if (s.status === 'Approved') R.push([a, s]) }));
  const item = ([a, s], ok) => '<div class="ai' + (ok ? ' ok' : '') + '"><div><h3>' + esc(a.name) + ': ' + esc(s.label) + '</h3><p><b>Subject:</b> ' + esc(s.subject) + '</p><p>' + esc(s.when) + ' · ' + (s.design === 'full' ? 'Full design' : 'Light') + ' · ' + (ok ? 'approved Mon 23 Nov, not switched on yet' : 'sent for approval Mon 23 Nov') + '</p></div>'
    + '<div class="btnrow"><a class="button' + (ok ? '' : ' main') + '" href="#/edit/' + a.id + '/' + s.id + '">' + (ok ? 'Open' : 'Review') + '</a>' + (ok ? '' : '<button data-ok="' + a.id + '/' + s.id + '">Approve (as Cammie)</button>') + '</div></div>';
  let h = '<section class="card secc"><h2>Approvals <span class="cnt">' + W.length + ' waiting for Cammie</span></h2><p class="lead">Every email goes Draft → Waiting for approval → Approved → Running. <b>Cammie approves each one before it goes live</b>, and any later change comes back here. In the real tool Cammie signs in with her own code, and only she can approve.</p></section>'
    + '<section class="card"><h2>Waiting for Cammie</h2><div class="aq">' + (W.length ? W.map(x => item(x)).join('') : '<p class="note">Nothing is waiting.</p>') + '</div></section>'
    + '<section class="card"><h2>Approved, ready to switch on</h2><div class="aq">' + (R.length ? R.map(x => item(x, 1)).join('') : '<p class="note">None.</p>') + '</div></section><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
  $$('[data-ok]').forEach(b => b.onclick = () => { const [ai, si] = b.dataset.ok.split('/'); const a = byId(ai); a.steps.find(x => x.id === si).status = 'Approved'; badge(); toast('Approved (in this mock only).'); drawApprovals() });
}

/* ---------- 5. Results ---------- */
function drawResults() {
  const run = A.filter(a => a.n.sent !== null), T = k => sumN(k, run);
  const P = {sent: 140, opt: 2, joined: 6};
  const sc = (c, l, v, s) => '<div class="sc ' + c + '"><span>' + l + '</span><b>' + v + '</b><small>' + s + '</small></div>';
  let h = '<section class="card secc"><h2>Results <span class="cnt">last 30 days</span>' + SD + '</h2><p class="lead">What Peak\'s emails did: sends, opt-outs, and members who joined. Joined is read from CourtReserve: a paid plan that started within 7 days of an email. Every number here is made up to show the layout.</p>'
    + '<div class="strip s4">' + sc('sc-sent', 'Emails sent', nf(T('sent')), nf(T('del')) + ' delivered') + sc('sc-click', 'Clicked', nf(T('click')), pc(T('click'), T('del')) + ' of delivered')
    + sc('sc-opt', 'Opt-outs', nf(T('opt')), pc(T('opt'), T('del')) + ' of delivered') + sc('sc-join', 'Members who joined', nf(T('joined')), 'within 7 days of an email') + '</div>'
    + '<div class="cmp">' + SD + '<span><b>Against Patch:</b> in the same 30 days a year ago, Patch sent ' + nf(P.sent) + ' of these emails, with ' + P.opt + ' opt-outs and ' + P.joined + ' members who joined. Outbox: ' + nf(T('sent')) + ' sent, ' + T('opt') + ' opt-out, ' + T('joined') + ' joined.</span></div></section>';
  const mx = Math.max(...run.map(a => a.n.sent));
  h += '<section class="card"><div class="ph" style="margin-bottom:8px"><h2>By automation</h2>' + SD + '</div><div class="tw"><table class="t"><tr><th>Automation</th><th>Status</th><th class="num">Sent</th><th class="num">Opened</th><th class="num">Clicked</th><th class="num">Joined</th><th class="num">Opt-outs</th><th style="width:28%"><span class="sr">Share of sends</span></th></tr>'
    + A.filter(a => a.setup).map(a => { const n = a.n; return '<tr><td><a href="#/automations/' + a.id + '/stats">' + esc(a.name) + '</a></td><td>' + pill(rollup(a)) + '</td><td class="num">' + nf(n.sent) + '</td><td class="num">' + nf(n.open) + '</td><td class="num">' + nf(n.click) + '</td><td class="num">' + nf(n.joined) + '</td><td class="num">' + nf(n.opt) + '</td><td>'
      + (n.sent ? '<div class="bt"><i style="width:' + Math.round(100 * n.sent / mx) + '%"></i></div>' : '<span class="dash">–</span>') + '</td></tr>' }).join('')
    + '</table></div><p class="note tiny">Opens run high because Apple Mail opens every email by itself, so clicks and joins count for more. The other 13 automations are drafts and have sent nothing. A readout like this goes to Cammie every two weeks.</p></section><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
}

/* ---------- 6. Settings ---------- */
function drawSettings() {
  const ex = '<span class="sd" title="Not a real setting">example</span>';
  let h = '<section class="card secc"><h2>Settings <span class="cnt">Peak Pickleball workspace</span></h2><p class="lead">How Peak\'s emails are sent, who can unsubscribe, and where the triggers come from. Values marked <b>example</b> show the layout only.</p></section><div class="sets">'
    + '<section class="card"><div class="ph"><h2>Sending domain</h2>' + ex + '</div><dl class="kvs"><dt>Domain</dt><dd><code>mail.peak.example</code></dd><dt>From</dt><dd>Peak Pickleball &lt;hello@mail.peak.example&gt;</dd><dt>Replies go to</dt><dd><span class="brkx">[Peak inbox: Cammie to choose]</span></dd></dl>'
    + '<ul class="chk">' + [['SPF', 'Passing', 'Says which servers may send for the domain'], ['DKIM', 'Passing', 'Signs each email so it can\'t be faked'], ['DMARC', 'Passing', 'Tells inboxes what to do with fakes']].map(r => '<li><i aria-hidden="true">✓</i><b>' + r[0] + '</b><span>' + r[1] + ' ' + ex + ' <span class="soft tiny">' + r[2] + '</span></span></li>').join('') + '</ul></section>'
    + '<section class="card"><div class="ph"><h2>Unsubscribes</h2>' + SD + '</div><p class="note" style="margin:6px 0">Anyone who unsubscribed in Patch or in CourtReserve never gets a marketing email from Outbox. Every email carries an unsubscribe link.</p>'
    + '<dl class="kvs"><dt>Imported from Patch</dt><dd><b>1,240</b> addresses, on Tue 24 Nov ' + ex + '</dd><dt>Since then</dt><dd><b>1</b> more, from Outbox\'s own link</dd><dt>Who gets emails</dt><dd>Only accounts opted in to marketing email in CourtReserve</dd></dl>'
    + '<div class="btnrow"><button id="imp">Import again from Patch</button><span class="note tiny">Does nothing in the mock.</span></div></section>'
    + '<section class="card"><div class="ph"><h2>CourtReserve connection</h2>' + ex + '</div><p style="margin:8px 0"><span class="dot"></span><b>Connected</b> · read only</p><dl class="kvs"><dt>Checks</dt><dd>Every 15 minutes ' + ex + '</dd><dt>Last check</dt><dd>Today, 4:15 pm ' + ex + '</dd>'
    + '<dt>Reads</dt><dd>Bookings (the free class), class times, plan starts and ends, new accounts, check-ins, marketing opt-ins</dd><dt>Never</dt><dd>Changes anything in CourtReserve</dd></dl></section>'
    + '<section class="card"><h2>People and texts</h2><dl class="kvs"><dt>Matthew Sharpe</dt><dd>Editor: writes and builds each email</dd><dt>Cammie</dt><dd>Approver: approves each email before it goes live</dd>'
    + '<dt>Texts</dt><dd><span class="ch ch-later">Later</span> Not set up. When they are, texts go only to people opted in to texts.</dd></dl></section></div><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
  $('#imp').onclick = () => toast('Mock: nothing was imported.');
}

route();
