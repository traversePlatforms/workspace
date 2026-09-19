/* Surge site — motion layer. Plain JS, no libraries. Mirrors the lost build
   (Surge Motion Inventory, 2026-08-14): content is fully visible without this
   running; this only adds the reveal, and only when reduced-motion is off. */
(function () {
  var root = document.documentElement;
  var head = document.querySelector('.site-head');

  if (head) {
    var onScroll = function () { head.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  if (!('IntersectionObserver' in window)) return;
  root.classList.add('anim');

  // staggered arrival: hero, and any grid/list marked data-stagger
  var staggerSel = ['.hero .wrap', '[data-stagger]'];
  // plain block reveal + photo settle
  var plainSel = ['.band .wrap', '.page-head', '.split__media', '.ph-media', '.split > div'];

  document.querySelectorAll(staggerSel.join(',')).forEach(function (el) {
    el.classList.add('reveal', 'stagger');
  });
  document.querySelectorAll(plainSel.join(',')).forEach(function (el) {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();

/* Header: mobile nav toggle (<=940px; drop panel styled in site.css).
   Closes on link tap, Escape, and when the viewport leaves the breakpoint. */
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  var setOpen = function (open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-open', open);
  };

  btn.addEventListener('click', function () {
    setOpen(btn.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
  addEventListener('resize', function () {
    if (window.innerWidth > 940) setOpen(false);
  });
})();

/* Applicant form: don't allow an earliest-start-date in the past. */
(function () {
  var d = document.querySelector('input[type="date"][name="start"]');
  if (d && !d.min) d.min = new Date().toISOString().slice(0, 10);
})();

/* Contact page: reveal the matching form when an audience is chosen, and honour
   a deep link (/contact/#apply, #client, #feedback) so a visitor arriving from
   another page does not have to answer "which one are you?" a second time.
   With no JS the hash still scrolls to the right label — the ids are on the
   <label>s — the reader just picks the radio themselves. */
(function () {
  var radios = document.querySelectorAll('input[name="audience"]');
  if (!radios.length) return;
  var forms = {
    client: document.getElementById('form-client'),
    job: document.getElementById('form-job'),
    feedback: document.getElementById('form-feedback')
  };
  function show(value) {
    Object.keys(forms).forEach(function (k) {
      if (forms[k]) forms[k].hidden = (k !== value);
    });
  }
  radios.forEach(function (r) {
    r.addEventListener('change', function () { show(r.value); });
  });

  /* hash fragment -> audience value. #apply is the one /careers/ links to. */
  var fromHash = { '#client': 'client', '#apply': 'job', '#job': 'job', '#feedback': 'feedback' };
  function openFromHash() {
    var want = fromHash[window.location.hash];
    if (!want) return;
    var radio = document.querySelector('input[name="audience"][value="' + want + '"]');
    if (!radio) return;
    radio.checked = true;
    show(want);
    if (forms[want] && forms[want].scrollIntoView) {
      forms[want].scrollIntoView({ block: 'start' });
    }
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();

/* Forms: progressive-enhancement submit. Posts to the form's own action
   (api/submit.php in production, the dev server locally) and shows an inline
   result. With no JS the native POST still works and the handler redirects
   to /thank-you/. */
(function () {
  document.querySelectorAll('form.form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var hp = f.querySelector('input[name="_hp"]');
      if (hp && hp.value) { e.preventDefault(); return; }        // bot: drop it
      if (!f.getAttribute('action') || !window.fetch) return;    // no JS path: submit natively
      e.preventDefault();

      var btn = f.querySelector('button[type="submit"]');
      var ok = f.querySelector('.form-msg--ok');
      var err = f.querySelector('.form-msg--err');
      if (ok) ok.hidden = true;
      if (err) err.hidden = true;
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      // Send multipart when a file is attached (resume), URL-encoded otherwise.
      var fd = new FormData(f);
      var hasFile = false;
      fd.forEach(function (v) { if (v instanceof File && v.size > 0) hasFile = true; });

      fetch(f.getAttribute('action'), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: hasFile ? fd : new URLSearchParams(fd)
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json().catch(function () { return { ok: true }; });
      }).then(function (d) {
        if (d && d.ok === false) throw new Error('rejected');
        f.reset();
        if (ok) ok.hidden = false;
        if (ok && ok.scrollIntoView) ok.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }).catch(function () {
        if (err) err.hidden = false;
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  });
})();

/* Hero background video. Does nothing at all unless the <video data-hero-video>
   actually contains a <source> — so the slot can ship empty and the poster
   image simply stays. Only swaps in once the video is genuinely playing, so a
   failed load, a slow connection or an unsupported codec leaves the still in
   place rather than a black rectangle.
   Skipped entirely on reduced-motion and on save-data/2g. Narrow screens are NOT
   skipped since 2026-09-17 — they get a smaller encode instead; see below. */
(function () {
  var v = document.querySelector('video[data-hero-video]');
  if (!v || !v.querySelector('source')) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A phone on its side is 844+ wide and was getting the 1.4 MB desktop file on
     cellular (device matrix, 2026-09-19). Height catches it: no tablet is under
     480px tall in either orientation, every phone is in landscape. */
  var narrow = window.matchMedia && window.matchMedia('(max-width: 720px), (max-height: 480px)').matches;
  if (reduced) return;

  // save-data / metered connections: leave the still
  var conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;

  /* Phones used to be skipped outright (a background video is decoration, and the
     desktop file is ~1.9 MB of it). Matthew asked for motion on mobile 2026-09-17,
     so narrow screens get a much smaller encode instead of nothing: 854x480, ~560 KB,
     the same 10.6 s loop. Indistinguishable behind the blur at phone width. If the
     small file is ever missing, the <source> children stay as they are and the
     desktop file plays — no blank box either way. */
  var mobileSrc = v.getAttribute('data-mobile-src');
  var swapped = false;
  if (narrow && mobileSrc) {
    while (v.firstChild) v.removeChild(v.firstChild);
    var s = document.createElement('source');
    s.src = mobileSrc;
    s.type = 'video/mp4';
    v.appendChild(s);
    swapped = true;
  }

  function reveal() { v.classList.add('is-playing'); }
  v.addEventListener('playing', reveal, { once: true });
  v.addEventListener('error', function () { v.classList.remove('is-playing'); });

  /* 2026-09-17: the first version called v.load() and then v.play() in the same
     tick. On Matthew's Chrome the play() promise never resolved and the still
     stayed, while a play() typed into the console worked — the load() was racing
     the play(). Now: no explicit load() (preload=auto starts it), try to play as
     soon as the element says it can, and once more when the tab becomes visible.
     A rejection is logged at debug level instead of vanishing. */
  function attempt() {
    var p = v.play();
    if (p && p.then) {
      p.then(function () { if (!v.paused) reveal(); },
             function (e) { if (window.console && console.debug) console.debug('hero video: ' + e.name + ' — ' + e.message); });
    }
  }
  /* Swapping <source> children after parse does nothing on its own — the element has
     already run its resource selection and keeps the old currentSrc. load() is what
     re-runs it. It is only called when we actually swapped, and play() is then left to
     the canplay listener rather than fired in the same tick, which is what raced the
     load() in the first version.

     ORDER MATTERS, found 2026-09-19: preload used to be set to 'auto' BEFORE the
     load(). 'auto' is an instruction to fetch the CURRENTLY selected resource — which
     at that moment was still the 1.4 MB desktop file — and load() then selected the
     mobile one and fetched that too. Every phone downloaded both: 2.0 MB of video for
     a 560 KB loop. preload now changes only after the selection is the right one. */
  if (swapped) v.load();
  v.preload = 'auto';
  if (v.readyState >= 3) attempt();
  else v.addEventListener('canplay', attempt, { once: true });
  if (!swapped) attempt();
  document.addEventListener('visibilitychange', function () { if (!document.hidden && v.paused) attempt(); });
})();

/* Header dropdown. The parent link still navigates — the chevron is a separate
   control so keyboard and touch users are not dependent on hover, which does
   not exist on a phone and is awkward on a trackpad.
   CSS handles hover and focus-within on desktop; this only drives the button,
   plus the dismissals people expect (Escape, click-away, following a link). */
(function () {
  var toggles = document.querySelectorAll('.sub-toggle');
  if (!toggles.length) return;

  function close(btn) {
    btn.setAttribute('aria-expanded', 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.removeAttribute('data-open');
  }
  function closeAll() { toggles.forEach(close); }

  toggles.forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = btn.getAttribute('aria-expanded') === 'true';
      closeAll();
      if (!open) { btn.setAttribute('aria-expanded', 'true'); panel.setAttribute('data-open', ''); }
    });

    // following an anchor inside the panel should dismiss it
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) close(btn); });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-sub')) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();

/* Photo rotator. Does nothing unless a .rot holds more than one <picture> — so
   a slot can be converted to the component before the extra photos exist and it
   simply behaves as a plain figure until they do.
   Auto-advance is suppressed under reduced-motion (the dots still work), and
   pauses on hover and on keyboard focus so it cannot move under someone who is
   reading the caption or tabbing through. */
(function () {
  var rots = document.querySelectorAll('.rot');
  if (!rots.length) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  rots.forEach(function (rot) {
    var frames = rot.querySelectorAll('.rot__frames > picture');
    if (frames.length < 2) return;               // one photo: leave it alone

    var dots = rot.querySelector('.rot__dots');
    var i = 0, timer = null;

    function go(n) {
      i = (n + frames.length) % frames.length;
      frames.forEach(function (f, k) { f.classList.toggle('is-on', k === i); });
      if (dots) {
        dots.querySelectorAll('button').forEach(function (b, k) {
          b.setAttribute('aria-current', k === i ? 'true' : 'false');
        });
      }
    }
    function start() { if (!reduced && !timer) timer = setInterval(function () { go(i + 1); }, 5200); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    if (dots) {
      frames.forEach(function (_, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Show photo ' + (k + 1) + ' of ' + frames.length);
        b.addEventListener('click', function () { stop(); go(k); });
        dots.appendChild(b);
      });
    }

    rot.addEventListener('mouseenter', stop);
    rot.addEventListener('mouseleave', start);
    rot.addEventListener('focusin', stop);
    rot.addEventListener('focusout', start);

    rot.classList.add('is-live');
    go(0);
    start();
  });
})();
