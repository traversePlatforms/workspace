#!/usr/bin/env python3
"""Sponsor add-ons: ONE list -> the sponsor hand-out and the internal time sheet (26 Nov 2026).

Matthew: "group this up into catergories. Like is one is marketing, or one in website etc". Both sheets number the items the same way
because both come from CATS below. Edit here, then:
  python3 matthew/peak-pickleball-sponsorship/tools/build-add-ons.py
  node shared/tools/traverse-pdf.mjs matthew/peak-pickleball-sponsorship/sponsor-add-ons-list-2026-11-26.html
  node shared/tools/traverse-pdf.mjs matthew/peak-pickleball-sponsorship/sponsor-add-ons-time-2026-11-26.html
Hours are my estimates of Matthew's (and my) time. "Built" = already running for Peak/Traverse: Peak sender tracked links + opens/clicks
(18-20 Nov), links.peakpickleball.us (20 Nov), cookie-free site stats (20 Nov), post calendar with approver tap, Golden Ring video tools
(25 Nov), Meta ads on the Traverse token (25 Nov), GBP + Meta pulls (25 Nov).
"""
import html
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
B = 'BUILT'
# category, sponsor-facing blurb, items: (key, name, hand-out text, internal text, dependency note, build, set up, monthly)
CATS = [
 ('Tracking and reports', 'Proof of what the sponsorship did.', [
  ('qr', 'Tracked QR codes', 'Your own QR codes for court signs, banners and table tents. Every scan is counted.',
   'Own code per sponsor for signs and table tents; every scan counted.', '', '2–3 h', '15 min', '~0 (runs itself)'),
  ('report', 'Monthly sponsor report', 'One page each month with your scans, clicks, visits and results in one place.',
   'One page a month: scans, link clicks, email clicks, plus any stats below.', '', '6–8 h', '30 min', '15–30 min'),
  ('stats', 'Website visitor stats', 'Simple, cookie-free counts of who visits your website, added to your report.',
   'Cookie-free counts, into the monthly report.', '', B, '1 h', '~0'),
  ('sstats', 'Social media stats', 'Reach, followers and clicks from your pages, added to your report.',
   'Reach, followers, clicks into the monthly report.', '', '2–3 h', '1 h', '~0'),
 ]),
 ('At Peak', 'Your business in front of Peak members.', [
  ('tv', "Sponsor slides on Peak's TVs", 'Your business in a rotating reel on the screens around the club, including "Court 4 presented by" boards.',
   'Rotating reel and "Court 4 presented by" boards.', 'Depends on what runs the TVs.', '8–12 h', '1 h', '15–30 min'),
  ('spot', 'Partner spot in member emails', 'A "This month\'s partner" feature in Peak\'s emails to members.',
   '"This month\'s partner" block, clicks counted; time only in months they\'re featured.', '', '2 h', '15 min', '30 min'),
  ('page', "Sponsor page on Peak's website", 'A profile of your business on peakpickleball.us with links to you.',
   'Profile with tracked links.', 'Needs the website login.', '4–6 h', '1 h', '15 min'),
  ('staff', 'Staff sign-up link', 'If your sponsorship includes memberships for your team: a sign-up link that shows how many joined and played.',
   "Sponsor's team sign-ups counted.", 'Depends on CourtReserve.', '3–5 h', '30 min', '15 min'),
  ('pres', '"Presented by" tournaments and leagues', 'Your name on brackets, results, the TV boards and the results email.',
   'Name on brackets, results, TV boards, results email.', '', '4–6 h', '1–2 h per event', '1 h per event'),
  ('event', 'Event sign-ups', 'A tablet sign-up at events, such as a raffle or a free lesson. You get entries only from people who opt in.',
   'Tablet sign-up with an opt-in box.', '', '6–8 h', '30 min per event', '30 min per event'),
  ('cam', 'Court cameras and replays', 'Match replays with your business on screen.',
   'Replays with the sponsor on screen.', 'Needs cameras bought and installed.', '20–40 h', '1 h', '2–4 h'),
  ('wifi', 'Wi-Fi sign-in page', 'Your business on the page members see when they join Peak\'s Wi-Fi.',
   'Sponsor on the Wi-Fi sign-in.', "Depends on Peak's network gear.", '4–10 h', '30 min', '15 min'),
 ]),
 ('Website', 'Your own website, working harder.', [
  ('health', 'Website health check', 'A look at speed, mobile, broken links, Google basics and forms, with a clear fix list or the fixes done.',
   'Speed, mobile, broken links, Google basics, forms; fix list or fixes.', '', '2 h (checklist)', '2–4 h', 'none (one-time)'),
  ('landing', 'Landing page for your Peak offer', 'A simple page for your member deal and QR codes to point to, with visits counted.',
   'Page for the member deal and QR codes, visits counted.', '', '3 h (template)', '2 h', '15 min'),
  ('forms', 'Forms that alert you', 'Contact and quote forms that email or text you the moment someone fills one in.',
   'Contact/quote forms that email or text on each fill-in.', '', '3 h', '2 h', '15 min'),
  ('newsite', 'New website or redesign', 'A new site built for you, quoted as its own project.',
   'Its own project; price like the $3,000 Peak quote.', '', 'n/a', '25–40 h', 'see hosting'),
  ('host', 'Hosting and upkeep', 'Your site kept updated, backed up and fixed each month.',
   'Updates, backups, fixes.', '', '1 h', '1 h', '1 h'),
 ]),
 ('Search and reviews', 'Getting found on Google and building trust.', [
  ('seo', 'Local search (SEO)', 'Work on your Google listing and local search results, with a monthly report.',
   'Google listing, local listings, monthly search report.', '', '2 h (report)', '4–6 h', '3–5 h'),
  ('revreq', 'Google review requests', 'A QR code or text link that asks happy customers for a review, with new reviews counted each month.',
   'QR or text link asking for reviews; new reviews counted.', '', '2–3 h', '1 h', '~0'),
  ('revalert', 'Review alerts', 'A heads-up whenever a new review lands, good or bad.',
   'A ping on every new review.', '', '2 h', '30 min', '0–15 min'),
 ]),
 ('Social media', 'Your pages, kept active.', [
  ('profile', 'Profile cleanup', 'Bios, links, hours and photos tidied and matched across Facebook, Instagram and Google.',
   'Bios, links, hours, photos on Facebook, Instagram, Google.', '', '1 h (checklist)', '2–3 h', 'none (one-time)'),
  ('posts', 'Monthly posts', 'A month of posts drafted for you. Nothing goes out until you approve it.',
   'A month of posts drafted; each one approved by them first.', '', B + ' (post calendar)', '1–2 h', '3–5 h'),
  ('spotlight', 'Spotlight posts with Peak', 'Peak features your business on its socials, ready for you to share.',
   'Peak features the sponsor; they share it.', '', '1 h (template)', '30 min', '30 min'),
  ('video', 'Short videos from Peak', 'Clips of your name on the courts, at events and with the winners, for your own pages.',
   'Clips of their name on court, events, winners.', '', B + ' (video tools)', '30 min', '2–4 h per video'),
 ]),
 ('Marketing', 'Bringing in customers.', [
  ('deals', 'Member deals with codes', 'A special offer for Peak members with its own code, so you see real redemptions.',
   'An offer for members with its own code; redemptions counted.', '', '3–4 h', '30 min', '15 min'),
  ('ads', 'Local ads on Facebook and Instagram', 'Ads set up and run for your area only, with results reported.',
   'Tight local radius, results reported. Rate card: 12% of spend, $350 minimum.', '', B, '2–3 h', '1–2 h'),
  ('news', 'Customer email newsletter', 'A monthly email to your own customers, with opens and clicks counted.',
   'Monthly email to their customers, opens and clicks counted.', '', '2–4 h', '2–3 h', '2–3 h'),
 ]),
]

# monthly per sponsor ONCE AUTOMATED (26 Nov, Matthew: "most of this can be automated though after the intial setup right?" -> "yes add the
# column"). Automating costs about 20-40 h of extra one-time build in total. Judgment, writing and approvals stay human.
AUTO = {'qr': '0', 'report': '~5 min', 'stats': '0', 'sstats': '0',
        'tv': '~5 min', 'spot': '~10 min', 'page': '0', 'staff': '0', 'pres': '~15 min per event', 'event': '~10 min per event',
        'cam': '~1 h', 'wifi': '0',
        'health': 'none (one-time)', 'landing': '0', 'forms': '0', 'newsite': 'see hosting', 'host': '15–30 min',
        'seo': '1–2 h', 'revreq': '0', 'revalert': '0',
        'profile': 'none (one-time)', 'posts': '1–2 h', 'spotlight': '~10 min', 'video': '1–2 h per video',
        'deals': '~5 min', 'ads': '~1 h', 'news': '45 min–1 h'}

N = {}
i = 0
for _, _, items in CATS:
    for it in items:
        i += 1
        N[it[0]] = i
assert i == 27, i
assert set(AUTO) == set(N), set(N) ^ set(AUTO)
e = html.escape
def nums(*ks): return ', '.join(str(N[k]) for k in ks[:-1]) + ' and ' + str(N[ks[-1]])

HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<!-- GENERATED by tools/build-add-ons.py: edit the list there, not this file. Print: node shared/tools/traverse-pdf.mjs <this file>. -->
<style>{css}</style>
</head>
<body>
<header class="tv-top">
  <div><div class="tv-brand"><tv-mark></tv-mark><span class="tv-wm">Traverse</span></div>
    <div class="tv-kicker">{kicker}</div><h1>{title}</h1></div>
  <div class="tv-meta"><b>{meta1}</b>{meta2}</div>
</header><div class="tv-bar"></div>
'''

# ---- the sponsor hand-out: categories, names, one line each; no prices, no hours ----
css = ('body{counter-reset:q} ol.tv-steps{counter-reset:none} ol.tv-steps>li{margin-bottom:7px}'
       # category headings (26 Nov, Matthew: "make it so the catergories are more prominent they fade a little into the distance")
       ' h2{background:var(--navy);color:#fff;font:700 13.5pt "Familjen Grotesk";padding:6px 12px;margin:16px 0 9px;'
       'border-left:6px solid var(--flag);border-radius:4px;letter-spacing:.01em}'
       ' h2 small{font:400 9.2pt "Atkinson Hyperlegible";color:#c9d5e6;margin-left:10px}')
out = [HEAD.format(title='Sponsor add-ons: what we can offer', css=css, kicker='Peak Pickleball sponsorships',
                   meta1='The tech side', meta2='of a Peak Pickleball sponsorship')]
for cat, blurb, items in CATS:
    out.append(f'<h2>{e(cat)}<small>{e(blurb)}</small></h2>\n<ol class="tv-steps">')
    for k, name, hand, *_ in items:
        out.append(f'  <li><b>{e(name)}</b>{e(hand)}</li>')
    out.append('</ol>')
out.append('</body>\n</html>\n')
(HERE / 'sponsor-add-ons-list-2026-11-26.html').write_text('\n'.join(out))

# ---- the internal time sheet ----
css = ('body{font-size:9.6pt} table{font-size:8.5pt;margin-top:2px;table-layout:fixed} td{padding:3px 6px} th,td{width:13%} th:first-child,td:first-child{width:48%} tr.grp td{width:auto} td.n{white-space:nowrap;text-align:center}'
       ' th.n{text-align:center} td b{display:block;font:700 9.4pt "Familjen Grotesk";color:var(--navy)} .d{color:#3d4a5e}'
       ' .dep{color:#a3420c;font-size:8.2pt} tbody.keep{break-inside:avoid} .ok{color:#1d6b45;font-weight:700} thead{display:table-header-group}'
       ' tr.grp td{background:#dfe7f2;border-left:6px solid var(--flag);border-bottom:2px solid var(--navy);font:700 11pt "Familjen Grotesk";'
       'letter-spacing:.04em;color:var(--navy);padding:7px 10px 5px}'
       ' th.auto{background:#1d6b45} td.auto{background:#eef7f1;color:#1d6b45;font-weight:700} .tv-callout{font-size:9pt;margin-bottom:8px} ul.notes{font-size:8.6pt;color:var(--soft);margin-top:6px}')
out = [HEAD.format(title='Sponsor add-ons: time to build and run', css=css, kicker='Internal · for pricing',
                   meta1='For Matthew', meta2='Estimates, 26 Nov 2026'),
       '<div class="tv-callout"><div class="tv-label">How to read it</div><b>Build once</b> is done one time and serves every sponsor after '
       '(<span class="ok">Built</span> = already running for Peak or Traverse). <b>Set up</b> is the time each new sponsor takes. <b>Monthly</b> '
       'is the hours per sponsor, per month, to keep it running as it is today; <b>Once automated</b> is the same after the extra build '
       '(about 20–40 h in all). Price on what it is worth to the sponsor, with these hours as the floor; automation is your margin and how far it scales. Orange notes depend on Peak\'s systems. All estimates, not quotes.</div>',
       '<table>\n  <thead><tr><th>Add-on</th><th class="n">Build once</th><th class="n">Set up per sponsor</th><th class="n">Monthly per sponsor</th><th class="n auto">Monthly, once automated</th></tr></thead>']
for cat, _, items in CATS:
    # the heading and its first row share a tbody that can't split, so a heading never sits alone at the foot of a page
    out.append(f'  <tbody class="keep"><tr class="grp"><td colspan="5">{e(cat)}</td></tr>')
    for j, (k, name, _, inner, dep, build, setup, monthly) in enumerate(items):
        if j == 1: out.append('  </tbody><tbody>')
        d = f'{e(inner)}' + (f' <span class="dep">{e(dep)}</span>' if dep else '')
        b = e(build).replace(B, '<span class="ok">Built</span>')
        out.append(f'  <tr><td><b>{N[k]}. {e(name)}</b><span class="d">{d}</span></td><td class="n">{b}</td><td class="n">{e(setup)}</td><td class="n">{e(monthly)}</td><td class="n auto">{e(AUTO[k])}</td></tr>')
    out.append('  </tbody>')
out.append('</table>')
out.append(f'''<ul class="notes">
  <li><b>Typical bundles, per sponsor:</b> items {nums('qr', 'report', 'deals')} (QR codes, report, member deal) take about 1¼ h to set up and 30–45 min a month today, <b>about 10 min once automated</b>. Adding the TV slides, partner spot and sponsor page ({nums('tv', 'spot', 'page')}) brings it to about 3½ h to set up and 1½–2 h a month today, <b>about 25 min once automated</b>. Local search ({N['seo']}) adds 4–6 h to set up and 3–5 h a month (1–2 h automated).</li>
  <li><b>A website and socials starter ({', '.join(str(N[k]) for k in ['stats', 'sstats', 'health', 'revreq', 'profile', 'posts'])}):</b> about 8–12 h to set up, then 3–5 h a month today, <b>1–2 h once automated</b>, all of it the monthly posts.</li>
  <li><b>What stays real work</b> even automated: local search ({N['seo']}), monthly posts ({N['posts']}), videos ({N['video']}), ads ({N['ads']}) and the newsletter ({N['news']}), because they need judgment, writing or the sponsor's approval. Nothing posts or sends without an OK.</li>
  <li><b>Keep about 15 min a month per sponsor</b> on top of these for check-ins, questions and fixing what breaks.</li>
</ul>
</body>
</html>
''')
(HERE / 'sponsor-add-ons-time-2026-11-26.html').write_text('\n'.join(out))
print('wrote both; 27 items in', len(CATS), 'categories:', ', '.join(f'{c} ({len(x)})' for c, _, x in CATS))
