/* Sixfold Colorado — the lawn cutaway, as a function.

   Shared by build-board.mjs (the 4:5 ad board) and build-flyer.mjs (the flyer in
   the shape of the 2026 Land & Fire sheet). It was inline in build-board.mjs
   first; two callers is when it moves, not the third.

   Everything vertical derives from ONE scale — pxPerIn — so the depth ruler, the
   tine, the holes and the roots cannot disagree with each other. That is the
   whole reason this is generated rather than drawn: a hand-placed drawing is
   consistent only until someone nudges it.

   The drawing is measured to the facts, not decorated:
     cores 2-3 in deep, 2-4 in apart, hollow tines, plugs left on the surface.
*/

export function cutaway({
  W = 960,
  H = 468,
  pxPerIn = 62,
  surface = 150,
  split = 430,
  holes = [520, 646, 772, 898],
  holeW = 32,
  holeDepth = 2.15,
  ruler: showRuler = true,
  badges = true,
  theme = 'dark',      // 'dark' = pine panel · 'day' = sky above, sunlit ground below
  anim = false,        // true tags the moving parts so a stylesheet can drive them
  idp = '',            // id prefix, so two of these can live on one page
} = {}) {
  const K = (name) => (anim ? ` class="${name}"` : '');
  /* Two grounds, one drawing. The day palette is not the dark one lightened: the
     sky becomes a real sky, the soil warms up rather than washing out, and every
     label flips to ink so it still clears contrast on a pale panel. */
  const day = theme === 'day';
  const P = day ? {
    panel: '#D8ECF6', soilTop: '#B08A60', soilBot: '#6E5138', pan: '#4A3526',
    panEdge: 'rgba(0,0,0,.55)', panHi: 'rgba(255,255,255,.22)',
    ink: 'rgba(24,34,28,.72)', inkSoft: 'rgba(24,34,28,.55)',
    rule: 'rgba(24,34,28,.30)', tick: 'rgba(24,34,28,.45)', tickMinor: 'rgba(24,34,28,.28)',
    badgeBg: 'rgba(255,253,246,.88)', badgeInk: '#4A564C',
    badge2Bg: 'rgba(255,253,246,.94)', badge2Ink: '#1E6B42',
    rootTop: '#7EA167', rootBot: '#4C6B3F',
  } : {
    panel: '#121A16', soilTop: '#75573F', soilBot: '#33261C', pan: '#241A12',
    panEdge: 'rgba(0,0,0,.75)', panHi: 'rgba(237,231,220,.10)',
    ink: 'rgba(237,231,220,.55)', inkSoft: 'rgba(237,231,220,.55)',
    rule: 'rgba(237,231,220,.28)', tick: 'rgba(237,231,220,.45)', tickMinor: 'rgba(237,231,220,.25)',
    badgeBg: 'rgba(237,231,220,.10)', badgeInk: 'rgba(237,231,220,.68)',
    badge2Bg: 'rgba(79,184,120,.18)', badge2Ink: '#7FD6A2',
    rootTop: '#BFD6A8', rootBot: '#7E9A6C',
  };
  const inch = (n) => surface + n * pxPerIn;
  const id = (n) => idp + n;
  const u = (n) => `url(#${id(n)})`;

  /* a root: filled taper, branches from the same curve */
  function root(x, depthIn, { w = 6, lean = 0, branches = [] } = {}) {
    const y0 = inch(0.42);
    const d = depthIn * pxPerIn;
    const tipX = x + lean;
    const main = `M${x - w} ${y0} C${x - w * 0.55} ${y0 + d * 0.45} ${tipX - 1.5} ${y0 + d * 0.8} ${tipX} ${y0 + d} `
               + `C${x + w * 0.55} ${y0 + d * 0.8} ${x + w * 0.8} ${y0 + d * 0.45} ${x + w} ${y0} Z`;
    const kids = branches.map(([atIn, len, dir]) => {
      const by = y0 + atIn * pxPerIn, bw = w * 0.48, bl = len * pxPerIn;
      const ex = x + dir * bl * 0.78, ey = by + bl * 0.72;
      return `M${x - bw} ${by} Q${x + dir * bl * 0.3} ${by + bl * 0.25} ${ex} ${ey} `
           + `Q${x + dir * bl * 0.2} ${by + bl * 0.55} ${x + bw} ${by + bw} Z`;
    });
    return `<path d="${main}" fill="${u('rootG')}"/>`
         + kids.map(k => `<path d="${k}" fill="${u('rootG')}" opacity=".92"/>`).join('');
  }

  const drop = (x, y, s = 1, k = 'm-rain') =>
    `<g${K(k)}><path transform="translate(${x} ${y}) scale(${s})" fill="${u('waterG')}"
       d="M0 -16 C7 -6 12 0 12 6 A12 12 0 0 1 -12 6 C-12 0 -7 -6 0 -16 Z"/></g>`;

  const seed = (x, y, r = -18, s = 1) =>
    `<g${K('m-seed')}><g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><ellipse rx="6.5" ry="10" fill="#D9853F"/>`
    + `<ellipse cx="-1.6" cy="-3" rx="2.2" ry="3.6" fill="#F0B577" opacity=".85"/></g></g>`;

  function rulerMarks() {
    if (!showRuler) return '';
    let s = `<g font-family="Consolas,monospace" font-size="${Math.round(pxPerIn * 0.27)}" fill="${P.ink}">`;
    s += `<line x1="46" y1="${inch(0)}" x2="46" y2="${inch(3.3)}" stroke="${P.rule}" stroke-width="2"/>`;
    for (let i = 0; i <= 3; i++) {
      const y = inch(i);
      s += `<line x1="38" y1="${y}" x2="58" y2="${y}" stroke="${P.tick}" stroke-width="2"/>`;
      s += `<text x="30" y="${y + 6}" text-anchor="end">${i}</text>`;
      if (i < 3) for (const f of [0.25, 0.5, 0.75]) {
        const yy = inch(i + f);
        s += `<line x1="42" y1="${yy}" x2="50" y2="${yy}" stroke="${P.tickMinor}" stroke-width="2"/>`;
      }
    }
    s += `<text x="30" y="${inch(0) - 22}" text-anchor="end" letter-spacing="2" fill="${P.inkSoft}">IN</text></g>`;
    return s;
  }

  const zone = badges ? `
    <g font-family="Consolas,monospace" font-size="18" font-weight="700" letter-spacing="2.5">
      <rect x="74" y="${H - 56}" width="150" height="40" rx="20" fill="${P.badgeBg}"/>
      <text x="149" y="${H - 30}" text-anchor="middle" fill="${P.badgeInk}">PACKED</text>
      <rect x="${W - 224}" y="${H - 56}" width="150" height="40" rx="20" fill="${P.badge2Bg}"/>
      <text x="${W - 149}" y="${H - 30}" text-anchor="middle" fill="${P.badge2Ink}">CORED</text>
    </g>` : '';

  /* left roots stop on the pan; right roots run past three inches. Depths scale
     with the panel so a short panel does not push roots out of the bottom. */
  const deep = Math.min(3.6, (H - inch(0.42)) / pxPerIn - 0.5);

  return `
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
     aria-label="Measured cross-section of a lawn. Left: packed ground, water running off, roots stopping at a compacted layer about an inch down. Centre: a hollow tine pulling a core. Right: cored ground, water and seed entering open holes, roots running past three inches.">
  <defs>
    <linearGradient id="${id('soilG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.soilTop}"/><stop offset="1" stop-color="${P.soilBot}"/></linearGradient>
    <linearGradient id="${id('skyG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9FD4EE"/><stop offset="1" stop-color="#E6F4FA"/></linearGradient>
    <radialGradient id="${id('sunG')}">
      <stop offset="0" stop-color="#FFE39B"/><stop offset=".55" stop-color="#FFC95E"/>
      <stop offset="1" stop-color="#FFC95E" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id('turfG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4FB878"/><stop offset="1" stop-color="#2E7A4E"/></linearGradient>
    <linearGradient id="${id('turfDull')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7C8A74"/><stop offset="1" stop-color="#5A6654"/></linearGradient>
    <linearGradient id="${id('rootG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.rootTop}"/><stop offset="1" stop-color="${P.rootBot}"/></linearGradient>
    <linearGradient id="${id('waterG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9FD0E8"/><stop offset="1" stop-color="#4E88A8"/></linearGradient>
    <linearGradient id="${id('steel')}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6E7A74"/><stop offset=".28" stop-color="#E9EEEB"/>
      <stop offset=".62" stop-color="#AEB8B2"/><stop offset="1" stop-color="#63706A"/></linearGradient>
    <linearGradient id="${id('plugG')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7A5C43"/><stop offset="1" stop-color="#4D3A2B"/></linearGradient>
    <pattern id="${id('grit')}" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="7" r="2.2" fill="rgba(0,0,0,.34)"/>
      <circle cx="19" cy="18" r="2.6" fill="rgba(0,0,0,.34)"/>
      <circle cx="13" cy="2" r="1.6" fill="rgba(0,0,0,.24)"/></pattern>
    <filter id="${id('lift')}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".45"/></filter>
    <clipPath id="${id('panel')}"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
  </defs>

  <g clip-path="url(#${id('panel')})">
    <rect x="0" y="0" width="${W}" height="${H}" fill="${day ? u('skyG') : P.panel}"/>
    ${day ? `
      <circle cx="96" cy="${Math.round(surface * 0.42)}" r="78" fill="${u('sunG')}" opacity=".85"/>
      <circle cx="96" cy="${Math.round(surface * 0.42)}" r="30" fill="#FFD264"/>
      <g stroke="#FFD264" stroke-width="5" stroke-linecap="round" opacity=".9">
        <path d="M96 ${Math.round(surface * 0.42) - 46}v-16M96 ${Math.round(surface * 0.42) + 46}v16"/>
        <path d="M${96 - 46} ${Math.round(surface * 0.42)}h-16M${96 + 46} ${Math.round(surface * 0.42)}h16"/>
        <path d="M${96 - 34} ${Math.round(surface * 0.42) - 34}l-11-11M${96 + 34} ${Math.round(surface * 0.42) + 34}l11 11"/>
        <path d="M${96 + 34} ${Math.round(surface * 0.42) - 34}l11-11M${96 - 34} ${Math.round(surface * 0.42) + 34}l-11 11"/>
      </g>` : ''}

    <rect x="0" y="${inch(0.42)}" width="${W}" height="${H - inch(0.42)}" fill="${u('soilG')}"/>
    <rect x="0" y="${inch(0.42)}" width="${W}" height="${H - inch(0.42)}" fill="${u('grit')}" opacity=".55"/>

    <!-- the compacted pan: darkest thing in the drawing, hard top edge, labelled -->
    <rect x="0" y="${inch(0.95)}" width="${split}" height="${pxPerIn}" fill="${P.pan}"/>
    <rect x="0" y="${inch(0.95)}" width="${split}" height="${pxPerIn}" fill="${u('grit')}" opacity="1"/>
    <line x1="0" y1="${inch(0.95)}" x2="${split}" y2="${inch(0.95)}" stroke="${P.panEdge}" stroke-width="4"/>
    <line x1="0" y1="${inch(0.95) + 4}" x2="${split}" y2="${inch(0.95) + 4}" stroke="${P.panHi}" stroke-width="2"/>
    <text x="${split - 72}" y="${inch(1.6)}" text-anchor="end" font-family="Consolas,monospace"
          font-size="16" letter-spacing="2" fill="rgba(255,255,255,.72)">COMPACTED LAYER</text>

    <g opacity=".85">
      ${root(120, 0.74, { lean: -30, branches: [[0.34, 0.5, -1], [0.54, 0.44, 1]] })}
      ${root(252, 0.80, { lean: 26, branches: [[0.36, 0.52, 1], [0.58, 0.42, -1]] })}
      ${root(372, 0.70, { lean: -22, branches: [[0.32, 0.46, -1], [0.5, 0.38, 1]] })}
    </g>
    <g${K('m-roots')} style="transform-origin:${Math.round(W * 0.75)}px ${inch(0.42)}px">
      ${root(560, deep * 0.92, { lean: 16, branches: [[0.9, 0.9, -1], [1.9, 0.8, 1]] })}
      ${root(700, deep, { lean: -14, branches: [[1.1, 0.85, 1], [2.2, 0.75, -1]] })}
      ${root(840, deep * 0.95, { lean: 18, branches: [[0.95, 0.8, -1], [2.1, 0.7, 1]] })}
      ${root(936, deep * 0.82, { lean: -10, branches: [[1.3, 0.6, -1]] })}
    </g>

    ${holes.map(x => `<rect x="${x - holeW / 2}" y="${inch(0.3)}" width="${holeW}" height="${holeDepth * pxPerIn}" rx="6" fill="#1A120C"/>
      <rect x="${x - holeW / 2}" y="${inch(0.3)}" width="${holeW}" height="14" fill="rgba(0,0,0,.55)"/>`).join('')}

    <rect x="0" y="${inch(0)}" width="${split}" height="${inch(0.42) - inch(0)}" fill="${u('turfDull')}"/>
    <rect x="${split}" y="${inch(0)}" width="${W - split}" height="${inch(0.42) - inch(0)}" fill="${u('turfG')}"/>
    ${holes.map(x => `<rect x="${x - holeW / 2}" y="${inch(0)}" width="${holeW}" height="${inch(0.42) - inch(0)}" fill="#0A0906"/>`).join('')}

    ${(day ? [206, 272, 338] : [96, 168, 240]).map((x, i) => drop(x, surface * 0.38 + i * 12)).join('')}
    <path${K('m-runoff')} d="M60 ${inch(-0.2)} C150 ${inch(0.35)} 300 ${inch(0.3)} 392 ${inch(-0.1)}"
          fill="none" stroke="${u('waterG')}" stroke-width="9" stroke-linecap="round" opacity=".9"
          stroke-dasharray="420" stroke-dashoffset="0"/>
    <path d="M366 ${inch(-0.26)} L400 ${inch(-0.1)} L368 ${inch(0.06)} Z" fill="#6FA8C4"/>
    ${holes.map((x, i) => drop(x, surface * 0.3 + (i % 2) * 20) + drop(x, surface * 0.68 + (i % 2) * 14, .78)).join('')}
    ${holes.map((x, i) => seed(x - 19, surface * 0.49 + (i % 2) * 16, -22 + i * 9)
                        + seed(x + 17, surface * 0.8 - (i % 2) * 12, 14 - i * 7)
                        + seed(x, inch(0.5) + (i % 2) * 12, 8 + i * 5)).join('')}

    <!-- the tine, mid-pull, straddling the two halves -->
    <g${K('m-tine')} filter="url(#${id('lift')})">
      <rect x="${split - 78}" y="14" width="156" height="26" rx="8" fill="#39433C"/>
      <rect x="${split - 12}" y="36" width="24" height="30" fill="#39433C"/>
      <rect x="${split - 21}" y="60" width="42" height="${inch(2.55) - 60}" rx="5" fill="${u('steel')}"/>
      <rect x="${split - 13}" y="${inch(0.15)}" width="26" height="${inch(2.5) - inch(0.15)}" fill="${u('plugG')}"/>
    </g>

    <!-- the core it has already set down, on the turf -->
    <g${K('m-plug')}><g transform="rotate(-7 ${split + 150} ${inch(-0.24)})" filter="url(#${id('lift')})">
      <rect x="${split + 78}" y="${inch(-0.52)}" width="146" height="42" rx="21" fill="${u('plugG')}"/>
      <rect x="${split + 78}" y="${inch(-0.52)}" width="38" height="42" rx="19" fill="${u('turfG')}"/>
    </g></g>

    ${rulerMarks()}
    ${zone}
  </g>
</svg>`;
}
