/* Peak website mock: phone menu, mock forms, and the "coming in the full build" page title. No libraries. */
(function () {
  var body = document.body;
  var btn = document.querySelector('.menu-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) { body.classList.remove('menu-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  }

  // Mock forms: nothing is sent. In the full build each form is a Ninja Form that saves the entry,
  // emails the inbox named in data-inbox and confirms to the sender.
  Array.prototype.forEach.call(document.querySelectorAll('form[data-mock]'), function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      f.classList.add('sent');
      var d = f.querySelector('.form-done');
      if (d) { d.setAttribute('tabindex', '-1'); d.focus(); }
    });
  });

  // coming-soon.html?p=Name shows which page was clicked
  var slot = document.getElementById('soon-name');
  if (slot) {
    var m = /[?&]p=([^&]+)/.exec(location.search);
    if (m) {
      var name = decodeURIComponent(m[1].replace(/\+/g, ' ')).replace(/[<>]/g, '').slice(0, 60);
      slot.textContent = name;
      document.title = name + ' | Peak Pickleball (draft mock)';
    }
  }
})();
