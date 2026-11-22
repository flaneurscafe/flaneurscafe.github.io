/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the lightness chart: the outfit on a scale of lightness.

   One row per piece, head to toe. Each sits at its lightness (CIELAB L*, dark on the left, light
   on the right); a patterned piece at the colour it adds up to, with its two colours as ticks.
   Down the whole chart runs a line at your skin's lightness, and on the rows at the face a
   shaded zone marks the lightness that frames your face (the band of section 4). Underneath,
   first any piece near the face that clashes with your skin (ringed in red), then the three steps
   the outfit rules check, with their numbers: shirt against jacket, top against
   trousers, shoes against trousers. They use the same thresholds as the Dresser, so the
   chart and the checks always agree.

   It sits on white, so the dark text and thin rules read clearly (How it works, section 12); the
   colours themselves are judged on cloth, not on a screen. window.VCHART = { mount, update }. */
(function () {
  'use strict';
  const VC = window.VC;
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const r1 = function (v) { return Math.round(v * 10) / 10; };
  const Lof = function (hex) { return VC.hexToLab(hex)[0]; };

  const W = 330, X0 = 92, X1 = 284;                  // the lightness track
  const X = function (L) { return X0 + (X1 - X0) * Math.max(0, Math.min(100, L)) / 100; };
  const TT_COL = { 1: '#2f6b3d', 2: '#2e5480', 3: '#8a6a16', 4: '#8f2f2f' };

  function chart(P) {
    const a = P.analysis, o = P.outfit, pats = P.pats || {}, n = P.names || {}, VP = window.VPAT, E = window.VENGINE;
    const s = [], rows = [];
    const mean = function (k) { return VP ? VP.mean(o[k], pats[k]) : o[k]; };
    const twoTone = function (k) { const p = VP ? VP.norm(pats[k]) : { type: 'solid' }; return p.type === 'solid' ? null : [o[k], p.hex2]; };
    // one row per worn position, named by the garment type worn there (a coat, a roll neck)
    const kinds = P.kinds || {}, pinName = (window.VGARM.byKey.boutonniere.kinds.find(function (x) { return x.id === 'pin'; }) || {}).name;
    window.VGARM.POSITIONS.forEach(function (pos) {
      const k = pos.key; if (!o[k]) return;
      const label = k === 'shoes' ? 'Shoes, belt' : (kinds[k] || pos.label);
      rows.push({ k: k, label: label.length > 13 ? label.replace('Shawl-collar cardigan', 'Shawl cardigan').replace('Crew-neck knit', 'Crew neck').replace('Knitted polo', 'Knit polo') : label,
        name: n[k], hex: k === 'shoes' ? o.shoes : mean(k), two: k === 'shoes' ? (P.shoesTwo || null) : twoTone(k), face: pos.face,
        // judged against the skin as the outfit rules judge it: the face layers, and the pieces near the face
        // (pocket square, flower), except a lapel pin, which is metal
        near: (pos.face || pos.near) && !(k === 'boutonniere' && kinds[k] === pinName) });
    });

    const top = 44, youH = 50, rowH = 40, chartBot = top + youH + rows.length * rowH;
    const skinL = a ? a.lab.skin[0] : Lof(P.skin);

    // axis: dark to light, with a few L* ticks
    s.push('<text x="' + X0 + '" y="16" class="c-ax">dark</text><text x="' + X1 + '" y="16" class="c-ax" text-anchor="end">light</text>');
    s.push('<text x="' + ((X0 + X1) / 2) + '" y="16" class="c-ax" text-anchor="middle">lightness (L*)</text>');
    [0, 25, 50, 75, 100].forEach(function (L) {
      s.push('<line x1="' + r1(X(L)) + '" x2="' + r1(X(L)) + '" y1="' + (top - 8) + '" y2="' + chartBot + '" stroke="#000" stroke-opacity="0.08"/>');
      s.push('<text x="' + r1(X(L)) + '" y="' + (top - 12) + '" class="c-tick" text-anchor="middle">' + L + '</text>');
    });

    // you: skin, hair or brows, eyes
    const yYou = top + youH / 2;
    s.push('<text x="8" y="' + (yYou + 4) + '" class="c-lab">You</text>');
    s.push('<line x1="' + X0 + '" x2="' + X1 + '" y1="' + yYou + '" y2="' + yYou + '" stroke="#000" stroke-opacity="0.18"/>');
    const feats = [];
    if (P.hair) feats.push({ hex: P.hair, t: P.hairStyle === 'none' ? 'brows' : 'hair' });
    if (P.eyes) feats.push({ hex: P.eyes, t: 'eyes' });
    feats.push({ hex: P.skin, t: 'skin', big: true });
    // stagger labels so close values do not overlap
    feats.sort(function (p, q) { return Lof(p.hex) - Lof(q.hex); });
    let lastX = -99, up = false;
    feats.forEach(function (f) {
      const x = X(Lof(f.hex)); up = x - lastX < 26 ? !up : false; lastX = x;
      s.push('<circle cx="' + r1(x) + '" cy="' + yYou + '" r="' + (f.big ? 9 : 7) + '" fill="' + f.hex + '" stroke="#000" stroke-opacity="0.25"/>');
      s.push('<text x="' + r1(x) + '" y="' + (up ? yYou - 13 : yYou + 21) + '" class="c-small" text-anchor="middle">' + f.t + ' ' + Math.round(Lof(f.hex)) + '</text>');
    });
    if (a && a.contrastEdge) {
      s.push('<text x="8" y="' + (yYou + 16) + '" class="c-small">contrast ' + Math.round(a.contrast) + '</text>');
    }

    // the face's framing zone on the rows at the face, and the skin line down everything
    const band = a ? a.band : [12, 60];
    const faceRows = rows.filter(function (r) { return r.face; });
    if (faceRows.length) {
      const y0 = top + youH, y1 = y0 + faceRows.length * rowH;
      [[skinL - band[1], skinL - band[0]], [skinL + band[0], skinL + band[1]]].forEach(function (z) {
        const l0 = Math.max(0, z[0]), l1 = Math.min(100, z[1]);
        if (l1 - l0 > 0.5) s.push('<rect x="' + r1(X(l0)) + '" y="' + y0 + '" width="' + r1(X(l1) - X(l0)) + '" height="' + (y1 - y0) + '" fill="#3e8e5a" opacity="0.16"/>');
      });
    }
    s.push('<line x1="' + r1(X(skinL)) + '" x2="' + r1(X(skinL)) + '" y1="' + (yYou + 10) + '" y2="' + chartBot + '" stroke="' + shadeLine(P.skin) + '" stroke-width="1.4" stroke-dasharray="3 3"/>');

    // the pieces
    const clashRows = [];
    rows.forEach(function (r, i) {
      const y = top + youH + i * rowH + rowH / 2, L = Lof(r.hex), x = X(L);
      r.y = y; r.L = L; r.x = x;
      s.push('<text x="8" y="' + (y - 2) + '" class="c-lab' + (P.previewSlot === r.k ? ' c-try' : '') + '">' + r.label + '</text>');
      s.push('<text x="8" y="' + (y + 10) + '" class="c-small">' + esc(r.name || '') + '</text>');
      s.push('<line x1="' + X0 + '" x2="' + X1 + '" y1="' + y + '" y2="' + y + '" stroke="#000" stroke-opacity="0.18"/>');
      if (r.two) r.two.forEach(function (h) { s.push('<line x1="' + r1(X(Lof(h))) + '" x2="' + r1(X(Lof(h))) + '" y1="' + (y - 9) + '" y2="' + (y + 9) + '" stroke="' + h + '" stroke-width="3"/><line x1="' + r1(X(Lof(h))) + '" x2="' + r1(X(Lof(h))) + '" y1="' + (y - 9) + '" y2="' + (y + 9) + '" stroke="#000" stroke-opacity="0.2" stroke-width="0.6"/>'); });
      s.push('<rect x="' + r1(x - 9) + '" y="' + (y - 9) + '" width="18" height="18" rx="3" fill="' + r.hex + '" stroke="' + (P.previewSlot === r.k ? '#111' : 'rgba(0,0,0,0.3)') + '" stroke-width="' + (P.previewSlot === r.k ? 1.6 : 1) + '"/>');
      // tier at the face, from the colour rules
      if (r.near && a && E) {
        const t = E.scoreColour(r.hex, a).tier;
        s.push('<text x="' + (X1 + 8) + '" y="' + (y + 4) + '" class="c-tt" fill="' + TT_COL[t] + '">T' + t + '</text>');
        if (t > 2) {                                  // clashes with your skin: ring it in red
          s.push('<rect x="' + r1(x - 12) + '" y="' + (y - 12) + '" width="24" height="24" rx="5" fill="none" stroke="#b0413e" stroke-width="1.8"/>');
          clashRows.push({ r: r, t: t, soft: a.confidence === 'low' && E.scoreColour(r.hex, a).tempOnly });
        }
      }
      s.push('<text x="' + r1(x) + '" y="' + (y - 12) + '" class="c-small" text-anchor="middle">' + Math.round(L) + '</text>');
    });

    // the steps the outfit rules check (the same thresholds as engine.js)
    const by = {}; rows.forEach(function (r) { by[r.k] = r; });
    const lo = a ? a.band[0] : 12, hi = a ? a.band[1] : 70;   // the face band of section 4, as the engine uses it
    const notes = [];
    // Clashes with your skin come first: they are the one thing no other piece can fix.
    clashRows.forEach(function (c) {
      const why = E.skinReasons ? E.skinReasons(c.r.hex, a) : [];
      notes.push({ ok: false, text: 'Clashes with your skin: ' + (c.r.name ? c.r.name + ' ' : '') + c.r.label.toLowerCase() + ' is T' + c.t + (why.length ? ', ' + why[0] : '') +
        (c.soft ? ' (temperature only, and your temperature reading is low confidence: a note in the Dresser)' : '') + '.' });
    });
    function bracket(r1_, r2_, ok, text) {
      const xm = X1 + 38, ya = r1_.y, yb = r2_.y;
      s.push('<path d="M' + (X1 + 32) + ' ' + ya + 'H' + xm + 'V' + yb + 'H' + (X1 + 32) + '" fill="none" stroke="' + (ok ? '#3e8e5a' : '#b0413e') + '" stroke-width="1.4"/>');
      notes.push({ ok: ok, text: text });
    }
    const faceLayers = window.VGARM.FACE.filter(function (k) { return by[k]; });
    if (faceLayers.length >= 2) {
      let best = -1, pair = null;        // -1 so two layers of equal lightness still make a pair
      for (let i = 0; i < faceLayers.length; i++) for (let j = i + 1; j < faceLayers.length; j++) {
        const d = Math.abs(by[faceLayers[i]].L - by[faceLayers[j]].L);
        if (d > best) { best = d; pair = [by[faceLayers[i]], by[faceLayers[j]]]; }
      }
      // a step a little short of the bound (within stepNear of it) still frames the face: a note in the Dresser
      const nearLo = lo * (E && E.PARAMS ? E.PARAMS.stepNear : 1), short = best >= nearLo && best < lo;
      const ok = best >= nearLo && !(a && a.contrastLevel === 'low' && best > hi);
      bracket(pair[0], pair[1], ok, (short ? 'Face just framed: ' : ok ? 'Face framed: ' : best < lo ? 'Face not framed: ' : 'Frame heavy: ') + pair[0].label.toLowerCase() + ' against ' + pair[1].label.toLowerCase() + ', step ' + Math.round(best) +
        (short ? ' (a little short of the ' + Math.round(lo) + ' your face carries)' : best < lo ? ' (your face needs at least ' + Math.round(lo) + ')' : ok ? ' (needs ' + Math.round(lo) + ' or more)' : ' (more than your colouring carries, ' + Math.round(hi) + ')'));
    }
    if (by.shirt && a && Math.abs(by.shirt.L - skinL) < lo) {
      notes.push({ ok: null, text: by.shirt.label + ' at your skin\u2019s lightness (' + Math.round(Math.abs(by.shirt.L - skinL)) + ' apart): beside the face it separates by colour, not by light against dark.' });
    }
    if (faceLayers.length === 1 && !P.study) {      // layering is the Dresser's business, not the study's
      notes.push({ ok: null, text: 'One layer at the face: only its neckline frames it. A jacket or a knit adds a frame.' });
    }
    const topK = by.jacket ? 'jacket' : by.mid ? 'mid' : 'shirt';
    if (by[topK] && by.trousers) {
      const d = Math.abs(by[topK].L - by.trousers.L), dE = VC.deltaE2000(VC.hexToLab(by[topK].hex), VC.hexToLab(by.trousers.hex));
      // the thresholds of the blur rule (rules.js), not numbers of its own
      const PR = E && E.PARAMS ? E.PARAMS : { nearFrom: 1.5, nearTo: 7, halvesL: 12 };
      const blur = dE >= PR.nearTo && d < PR.halvesL, same = dE < PR.nearFrom;
      notes.push({ ok: !blur, text: same ? 'Top and trousers the same colour: one block from neck to shoes' + (topK === 'jacket' ? ', as a suit reads' : '') + '.' : (blur ? 'Halves blur: ' : 'Top and bottom separate: ') + by[topK].label.toLowerCase() + ' and trousers ' + Math.round(d) + ' apart' + (blur ? ' (need ' + PR.halvesL + ' or more, or an exact match)' : '') + '.' });
    }
    if (by.shoes && by.trousers) {
      const lighter = by.shoes.L > by.trousers.L + 8;
      notes.push({ ok: !lighter, text: lighter ? 'Shoes lighter than the trousers: they pull the eye down.' : 'Shoes the trousers’ depth or darker.' });
    }

    // legend and notes
    let ny = chartBot + 22;
    s.push('<rect x="' + X0 + '" y="' + (ny - 9) + '" width="12" height="10" fill="#3e8e5a" opacity="0.3"/><text x="' + (X0 + 17) + '" y="' + ny + '" class="c-small">lightness that frames your face</text>');
    s.push('<line x1="' + (X0 + 172) + '" x2="' + (X0 + 186) + '" y1="' + (ny - 4) + '" y2="' + (ny - 4) + '" stroke="' + shadeLine(P.skin) + '" stroke-width="1.4" stroke-dasharray="3 3"/><text x="' + (X0 + 190) + '" y="' + ny + '" class="c-small">your skin</text>');
    ny += 20;
    // Without a profile the rows are stand-ins, so no verdicts are drawn: they would judge placeholders.
    if (!a) notes.length = 0;
    // notes, wrapped to the chart's width
    function wrap(t, n) {
      const out = [''];
      t.split(' ').forEach(function (w) { const cur = out[out.length - 1]; if ((cur + ' ' + w).trim().length > n) out.push(w); else out[out.length - 1] = (cur + ' ' + w).trim(); });
      return out;
    }
    notes.forEach(function (nt) {
      const mark = nt.ok === null ? '•' : nt.ok ? '✓' : '✕', lines = wrap(nt.text, 60);
      s.push('<text x="8" y="' + ny + '" class="c-note ' + (nt.ok === null ? '' : nt.ok ? 'ok' : 'no') + '"><tspan class="c-mark">' + mark + '</tspan>' +
        lines.map(function (l, i) { return '<tspan x="20"' + (i ? ' dy="12.5"' : '') + '>' + esc(l) + '</tspan>'; }).join('') + '</text>');
      ny += 12.5 * (lines.length - 1) + 17;
    });
    return { body: s.join(''), h: ny + 6, label: 'Lightness chart of the outfit against your colouring. ' + notes.map(function (x) { return x.text; }).join(' ') };
  }
  // the skin line: darker than the skin, so it shows on a light ground
  function shadeLine(hex) { const l = VC.hexToLab(hex); return VC.labToHex([Math.max(0, l[0] - 35), l[1] * 1.2, l[2] * 1.2]); }

  /* ---------- Stage ---------- */
  const A = { host: null, stage: null, P: null };
  function draw() {
    if (!A.stage || !A.P) return;
    const r = chart(A.P), svg = A.stage.querySelector('svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.ceil(r.h));
    svg.innerHTML = r.body;
    svg.setAttribute('aria-label', r.label);
    A.key.innerHTML = keyHtml(A.P);
  }
  /* How to read the chart, and where to put colours, with this person's numbers: the framing zones
     and the step the face needs. The same numbers as the chart and the Dresser. */
  function keyHtml(P) {
    const a = P.analysis;
    const head = '<summary>How to read the chart</summary>';
    if (!a) return head + '<p>Set your colouring on the You tab; the chart then measures every piece against it.</p>';
    const skinL = Lof(P.skin), band = a.band, lo = Math.round(band[0]);
    const z = function (x, y) { return Math.round(Math.max(0, x)) + ' to ' + Math.round(Math.min(100, y)); };
    const dark = z(skinL - band[1], skinL - band[0]), light = skinL + band[0] < 100 ? z(skinL + band[0], skinL + band[1]) : null;
    return head +
      '<ul class="ck-marks">' +
      '<li><b>Rows:</b> one per piece, head to toe, placed by lightness: black (0) on the left, white (100) on the right. Your features sit on the top row.</li>' +
      '<li><b>Dashed line:</b> your skin\'s lightness, ' + Math.round(skinL) + ', carried down the chart.</li>' +
      '<li><b>Green zones</b> (on the rows at the face): the lightness that frames your face, far enough from your skin to give it an edge and not so far that it takes over. Yours: ' + dark + ' on the dark side' + (light ? ', ' + light + ' on the light side' : '') + '.</li>' +
      '<li><b>T1 to T4</b> at the right: each colour\'s tier at your face. <b>A red ring:</b> the colour clashes with your skin.</li>' +
      '<li><b>Two coloured ticks:</b> a pattern\'s two colours; its square sits where they add up from a distance.</li>' +
      '<li><b>Bracket and number:</b> the biggest light-dark step between the layers at the face.</li></ul>' +
      '<p class="ck-how"><b>Where to put colours</b></p><ol class="ck-place">' +
      '<li>At least one layer at the face in a green zone.</li>' +
      '<li>Between the layers at the face, a step of at least ' + lo + ' (your face carries contrast ' + Math.round(a.contrast) + ').</li>' +
      '<li>The top and the trousers at least 12 apart, or matching exactly, as a suit.</li>' +
      '<li>Shoes level with the trousers or to their left, darker.</li>' +
      '<li>Below the face there is no zone: any lightness works there, within these steps.</li></ol>';
  }
  function ensure() {
    if (A.stage) return;
    A.stage = document.createElement('div'); A.stage.className = 'chart-stage';
    A.stage.innerHTML = '<svg class="chart-svg" role="img" preserveAspectRatio="xMidYMin meet"></svg><details class="chart-key"></details>';
    A.key = A.stage.querySelector('.chart-key');
  }
  function update(P) { ensure(); A.P = P; draw(); }
  function mount(host) {
    ensure(); if (!host) return;
    if (A.host !== host) { host.appendChild(A.stage); A.host = host; }
    draw();
  }
  window.VCHART = { mount: mount, update: update };
})();
