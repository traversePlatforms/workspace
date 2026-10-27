/* ---- Spanish screens (Matthew 2026-10-11: "the spanish version of the screens ... toggle on the login screen ... and in the
   profile page where light and dark mode are") ----
   The page is written in English and stays that way in the source. When this device is set to Spanish ('doorapp.lang' =
   'es'), every text the app puts on screen is swapped for its Spanish as it appears: whole phrases first, then the pieces
   the code joins together ("New owner since " + a date), then the parts of a " · " line, then month names next to a number.
   What people type (addresses, owners, notes, names) is not in the dictionary, so it is left alone; inputs and textareas are
   never touched. The dictionary is i18n/es.json, copied beside the page as es.json by i18n/sync-es.cjs and fetched only on a
   Spanish device (2026-10-27, code review item 7b: it was 50 KB of every English page load); sw.js keeps it for offline. The page
   stays hidden until it lands (at most 3 s, then English rather than a blank screen); late, it still translates.
   Statutory text (roofing-law cancellation windows, the insurance and tax-credit paragraphs) is deliberately left out of the
   dictionary and stays in English until a bilingual person has reviewed a translation. */
var LANG = 'en';
try { if (localStorage.getItem('doorapp.lang') === 'es') LANG = 'es'; } catch (e) {}
var LOCALE = LANG === 'es' ? 'es-US' : 'en-US';
function setLang(l) { try { if (l === 'es') localStorage.setItem('doorapp.lang', 'es'); else localStorage.removeItem('doorapp.lang'); } catch (e) {} location.reload(); }
var i18nT = function (t) { return t; };
(function () {
  document.documentElement.setAttribute('lang', LANG === 'es' ? 'es' : 'en');
  if (LANG !== 'es') return;
  var de = document.documentElement, hold = document.createElement('style'), shown = false;
  hold.textContent = 'html.i18n-wait body{visibility:hidden}'; (document.head || de).appendChild(hold); de.classList.add('i18n-wait');
  var show = function () { if (!shown) { shown = true; de.classList.remove('i18n-wait'); } };
  setTimeout(show, 3000);
  fetch('es.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (D) { if (D) setup(D); show(); }, show);
  function setup(D) {
  var EXACT = Object.create(null), PRE = [], FRAG = Object.create(null), fragKeys = [];
  Object.keys(D).forEach(function (k) {
    var v = D[k], t = k.trim(); EXACT[k] = v; if (t && !(t in EXACT)) EXACT[t] = v.trim();
    var words = t.split(/\s+/).length;
    if (words === 1 && /\s$/.test(k) && !/^\s/.test(k)) PRE.push([k, v]);             /* "Call " + name: only at the start */
    else if (words >= 2 || /^[\s,;:(]/.test(k)) { if (t.length >= 4) { FRAG[k] = v; fragKeys.push(k); } }
  });
  fragKeys.sort(function (a, b) { return b.length - a.length; });
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var FRE = fragKeys.length ? new RegExp(fragKeys.map(esc).join('|'), 'g') : null;
  var FULLMON = { January: 'enero', February: 'febrero', March: 'marzo', April: 'abril', May: 'mayo', June: 'junio', July: 'julio', August: 'agosto', September: 'septiembre', October: 'octubre', November: 'noviembre', December: 'diciembre' };
  var WDAY = { Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mié', Thu: 'jue', Fri: 'vie', Sat: 'sáb' };
  var MON = { Jan: 'ene', Feb: 'feb', Mar: 'mar', Apr: 'abr', May: 'may', Jun: 'jun', Jul: 'jul', Aug: 'ago', Sep: 'sep', Oct: 'oct', Nov: 'nov', Dec: 'dic' };
  var MRE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b(?=\.? \d|, \d)|(\d )(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;
  var tr = function (s) {
    if (!s || !/[A-Za-z]/.test(s)) return s;
    if (s in EXACT) return EXACT[s];
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.slice(lead.length, s.length - trail.length);
    if (core in EXACT) return lead + EXACT[core] + trail;
    var r = s;
    for (var i = 0; i < PRE.length; i++) if (r.indexOf(PRE[i][0]) === 0) {
      /* a longer known phrase at the start wins over its first word (2026-10-11: "The largest hail ..." became "La largest hail ...") */
      var longer = false; for (var q = 0; q < fragKeys.length && !longer; q++) if (fragKeys[q].length > PRE[i][0].length && r.indexOf(fragKeys[q]) === 0) longer = true;
      if (!longer) r = PRE[i][1] + r.slice(PRE[i][0].length);
      break;
    }
    if (FRE) r = r.replace(FRE, function (m) { return FRAG[m]; }).replace(FRE, function (m) { return FRAG[m]; });   /* twice: two pieces can share a " · " */
    if (r.indexOf(' · ') >= 0) r = r.split(' · ').map(function (p) {
      var c = p.trim(); if (c in EXACT) return p.replace(c, EXACT[c]);
      for (var j = 0; j < PRE.length; j++) if (c.indexOf(PRE[j][0]) === 0) return p.replace(PRE[j][0], PRE[j][1]);   /* "Built 1997" after a dot too (2026-10-11) */
      return p;
    }).join(' · ');
    r = r.replace(MRE, function (m, a, num, b) { return a ? MON[a] : num + MON[b]; });
    /* counts the code builds from numbers: '4 of 30,464', '37 doors', '1 door' */
    r = r.replace(/(\d[\d,]*) of (\d)/g, '$1 de $2').replace(/(\d) doors\b/g, '$1 puertas').replace(/(\d) door\b/g, '$1 puerta');
    /* phrases with a name or a number inside (2026-10-11, round 2) */
    r = r.replace(/^Install the (.+) app$/, 'Instalar la app $1').replace(/^Instalar la app (.+) app$/, 'Instalar la app $1')
      .replace(/\b(\d+) min ago\b/g, 'hace $1 min').replace(/\b(\d+) h ago\b/g, 'hace $1 h').replace(/\bjust now\b/g, 'justo ahora')   /* ago() (2026-10-11) */
      .replace(/(\d{4}) photo\b/g, 'foto $1').replace(/([\d.]+)-acre lot\b/g, 'lote de $1 acres').replace(/(\d[\d,]*) homes\b/g, '$1 casas')
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b(?= \d| of)/g, function (m) { return FULLMON[m]; })
      .replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b(?=,? \d)/g, function (m) { return WDAY[m]; });
    return r;
  };
  i18nT = tr;
  var done = new WeakMap();
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/;   /* option labels in a select ARE translated */
  var skip = function (n) { for (var p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) { if (SKIP.test(p.nodeName)) return true; if (p.isContentEditable || (p.classList && p.classList.contains('noi18n'))) return true; } return false; };
  var text = function (n) {
    var v = n.nodeValue; if (!v || done.get(n) === v || skip(n)) return;
    var t = tr(v); if (t !== v) n.nodeValue = t; done.set(n, n.nodeValue);
  };
  var attrs = function (e) {
    if (e.nodeType !== 1) return;
    ['placeholder', 'title', 'aria-label'].forEach(function (a) { var v = e.getAttribute && e.getAttribute(a); if (v && e['_i18n' + a] !== v) { var t = tr(v); if (t !== v) e.setAttribute(a, t); e['_i18n' + a] = e.getAttribute(a); } });
    if ((e.nodeName === 'INPUT' && (e.type === 'button' || e.type === 'submit')) && e.value && e._i18nv !== e.value) { e.value = tr(e.value); e._i18nv = e.value; }
  };
  var walk = function (root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    attrs(root);
    var tw = document.createTreeWalker(root, 1 | 4, null), n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  };
  var start = function () {
    walk(document.body); document.title = tr(document.title);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') text(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
})();
