/* Sixfold Colorado — the only script on the site, and only /contact/ loads it.

   Two jobs, both progressive: the page works without this file, it just works
   a little less nicely.

   1. The "what do you need" chooser swaps the prompt above the message box, so
      a landscaping customer is not asked how many trees they have. Without JS the
      fire-mitigation prompt shows, which is the default radio — acceptable.

   2. Submit posts the form with fetch and shows the inline ok/err message. Without
      JS the browser posts natively and the server redirects to /thank-you/.
      Same contract as the Surge site's forms.
*/
(function () {
  'use strict';

  /* ---- chooser -> prompt ------------------------------------------------ */
  var radios = document.querySelectorAll('input[name="need"]');
  var label = document.querySelector('label[for="c-message"]');

  /* The home page's three service cards link here as /contact/?need=fire|clearing
     |landscaping, so the person who clicked "Book a landscaping walk" is not then
     asked to pick landscaping again. Only ever SELECTS one of the radios that is
     already on the page — an unknown or hostile ?need= matches nothing and the
     default stands, and nothing from the query string is written into the DOM.
     Without JS the link still works; it just lands on the default radio. */
  try {
    var want = new URLSearchParams(window.location.search).get('need');
    if (want) {
      for (var r = 0; r < radios.length; r++) {
        if (radios[r].value === want) { radios[r].checked = true; break; }
      }
    }
  } catch (e) { /* no URLSearchParams: the default radio is a fine outcome */ }
  /* Where the enquiry came from (2026-10-04): Linktree links here as /contact/?via=linktree, so the
     lead lands in the door app's Pipeline as Linktree, not Website. Only known words are kept; the
     server checks the same list. */
  try {
    var via = new URLSearchParams(window.location.search).get('via'), vf = document.getElementById('c-via');
    if (vf && via && /^(linktree|nextdoor|meta)$/.test(via)) vf.value = via;
  } catch (e) {}
  function applyPrompt() {
    if (!label) return;
    var picked = document.querySelector('input[name="need"]:checked');
    var text = picked && label.getAttribute('data-prompt-' + picked.value);
    if (text) label.textContent = text;
  }
  for (var i = 0; i < radios.length; i++) radios[i].addEventListener('change', applyPrompt);
  applyPrompt();

  /* ---- submit ------------------------------------------------------------ */
  var f = document.getElementById('contact-form');
  if (!f || !window.fetch) return;              // no fetch: native submit, server redirects

  f.addEventListener('submit', function (e) {
    var hp = f.querySelector('input[name="_confirm_url"]');
    if (hp && hp.value.trim() !== '') { e.preventDefault(); return; }   // honeypot: drop silently
    e.preventDefault();

    var btn = f.querySelector('button[type="submit"]');
    var ok = f.querySelector('.form-msg--ok');
    var err = f.querySelector('.form-msg--err');

    /* native validity first — the browser's own messages are better than ours */
    if (!f.checkValidity()) { f.reportValidity(); return; }

    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = 'Sending…';
    ok.hidden = true; err.hidden = true;

    fetch(f.getAttribute('action'), {
      method: 'POST',
      body: new FormData(f),
      headers: { 'Accept': 'application/json' }
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body && res.body.ok) {
          f.reset(); applyPrompt();
          ok.hidden = false;
          ok.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          if (res.body && res.body.error) err.firstChild.textContent = res.body.error + ' ';
          err.hidden = false;
        }
      })
      .catch(function () { err.hidden = false; })
      .then(function () { btn.disabled = false; btn.textContent = was; });
  });
})();
