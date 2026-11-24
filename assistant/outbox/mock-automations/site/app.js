/* Outbox automations mock for Peak Pickleball, v2 (24 Nov 2026). A static, clickable mock: nothing here sends, saves to a server or reads
   real data. Every number and name is made up (sample data). Changes made on screen live in this tab only and are gone on reload.
   Screens (hash routes): #/automations (list + drawer), #/edit/<automation>/<step>[/light|/full] (block editor), #/approvals, #/results, #/settings. */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SD = '<span class="sd" title="Every number and name on this screen is made up">Sample data</span>';
const EX = '<span class="ex" title="Not a real setting">example</span>';
const nf = n => n === null || n === undefined ? '<span class="dash">–</span>' : Number(n).toLocaleString('en-US');
const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '';
const SIG = '— The Peak Pickleball Team';
const paras = t => String(t || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
const I = { // small line icons
  eye: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  up: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  grip: '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.3"/><circle cx="8" cy="2" r="1.3"/><circle cx="2" cy="7" r="1.3"/><circle cx="8" cy="7" r="1.3"/><circle cx="2" cy="12" r="1.3"/><circle cx="8" cy="12" r="1.3"/></svg>',
  lock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  ok: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  warn: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v9"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>',
  phone: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  desk: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  cols: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="flex:none;margin-top:1px"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'};

/* ---------- people, merge fields, photos (all made up) ---------- */
const PEOPLE = [
  {id: 'alex', label: 'Alex Sample', first_name: 'Alex', class_time: '6:00 pm', email: 'alex.sample@example.com'},
  {id: 'jordan', label: 'Jordan Example', first_name: 'Jordan', class_time: '9:30 am', email: 'jordan.example@example.com'},
  {id: 'noname', label: 'No first name on file', first_name: '', class_time: '6:00 pm', email: 'member.4417@example.com'},
  {id: 'riley', label: 'Riley Testcase (no class booked)', first_name: 'Riley', class_time: '', email: 'riley.testcase@example.com'}];
let who = PEOPLE[0];
const MF = {first_name: {label: 'First name', fb: 'there'}, class_time: {label: 'Class time', fb: 'your booked time'}};
const PHOTOS = [['img/open-play-action.webp', 'Players in an Open Play game at Peak'], ['img/class-group.webp', 'An Intro class group on court at Peak']];

/* ---------- the automations (all sample) ---------- */
const T = (v, h) => ({t: 'text', v, h: !!h}), IMG = (n) => ({t: 'image', src: PHOTOS[n || 0][0], alt: PHOTOS[n || 0][1]}), BTN = (label, link) => ({t: 'button', label, link});
function mk(head, body, btn, link, img) { const b = []; if (img !== undefined) b.push(IMG(img)); if (head) b.push(T(head, 1)); b.push(T(body)); if (btn) b.push(BTN(btn, link)); return b }
const st = (id, label, when, status, subject, pre, blocks, design, extra) => Object.assign({id, label, when, status, subject, pre, blocks, design: design || 'light', hist: [], thread: []}, extra || {});
const N = (sent, del, open, click, reply, joined, opt, bounce, fail) => ({sent, del, open, click, reply, joined, opt, bounce, fail});
const DASH = N(null, null, null, null, null, null, null, null, null);
const H = (at, who, what, ap) => ({at, who, what, ap: !!ap});

const A = [
 {id: 'free-class', setup: true, name: 'Free-class reminder and follow-up', desc: 'Books the free Intro class', type: 'Triggered', on: true,
  last: 'Today, 4:00 pm', next: 'Tomorrow, 8:00 am', updated: 'Mon 23 Nov', n: N(130, 129, 87, 30, 2, 11, 1, 1, 0), n7: N(31, 31, 20, 8, 0, 3, 0, 0, 0),
  how: [['WHEN', 'Someone books the free Intro to Pickleball class in CourtReserve. The reminder goes the day before the class, at 4 pm.'],
        ['WHO', 'Free-class sign-ups with no paid plan, opted in to marketing email. Not staff, not guests.'],
        ['THEN', 'Reminder email (Light design). The follow-up the next morning at 8 am. A day-7 email if they haven\'t joined.'],
        ['EXIT', 'They start any paid plan.']],
  funnel: [['Reminded', 'The day-before reminder', 78], ['Attended', 'Checked in to the class (CourtReserve)', 60], ['Got the follow-up', 'Next morning, 8 am', 52], ['Joined within 7 days', 'A paid plan started (CourtReserve)', 11]],
  steps: [
   st('reminder', 'Reminder', 'The day before, 4 pm', 'Running', 'Your free Intro to Pickleball class is tomorrow! 🏓', 'Here\'s what to expect, and what to bring.',
      mk('See you tomorrow at Peak!', 'Hi {first_name},\n\nYou\'re booked for the free Intro to Pickleball class tomorrow at {class_time}. We can\'t wait to get you on court.\n\nWhat to bring: [what to wear and bring: Cammie to confirm].\n\nWhen you arrive, check in at the front desk and our coaches will take it from there. No experience needed.\n\nCan\'t make it? Please cancel in the CourtReserve app [by the cancel cutoff] so someone on the waitlist can take your spot.',
      'See my booking', '[CourtReserve booking link]'), 'light', {service: true,
      hist: [H('Sat 21 Nov, 3:20 pm', 'Matthew Sharpe', 'created it'), H('Sat 21 Nov, 3:40 pm', 'Matthew Sharpe', 'sent it for approval'), H('Sun 22 Nov, 9:40 am', 'Cammie', 'approved it', 1), H('Sun 22 Nov, 10:00 am', 'Matthew Sharpe', 'switched it on')]}),
   st('follow-up', 'Follow-up', 'Next morning, 8 am', 'Running', 'You did it, {first_name}! Here\'s your next step 🎉', 'A membership made for Intro grads.',
      mk('From Intro to game on', 'Hi {first_name},\n\nThanks for joining us for Intro to Pickleball! You\'ve now unlocked Peak Starter, a membership just for players who\'ve completed Intro.\n\n[Starter price and what\'s included: Tyler to confirm]\n\nQuestions? Our front desk team is happy to help.',
      'Start my Starter membership', '[CourtReserve Starter link]'), 'light', {
      hist: [H('Sat 21 Nov, 3:30 pm', 'Matthew Sharpe', 'created it'), H('Sun 22 Nov, 9:42 am', 'Cammie', 'approved it', 1), H('Sun 22 Nov, 10:00 am', 'Matthew Sharpe', 'switched it on')]}),
   st('day-7', 'Day 7, not joined yet', 'Day 7, if they haven\'t joined', 'Waiting for approval', 'Ready for round two, {first_name}?', 'Guided Open Play is the easiest way to keep going.',
      mk('Keep the momentum going', 'Hi {first_name},\n\nIt\'s been a week since your Intro class. The best time to play again is now, while it\'s all fresh.\n\nGuided Open Play is made for new players: real games, with a coach nearby to help. [Schedule: Peak to confirm]\n\nYour Starter offer is still waiting for you. [Deadline, only if Tyler sets one]',
      'See Guided Open Play', '[CourtReserve Guided Open Play link]'), 'light', {sentAt: 'Mon 23 Nov, 6:10 pm',
      hist: [H('Sun 22 Nov, 2:05 pm', 'Matthew Sharpe', 'created it'), H('Mon 23 Nov, 6:10 pm', 'Matthew Sharpe', 'sent it for approval')],
      thread: [{who: 'Cammie', at: 'Mon 23 Nov, 7:02 pm', text: 'Can we put the Guided Open Play times in once Tyler confirms them?'},
               {who: 'Matthew Sharpe', at: 'Mon 23 Nov, 7:15 pm', text: 'Yes. The [Schedule] bracket holds the spot, and approval stays blocked until it\'s filled.'}]})],
  stepN: {'reminder': N(78, 77, 52, 14, 1, null, 0, 1, 0), 'follow-up': N(52, 52, 35, 16, 1, 11, 1, 0, 0), 'day-7': DASH}},

 {id: 'new-member', setup: true, name: 'New-member welcome', desc: 'A paid plan starts', type: 'Triggered', on: true,
  last: 'Today, 8:00 am', next: 'Tomorrow, 8:00 am', updated: 'Mon 23 Nov', n: N(38, 38, 24, 9, 3, null, 0, 0, 0), n7: N(9, 9, 6, 2, 1, null, 0, 0, 0),
  how: [['WHEN', 'A paid plan starts in CourtReserve (a new plan, not a change between paid plans). The next morning, 8 am.'],
        ['WHO', 'New paid members, opted in to marketing email. Not staff, not sponsors.'],
        ['THEN', 'The welcome, then day 3, day 14 and day 30.'],
        ['EXIT', 'Their plan ends.']],
  steps: [
   st('welcome', 'Welcome', 'Next morning, 8 am', 'Running', 'Welcome to Peak, {first_name}! 🎉', 'Everything you need for your first week.',
      mk('Welcome to the Peak family', 'Hi {first_name},\n\nThanks for joining Peak. Your membership is active, and we can\'t wait to see you on court.\n\nThe CourtReserve app is where you book courts, sign up for Open Play and check in.\n\n[Your plan\'s court rate and notice period: Tyler to confirm]\n\nSee you on the courts!',
      'Get the CourtReserve app', '[CourtReserve app link]'), 'light', {hist: [H('Sat 21 Nov, 4:00 pm', 'Matthew Sharpe', 'created it'), H('Sun 22 Nov, 9:50 am', 'Cammie', 'approved it', 1), H('Sun 22 Nov, 10:00 am', 'Matthew Sharpe', 'switched it on')]}),
   st('day-3', 'Day 3: find your game', 'Day 3, 10 am', 'Waiting for approval', 'Make your first week count', 'The easiest ways to find games at your level.',
      mk('Find your game', 'Hi {first_name},\n\nHere are the easiest ways members find regular games at Peak.\n\nOpen Play: drop in, rotate, and meet players at your level.\n\nLeagues: a regular group, a regular night and friendly competition. [League details: league lead to confirm]',
      'See the Open Play schedule', '[CourtReserve Open Play link]'), 'light', {sentAt: 'Mon 23 Nov, 6:12 pm', hist: [H('Sun 22 Nov, 2:30 pm', 'Matthew Sharpe', 'created it'), H('Mon 23 Nov, 6:12 pm', 'Matthew Sharpe', 'sent it for approval')]}),
   st('day-14', 'Day 14: how\'s it going?', 'Day 14, 10 am', 'Draft', 'How\'s it going, {first_name}?', 'Just hit reply.',
      mk('', 'Hi {first_name},\n\nYou\'ve been a Peak member for two weeks. How\'s it going? Just hit reply and tell us anything: what you love, what\'s confusing, what you\'d like more of.')),
   st('day-30', 'Day 30: share the free class', 'Day 30, 10 am', 'Draft', 'One month in 🏓', 'Know someone who\'d love it?',
      mk('One month at Peak', 'Hi {first_name},\n\nOne month at Peak! Thanks for being part of the community. Know someone who\'d love it? The free Intro to Pickleball class is the best way to start.',
      'Share the free class', '[Free class page link]'))],
  stepN: {'welcome': N(38, 38, 24, 9, 3, null, 0, 0, 0), 'day-3': DASH, 'day-14': DASH, 'day-30': DASH}},

 {id: 'new-account', setup: true, name: 'New free-account welcome', desc: 'A free Drop In account is created', type: 'Triggered', on: false,
  last: null, next: 'When switched on', updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', 'A new free (Drop In) account is created in CourtReserve. The next morning, 9 am.'],
        ['WHO', 'New free accounts, opted in to marketing email. Not staff.'],
        ['THEN', 'One email, with a button to book the free Intro class.'],
        ['EXIT', 'They book the free class or start a paid plan.']],
  steps: [st('welcome', 'Welcome', 'Next morning, 9 am', 'Approved', 'You\'re in! Drop in and play whenever it works for you', 'And a free class if you\'re new to the game.',
      mk('You\'re in!', 'Hi {first_name},\n\nYour Peak account is ready. You can book a court or drop in to Open Play whenever it works for you. [Drop-in price: Tyler to confirm]\n\nNew to pickleball? Start with our free Intro to Pickleball class. Paddles and balls are on us.',
      'Book the free class', '[Free class booking link]'), 'light', {approvedAt: 'Mon 23 Nov, 11:05 am', hist: [H('Sat 21 Nov, 4:20 pm', 'Matthew Sharpe', 'created it'), H('Mon 23 Nov, 9:30 am', 'Matthew Sharpe', 'sent it for approval'), H('Mon 23 Nov, 11:05 am', 'Cammie', 'approved it', 1)]})]},

 {id: 'google-review', setup: true, name: 'Google review request', desc: 'Checks in at the front desk', type: 'Triggered', on: false,
  last: null, next: 'After approval', updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', 'A check-in in CourtReserve: [the 5th check-in, or the first visit: Cammie to choose]. The next morning, 8 am.'],
        ['WHO', 'People who checked in, opted in to marketing email. Once per person.'],
        ['THEN', 'One short email with one button to Peak\'s Google review page.'],
        ['EXIT', 'After the one email.']],
  steps: [st('ask', 'Review ask', 'Next morning, 8 am', 'Waiting for approval', 'Thank you for visiting today!', 'Would you share how it went?',
      mk('Thanks for playing at Peak', 'Hi {first_name},\n\nThanks for coming in. If you enjoyed it, a quick Google review helps other players find us. It takes about a minute.',
      'Leave a Google review', 'https://example.com/peak-google-review'), 'light', {sentAt: 'Mon 23 Nov, 5:50 pm',
      hist: [H('Sat 21 Nov, 4:45 pm', 'Matthew Sharpe', 'created it'), H('Sun 22 Nov, 10:14 am', 'Cammie', 'approved it', 1), H('Mon 23 Nov, 5:48 pm', 'Matthew Sharpe', 'changed the subject, a line and the button'), H('Mon 23 Nov, 5:50 pm', 'Matthew Sharpe', 'sent it back for approval')],
      thread: [{who: 'Cammie', at: 'Sun 22 Nov, 10:13 am', text: 'Looks good. Could the button say "Leave a Google review"? It sounds friendlier.'},
               {who: 'Matthew Sharpe', at: 'Mon 23 Nov, 5:49 pm', text: 'Changed it, and softened the subject and the middle line too. Back to you.'}]})]},
];
// the version Cammie approved on 22 Nov, so "what changed" has something to show
{ const g = A[3].steps[0]; g.prev = {at: 'Sun 22 Nov, 10:14 am', lines: lines({subject: 'Thanks for playing at Peak today!', pre: g.pre,
  blocks: mk('Thanks for playing at Peak', 'Hi {first_name},\n\nThanks for coming in. If you enjoyed it, a Google review helps other players find us.', 'Review us on Google', 'https://example.com/peak-google-review')})} }

/* the rest of the write-up, as drafts: one draft email each, wording to redo with Cammie */
const D = (id, name, desc, type, when, who, subject, line, design, svc) => ({id, name, desc, type, on: false, last: null, next: null, updated: 'Mon 23 Nov', n: DASH,
  how: [['WHEN', when], ['WHO', who], ['THEN', 'Draft email from the write-up. Wording, layout and timing to redo with Cammie.']],
  steps: [st('draft', 'Draft email', when, 'Draft', subject, '', design === 'full' ? [IMG(0), T('Hi {first_name},\n\n' + line)] : [T('Hi {first_name},\n\n' + line)], design || 'light', {service: !!svc})]});
A.push(
 D('birthday', 'Birthday', 'Birthday month', 'Triggered', 'Birthday month, 10 am.', 'Everyone with a birth date, split: paid members and free accounts.', 'Happy birthday, {first_name}! 🎉', 'Happy birthday from all of us at Peak! [Birthday offer: Tyler to choose]', 'full'),
 D('win-back', 'Lapsed-member win-back', 'A paid plan ends', 'Triggered', 'Days 14, 45 and 90 after a paid plan ends.', 'Ex-paid members. Not staff, sponsors or prepaid annual.', 'We miss you on the courts, {first_name}', 'We noticed your membership ended, and we\'d love to know why. [Reason to come back: an offer or an event, Tyler to choose]', 'full'),
 D('cancel-save', 'Cancellation save', 'An end date is set', 'Triggered', 'The morning after an end date is set on a paid plan (check that CourtReserve shows it).', 'Paid plans with an end date in the future.', 'Before you go, {first_name}', 'We saw your membership is set to end on [end date]. Before it does, is there something we could do better? Just reply.'),
 D('failed-payment', 'Failed payment', 'Dues are past due', 'Triggered', 'Days 1, 5 and 9 past due (check that CourtReserve shows it).', 'Paid plans with an unpaid dues charge.', 'Quick fix needed: your Peak payment didn\'t go through', 'Your membership payment didn\'t go through. This usually just means a card expired or was replaced. [Where to update it]', 'light', 1),
 D('annual-renewal', 'Prepaid annual renewal', '30 and 7 days before renewal', 'Triggered', '30 days and 7 days before the next payment date.', 'Prepaid annual members.', 'Your Peak annual membership renews on [date]', 'Thank you for a year at Peak! Your [plan] renews on [date] at [price].', 'light', 1),
 D('event-reminder', 'Event reminder, release your spot', 'Books an event', 'Triggered', '26 hours before the event starts.', 'Open Play, Social, leagues and events. Not the free class.', 'See you tomorrow at [event]', 'You\'re on for [event] tomorrow at [time]. Plans changed? Please cancel in the CourtReserve app by [cutoff] so a waitlisted player gets in.', 'light', 1),
 D('referral', 'Referral ask', '60 days on a paid plan', 'Triggered', '60 days on a paid plan, 10 am.', 'Active paid members.', 'Who should play at Peak next?', 'You\'ve been playing at Peak for two months. Who in your life would love it? [Reward: only if Tyler sets one]'),
 D('drop-in', 'Drop-in regular to member', '3rd check-in in 30 days', 'Triggered', 'The 3rd check-in within 30 days, next morning 9 am, at most once every 90 days.', 'People with no paid plan.', 'You\'re playing a lot, {first_name}. Here\'s how to pay less 🏓', 'You\'ve been on court at Peak a lot lately, and we love it. [Plan comparison: Tyler to confirm prices]'),
 D('no-show', 'No-show follow-up', 'Marked as a no-show', 'Triggered', 'The morning after a no-show, at most once a month.', 'Anyone marked No-Show.', 'We missed you yesterday', 'We saved you a spot at [event] yesterday but didn\'t see you. [No-show policy: Tyler decides]'),
 D('starter-upgrade', 'Starter upgrade', '75 days on Starter', 'Triggered', 'Day 75 on Starter, then day 120.', 'Active Starter members.', 'Ready for your next level, {first_name}?', 'You started at Peak with Intro and Starter. If you\'re playing more, there\'s a plan that fits. [Plans and prices: Tyler to confirm]'),
 D('monthly-nudge', 'Monthly note to free accounts', 'The 1st of each month', 'Recurring', 'Once a month, 9 am.', 'Free Drop In accounts, opted in.', '[Subject to write with Cammie]', '[What\'s on at Peak this month]', 'full'),
 D('miss-you', 'We miss you (visitors)', 'No check-in in 35 days', 'Triggered', '35, 60 and 90 days after the last check-in.', 'Visitors with no paid plan.', 'We haven\'t seen you in a while, {first_name}', '[Reason to come back: an event or an offer]'),
 D('lapsed-visitor', 'Lapsed visitor, 7 weeks', 'No check-in in 7 weeks', 'Triggered', 'About 7 weeks after the last visit.', 'Visitors with no paid plan.', '[Subject to write with Cammie]', '[Wording to write with Cammie]'),
);

const LAST = [['Alex Sample', 'Follow-up', 'Today, 8:00 am', 'Clicked', 'Joined'], ['Jordan Example', 'Reminder', 'Yesterday, 4:00 pm', 'Opened', ''],
  ['Sam Placeholder', 'Follow-up', 'Yesterday, 8:00 am', 'Opened', ''], ['Riley Testcase', 'Reminder', 'Sun 22 Nov, 4:00 pm', 'Delivered', ''], ['Casey Demo', 'Follow-up', 'Sun 22 Nov, 8:00 am', 'Clicked', 'Joined']];

/* sending rules (Settings), live in this tab only */
const RULES = {capOn: true, capN: 3, capD: 7, svcEx: true, qOn: true, qFrom: 20, qTo: 7};

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
const fmtH = h => (h % 12 || 12) + ':00 ' + (h < 12 ? 'am' : 'pm');

/* ---------- routing ---------- */
let drId = null, drTab = 'messages';
function route() {
  const h = (location.hash || '#/automations').slice(2).split('/');
  const r = h[0] || 'automations';
  $$('#nav a').forEach(a => a.removeAttribute('aria-current'));
  const cur = $('#nav a[data-r="' + (r === 'edit' ? 'automations' : r) + '"]'); if (cur) cur.setAttribute('aria-current', 'page');
  badge();
  if (r === 'edit') return drawEditor(h[1], h[2], h[3]);
  drClose(true); window.scrollTo(0, 0);
  if (r === 'approvals') return drawApprovals();
  if (r === 'results') return drawResults();
  if (r === 'settings') return drawSettings();
  drawList(); if (h[1]) drOpen(h[1], h[2]);
}
window.addEventListener('hashchange', route);

/* ---------- 1. the Automations list ---------- */
// [key, label, numeric, optional, tooltip]
const COLS = [['status', 'Status'], ['last', 'Last run'], ['next', 'Next run'], ['sent', 'Sent', 1], ['click', 'Clicked', 1],
  ['joined', 'Joined', 1, 0, 'Started a paid plan within 7 days of the email (read from CourtReserve)'], ['opt', 'Opt-outs', 1],
  ['channels', 'Channels', 0, 1], ['type', 'Type', 0, 1], ['del', 'Delivered', 1, 1], ['open', 'Opened', 1, 1, 'Apple Mail opens every email by itself, so opens run high'],
  ['reply', 'Replies', 1, 1], ['bounce', 'Bounces', 1, 1], ['fail', 'Failed', 1, 1]];
const F = {st: '', ty: '', q: '', sort: '', dir: 1, cols: new Set(), colsOpen: false};
const shown = () => COLS.filter(c => !c[3] || F.cols.has(c[0]));
function sw(a, extra) {
  const s = rollup(a), can = s === 'Running' || s === 'Paused' || s === 'Approved';
  return '<button class="sw' + (a.on && !a.paused ? ' on' : '') + (can ? '' : ' ro') + '" role="switch" aria-checked="' + !!(a.on && !a.paused) + '" data-sw="' + a.id + '" aria-label="On or off: ' + esc(a.name) + '"'
    + ' title="' + (can ? (a.on && !a.paused ? 'On. Click to pause.' : 'Off. Click to switch on.') : 'Cammie approves it before it can be switched on') + '"' + (extra || '') + '><span></span></button>';
}
const statusCell = a => '<div class="stc">' + sw(a) + pill(rollup(a)) + '</div>';
function cell(a, k) {
  const n = a.n;
  switch (k) {
    case 'status': return statusCell(a);
    case 'channels': return '<span class="chn">Email <em>· text later</em></span>';
    case 'type': return '<span class="chn">' + esc(a.type) + '</span>';
    case 'last': return a.last ? esc(a.last) : '<span class="dash">–</span>';
    case 'next': return a.next ? esc(a.next) : '<span class="dash">–</span>';
    case 'click': case 'open': return n[k] === null ? nf(null) : nf(n[k]) + '<small class="pc">' + pc(n[k], n.del) + '</small>';
    default: return nf(n[k]);
  }
}
function sumN(k, R) { return R.reduce((t, a) => t + (a.n[k] || 0), 0) }
const RUN = () => A.filter(a => a.n.sent !== null);
function numsRow(cls) {
  const R = RUN(), t = k => sumN(k, R), del = t('del');
  return '<div class="nums ' + cls + '">'
    + '<div><span>Sent</span><b>' + nf(t('sent')) + '</b></div>'
    + '<div><span>Clicked</span><b>' + nf(t('click')) + '</b><small>' + pc(t('click'), del) + '</small></div>'
    + '<div><span>Joined</span><b>' + nf(t('joined')) + '</b><small>within 7 days</small></div>'
    + '<div><span>Opt-outs</span><b>' + nf(t('opt')) + '</b><small>' + pc(t('opt'), del) + '</small></div>'
    + '<div><span>Bounces</span><b>' + nf(t('bounce')) + '</b><small>' + pc(t('bounce'), t('sent')) + '</small></div>'
    + '<div class="minor" title="Apple Mail opens every email by itself, so opens run high. Clicks and joins count for more."><span>Opened*</span><b>' + nf(t('open')) + '</b><small>' + pc(t('open'), del) + '</small></div>'
    + '<div class="per">Last 30 days ' + SD + '</div></div>';
}
function phoneNums() {
  const R = RUN(), t = k => sumN(k, R), del = t('del');
  const c = (l, v, s) => '<div><span>' + l + '</span><b>' + v + '</b>' + (s ? ' <small class="soft tiny">' + s + '</small>' : '') + '</div>';
  return '<details class="phsum"><summary>Last 30 days</summary><div class="hstrip">' + c('Sent', nf(t('sent'))) + c('Clicked', nf(t('click')), pc(t('click'), del)) + c('Joined', nf(t('joined')))
    + c('Opt-outs', nf(t('opt'))) + c('Bounces', nf(t('bounce'))) + c('Opened*', nf(t('open'))) + '</div><p class="note">' + SD + ' *Apple Mail opens every email by itself, so opens run high.</p></details>';
}
function drawList() {
  let R = A.filter(a => (!F.st || rollup(a) === F.st) && (!F.ty || a.type === F.ty) && (!F.q || (a.name + ' ' + a.desc).toLowerCase().includes(F.q.toLowerCase())));
  if (F.sort) R = R.slice().sort((x, y) => { const k = F.sort; const v = a => k === 'name' ? a.name : k === 'status' ? rollup(a) : (a.n[k] ?? -1); const p = v(x), q = v(y); return (p > q ? 1 : p < q ? -1 : 0) * F.dir });
  const C = shown();
  let h = '<div class="lhead"><div class="ph"><h1>Automations</h1><span class="soft">' + A.length + '</span><div class="r"><button class="btn" id="newa">New automation</button></div></div>'
    + '<p class="intro">Peak\'s member emails, started by what happens in CourtReserve. Nothing goes live until Cammie approves it.</p>' + numsRow('desk') + '</div>';
  const o = (id, lab, list, v) => '<select id="' + id + '" aria-label="' + lab + '"><option value="">' + lab + ': all</option>' + list.map(x => '<option' + (x === v ? ' selected' : '') + ' value="' + esc(x) + '">' + esc(x) + '</option>').join('') + '</select>';
  h += '<div class="bar"><input id="fq" class="q" type="search" placeholder="Search name or trigger" aria-label="Search" value="' + esc(F.q) + '">'
    + o('fst', 'Status', ['Running', 'Approved', 'Waiting for approval', 'Draft', 'Paused'], F.st) + o('fty', 'Type', ['Triggered', 'Recurring'], F.ty)
    + '<div class="r"><button class="btn" id="colsb" aria-expanded="' + F.colsOpen + '" aria-controls="colsp">' + I.cols + 'Columns' + (F.cols.size ? ' <span class="nb">+' + F.cols.size + '</span>' : '') + '</button>'
    + '<div class="cols' + (F.colsOpen ? '' : ' hide') + '" id="colsp" role="group" aria-label="Columns"><h4>Show columns</h4>'
    + COLS.filter(c => !c[3]).map(c => '<label class="fx"><input type="checkbox" checked disabled>' + c[1] + '</label>').join('')
    + COLS.filter(c => c[3]).map(c => '<label><input type="checkbox" data-col="' + c[0] + '"' + (F.cols.has(c[0]) ? ' checked' : '') + '>' + c[1] + '</label>').join('')
    + '<div class="ft"><button class="btn sm ghost" id="colsr">Reset</button><button class="btn sm" id="colsx">Done</button></div></div></div></div>';
  const sb = (k, l) => '<button class="sb" data-sort="' + k + '" aria-sort="' + (F.sort === k ? (F.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + l + ' <i>' + (F.sort === k ? (F.dir > 0 ? '▲' : '▼') : '↕') + '</i></button>';
  h += '<div class="tw lst"><table class="lt"><thead><tr><th class="nm">' + sb('name', 'Name') + '</th>'
    + C.map(c => '<th' + (c[2] ? ' class="num"' : '') + (c[4] ? ' title="' + esc(c[4]) + '"' : '') + '>' + (['channels', 'last', 'next', 'type'].includes(c[0]) ? c[1] : sb(c[0], c[1])) + '</th>').join('') + '<th class="act"><span class="sr">View</span></th></tr></thead><tbody>';
  const row = a => '<tr><td class="nm"><button data-open="' + a.id + '">' + esc(a.name) + '</button><small>' + esc(a.desc) + '</small></td>'
    + C.map(c => '<td data-c="' + c[0] + '"' + (c[2] ? ' class="num"' : '') + '>' + cell(a, c[0]) + '</td>').join('')
    + '<td class="act"><button class="eye" data-open="' + a.id + '" aria-label="View ' + esc(a.name) + '">' + I.eye + '</button></td></tr>';
  const span = C.length + 2;
  const card = a => { const n = a.n; return '<li class="pcard"><div class="t"><div><button class="n" data-open="' + a.id + '">' + esc(a.name) + '</button><small>' + esc(a.desc) + '</small></div>' + sw(a, ' data-ph="1"') + '</div>'
    + '<div class="m">' + pill(rollup(a)) + '<div class="k"><span>Sent <b>' + nf(n.sent) + '</b></span><span>Clicked <b>' + nf(n.click) + '</b></span><span>Joined <b>' + nf(n.joined) + '</b></span></div></div></li>' };
  let cards = '';
  if (!R.length) { h += '<tr><td colspan="' + span + '" class="empty">Nothing matches these filters.</td></tr>'; cards = '<li class="g">Nothing matches these filters.</li>' }
  else if (!F.sort) {
    const a1 = R.filter(a => a.setup), a2 = R.filter(a => !a.setup);
    if (a1.length) { h += '<tr class="grp"><td colspan="' + span + '">The first four, set up with Cammie</td></tr>' + a1.map(row).join(''); cards += '<li class="g">The first four, set up with Cammie</li>' + a1.map(card).join('') }
    if (a2.length) { h += '<tr class="grp"><td colspan="' + span + '">Drafts from the write-up, to go through later</td></tr>' + a2.map(row).join(''); cards += '<li class="g">Drafts from the write-up</li>' + a2.map(card).join('') }
  } else { h += R.map(row).join(''); cards = R.map(card).join('') }
  h += '</tbody></table></div><ul class="pcards">' + cards + '</ul>'
    + '<p class="listnote">' + R.length + ' of ' + A.length + ' shown. Numbers are the last 30 days (sample data). <span class="dash">–</span> means nothing sent yet. Joined: a paid plan started in CourtReserve within 7 days of the email. *Opens run high because Apple Mail opens every email by itself.</p>'
    + phoneNums() + '<p class="foot">Outbox · mock for review, 24 Nov 2026</p>';
  $('#view').innerHTML = h;
  $('#fst').onchange = e => { F.st = e.target.value; drawList() }; $('#fty').onchange = e => { F.ty = e.target.value; drawList() };
  $('#fq').oninput = e => { F.q = e.target.value; const p = e.target.selectionStart; drawList(); const q = $('#fq'); q.focus(); q.setSelectionRange(p, p) };
  $$('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; if (F.sort === k) { if (F.dir > 0) F.dir = -1; else { F.sort = ''; F.dir = 1 } } else { F.sort = k; F.dir = 1 } drawList() });
  $$('[data-open]').forEach(b => b.onclick = () => { location.hash = '#/automations/' + b.dataset.open });
  $$('#view [data-sw]').forEach(b => b.onclick = () => flip(b.dataset.sw));
  $('#newa').onclick = () => toast('Mock: new automations are built with Cammie.');
  $('#colsb').onclick = e => { e.stopPropagation(); F.colsOpen = !F.colsOpen; $('#colsp').classList.toggle('hide', !F.colsOpen); $('#colsb').setAttribute('aria-expanded', F.colsOpen) };
  $('#colsp').onclick = e => e.stopPropagation();
  $$('[data-col]').forEach(c => c.onchange = () => { c.checked ? F.cols.add(c.dataset.col) : F.cols.delete(c.dataset.col); drawList() });
  $('#colsr').onclick = () => { F.cols.clear(); drawList() };
  $('#colsx').onclick = () => { F.colsOpen = false; drawList() };
}
document.addEventListener('click', () => { if (F.colsOpen && $('#colsp')) { F.colsOpen = false; $('#colsp').classList.add('hide'); $('#colsb').setAttribute('aria-expanded', 'false') } });
function flip(id) {
  const a = byId(id), s = rollup(a);
  if (s === 'Approved') { a.on = true; a.paused = false; a.steps.forEach(x => { if (x.status === 'Approved') { x.status = 'Running'; x.hist.push(H('Just now', 'Matthew Sharpe', 'switched it on')) } }); a.next = 'Tomorrow, 9:00 am'; toast('Switched on in this mock only. Nothing sends.') }
  else if (s === 'Running') { a.paused = true; toast('Paused in this mock only.') }
  else if (s === 'Paused') { a.paused = false; toast('Running again in this mock only. Nothing sends.') }
  else { toast('Cammie approves it first. Then it can be switched on.'); return }
  if ((location.hash || '#/automations').startsWith('#/automations')) { drawList(); if (drId) drDraw() }
}

/* ---------- 2. the drawer ---------- */
function drOpen(id, tab) { const a = byId(id); if (!a) return; drTab = tab || (drId === id ? drTab : 'messages'); drId = id; $('#dr').classList.remove('hide'); $('#drbg').classList.remove('hide'); drDraw(); setTimeout(() => { const x = $('#drx'); if (x) x.focus() }, 0) }
function drClose(quiet) { if (!drId) return; drId = null; $('#dr').classList.add('hide'); $('#drbg').classList.add('hide'); if (!quiet && location.hash.split('/').length > 2) history.replaceState(null, '', '#/automations') }
$('#drbg').onclick = () => drClose(); document.addEventListener('keydown', e => { if (e.key === 'Escape' && drId) drClose() });
function drDraw() {
  const a = byId(drId), s = rollup(a);
  const svc = a.steps.filter(x => x.service);
  let h = '<div class="dh"><div><h2 id="drt">' + esc(a.name) + '</h2><div class="dmeta">' + pill(s) + '<span>Updated ' + esc(a.updated) + '</span></div></div><button id="drx" class="btn sm x" aria-label="Close">' + I.x + '</button></div><div class="dbody">';
  h += '<div class="dctl">' + sw(a) + '<div class="tx"><b>' + (a.on && !a.paused ? 'On' : 'Off') + '</b><span>' + (s === 'Running' ? 'Sending as each trigger happens.' : s === 'Approved' ? 'Approved by Cammie. Ready to switch on.' : s === 'Paused' ? 'Paused. Nothing sends.' : 'Cammie approves each email before it can be switched on.') + '</span></div></div>';
  h += '<dl class="facts"><dt>Trigger</dt><dd>' + esc(a.desc) + '</dd><dt>Channels</dt><dd>Email. Texts come later: not set up yet.</dd><dt>Type</dt><dd>' + esc(a.type) + '</dd>'
    + '<dt>Sending cap</dt><dd>' + (svc.length === a.steps.length ? 'Service email: does not count toward the cap.' : svc.length ? esc(svc.map(x => x.label).join(', ')) + ' is a service email and does not count; the rest do.' : 'Counts toward each person\'s cap (Settings).') + '</dd></dl>';
  h += '<h3>How it works</h3><ol class="how">' + a.how.map(x => '<li><span class="k k-' + x[0].toLowerCase() + '">' + x[0] + '</span><span>' + esc(x[1]) + '</span></li>').join('') + '</ol>';
  h += '<div class="dtabs" role="tablist">' + [['messages', 'Messages'], ['flow', 'Flow'], ['stats', 'Stats']].map(t => '<button role="tab" data-dt="' + t[0] + '" aria-selected="' + (drTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div><div role="tabpanel">' + drPanel(a) + '</div></div>';
  $('#dr').innerHTML = h;
  $('#drx').onclick = () => drClose();
  $$('[data-dt]').forEach(b => b.onclick = () => { drTab = b.dataset.dt; drDraw() });
  $$('#dr [data-sw]').forEach(b => b.onclick = () => flip(b.dataset.sw));
}
function drPanel(a) {
  if (drTab === 'messages') return a.steps.map((s, i) => '<div class="msg"><h4>' + (i + 1) + '. ' + esc(s.label) + ' ' + pill(s.status) + '</h4><p>' + esc(s.when) + ' · ' + (s.design === 'full' ? 'Full design' : 'Light') + (s.service ? ' · service email' : '') + '</p><p>' + esc(s.subject) + '</p>'
    + '<a class="btn sm' + (i === 0 ? ' pri' : '') + '" href="#/edit/' + a.id + '/' + s.id + '">Edit</a></div>').join('');
  if (drTab === 'flow') return flowHTML(a);
  return statsHTML(a);
}
function fn(k, t, p, extra, cls) { return '<div class="fn fn-' + k.toLowerCase() + (cls ? ' ' + cls : '') + '"><div class="fx"><span class="k k-' + k.toLowerCase() + '">' + k + '</span>' + (extra || '') + '</div><p>' + t + '</p>' + (p ? '<p class="s">' + p + '</p>' : '') + '</div>' }
const ar = '<div class="fa" aria-hidden="true"></div>';
function flowHTML(a) {
  const S = id => a.steps.find(s => s.id === id);
  const ed = s => '<span>' + pill(s.status) + ' <a class="tiny" href="#/edit/' + a.id + '/' + s.id + '">Edit</a></span>';
  const wait = t => '<div class="fn fn-wait"><div class="fx"><span class="k">WAIT</span><span class="tiny">' + t + '</span></div></div>';
  if (a.id === 'free-class') {
    return '<div class="flow">' + fn('WHEN', 'Books the free Intro to Pickleball class in CourtReserve', 'Free-class sign-ups with no paid plan, opted in to marketing email.')
      + ar + wait('Until the day before the class, 4 pm') + ar
      + fn('THEN', '<b>Reminder:</b> ' + esc(S('reminder').subject), 'Light design · service email · 78 sent in 30 days', ed(S('reminder'))) + ar
      + wait('Until the next morning, 8 am (after the class)') + ar
      + fn('THEN', '<b>Follow-up:</b> ' + esc(S('follow-up').subject), 'Light design. The button goes to Starter. · 52 sent', ed(S('follow-up'))) + ar
      + wait('Until day 7 after the class') + ar
      + fn('CHECK', 'Have they joined? (a paid plan in CourtReserve)') + ar
      + '<div class="fork">' + fn('EXIT', '<b>Yes:</b> they leave the flow. Nothing more is sent.', '11 so far') + fn('THEN', '<b>No:</b> day-7 email: ' + esc(S('day-7').subject), 'Light design', ed(S('day-7'))) + '</div>'
      + '<p class="note">At any step, starting a paid plan ends the flow. The step counts are sample data; the funnel is in Stats.</p></div>';
  }
  let h = '<div class="flow">' + fn('WHEN', esc(a.how[0][1]), esc(a.how[1][1]));
  a.steps.forEach(s => { h += ar + wait(esc(s.when)) + ar + fn('THEN', '<b>' + esc(s.label) + ':</b> ' + esc(s.subject), s.design === 'full' ? 'Full design' : 'Light design', ed(s)) });
  const ex = a.how.find(x => x[0] === 'EXIT'); if (ex) h += ar + fn('EXIT', esc(ex[1]));
  return h + '</div>';
}
function funnelSteps(a) {
  if (a.funnel) return a.funnel;
  const n = a.n, F2 = [['Sent', '', n.sent], ['Delivered', '', n.del], ['Clicked', 'The button or a link', n.click]];
  if (n.joined !== null) F2.push(['Joined within 7 days', 'A paid plan started', n.joined]);
  return F2;
}
const cvWord = l => ({Attended: 'attended', 'Got the follow-up': 'got the follow-up', 'Joined within 7 days': 'joined', Delivered: 'delivered', Clicked: 'clicked'}[l] || l.toLowerCase());
function funnelHTML(a) {
  const St = funnelSteps(a), top = St[0][2] || 1;
  let h = '<div class="fnl" aria-label="Funnel">';
  St.forEach((x, i) => {
    if (i) h += '<div class="cv"><span></span><span>' + pc(x[2], St[i - 1][2]) + ' ' + cvWord(x[0]) + '</span></div>';
    h += '<div class="stp"><span><b style="font-weight:600;text-align:left">' + esc(x[0]) + '</b>' + (x[1] ? '<br><small class="soft">' + esc(x[1]) + '</small>' : '') + '</span><div class="b"><i style="width:' + Math.max(2, Math.round(100 * x[2] / top)) + '%"></i></div><b>' + nf(x[2]) + '</b></div>';
  });
  const last = St[St.length - 1];
  h += '</div><div class="fnsum"><span><b>' + pc(last[2], top) + '</b> of everyone ' + (a.funnel ? 'reminded' : 'sent to') + ' ' + cvWord(last[0]) + (a.funnel ? ' within 7 days' : '') + '</span>' + SD + '</div>';
  return h;
}
function miniFunnel(a) { const St = funnelSteps(a); return '<span class="mfnl">' + St.map(x => '<b title="' + esc(x[0]) + '">' + nf(x[2]) + '</b>').join('<i>→</i>') + '</span>' }
function statsHTML(a) {
  if (a.n.sent === null) return '<p class="note">Nothing has been sent yet: ' + (rollup(a) === 'Approved' ? 'it is approved and waiting to be switched on.' : 'Cammie approves it first.') + ' The numbers show here once it runs.</p>';
  let h = '<h3 style="font-size:13px;margin:0 0 10px">Funnel, last 30 days</h3>' + funnelHTML(a);
  if (a.funnel) h += '<p class="note">Attended is a check-in to the class in CourtReserve. Some who attended get no follow-up: they had already joined at the desk, or theirs goes tomorrow morning.</p>';
  const dl = n => '<dl><dt>Sent</dt><dd>' + nf(n.sent) + '</dd><dt>Clicked</dt><dd>' + nf(n.click) + ' <small class="soft">' + pc(n.click, n.del) + '</small></dd><dt>Joined</dt><dd>' + nf(n.joined) + '</dd><dt>Opt-outs</dt><dd>' + nf(n.opt) + '</dd><dt class="soft">Opened*</dt><dd class="soft">' + nf(n.open) + '</dd></dl>';
  h += '<div class="sgrid" style="margin-top:18px"><div class="sbx"><h4>Last 7 days</h4>' + dl(a.n7) + '</div><div class="sbx"><h4>Last 30 days</h4>' + dl(a.n) + '</div></div>';
  h += '<h3 style="font-size:13px;margin:20px 0 6px">By email, last 30 days</h3><div class="tw"><table class="t"><tr><th>Email</th><th class="num">Sent</th><th class="num">Clicked</th><th class="num">Joined</th><th class="num">Opt-outs</th></tr>'
    + a.steps.map(s => { const n = a.stepN[s.id]; return '<tr><td>' + esc(s.label) + '</td><td class="num">' + nf(n.sent) + '</td><td class="num">' + nf(n.click) + '</td><td class="num">' + nf(n.joined) + '</td><td class="num">' + nf(n.opt) + '</td></tr>' }).join('') + '</table></div>';
  if (a.id === 'free-class') h += '<h3 style="font-size:13px;margin:20px 0 6px">Last sends</h3><div class="tw"><table class="t"><tr><th>Person (made up)</th><th>Email</th><th>Sent</th><th>Result</th></tr>' + LAST.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + (r[4] ? ' <span class="tag">' + esc(r[4]) + '</span>' : '') + '</td></tr>').join('') + '</table></div>';
  return h + '<p class="note">*Apple Mail opens every email by itself, so opens run high; clicks and joins count for more.</p>';
}

/* ---------- 3. the block editor ---------- */
const FLOW = ['Draft', 'Waiting for approval', 'Approved', 'Running'];
function mfv(k) { const v = who[k]; return v ? '<span class="mfv">' + esc(v) + '</span>' : '<span class="mfv fbk" title="Fallback: no ' + esc(MF[k].label.toLowerCase()) + ' on file">' + esc(MF[k].fb) + '</span>' }
function fill(t) { return esc(t).replace(/\{(first_name|class_time)\}/g, (x, k) => mfv(k)).replace(/\[([^\]]+)\]/g, '<span class="brk">[$1]</span>') }
function lines(s) { // the email as plain lines, for "what changed"
  const L = ['Subject: ' + s.subject, 'Preview text: ' + (s.pre || '')];
  s.blocks.forEach(b => {
    if (b.t === 'text') paras(b.v).forEach(p => L.push((b.h ? 'Heading: ' : 'Text: ') + p.replace(/\n/g, ' ')));
    else if (b.t === 'image') L.push('Image: ' + b.alt);
    else if (b.t === 'button') L.push('Button: ' + b.label + ' (' + b.link + ')');
    else if (b.t === 'divider') L.push('Divider');
    else if (b.t === 'spacer') L.push('Space: ' + (b.size || 24) + ' px');
  });
  return L;
}
function emailHTML(s) {
  const ft = '<div class="ft"><a href="#" onclick="return false">Unsubscribe</a> · Peak Pickleball · <span class="brk">[address and phone, as in Peak\'s footer]</span></div>';
  const blk = (b, full) => {
    if (b.t === 'text') return b.h ? '<h1>' + fill(b.v) + '</h1>' : paras(b.v).map(p => '<p>' + fill(p).replace(/\n/g, '<br>') + '</p>').join('');
    if (b.t === 'image') return '<img class="im" src="' + esc(b.src) + '" alt="' + esc(b.alt) + '">';
    if (b.t === 'button') return b.label ? (full ? '<div class="cta">' : '<p style="margin:20px 0">') + '<a class="bt" href="#" onclick="return false">' + fill(b.label) + '</a>' + (full ? '</div>' : '</p>') : '';
    if (b.t === 'divider') return '<hr>';
    if (b.t === 'spacer') return '<span class="spc" style="height:' + (b.size || 24) + 'px"></span>';
    return '';
  };
  if (s.design === 'full') { // the same blocks, laid out for promotions: a hero image and a colour band before the body
    let h = '<div class="em full"><div class="top"><img src="img/logo-fit-white.png" alt="Peak Pickleball"></div>', i = 0, B = s.blocks;
    if (B[i] && B[i].t === 'image') h += blk(B[i++], 1);
    if (B[i] && B[i].t === 'text' && B[i].h) h += '<div class="band"><h1>' + fill(B[i++].v) + '</h1></div>';
    h += '<div class="in">' + B.slice(i).map(b => blk(b, 1)).join('') + '<p>' + esc(SIG) + '</p></div><p class="tagl">Learn. Play. Connect. Belong.</p>' + ft + '</div>';
    return h;
  }
  return '<div class="em light"><img class="lg" src="img/logo-fit-black.png" alt="Peak Pickleball">' + s.blocks.map(b => blk(b)).join('') + '<p class="sig">' + esc(SIG) + '</p>' + ft + '</div>';
}
function checks(s) {
  const imgs = s.blocks.filter(b => b.t === 'image').length;
  const words = s.blocks.filter(b => b.t === 'text').map(b => b.v).join(' ').split(/\s+/).filter(Boolean).length;
  const links = s.blocks.filter(b => b.t === 'button' && b.label).length + s.blocks.filter(b => b.t === 'text').reduce((t, b) => t + (b.v.match(/https?:\/\/\S+/g) || []).length, 0);
  const subj = s.subject.trim(), L = [...subj].length;
  const all = [s.subject, s.pre].concat(s.blocks.flatMap(b => [b.v, b.label, b.link, b.alt])).filter(Boolean).join(' ');
  const br = all.match(/\[[^\]]+\]/g) || [];
  const C = [];
  C.push(!imgs ? {ok: 1, t: 'Images and text', w: 'Text only, ' + words + ' words. Reads like a note from a person.'}
    : words / imgs >= 60 ? {ok: 1, t: 'Images and text', w: imgs + ' image' + (imgs > 1 ? 's' : '') + ', ' + words + ' words: a healthy balance.'}
    : {ok: 0, t: 'Images and text', w: imgs + ' image' + (imgs > 1 ? 's' : '') + ', only ' + words + ' words. Mostly picture: add text or drop an image.'});
  C.push(links === 0 ? {ok: 1, t: 'Links', w: 'No links. Fine for a note; add a button if they need to act.'}
    : links <= 2 ? {ok: 1, t: 'Links', w: links + ' link' + (links > 1 ? 's' : '') + '. One or two is best.'}
    : {ok: 0, t: 'Links', w: links + ' links. More links look like a promotion: keep it to one or two.'});
  C.push({ok: 1, t: 'Unsubscribe link', w: 'In the locked footer, on every email.'});
  C.push(!L ? {ok: 0, block: 1, t: 'Subject length', w: 'No subject yet.'} : L <= 50 ? {ok: 1, t: 'Subject length', w: L + ' characters. Shows in full on most phones.'}
    : {ok: 0, t: 'Subject length', w: L + ' characters. Phones show about 40 to 50, so the end may be cut off.'});
  C.push(!br.length ? {ok: 1, t: '[Brackets] to fill', w: 'None left. Ready for Cammie to approve.'}
    : {ok: 0, block: 1, t: '[Brackets] to fill', w: br.length + ' still to fill: ' + esc(br.slice(0, 3).join(', ')) + (br.length > 3 ? ' and more' : '') + '.'});
  const promo = s.design === 'full' || imgs >= 2 || links >= 3;
  const why = s.design === 'full' ? 'The Full design (photo, colour bands) reads as a promotion.' : promo ? 'Light, but ' + (imgs >= 2 ? 'the images' : 'the links') + ' make it read as a promotion.' : 'Light, one button, mostly text: reads like a note from a person.';
  return {C, promo, why, blocked: C.some(c => c.block && !c.ok), br: br.length};
}
function stepper(cur) {
  const i = FLOW.indexOf(cur);
  return '<div class="flowp" aria-label="Approval steps">' + FLOW.map((x, j) => (j ? '<b class="' + (j <= i ? 'done' : '') + '"></b>' : '') + '<span class="' + (j < i || (j === i && x === 'Running') ? 'done' : j === i ? 'cur' : '') + '"><i>' + (j < i || (j === i && x === 'Running') ? '✓' : j + 1) + '</i>' + x + '</span>').join('') + '</div>';
}
const MAILNOTE = '<p class="mailnote">' + I.mail + '<span>Cammie gets an email when something is waiting for her. Mock only: no email is sent.</span></p>';
let lastField = null, dragI = null, view = 'desktop';
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('[data-mfok]')) lastField = e.target });
function drawEditor(aid, sid, look) {
  const a = byId(aid); const s = a && a.steps.find(x => x.id === sid);
  if (s && (look === 'full' || look === 'light')) s.design = look;
  if (!s) { $('#view').innerHTML = '<p>That email is not in this mock. <a href="#/automations">Back to Automations</a></p>'; return }
  drClose(true); lastField = null;
  const chips = '<div class="chips" aria-label="Insert a merge field">' + Object.keys(MF).map(k => '<button type="button" class="chip" data-mf="' + k + '">{' + k + '}</button>').join('') + '</div>';
  let h = '<p class="crumb"><a href="#/automations">Automations</a> › <a href="#/automations/' + a.id + '">' + esc(a.name) + '</a> › ' + esc(s.label) + '</p>'
    + '<div class="edtop"><h1>' + esc(s.label) + '</h1><span id="edst">' + pill(s.status) + '</span><span class="soft tiny">' + esc(s.when) + (s.service ? ' · service email' : '') + '</span>'
    + '<div class="r"><label class="pa">Preview as <select id="pas">' + PEOPLE.map(p => '<option value="' + p.id + '"' + (p === who ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></label>'
    + '<button class="btn" id="test">Test to me</button><button class="btn" id="testc">Test to Cammie</button><button class="btn pri" id="save">Save</button></div></div>'
    + '<div class="ed"><div class="c c1">'
    + '<section class="panel"><div class="hd"><h2>Inbox line</h2></div><div class="bd">'
    + '<div class="fld"><label class="l" for="e-subject">Subject <span class="cnt" id="sl"></span></label><input id="e-subject" data-f="subject" data-mfok value="' + esc(s.subject) + '">' + chips + '</div>'
    + '<div class="fld"><label class="l" for="e-pre">Preview text</label><input id="e-pre" data-f="pre" data-mfok value="' + esc(s.pre) + '"><div class="hint">The grey line after the subject in the inbox.</div></div></div></section>'
    + '<section class="panel"><div class="hd"><h2>Blocks</h2></div><div class="bd"><div class="blocks" id="blocks"></div>'
    + '<div class="addb">Add: ' + [['text', 'Text'], ['image', 'Image'], ['button', 'Button'], ['divider', 'Divider'], ['spacer', 'Spacer']].map(x => '<button class="btn" data-add="' + x[0] + '">+ ' + x[1] + '</button>').join('') + '</div><p class="hint" style="margin-top:8px">Light and Full lay out the same blocks. Drag a block by its handle, or use the arrows.</p></div></section>'
    + '<section class="panel"><div class="hd"><h2>Merge fields</h2></div><div class="bd"><div class="mfl">'
    + Object.keys(MF).map(k => '<div class="mfr"><button type="button" class="chip" data-mf="' + k + '">{' + k + '}</button><label class="fb">If empty, use <input data-fb="' + k + '" value="' + esc(MF[k].fb) + '" aria-label="Fallback for ' + k + '"></label></div>').join('')
    + '</div><p class="hint" style="margin-top:10px">Click a field to insert it where you are typing. Preview as "No first name on file" to see the fallback.</p></div></section>'
    + brandKit() + '</div>'
    + '<div class="c c2"><div class="pvw"><section class="panel"><div class="pvbar"><div class="seg" role="group" aria-label="Design"><button type="button" data-d="light" aria-pressed="' + (s.design !== 'full') + '">Light</button><button type="button" data-d="full" aria-pressed="' + (s.design === 'full') + '">Full design</button></div>'
    + '<div class="seg r" role="group" aria-label="Preview size"><button type="button" data-v="phone" aria-pressed="' + (view === 'phone') + '">' + I.phone + 'Phone</button><button type="button" data-v="desktop" aria-pressed="' + (view === 'desktop') + '">' + I.desk + 'Desktop</button></div></div>'
    + '<p class="segnote" id="segnote"></p><div class="inbox" id="pv"></div></section></div></div>'
    + '<div class="c c3"><section class="panel"><div class="hd"><h2>Inbox checks</h2><span class="r soft tiny">Update as you edit</span></div><div class="bd"><ul class="chks" id="chk"></ul><div class="likely" id="likely"></div></div></section>'
    + '<section class="panel" id="appr"></section></div></div>';
  $('#view').innerHTML = h;
  const pv = () => {
    const K = checks(s);
    $('#segnote').textContent = s.design === 'full' ? 'Full design: the first image becomes a full-width photo and the first heading a colour band. For promotions (birthday, win-backs, newsletters).' : 'Light: logo, Peak colours, mostly text and one button. Reads like a note from a person, so it is more likely to reach the main inbox.';
    const pv = $('#pv'); pv.className = 'inbox' + (view === 'phone' ? ' phone' : '');
    pv.innerHTML = '<div class="ih"><div class="tp"><span><b>Peak Pickleball</b> &lt;hello@mail.peak.example&gt;</span><span class="tabi' + (K.promo ? ' pr">Likely: Promotions' : '">Likely: Primary inbox') + '</span></div>'
      + '<span class="su">' + fill(s.subject) + '</span>' + (s.pre ? '<span class="pre">' + fill(s.pre) + '</span>' : '') + '<div class="tiny soft">To: ' + esc(who.email) + '</div></div><div class="ib">' + emailHTML(s) + '</div>';
    $('#chk').innerHTML = K.C.map(c => '<li class="' + (c.ok ? 'g' : 'a') + (c.block ? ' block' : '') + '"><span class="d">' + (c.ok ? I.ok : I.warn) + '</span><div><b>' + c.t + '</b><span>' + c.w + '</span></div></li>').join('');
    $('#likely').innerHTML = '<span class="tabi' + (K.promo ? ' pr">Likely: Promotions' : '">Likely: Primary inbox') + '</span>' + esc(K.why);
    $('#sl').textContent = [...s.subject].length + ' characters';
    appr(a, s);
  };
  const drawBlocks = () => {
    const B = s.blocks, n = B.length;
    const head = (b, i, ty) => '<div class="bh"><span class="grip" title="Drag to move" data-grip="' + i + '">' + I.grip + '</span><span class="ty">' + ty + '</span><span class="r">'
      + '<button class="ib2" data-mv="' + i + '" data-dir="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + I.up + '</button><button class="ib2" data-mv="' + i + '" data-dir="1" aria-label="Move down"' + (i < n - 1 ? '' : ' disabled') + '>' + I.down + '</button>'
      + '<button class="ib2 del" data-rm="' + i + '" aria-label="Remove block">' + I.x + '</button></span></div>';
    $('#blocks').innerHTML = B.map((b, i) => {
      if (b.t === 'text') return '<div class="blk" data-i="' + i + '">' + head(b, i, b.h ? 'Text · heading' : 'Text') + '<div class="bb"><textarea data-b="' + i + '" data-k="v" data-mfok rows="' + (b.h ? 1 : Math.min(9, Math.max(3, paras(b.v).length * 2))) + '" aria-label="Text">' + esc(b.v) + '</textarea>'
        + '<div class="sm">Style <select data-b="' + i + '" data-k="h"><option value="">Paragraph</option><option value="1"' + (b.h ? ' selected' : '') + '>Heading</option></select><span>A blank line starts a new paragraph.</span></div></div></div>';
      if (b.t === 'image') return '<div class="blk" data-i="' + i + '">' + head(b, i, 'Image') + '<div class="bb"><div class="rowi"><img src="' + esc(b.src) + '" alt=""><div><select data-b="' + i + '" data-k="src" aria-label="Photo">' + PHOTOS.map(p => '<option value="' + p[0] + '"' + (p[0] === b.src ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') + '</select>'
        + '<div class="sm">Alt text <input data-b="' + i + '" data-k="alt" value="' + esc(b.alt) + '" style="height:28px" aria-label="Alt text"></div></div></div></div></div>';
      if (b.t === 'button') return '<div class="blk" data-i="' + i + '">' + head(b, i, 'Button') + '<div class="bb"><div class="row2"><input data-b="' + i + '" data-k="label" data-mfok value="' + esc(b.label) + '" placeholder="Label" aria-label="Button label"><input data-b="' + i + '" data-k="link" value="' + esc(b.link) + '" placeholder="Link" aria-label="Button link"></div></div></div>';
      if (b.t === 'divider') return '<div class="blk dv" data-i="' + i + '">' + head(b, i, 'Divider') + '<div class="bb"><hr></div></div>';
      return '<div class="blk sp" data-i="' + i + '">' + head(b, i, 'Spacer') + '<div class="bb">Height <select data-b="' + i + '" data-k="size" style="width:auto;height:28px">' + [16, 24, 40].map(z => '<option' + ((b.size || 24) === z ? ' selected' : '') + '>' + z + '</option>').join('') + '</select> px</div></div>';
    }).join('') || '<p class="soft tiny">No blocks. Add one below.</p>';
    $$('#blocks [data-b]').forEach(el => { const ev = el.tagName === 'SELECT' ? 'onchange' : 'oninput'; el[ev] = () => { const b = B[+el.dataset.b], k = el.dataset.k; b[k] = k === 'h' ? !!el.value : k === 'size' ? +el.value : el.value; if (k === 'h' || k === 'src') { if (k === 'src') b.alt = (PHOTOS.find(p => p[0] === b.src) || [])[1] || b.alt; drawBlocks() } pv() } });
    $$('#blocks [data-mv]').forEach(x => x.onclick = () => { const i = +x.dataset.mv, j = i + +x.dataset.dir; [B[i], B[j]] = [B[j], B[i]]; drawBlocks(); pv() });
    $$('#blocks [data-rm]').forEach(x => x.onclick = () => { B.splice(+x.dataset.rm, 1); drawBlocks(); pv(); toast('Block removed (in this tab only).') });
    $$('#blocks .grip').forEach(g => { const el = g.closest('.blk'); g.onmousedown = () => { el.draggable = true } });
    $$('#blocks .blk').forEach(el => {
      el.ondragstart = e => { dragI = +el.dataset.i; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move' };
      el.ondragend = () => { el.draggable = false; el.classList.remove('drag'); $$('#blocks .over').forEach(x => x.classList.remove('over')) };
      el.ondragover = e => { e.preventDefault(); el.classList.add('over') }; el.ondragleave = () => el.classList.remove('over');
      el.ondrop = e => { e.preventDefault(); const to = +el.dataset.i; if (dragI === null || dragI === to) return; const [m] = B.splice(dragI, 1); B.splice(to, 0, m); dragI = null; drawBlocks(); pv() };
    });
  };
  drawBlocks(); pv();
  $$('[data-f]').forEach(el => el.oninput = () => { s[el.dataset.f] = el.value; pv() });
  $$('[data-add]').forEach(b => b.onclick = () => { const t = b.dataset.add; s.blocks.push(t === 'text' ? T('New paragraph. Hi {first_name}!') : t === 'image' ? IMG(1) : t === 'button' ? BTN('Book now', '[link]') : t === 'divider' ? {t: 'divider'} : {t: 'spacer', size: 24}); drawBlocks(); pv() });
  $$('[data-mf]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => {
    const ae = document.activeElement, el = ae && ae.matches && ae.matches('[data-mfok]') ? ae : lastField && document.body.contains(lastField) ? lastField : $('#e-subject'), t = '{' + b.dataset.mf + '}', p = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, p) + t + el.value.slice(el.selectionEnd ?? p); el.focus(); el.setSelectionRange(p + t.length, p + t.length); el.oninput() } });
  $$('[data-fb]').forEach(el => el.oninput = () => { MF[el.dataset.fb].fb = el.value || '…'; pv() });
  $('#pas').onchange = e => { who = PEOPLE.find(p => p.id === e.target.value); pv() };
  $$('[data-d]').forEach(b => b.onclick = () => { s.design = b.dataset.d; $$('[data-d]').forEach(x => x.setAttribute('aria-pressed', x === b)); pv() });
  $$('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; $$('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b)); pv() });
  $('#save').onclick = () => { a.updated = 'Just now'; if (s.status === 'Approved' || s.status === 'Running') toast('Saved in this mock. A change after approval goes back to Cammie.'); else toast('Saved in this tab only. Nothing sends.') };
  $('#test').onclick = () => toast('Mock: no test was sent to you.');
  $('#testc').onclick = () => toast('Mock: no test was sent to Cammie.');
}
function brandKit(inSettings) {
  return '<section class="panel"><div class="hd"><h2>Brand kit</h2><span class="r"><span class="lock">' + I.lock + 'Locked</span></span></div><div class="bd"><div class="bk">'
    + '<div class="rw"><span>Logo</span><span class="lg"><img src="img/logo-fit-black.png" alt="Peak Pickleball logo, dark"><span class="dk"><img src="img/logo-fit-white.png" alt="Peak Pickleball logo, light"></span></span></div>'
    + '<div class="rw"><span>Colours</span><span class="sw3">' + [['#23C5E2', 'Cyan'], ['#1F3D67', 'Navy'], ['#231F20', 'Ink'], ['#F3F5F7', 'Light']].map(c => '<span title="' + c[1] + '"><i style="background:' + c[0] + '"></i>' + c[0] + '</span>').join('') + '</span></div>'
    + '<div class="rw fo"><span>Fonts</span><span><b style="font-family:\'Golos Text\'">Golos Text</b> headings, <b style="font-family:Inter">Inter</b> body. Arial where an inbox blocks web fonts.</span></div>'
    + '<div class="rw"><span>Footer</span><span>Unsubscribe link, Peak\'s address and phone. Sign-off: ' + esc(SIG) + '</span></div>'
    + '<div class="bk ok">' + I.ok + 'Every email stays on-brand automatically</div>'
    + '<p class="hint">' + (inSettings ? 'Taken from Peak\'s website and brand sheet. [Fonts: Cammie decides]' : 'Set once for the workspace in Settings, not per email.') + '</p></div></div></section>';
}
function appr(a, s) {
  const K = checks(s);
  const dis = K.blocked ? ' disabled title="Fill every [bracket] first"' : '';
  const b = {Draft: '<button class="btn pri" data-to="Waiting for approval">Send to Cammie</button>',
    'Waiting for approval': '<button class="btn pri" data-to="Approved"' + dis + '>Approve (as Cammie)</button><button class="btn" data-to="Draft">Ask for changes</button>',
    Approved: '<button class="btn pri" data-to="Running">Switch on</button><button class="btn" data-to="Draft">Back to draft</button>',
    Running: '<button class="btn" data-to="Approved">Pause this email</button>'}[s.status] || '';
  const say = {Draft: 'Matthew is still writing this one. When it is ready, send it to Cammie.', 'Waiting for approval': 'Waiting for Cammie. She reads it, sends herself a test, then approves it or asks for changes.',
    Approved: 'Approved' + (s.approvedAt ? ' by Cammie, ' + esc(s.approvedAt) : '') + '. It goes live when it is switched on.', Running: 'Live. Any change goes back to Cammie for approval before it sends.'}[s.status];
  const last = [...s.hist].reverse().find(x => x.ap);
  $('#appr').innerHTML = '<div class="hd"><h2>Approval</h2><span class="r"><a class="tiny" href="#/approvals">History and comments</a></span></div><div class="bd">' + stepper(s.status) + '<p class="soft tiny" style="margin-bottom:12px">' + say + (last && s.status !== 'Approved' ? ' Last approved by ' + esc(last.who) + ', ' + esc(last.at) + '.' : '') + '</p>'
    + '<div class="btnrow">' + b + '</div>' + (s.status === 'Waiting for approval' && K.blocked ? '<p class="blockmsg">Approval is blocked: ' + (K.br ? K.br + ' [bracket' + (K.br > 1 ? 's' : '') + '] still to fill.' : 'add a subject.') + '</p>' : '') + MAILNOTE + '</div>';
  $$('#appr [data-to]').forEach(x => x.onclick = () => setStatus(a, s, x.dataset.to, () => { if ($('#appr')) { appr(a, s); $('#edst').innerHTML = pill(s.status) } }));
}
function setStatus(a, s, to, redraw, note) {
  const from = s.status; s.status = to;
  if (to === 'Approved' && from === 'Waiting for approval') { s.approvedAt = 'Just now'; s.hist.push(H('Just now', 'Cammie', 'approved it', 1)); s.prev = {at: 'Just now', lines: lines(s)} }
  else if (to === 'Waiting for approval') { s.sentAt = 'Just now'; s.hist.push(H('Just now', 'Matthew Sharpe', 'sent it for approval')) }
  else if (to === 'Draft' && from === 'Waiting for approval') s.hist.push(H('Just now', 'Cammie', 'asked for changes'));
  else if (to === 'Running') { a.on = true; a.paused = false; if (!a.last) a.next = 'Tomorrow, 9:00 am'; s.hist.push(H('Just now', 'Matthew Sharpe', 'switched it on')) }
  if (note) s.thread.push({who: to === 'Draft' ? 'Cammie' : 'Matthew Sharpe', at: 'Just now', text: note});
  badge(); redraw();
  toast({'Waiting for approval': 'Sent to Cammie (in this mock only).', Approved: 'Approved (in this mock only).', Draft: from === 'Waiting for approval' ? 'Sent back to Matthew with changes asked (mock).' : 'Back to draft.', Running: 'Switched on in this mock only. Nothing sends.'}[to]);
}

/* ---------- 4. Approvals ---------- */
function diffHTML(s) {
  if (!s.prev) return '<p class="soft tiny">The first time Cammie sees this email: nothing to compare yet.</p>';
  const now = lines(s), was = s.prev.lines;
  const gone = was.filter(x => !now.includes(x)), added = now.filter(x => !was.includes(x));
  if (!gone.length && !added.length) return '<p class="soft tiny">No changes since Cammie approved it (' + esc(s.prev.at) + ').</p>';
  const sp = x => { if (!x) return ''; const i = x.indexOf(':'); return i > 0 ? '<i>' + esc(x.slice(0, i)) + '</i>' + fill(x.slice(i + 1).trim()) : esc(x) };
  let h = '<div class="diff"><div class="dhd"><span>Approved ' + esc(s.prev.at) + '</span><span>Now</span></div>';
  for (let i = 0; i < Math.max(gone.length, added.length); i++) h += '<div class="dr"><span class="o">' + sp(gone[i]) + '</span><span class="n">' + sp(added[i]) + '</span></div>';
  return h + '</div>';
}
function threadHTML(s, key) {
  const cm = c => '<div class="cm"><span class="av' + (c.who === 'Cammie' ? ' c' : '') + '">' + (c.who === 'Cammie' ? 'C' : 'MS') + '</span><div><div class="w"><b>' + esc(c.who) + '</b>' + esc(c.at) + '</div><p>' + fill(c.text) + '</p></div></div>';
  return '<div class="thread">' + (s.thread.length ? s.thread.map(cm).join('') : '<p class="soft tiny">No comments yet.</p>') + '</div>'
    + '<div class="reply"><textarea id="rp-' + key + '" rows="2" placeholder="Add a comment, or say what to change" aria-label="Comment"></textarea><div><button class="btn sm" data-post="' + key + '">Comment</button></div></div>';
}
function drawApprovals() {
  const W = waiting(), R = []; A.forEach(a => a.steps.forEach(s => { if (s.status === 'Approved') R.push([a, s]) }));
  const item = ([a, s]) => {
    const key = a.id + '/' + s.id, K = checks(s);
    return '<article class="aitem" data-item="' + key + '"><div class="ah"><div><h3>' + esc(a.name) + ': ' + esc(s.label) + ' ' + pill(s.status) + '</h3>'
      + '<p class="meta">Subject: ' + esc(s.subject) + '</p><p class="meta">Sent for approval by <b>Matthew Sharpe</b>, ' + esc(s.sentAt || 'Mon 23 Nov') + ' · ' + esc(s.when) + ' · ' + (s.design === 'full' ? 'Full design' : 'Light') + '</p></div>'
      + '<a class="btn" href="#/edit/' + a.id + '/' + s.id + '">Open in the editor</a></div>'
      + '<div class="ab"><div><h4>What changed since the last approval</h4>' + diffHTML(s) + '<h4 style="margin-top:16px">History</h4><ul class="hist">' + [...s.hist].reverse().map(x => '<li class="' + (x.ap ? 'ap' : '') + '"><span><b>' + esc(x.who) + '</b> ' + esc(x.what) + ' · ' + esc(x.at) + '</span></li>').join('') + '</ul></div>'
      + '<div><h4>Comments ' + (s.thread.length ? SD : '') + '</h4>' + threadHTML(s, key) + '</div></div>'
      + '<div class="af">' + MAILNOTE + '<button class="btn" data-chg="' + key + '">Ask for changes</button><button class="btn pri" data-ok="' + key + '"' + (K.blocked ? ' disabled title="Fill every [bracket] first"' : '') + '>Approve</button>'
      + (K.blocked ? '<p class="blockmsg" style="flex-basis:100%;margin:0">Approve is blocked: ' + (K.br ? K.br + ' [bracket' + (K.br > 1 ? 's' : '') + '] still to fill in the email.' : 'no subject.') + '</p>' : '') + '</div></article>';
  };
  const ok = ([a, s]) => '<article class="aitem"><div class="ah"><div><h3>' + esc(a.name) + ': ' + esc(s.label) + ' ' + pill(s.status) + '</h3><p class="meta">Approved by <b>Cammie</b>, ' + esc(s.approvedAt || 'Mon 23 Nov') + '. Not switched on yet.</p></div>'
    + '<div class="btnrow"><a class="btn" href="#/edit/' + a.id + '/' + s.id + '">Open</a></div></div></article>';
  let h = '<div class="ph"><h1>Approvals</h1><span class="soft">' + W.length + ' waiting for Cammie</span></div>'
    + '<p class="intro">Every email goes Draft → Waiting for approval → Approved → Running. Cammie approves each one before it goes live, and any later change comes back here.</p>'
    + '<section><div class="aq">' + (W.length ? W.map(item).join('') : '<p class="soft">Nothing is waiting.</p>') + '</div></section>'
    + '<section class="sec"><h2>Approved, ready to switch on</h2>' + (R.length ? R.map(ok).join('') : '<p class="soft">None.</p>') + '</section><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
  const find = k => { const [ai, si] = k.split('/'); const a = byId(ai); return [a, a.steps.find(x => x.id === si)] };
  $$('[data-ok]').forEach(b => b.onclick = () => { const [a, s] = find(b.dataset.ok); setStatus(a, s, 'Approved', drawApprovals) });
  $$('[data-chg]').forEach(b => b.onclick = () => { const k = b.dataset.chg, t = $('#rp-' + CSS.escape(k)); if (!t.value.trim()) { t.focus(); toast('Say what to change in a comment first.'); return } const [a, s] = find(k); setStatus(a, s, 'Draft', drawApprovals, t.value.trim()) });
  $$('[data-post]').forEach(b => b.onclick = () => { const k = b.dataset.post, t = $('#rp-' + CSS.escape(k)); if (!t.value.trim()) { t.focus(); return } const [, s] = find(k); s.thread.push({who: 'Matthew Sharpe', at: 'Just now', text: t.value.trim()}); drawApprovals(); toast('Comment added (this tab only).') });
}

/* ---------- 5. Results ---------- */
function drawResults() {
  const run = RUN(), t = k => sumN(k, run);
  const P = {sent: 140, opt: 2, joined: 6};
  const fc = byId('free-class');
  let h = '<div class="ph"><h1>Results</h1><span class="soft">Last 30 days</span></div><p class="intro">What Peak\'s emails did. Joined is read from CourtReserve: a paid plan that started within 7 days of an email.</p>' + numsRow('')
    + '<div class="res2"><section class="panel"><div class="hd"><h2>Free-class funnel</h2><span class="r"><a class="tiny" href="#/automations/free-class/stats">Open the automation</a></span></div><div class="bd">' + funnelHTML(fc) + '</div></section>'
    + '<section class="panel"><div class="hd"><h2>By automation</h2><span class="r">' + SD + '</span></div><div class="bd" style="padding-top:6px"><div class="tw"><table class="t"><tr><th>Automation</th><th class="num">Sent</th><th class="num">Clicked</th><th class="num">Joined</th><th class="num">Opt-outs</th><th>Funnel</th></tr>'
    + run.map(a => { const n = a.n; return '<tr><td><a href="#/automations/' + a.id + '/stats">' + esc(a.name) + '</a></td><td class="num">' + nf(n.sent) + '</td><td class="num">' + nf(n.click) + '</td><td class="num">' + nf(n.joined) + '</td><td class="num">' + nf(n.opt) + '</td><td>' + miniFunnel(a) + '</td></tr>' }).join('')
    + '</table></div><p class="note">The other ' + (A.length - run.length) + ' automations have sent nothing yet. Funnel: ' + 'reminded → attended → follow-up → joined for the free class; sent → delivered → clicked for the others.</p>'
    + '<p class="cmp">' + SD + ' <b>Against Patch:</b> in the same 30 days a year ago, Patch sent ' + nf(P.sent) + ' of these emails, with ' + P.opt + ' opt-outs and ' + P.joined + ' members who joined. Outbox: ' + nf(t('sent')) + ' sent, ' + t('opt') + ' opt-out, ' + t('joined') + ' joined.</p></div></section></div>'
    + '<p class="note">*Opens run high because Apple Mail opens every email by itself, so clicks and joins count for more. A readout like this goes to Cammie every two weeks.</p><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
}

/* ---------- 6. Settings ---------- */
function drawSettings() {
  const R = RULES, hrs = [...Array(24).keys()];
  const hsel = (id, v) => '<select id="' + id + '">' + hrs.map(x => '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + fmtH(x) + '</option>').join('') + '</select>';
  const tsw = (k, lab) => '<button class="sw' + (R[k] ? ' on' : '') + '" role="switch" aria-checked="' + !!R[k] + '" data-tg="' + k + '" aria-label="' + esc(lab) + '"><span></span></button>';
  const svc = A.flatMap(a => a.steps.filter(s => s.service).map(s => a.steps.length > 1 ? a.name + ': ' + s.label : a.name));
  let h = '<div class="ph"><h1>Settings</h1><span class="soft">Peak Pickleball workspace</span></div><p class="intro">How Peak\'s emails are sent. Values marked ' + EX + ' show the layout only.</p><div class="sets">'
    + '<section class="panel wide" id="rules"><div class="hd"><h2>Sending rules</h2><span class="r soft tiny">Across every automation</span></div><div class="bd"><div class="rules">'
    + '<div><h3>Emails per person</h3><p class="d">So no one hears from Peak too often, however many automations they qualify for.</p>'
    + '<div class="tg">' + tsw('capOn', 'Cap emails per person') + '<div class="inl">At most <input type="number" id="capN" min="1" max="10" value="' + R.capN + '" aria-label="Emails"> emails per person in <input type="number" id="capD" min="1" max="30" value="' + R.capD + '" aria-label="Days"> days</div></div>'
    + '<div class="tg">' + tsw('svcEx', 'Service emails are exempt') + '<div><b>Service emails don\'t count</b><span>Class reminders and payment notices always go, and don\'t use up the cap.</span><div class="svc">' + svc.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div></div>'
    + '<p class="d" style="margin-top:12px">Over the cap: the email waits for the next day it fits. [Or skip it after 2 days: Cammie to choose]</p></div>'
    + '<div><h3>Quiet hours</h3><p class="d">Nothing sends overnight. Times are Mountain Time (MT).</p>'
    + '<div class="tg">' + tsw('qOn', 'Quiet hours') + '<div class="inl">No sends between ' + hsel('qFrom', R.qFrom) + ' and ' + hsel('qTo', R.qTo) + ' MT</div></div>'
    + '<p class="d" style="margin-top:12px" id="qnote"></p></div></div><p class="eff" id="eff"></p></div></section>'
    + '<section class="panel"><div class="hd"><h2>Sending domain</h2><span class="r">' + EX + '</span></div><div class="bd"><dl class="kvs"><dt>Domain</dt><dd><code>mail.peak.example</code></dd><dt>From</dt><dd>Peak Pickleball &lt;hello@mail.peak.example&gt;</dd><dt>Replies go to</dt><dd>[Peak inbox: Cammie to choose]</dd></dl>'
    + '<ul class="chk">' + [['SPF', 'Says which servers may send for the domain'], ['DKIM', 'Signs each email so it can\'t be faked'], ['DMARC', 'Tells inboxes what to do with fakes']].map(r => '<li><i aria-hidden="true">✓</i><b>' + r[0] + '</b><span>Passing. ' + r[1] + '</span></li>').join('') + '</ul></div></section>'
    + '<section class="panel"><div class="hd"><h2>Unsubscribes</h2><span class="r">' + SD + '</span></div><div class="bd"><p class="soft" style="margin-bottom:10px;font-size:13px">Anyone who unsubscribed in Patch or in CourtReserve never gets a marketing email from Outbox. Every email carries an unsubscribe link.</p>'
    + '<dl class="kvs"><dt>Imported from Patch</dt><dd><b>1,240</b> addresses, Tue 24 Nov</dd><dt>Since then</dt><dd><b>1</b> more, from Outbox\'s own link</dd><dt>Who gets emails</dt><dd>Only accounts opted in to marketing email in CourtReserve</dd></dl>'
    + '<div class="btnrow" style="margin-top:12px"><button class="btn sm" id="imp">Import again from Patch</button><span class="soft tiny">Does nothing in the mock.</span></div></div></section>'
    + '<section class="panel"><div class="hd"><h2>CourtReserve connection</h2><span class="r">' + EX + '</span></div><div class="bd"><p style="margin-bottom:10px;font-size:13px"><span class="okdot"></span><b>Connected</b> · read only</p><dl class="kvs"><dt>Checks</dt><dd>Every 15 minutes</dd><dt>Last check</dt><dd>Today, 4:15 pm</dd>'
    + '<dt>Reads</dt><dd>Bookings (the free class), class times, check-ins, plan starts and ends, new accounts, marketing opt-ins</dd><dt>Never</dt><dd>Changes anything in CourtReserve</dd></dl></div></section>'
    + '<section class="panel"><div class="hd"><h2>People and texts</h2></div><div class="bd"><dl class="kvs"><dt>Matthew Sharpe</dt><dd>Editor: writes and builds each email</dd><dt>Cammie</dt><dd>Approver: approves each email before it goes live, and gets an email when one is waiting (mock: none sent)</dd>'
    + '<dt>Texts</dt><dd>Later. Not set up. When they are, texts go only to people opted in to texts.</dd></dl></div></section>'
    + brandKit(1).replace('<section class="panel">', '<section class="panel wide">') + '</div><p class="foot">Outbox · mock for review</p>';
  $('#view').innerHTML = h;
  const upd = () => {
    $('#capN').disabled = $('#capD').disabled = !R.capOn; $('#qFrom').disabled = $('#qTo').disabled = !R.qOn;
    $('#qnote').textContent = R.qOn ? 'Emails due in quiet hours wait in a queue and go at ' + fmtH(R.qTo) + ' MT.' : 'Off: emails go the moment they are due, day or night.';
    $('#eff').textContent = 'In practice: ' + (R.capOn ? 'one person gets at most ' + R.capN + ' marketing email' + (R.capN > 1 ? 's' : '') + ' in any ' + R.capD + ' days' + (R.svcEx ? ', plus any class reminders' : ', class reminders included') : 'no cap on how many emails one person gets')
      + '. ' + (R.qOn ? 'A follow-up due at 9:40 pm goes at ' + fmtH(R.qTo) + ' the next morning.' : 'A follow-up due at 9:40 pm goes at 9:40 pm.') + ' (Settings change in this tab only.)';
  };
  upd();
  $$('[data-tg]').forEach(b => b.onclick = () => { const k = b.dataset.tg; R[k] = !R[k]; b.classList.toggle('on', R[k]); b.setAttribute('aria-checked', R[k]); upd() });
  $('#capN').oninput = e => { R.capN = Math.max(1, +e.target.value || 1); upd() }; $('#capD').oninput = e => { R.capD = Math.max(1, +e.target.value || 1); upd() };
  $('#qFrom').onchange = e => { R.qFrom = +e.target.value; upd() }; $('#qTo').onchange = e => { R.qTo = +e.target.value; upd() };
  $('#imp').onclick = () => toast('Mock: nothing was imported.');
}

route();
