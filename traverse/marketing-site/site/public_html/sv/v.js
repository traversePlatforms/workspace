/* Site visit counting (2026-11-20): our own, cookie-free. Sends the page path (no query string), the referring site's domain, utm tags,
   whether the visit came from an ad click, the device's touch support (to tell an iPad from a Mac), the time zone, time on the page, and
   taps on call, text, email and outside links to /sv/c.php on this same site. Sets no cookie and keeps nothing on the device, except
   the opt-out flag "sv_ignore" when someone opens a page with ?sv_ignore=1 (?sv_ignore=0 clears it).
   Sends nothing when: Do Not Track or Global Privacy Control is on, the page is inside a frame, the device opted out, or the signing page
   was opened by staff (?staff=1). Pages call window.sa('name') for a finished form (demo_booked, quote_request ...). */
(function () {
  'use strict';
  var w = window, d = document, n = navigator, l = location, U = '/sv/c.php';
  w.sa = function () {};
  try {
    var sp = new URLSearchParams(l.search);
    if (sp.has('sv_ignore')) {
      try { if (sp.get('sv_ignore') === '0') localStorage.removeItem('sv_ignore'); else localStorage.setItem('sv_ignore', '1'); } catch (e) {}
      sp.delete('sv_ignore'); try { history.replaceState(history.state, '', l.pathname + (sp.toString() ? '?' + sp : '') + l.hash); } catch (e) {}
    }
    var off = false; try { off = localStorage.getItem('sv_ignore') === '1'; } catch (e) {}
    if (off || n.doNotTrack === '1' || w.doNotTrack === '1' || n.globalPrivacyControl === true || w.top !== w.self || sp.get('staff') === '1') return;
    if (!/^https?:$/.test(l.protocol)) return;
    var rnd = new Uint8Array(6); (w.crypto || w.msCrypto).getRandomValues(rnd);
    var id = Array.prototype.map.call(rnd, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    var path = l.pathname.replace(/\/index\.html?$/, '/').slice(0, 200);
    var send = function (o) {
      o.h = l.hostname; o.p = path; o.id = id; var b = JSON.stringify(o);
      try { if (n.sendBeacon && n.sendBeacon(U, b)) return; } catch (e) {}
      try { fetch(U, { method: 'POST', body: b, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
    };
    var clean = function (s) { return String(s || '').replace(/[^A-Za-z0-9 _.+\-]/g, '').slice(0, 60); };
    var ref = '', entry = 1;
    try { if (d.referrer) { var rh = new URL(d.referrer).hostname.toLowerCase(); if (rh.replace(/^www\./, '') === l.hostname.replace(/^www\./, '')) entry = 0; else ref = rh; } } catch (e) {}
    var us = clean(sp.get('utm_source')), um = clean(sp.get('utm_medium')), uc = clean(sp.get('utm_campaign'));
    var from = (sp.get('from') || '').toLowerCase();   /* the printed QR pieces land on /?from=card|yard|truck|car|concert */
    if (!us && /^[a-z]{2,20}$/.test(from)) { us = 'qr'; um = 'print'; uc = from; }
    var ad = sp.has('fbclid') ? 'fb' : (sp.has('gclid') || sp.has('gbraid') || sp.has('wbraid')) ? 'g' : sp.has('msclkid') ? 'ms' : '';
    var tz = ''; try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40); } catch (e) {}
    if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz)) tz = '';
    send({ k: 'pv', e: entry, r: ref, us: us, um: um, uc: uc, ad: ad, z: tz, tp: n.maxTouchPoints > 1 ? 1 : 0, wd: n.webdriver ? 1 : 0 });
    w.sa = function (name, label) { if (/^[a-z][a-z0-9_]{1,39}$/.test(name || '')) send({ k: 'ev', n: name, x: String(label || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 100) }); };
    /* time on the page: only while it is on screen */
    var shown = d.visibilityState === 'visible' ? Date.now() : 0, total = 0, sent = -1;
    var leave = function () { if (shown) { total += Date.now() - shown; shown = 0; } var s = Math.round(total / 1000); if (s > 0 && s !== sent) { sent = s; send({ k: 'lv', s: Math.min(s, 86400) }); } };
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') leave(); else if (!shown) shown = Date.now(); });
    w.addEventListener('pagehide', leave);
    /* taps: call, text, email, the deposit's pay link, and links to other sites */
    d.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
      var h = a.getAttribute('href') || '';
      if (/^tel:/i.test(h)) return w.sa('call_tap');
      if (/^sms:/i.test(h)) return w.sa('text_tap');
      if (/^mailto:/i.test(h)) return w.sa('email_tap');
      var u; try { u = new URL(a.href, l.href); } catch (x) { return; }
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') === l.hostname.replace(/^www\./, '')) return;
      if (/(^|\.)(square\.link|squareup\.com|square\.site)$/i.test(u.hostname)) return w.sa('deposit_pay_tap', u.hostname);
      w.sa('outbound', u.hostname);
    }, true);
  } catch (e) {}
})();
