/* J.A.R.V.I.S. chat for the Peak desk and the post calendar (2026-11-21, TASKS JV-APPS; Matthew: "everyone has access to a version of Jarvis
   they can use to make changes that they need"). The Sixfold field app's chat (helpFab / helpChat in summit index.html) as one file both
   pages load: a round blue button on every screen, a chat window (full screen on a phone) with the latest conversation, photos (up to 4,
   shrunk to 1600 px JPEG here), one voice note a message (up to 2 minutes), PDFs and photos opened from a reply, Refresh now under a reply
   that changed something, Earlier (past chats inside the chat), Clear (closes the conversation). J.A.R.V.I.S. stays blue in every look.
   Each app gives it its own calls:
     JVChat.mount({ call(action, body) -> Promise<json> (no body = GET), fileUrl(id, name), me() -> name, dark() -> bool, ctx() -> {...},
                    seenKey, greeting, offsetPhone (px above the bottom on a phone) })
   Server side: the app's actions jvlist / jvsend / jvclose / jvfile (shared/jv-chat/jv-lib.php). Opens itself on #jarvis or #jarvis/<id>. */
(function () {
  'use strict';
  var NAME = 'J.A.R.V.I.S.', O = null, HC = { el: null, id: null, tick: null, voiceOff: null, dotTick: null };
  var ST = { new: 'Waiting', working: 'Working on it', answered: 'Answered', matthew: 'With Matthew', closed: 'Closed' };
  function q(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function css() {
    if (document.getElementById('jvcss')) return;
    var s = document.createElement('style'); s.id = 'jvcss';
    s.textContent = [
      '.jvw{--jv:#1F5FAD;--on-jv:#fff;--jv-tint:#E6EEF9;--jvbg:var(--card,#fff);--jvsunk:var(--bg,#f4f5f6);--jvink:var(--ink,#1b1b1b);--jvline:var(--line,#dcdcdc);--jvsoft:var(--soft,#666)}',
      '.jvw.jvdark{--jv:#7DB4EE;--on-jv:#0A1626;--jv-tint:#17263A}',
      '.jvfab{position:fixed;right:18px;bottom:18px;z-index:900;width:56px;height:56px;border-radius:50%;border:0;background:var(--jv);color:var(--on-jv);box-shadow:0 6px 18px rgba(0,0,0,.3);display:grid;place-items:center;cursor:pointer}',
      '.jvfab .jvdot{position:absolute;top:6px;right:6px;width:13px;height:13px;border-radius:50%;background:#E4703A;border:2px solid #fff}.jvchat-on .jvfab{display:none}',
      '.jvchat{position:fixed;right:18px;bottom:18px;z-index:950;width:390px;height:min(620px,calc(100vh - 36px));display:flex;flex-direction:column;background:var(--jvbg);color:var(--jvink);border:1px solid var(--jvline);border-radius:18px;box-shadow:0 12px 36px rgba(0,0,0,.35);overflow:hidden;font:15px/1.45 var(--sans,system-ui,sans-serif)}',
      '@media (max-width:760px){.jvchat{inset:0;width:auto;height:auto;border-radius:0;border:0}}',
      '.jvhd{display:flex;align-items:center;gap:6px;padding:10px 10px 10px 14px;background:var(--jv);color:var(--on-jv);cursor:pointer}.jvttl{flex:1;font:800 16px var(--sans,system-ui,sans-serif);letter-spacing:.02em}',
      '.jvbtn{background:rgba(255,255,255,.18);color:inherit;border:0;border-radius:999px;padding:6px 10px;font:700 12.5px var(--sans,system-ui,sans-serif);cursor:pointer}.jvw.jvdark .jvbtn{background:rgba(0,0,0,.16)}.jvx{width:32px;padding:6px 0}',
      '.jvbody{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--jvsunk)}',
      '.jvmsg{max-width:86%;border-radius:16px;padding:8px 12px}.jvmsg.me{align-self:flex-end;background:var(--jv);color:var(--on-jv);border-bottom-right-radius:5px}',
      '.jvmsg.them{align-self:flex-start;background:var(--jvbg);border:1px solid var(--jvline);border-bottom-left-radius:5px}.jvmsg.other{align-self:flex-end;background:var(--jv-tint);color:var(--jvink);border-bottom-right-radius:5px}',
      '.jvwho{font-size:11px;font-weight:800;opacity:.75;margin-bottom:2px}.jvtxt{white-space:pre-wrap;font-size:14.5px;line-height:1.42;overflow-wrap:anywhere}.jvtime{font-size:10.5px;opacity:.65;margin-top:3px;text-align:right}',
      '.jvlink{color:inherit;text-decoration:underline;overflow-wrap:anywhere}',
      '.jvrefresh{margin-top:7px;border:0;border-radius:999px;padding:6px 12px;font:700 13px var(--sans,system-ui,sans-serif);background:var(--jv);color:var(--on-jv);cursor:pointer}',
      '.jvfile{display:flex;align-items:center;gap:10px;width:100%;margin-top:8px;padding:10px 12px;border:1px solid var(--jvline);border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.jvfile b{font-size:15px}.jvfile small{display:block;font-size:12.5px;opacity:.75}',
      '.jvpics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.jvpics.one{grid-template-columns:1fr}.jvpic{padding:0;border:0;background:none;cursor:pointer;border-radius:10px;overflow:hidden}.jvpic img{display:block;width:100%;max-height:220px;object-fit:cover}',
      '.jvvoice{margin-top:6px}.jvvoice audio{width:220px;max-width:100%;height:36px}.jvvlen,.jvtrans{font-size:12px;opacity:.8}',
      '.jvwork,.jvnote{align-self:center;font-size:12.5px;color:var(--jvsoft);display:flex;align-items:center;gap:8px;padding:4px 10px;text-align:center}.jvnote{background:var(--jvbg);border:1px dashed var(--jvline);border-radius:999px}',
      '.jvdots{width:28px;height:8px;background:radial-gradient(circle,var(--jvsoft) 3px,transparent 3.5px) 0 50%/9.3px 8px repeat-x;animation:jvd 1s steps(3) infinite}@keyframes jvd{from{width:10px}to{width:28px}}',
      '.jvold{display:block;width:100%;text-align:left;margin:0 0 8px;padding:10px 12px;border:1px solid var(--jvline);border-radius:12px;background:var(--jvbg);color:inherit;cursor:pointer;font:inherit}.jvold:hover{border-color:var(--jv)}',
      '.jvbar{display:flex;gap:8px;align-items:flex-end;padding:10px;border-top:1px solid var(--jvline);background:var(--jvbg)}',
      '.jvbar textarea{flex:1;resize:none;box-sizing:border-box;height:42px;min-height:42px;margin:0;line-height:1.35;border:1px solid var(--jvline);border-radius:18px;padding:10px 13px;font:15px var(--sans,system-ui,sans-serif);max-height:140px;background:var(--jvsunk);color:var(--jvink)}',
      '.jvsend{width:42px;height:42px;border-radius:50%;border:0;background:var(--jv);color:var(--on-jv);display:grid;place-items:center;cursor:pointer;flex:none}',
      '.jvround{width:42px;height:42px;border-radius:50%;border:1px solid var(--jvline);background:transparent;color:var(--jvink);display:grid;place-items:center;cursor:pointer;flex:none}.jvround:hover{border-color:var(--jv);color:var(--jv)}.jvround:disabled{opacity:.5}.jvround.on{border-color:#d93025;color:#d93025}',
      '.jvtray{display:flex;gap:8px;padding:10px 10px 0;border-top:1px solid var(--jvline);background:var(--jvbg);overflow-x:auto}.jvtray[hidden],.jvrec[hidden]{display:none}',
      '.jvtray1{position:relative;flex:none;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid var(--jvline)}.jvtray1 img{width:100%;height:100%;object-fit:cover;display:block}',
      '.jvtrayx{position:absolute;top:2px;right:2px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font:700 15px/24px sans-serif;padding:0;cursor:pointer}',
      '.jvrec{display:flex;align-items:center;gap:8px;padding:8px 10px 0;border-top:1px solid var(--jvline);background:var(--jvbg);flex-wrap:wrap}.jvrec audio{height:34px;max-width:200px}',
      '.jvrecdot{width:10px;height:10px;border-radius:50%;background:#d93025;animation:jvp 1s infinite}@keyframes jvp{50%{opacity:.3}}.jvrectime{font-size:13px;font-weight:700}',
      '.jvrecb{border:1px solid var(--jvline);background:transparent;color:inherit;border-radius:999px;padding:5px 11px;font:700 12.5px var(--sans,system-ui,sans-serif);cursor:pointer}.jvrecb.go{background:var(--jv);color:var(--on-jv);border-color:var(--jv)}',
      '.jvtoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;background:#222;color:#fff;padding:10px 16px;border-radius:12px;font:600 14px var(--sans,system-ui,sans-serif);max-width:90vw;box-shadow:0 6px 18px rgba(0,0,0,.3)}',
      '.jvview{position:fixed;inset:0;z-index:1001;background:rgba(0,0,0,.85);display:grid;place-items:center;cursor:zoom-out}.jvview img{max-width:96vw;max-height:92vh}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function theme(el) { if (el) el.classList.toggle('jvdark', !!(O.dark && O.dark())); }
  function toast(t, m) { var x = q('div', 'jvtoast jvw', t + (m ? ': ' + m : '')); document.body.appendChild(x); setTimeout(function () { x.remove(); }, 4200); }
  function len(s) { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function seen(t) { try { var s = JSON.parse(localStorage.getItem(O.seenKey) || '{}'); if (t) { s[t.id] = t.updated; localStorage.setItem(O.seenKey, JSON.stringify(s)); } return s; } catch (e) { return {}; } }
  function when(at) { if (!at) return ''; var d = new Date(at * 1000), t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + t; }
  function view(src) { var v = q('div', 'jvview'), im = document.createElement('img'); im.src = src; im.alt = ''; v.appendChild(im); v.addEventListener('click', function () { v.remove(); }); document.body.appendChild(v); }
  /* a phone photo made small enough to send: at most 1600 px, JPEG */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(b) : rej(new Error('That photo could not be read.')); }, 'image/jpeg', 0.85); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That photo could not be read. Try a JPEG or PNG.')); };
      im.src = url;
    });
  }
  function picker(tray) {
    var pics = [];
    var paint = function () {
      tray.textContent = ''; tray.hidden = !pics.length;
      pics.forEach(function (p, i) { var c = q('div', 'jvtray1'), im = document.createElement('img'); im.src = p.url; im.alt = ''; c.appendChild(im);
        var x = q('button', 'jvtrayx', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove photo'); x.addEventListener('click', function () { URL.revokeObjectURL(p.url); pics.splice(i, 1); paint(); }); c.appendChild(x); tray.appendChild(c); });
    };
    var add = function (files) {
      files = files.filter(function (f) { return /^image\//.test(f.type || '') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || ''); });
      var room = 4 - pics.length; if (files.length > room) toast('Up to 4 photos', 'send these, then add more in the next message');
      files.slice(0, Math.max(0, room)).forEach(function (f) {
        shrink(f).then(function (bl) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res({ bl: bl, data: String(r.result).split(',')[1] || '' }); }; r.readAsDataURL(bl); }); })
          .then(function (o) { if (pics.length >= 4) return; pics.push({ data: o.data, url: URL.createObjectURL(o.bl) }); paint(); })
          .catch(function (e) { toast('Not added', (e && e.message) || 'that photo could not be read'); });
      });
    };
    return { pick: function () { var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.addEventListener('change', function () { add([].slice.call(inp.files || [])); }); inp.click(); },
      add: add, count: function () { return pics.length; }, data: function () { return pics.map(function (p) { return p.data; }); }, clear: function () { pics.forEach(function (p) { URL.revokeObjectURL(p.url); }); pics = []; paint(); } };
  }
  /* one voice note a message, up to 2 minutes (the field app's recorder: MediaRecorder with whatever the browser gives) */
  function voice(strip, btn) {
    var MAX = 120, rec = null, stream = null, chunks = [], t0 = 0, tick = null, note = null, drop = false, then = null, gen = 0, stopping = false;
    var MIC = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
    var STOP = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
    var secsNow = function () { return Math.min(MAX, (Date.now() - t0) / 1000); };
    var release = function () { if (stream) { try { stream.getTracks().forEach(function (k) { k.stop(); }); } catch (e) {} } stream = null; };
    var paint = function () {
      strip.textContent = ''; btn.innerHTML = rec ? STOP : MIC; btn.classList.toggle('on', !!rec); btn.disabled = !!note && !rec;
      btn.setAttribute('aria-label', rec ? 'Stop recording' : 'Record a voice note'); btn.title = rec ? 'Stop recording' : (note ? 'One voice note a message' : 'Record a voice note');
      if (rec) {
        strip.appendChild(q('span', 'jvrecdot')); strip.appendChild(q('span', 'jvrectime', 'Recording ' + len(secsNow()) + ' / ' + len(MAX)));
        var cn = q('button', 'jvrecb', 'Cancel'), dn = q('button', 'jvrecb go', 'Done'); cn.type = dn.type = 'button';
        cn.addEventListener('click', function () { stop(true); }); dn.addEventListener('click', function () { stop(false); }); strip.appendChild(cn); strip.appendChild(dn);
      } else if (note) {
        var au = document.createElement('audio'); au.controls = true; au.preload = 'metadata'; au.src = note.url; strip.appendChild(au); strip.appendChild(q('span', 'jvrectime', len(note.secs)));
        var x = q('button', 'jvrecb', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove the voice note'); x.addEventListener('click', function () { clear(); }); strip.appendChild(x);
      }
      strip.hidden = !rec && !note;
    };
    var clear = function () { if (note) URL.revokeObjectURL(note.url); note = null; paint(); };
    var finish = function (r, mine) {
      if (mine !== gen || rec !== r) return;
      var secs = secsNow(), type = (r.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm'), bl = new Blob(chunks, { type: type }), go = then;
      clearInterval(tick); tick = null; rec = null; chunks = []; then = null; stopping = false; release();
      if (drop) { paint(); return; }
      if (secs < 1 || bl.size < 300) { paint(); toast('Too short', 'tap the mic, talk, then tap it again'); return; }
      if (bl.size > 6 * 1024 * 1024) { paint(); toast('Too long to send', 'keep a voice note under 2 minutes'); return; }
      var fr = new FileReader();
      fr.onload = function () { note = { data: String(fr.result).split(',')[1] || '', mime: type.split(';')[0], secs: Math.max(1, Math.round(secs)), url: URL.createObjectURL(bl) }; paint(); if (go) go(); };
      fr.onerror = function () { paint(); toast('Not added', 'that recording could not be read'); }; fr.readAsDataURL(bl);
    };
    var stop = function (cancel, after) {
      if (!rec) { if (after) after(); return; }
      if (stopping) { if (cancel) { drop = true; then = null; } else if (after) then = after; return; }
      stopping = true; drop = !!cancel; then = cancel ? null : (after || null);
      try { if (rec.state !== 'inactive') rec.stop(); else finish(rec, gen); } catch (e) { finish(rec, gen); }
    };
    var start = function () {
      if (rec || note) return;
      if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Voice notes don’t work here', 'type it instead'); return; }
      var mine = ++gen; btn.disabled = true;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        btn.disabled = false;
        if (mine !== gen || !document.body.contains(strip)) { try { s.getTracks().forEach(function (k) { k.stop(); }); } catch (e) {} return; }
        stream = s; var mt = '', c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'];
        if (MediaRecorder.isTypeSupported) for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) { mt = c[i]; break; }
        var r; try { r = mt ? new MediaRecorder(s, { mimeType: mt }) : new MediaRecorder(s); } catch (e) { try { r = new MediaRecorder(s); } catch (e2) { release(); toast('Voice notes don’t work here', 'type it instead'); return; } }
        chunks = []; drop = false; then = null; stopping = false; rec = r;
        r.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        r.onstop = function () { finish(r, mine); };
        r.onerror = function () { drop = true; finish(r, mine); toast('Recording stopped', 'something went wrong with the microphone'); };
        r.start(); t0 = Date.now();
        tick = setInterval(function () { if (!rec || stopping) return; if (secsNow() >= MAX) { stop(false); toast('2 minutes is the limit', 'the voice note is ready to send'); return; } var tm = strip.querySelector('.jvrectime'); if (tm) tm.textContent = 'Recording ' + len(secsNow()) + ' / ' + len(MAX); }, 250);
        paint();
      }, function (e) {
        btn.disabled = false; var n = (e && e.name) || '';
        toast(n === 'NotAllowedError' || n === 'SecurityError' ? 'Microphone not allowed' : 'No microphone', n === 'NotAllowedError' || n === 'SecurityError' ? 'allow the microphone for this site in your browser settings' : 'type it instead');
      });
    };
    paint();
    return { toggle: function () { if (rec) stop(false); else start(); }, stop: stop, busy: function () { return !!rec; },
      data: function () { return note ? { data: note.data, mime: note.mime, secs: note.secs } : null; }, clear: clear,
      off: function () { gen++; if (rec) { drop = true; try { rec.stop(); } catch (e) {} } rec = null; clearInterval(tick); tick = null; release(); if (note) URL.revokeObjectURL(note.url); note = null; } };
  }
  function extras(box, m, tid) {
    var ph = (m.photos || []).filter(function (p) { return p && p.n; });
    if (ph.length) { var g = q('div', 'jvpics' + (ph.length === 1 ? ' one' : ''));
      ph.forEach(function (p, i) { var bt = q('button', 'jvpic'); bt.type = 'button'; bt.setAttribute('aria-label', 'Photo ' + (i + 1)); var im = document.createElement('img'); im.loading = 'lazy'; im.alt = ''; im.src = O.fileUrl(tid, p.n); bt.appendChild(im);
        bt.addEventListener('click', function () { view(O.fileUrl(tid, p.n)); }); g.appendChild(bt); });
      box.appendChild(g); }
    (m.files || []).forEach(function (f) { if (!f || !f.n) return; var fb = q('button', 'jvfile'); fb.type = 'button'; var tx = q('span'); tx.appendChild(q('b', null, 'Open ' + String(f.n).replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '))); tx.appendChild(q('small', null, 'PDF · ' + Math.max(1, Math.round((f.size || 0) / 1024)) + ' KB'));
      fb.appendChild(tx); fb.addEventListener('click', function () { window.open(O.fileUrl(tid, f.n), '_blank', 'noopener'); }); box.appendChild(fb); });
    (m.audio || []).forEach(function (a) { if (!a || !a.n) return; var v = q('div', 'jvvoice'), au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.src = O.fileUrl(tid, a.n); v.appendChild(au);
      v.appendChild(q('div', 'jvvlen', 'Voice note · ' + len(a.secs))); if (a.text) v.appendChild(q('div', 'jvtrans', 'Transcript: ' + a.text)); else if (a.failed) v.appendChild(q('div', 'jvtrans', 'Transcript: could not be made.')); box.appendChild(v); });
  }
  function linked(text) {
    var d = q('div', 'jvtxt'), s = String(text || ''), re = /https?:\/\/[^\s<>"]+/g, last = 0, m;
    while ((m = re.exec(s))) { var u = m[0].replace(/[.,;:!?)\]]+$/, ''); if (m.index > last) d.appendChild(document.createTextNode(s.slice(last, m.index)));
      var a = q('a', 'jvlink', u); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; d.appendChild(a); last = m.index + u.length; re.lastIndex = last; }
    if (last < s.length) d.appendChild(document.createTextNode(s.slice(last)));
    return d;
  }
  function fab() {
    if (document.getElementById('jvfab')) return;
    var b = q('button', 'jvfab jvw'); b.id = 'jvfab'; b.type = 'button'; b.setAttribute('aria-label', 'Chat with ' + NAME); b.title = NAME;
    b.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4.5 3.6A.6.6 0 0 1 3.5 21V18H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/></svg><span class="jvdot" hidden></span>';
    if (O.offsetPhone && window.matchMedia && matchMedia('(max-width:760px)').matches) b.style.bottom = O.offsetPhone + 'px';
    b.addEventListener('click', function () { chat(); });
    theme(b); document.body.appendChild(b); dot(); clearInterval(HC.dotTick); HC.dotTick = setInterval(dot, 120000);
  }
  function dot() {
    var b = document.getElementById('jvfab'); if (!b || HC.el) return; theme(b);
    O.call('jvlist').then(function (j) { if (!j || !j.ok) return; var s = seen(), un = (j.tickets || []).some(function (t) { var l = t.msgs[t.msgs.length - 1]; return t.status !== 'closed' && l && l.jarvis && (s[t.id] || 0) < t.updated; }); var d = b.querySelector('.jvdot'); if (d) d.hidden = !un; }).catch(function () {});
  }
  function chat(openId) {
    if (HC.voiceOff) { HC.voiceOff(); HC.voiceOff = null; }
    if (HC.el) HC.el.remove();
    var w = q('div', 'jvchat jvw'); HC.el = w; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', NAME); theme(w);
    var hd = q('div', 'jvhd'); hd.appendChild(q('div', 'jvttl', NAME));
    var nw = q('button', 'jvbtn', 'Clear'), er = q('button', 'jvbtn', 'Earlier'), cx = q('button', 'jvbtn jvx', '✕'); [nw, er, cx].forEach(function (x) { x.type = 'button'; }); cx.setAttribute('aria-label', 'Close');
    nw.title = 'Close this conversation; start fresh'; hd.appendChild(nw); hd.appendChild(er); hd.appendChild(cx); w.appendChild(hd);
    var body = q('div', 'jvbody'); w.appendChild(body);
    var bar = q('div', 'jvbar'), ta = q('textarea'), sb = q('button', 'jvsend'); ta.rows = 1; ta.maxLength = 2000; ta.placeholder = 'Message ' + NAME + '…'; ta.setAttribute('aria-label', 'Message ' + NAME); sb.type = 'button'; sb.setAttribute('aria-label', 'Send');
    sb.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';
    var pb = q('button', 'jvround'); pb.type = 'button'; pb.setAttribute('aria-label', 'Add a photo'); pb.title = 'Add a photo';
    pb.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    var tray = q('div', 'jvtray'); tray.hidden = true; var picks = picker(tray); pb.addEventListener('click', function () { picks.pick(); });
    var mb = q('button', 'jvround'); mb.type = 'button'; var rstrip = q('div', 'jvrec'); rstrip.hidden = true; var vo = voice(rstrip, mb); HC.voiceOff = vo.off; mb.addEventListener('click', function () { vo.toggle(); });
    ta.addEventListener('paste', function (e) { var fs = [].slice.call((e.clipboardData && e.clipboardData.files) || []); if (fs.length) { e.preventDefault(); picks.add(fs); } });
    bar.appendChild(pb); bar.appendChild(mb); bar.appendChild(ta); bar.appendChild(sb); w.appendChild(tray); w.appendChild(rstrip); w.appendChild(bar);
    document.body.appendChild(w); document.body.classList.add('jvchat-on');
    var cur = null, fresh = false, listing = false, me = O.me();
    var close = function () { clearInterval(HC.tick); if (HC.voiceOff) { HC.voiceOff(); HC.voiceOff = null; } if (HC.el) HC.el.remove(); HC.el = null; document.body.classList.remove('jvchat-on'); if (/^#jarvis/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); dot(); };
    cx.addEventListener('click', close);
    hd.addEventListener('click', function (e) { if (!e.target.closest('button')) close(); });
    var bubble = function (cls, who, text, at, refresh, files, tid, photos, audio) {
      var b = q('div', 'jvmsg ' + cls); if (who) b.appendChild(q('div', 'jvwho', who)); if (text || !(audio || []).length) b.appendChild(linked(text));
      if (tid) extras(b, { files: files, photos: photos, audio: audio }, tid);
      if (at) b.appendChild(q('div', 'jvtime', when(at)));
      if (refresh) { var rb = q('button', 'jvrefresh', 'Refresh now'); rb.type = 'button'; rb.addEventListener('click', function () { location.reload(); }); b.appendChild(rb); }
      body.appendChild(b);
    };
    var draw = function (t) {
      theme(w); body.textContent = '';
      var hr = new Date().getHours(), tod = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
      bubble('them', NAME, tod + '. ' + (O.greeting || 'J.A.R.V.I.S. at your service. Tell me what you need changed, and I’ll see to it.'));
      if (t) {
        t.msgs.forEach(function (m, i) { var cls = m.jarvis ? 'them' : (m.mine ? 'me' : 'other'); bubble(cls, m.jarvis ? NAME : (m.mine ? '' : m.from), m.text, m.at, m.jarvis && m.refresh && i === t.msgs.length - 1, m.files, t.id, m.photos, m.audio); });
        if (t.status === 'new' || t.status === 'working') { var wk = q('div', 'jvwork'); wk.appendChild(q('span', 'jvdots')); wk.appendChild(q('span', null, t.status === 'new' ? 'Sent. ' + NAME + ' picks it up within a few minutes…' : NAME + ' is on it…')); body.appendChild(wk); }
        else if (t.status === 'matthew') body.appendChild(q('div', 'jvnote', 'Passed to Matthew. He’ll get back to you.'));
        else if (t.status === 'closed') body.appendChild(q('div', 'jvnote', 'This chat is closed. Start a new one any time.'));
        seen(t);
      }
      body.scrollTop = body.scrollHeight;
    };
    er.addEventListener('click', function () {
      if (listing) { listing = false; er.textContent = 'Earlier'; draw(cur); return; }
      listing = true; er.textContent = 'Back'; body.textContent = ''; body.appendChild(q('div', 'jvnote', 'Loading earlier conversations…'));
      O.call('jvlist').then(function (j) {
        if (!listing || !HC.el) return; body.textContent = ''; var ts = (j && j.ok && j.tickets) || [];
        if (!ts.length) { body.appendChild(q('div', 'jvnote', 'No earlier conversations.')); return; }
        ts.forEach(function (t) {
          var m0 = t.msgs.filter(function (m) { return !m.jarvis; })[0] || t.msgs[0] || {}, first = m0.text || ((m0.photos || []).length ? 'Photo' : (m0.audio || []).length ? 'Voice note' : '');
          var b = q('button', 'jvold'); b.type = 'button'; b.appendChild(q('div', 'jvtxt', first.length > 160 ? first.slice(0, 160) + '…' : first));
          b.appendChild(q('div', 'jvtime', (t.by && t.by !== me ? t.by + ' · ' : '') + when(t.updated) + ' · ' + (ST[t.status] || t.status)));
          b.addEventListener('click', function () { listing = false; er.textContent = 'Earlier'; fresh = false; openId = t.id; HC.id = t.id; cur = t; draw(t); ta.focus(); });
          body.appendChild(b);
        });
      }).catch(function () { if (listing && HC.el) { body.textContent = ''; body.appendChild(q('div', 'jvnote', 'Could not load them. Try again.')); } });
    });
    nw.addEventListener('click', function () { var was = HC.id; fresh = true; listing = false; er.textContent = 'Earlier'; cur = null; HC.id = null; openId = null; draw(null); ta.focus(); if (was) O.call('jvclose', { id: was }).catch(function () {}); });
    var load = function () {
      if (!HC.el) return;
      O.call('jvlist').then(function (j) {
        if (!HC.el || !j || !j.ok) return;
        var ts = j.tickets || [], pick = null; ts.forEach(function (t) { seen(t); });
        if (HC.id) pick = ts.filter(function (t) { return t.id === HC.id; })[0] || null;
        else if (fresh) pick = null;
        else if (openId) pick = ts.filter(function (t) { return t.id === openId; })[0] || null;
        else pick = ts.filter(function (t) { return t.status !== 'closed' && t.by === me; })[0] || null;
        if (pick) { HC.id = pick.id; cur = pick; }
        if (!listing && ![].some.call(body.querySelectorAll('audio'), function (a) { return !a.paused && !a.ended; })) draw(cur);
      }).catch(function () {});
    };
    var send = function () {
      if (vo.busy()) { vo.stop(false, send); return; }
      var v = ta.value.trim(), np = picks.count(), vn = vo.data(); if (v.length < 2 && !np && !vn) return;
      sb.disabled = pb.disabled = mb.disabled = true;
      O.call('jvsend', { text: v, id: HC.id || '', ctx: O.ctx ? O.ctx() : {}, photos: picks.data(), audio: vn || undefined }).then(function (j) {
        sb.disabled = pb.disabled = false; mb.disabled = !!vo.data(); if (!j || !j.ok) { toast('Not sent', (j && j.error) || 'try again'); return; }
        ta.value = ''; picks.clear(); vo.clear(); ta.style.height = ''; fresh = false; listing = false; er.textContent = 'Earlier'; HC.id = j.ticket.id; cur = j.ticket; draw(cur);
      }).catch(function () { sb.disabled = pb.disabled = false; mb.disabled = !!vo.data(); toast('No signal', 'not sent'); });
    };
    sb.addEventListener('click', send);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener('input', function () { ta.style.height = ''; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
    HC.id = openId || null; draw(null); load();
    clearInterval(HC.tick); HC.tick = setInterval(load, 15000);
    setTimeout(function () { try { ta.focus(); } catch (e) {} }, 50);
  }
  function fromHash() { var m = /^#jarvis(?:\/(h[0-9]{14}[0-9a-f]{4}))?$/.exec(location.hash || ''); if (m) chat(m[1] || null); }
  window.JVChat = {
    mount: function (opts) { O = opts; O.seenKey = O.seenKey || 'jvSeen'; css(); fab(); fromHash(); if (!window.__jvHash) { window.__jvHash = 1; window.addEventListener('hashchange', fromHash); } },
    open: function (id) { if (O) chat(id || null); },
    unmount: function () { clearInterval(HC.dotTick); clearInterval(HC.tick); if (HC.voiceOff) HC.voiceOff(); if (HC.el) HC.el.remove(); HC.el = null; var b = document.getElementById('jvfab'); if (b) b.remove(); document.body.classList.remove('jvchat-on'); O = null; }
  };
})();
