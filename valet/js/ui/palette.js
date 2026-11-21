/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — The Palette tab: tiers and the colour map, the study, build around one colour, saved combinations, what goes together.
   Part of the interface; the parts share window.VAPP (see core.js). */
(function () {
  'use strict';
  const V = window.VAPP;
  const { $, $$, D, E, VC, coreRows, esc, save, showTab, summerOn } = V;
  Object.assign(V, { fillSelects, nameOf, renderColour, study, tt, warmPairs });

  /* ---------- Palette tab ---------- */
  /* The one way a tier is shown in lists, swatches and rows. */
  function tt(t) { return '<span class="tt t' + t + '" title="Tier ' + t + ': ' + E.TIER_TEXT[t].note.replace(/"/g, '') + '">T' + t + '</span>'; }

  /* ---- The study: up to three colours, by where they sit. It lives beside the chart on the Palette
     tab and is for learning how colours behave together; it never changes the outfit. Each place
     stands for a position the rules know: near the face is the layer next to the neck, the accent
     is worn as a scarf (a small piece near the face, without the tie-against-shirt rules), below the
     belt is trousers. ---- */
  const PLACES = [
    { key: 'face', slot: 'shirt', kind: 'shirt', label: 'Near the face', hint: 'a shirt, knit or jacket', face: true },
    { key: 'accent', slot: 'scarf', kind: 'scarf', label: 'Accent', hint: 'a tie, scarf or pocket square', face: true },
    { key: 'below', slot: 'trousers', kind: 'trousers', label: 'Below the belt', hint: 'trousers', face: false }
  ];
  const placeBy = {}; PLACES.forEach(function (p) { placeBy[p.key] = p; });
  function study() {
    if (!V.state.study) V.state.study = { face: '#c3d7ee', accent: null, below: '#8e9196', active: 'face' };
    if (!placeBy[V.state.study.active]) V.state.study.active = 'face';
    return V.state.study;
  }
  const activePlace = function () { return placeBy[study().active]; };
  /* The study as an outfit for the rules. over: { place, hex } shows one colour in a place without
     keeping it; withActive gives the selected place a piece even when it is empty, so the palette can
     be marked for it. */
  function studyOutfit(over, withActive, src) {
    const st = src || study(), o = { study: true };   // the study checks colours only: no cloth, formality or season
    PLACES.forEach(function (p) {
      const hex = over && over.place === p.key ? over.hex : st[p.key];
      if (hex) o[p.slot] = { hex: hex, name: nameOf(hex), kind: p.kind, pat: { type: 'solid' } };
      else if (withActive && p.key === st.active) o[p.slot] = { hex: '#808080', name: 'empty', kind: p.kind, pat: { type: 'solid' } };
    });
    return o;
  }
  const filled = function () { return PLACES.filter(function (p) { return study()[p.key]; }); };

  function nameOf(hex) {
    const c = D.colours.find(function (x) { return x.hex.toLowerCase() === hex.toLowerCase(); });
    return c ? c.name : hex.toUpperCase();
  }

  /* ---- Your palette: the named library, by tier (where a colour can go) or by colour family ---- */
  let palView = 'tier';
  const FAMILIES = [['Neutral', 'Neutrals'], ['Blue', 'Blues'], ['Green', 'Greens'], ['Red', 'Reds and pinks'], ['Yellow', 'Yellows and oranges'], ['Purple', 'Purples']];
  const TIER_HEAD = { 1: 'Anywhere, even at the face', 2: 'The one deliberate colour', 3: 'Below the belt', 4: 'Away from the face' };
  function swatchHtml(s, sel) {
    return '<button class="swatch t' + s.tier + (s.hex.toLowerCase() === sel ? ' sel' : '') + '" data-hex="' + s.hex + '" title="' + esc(s.name) + ': tier ' + s.tier + ', score ' + s.score.toFixed(2) + '">' +
      '<span class="chip" style="background:' + s.hex + '">' + tt(s.tier) + '</span>' +
      '<span class="sname">' + esc(s.name) + '</span><span class="sr-only">, tier ' + s.tier + '</span></button>';
  }
  const selHex = function () { return (study()[study().active] || '').toLowerCase(); };
  function renderPalette() {
    const scored = D.colours.map(function (c) { return Object.assign({ name: c.name, family: c.family }, E.scoreColour(c.hex, V.analysis)); });
    const sel = selHex();
    const block = function (title, note, items) {
      return '<div class="tier"><h3>' + title + ' <span class="count">' + items.length + '</span></h3>' + (note ? '<p>' + note + '</p>' : '') +
        (items.length ? '<div class="swatches">' + items.map(function (s) { return swatchHtml(s, sel); }).join('') + '</div>' : '<p class="empty-tier">None in the library.</p>') + '</div>';
    };
    const atFace = scored.filter(function (s) { return s.tier <= 2; }).length;
    let html = '<p class="pal-sum">' + (summerOn() ? '<strong>Summer.</strong> ' : '') + atFace + ' of the ' + scored.length + ' named colours work at your face. ' + (scored.length - atFace) + ' belong below the belt or in small doses.</p>';
    if (palView === 'tier') {
      html += [1, 2, 3, 4].map(function (t) {
        return block(tt(t) + ' ' + TIER_HEAD[t], E.TIER_TEXT[t].note, scored.filter(function (s) { return s.tier === t; }).sort(function (a, b) { return b.score - a.score; }));
      }).join('');
    } else {
      html += FAMILIES.map(function (f) {
        return block(f[1], '', scored.filter(function (s) { return s.family === f[0]; }).sort(function (a, b) { return b.lab[0] - a.lab[0]; }));
      }).join('');
    }
    const box = $('#palette'); box.className = 'by-' + palView; box.innerHTML = html;
    $$('#palette .swatch').forEach(function (b) {
      b.addEventListener('click', function () { previewColour(null); selectColour(b.dataset.hex); });
      hoverPreview(b);
    });
    $$('#palView button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.view === palView)); });
    markFit();
  }
  $$('#palView button').forEach(function (b) {
    b.addEventListener('click', function () { palView = b.dataset.view; renderPalette(); });
  });
  $('#palFit').addEventListener('change', function (e) { V.state.fitMark = e.target.checked; save(); markFit(); });
  /* Pointing at a colour shows it in the selected place of the study, on the chart and in the
     line above it, without keeping it. */
  function previewColour(hex) {
    V.previewing = hex ? { slot: activePlace().slot, look: { hex: hex } } : null;
    clearTimeout(V.previewTimer); V.previewTimer = setTimeout(V.syncChart, hex ? 30 : 120);
  }
  function hoverPreview(el) {
    el.addEventListener('pointerenter', function () { previewColour(el.dataset.hex); showTry(el.dataset.hex); renderTester(el.dataset.hex); });
    el.addEventListener('pointerleave', function () { previewColour(null); showTry(null); renderTester(); });
    el.addEventListener('focus', function () { showTry(el.dataset.hex); renderTester(el.dataset.hex); });
    el.addEventListener('blur', function () { showTry(null); renderTester(); });
  }

  /* ---- Marks against the study: each palette colour tried in the selected place, with the other
     places as they are (suggest.js, fitFor). Struck through: it would break a rule; "!": it would
     bend one. The line above the chart says which rule and why. ---- */
  let fit = null;
  const FIT_WORD = { ok: 'works with the rest of the study.', care: 'Careful. ', out: 'Clashes. ' };
  function listWords(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function markFit() {
    const pl = activePlace(), on = V.state.fitMark !== false && !!V.analysis;
    fit = on ? E.fitFor(studyOutfit(null, true), V.analysis, pl.slot) : null;
    $$('#palette .swatch').forEach(function (b) {
      const j = fit && fit.byHex[b.dataset.hex.toLowerCase()];
      b.classList.toggle('fit-out', !!j && j.state === 'out'); b.classList.toggle('fit-care', !!j && j.state === 'care');
    });
    $('#palFit').checked = V.state.fitMark !== false;
    const sum = $('#palFitSum'); sum.hidden = !on; if ($('#palFitKey')) $('#palFitKey').hidden = !on;
    if (on) {
      const others = filled().filter(function (p) { return p.key !== pl.key; }).map(function (p) { return nameOf(study()[p.key]).toLowerCase() + ' ' + p.label.toLowerCase(); });
      sum.innerHTML = '<strong>' + pl.label + '</strong>' + (others.length ? ', with ' + esc(listWords(others)) : ', on its own') + ': <strong>' + fit.n.ok + ' work</strong>' +
        (fit.n.care ? ', ' + fit.n.care + (fit.n.care === 1 ? ' needs' : ' need') + ' care <span class="fit-key care">!</span>' : '') + ', ' + fit.n.out + V.say(' clash <span class="fit-key out"></span>. Point at any colour and the line beside the chart says why.', ' clash <span class="fit-key out"></span>. Tap any colour and the line beside the chart says why.') +
        (fit.stuck.length ? '<br><span class="muted">Whatever goes ' + pl.label.toLowerCase() + ', one problem stays, because it lies between the other places. ' + esc(fit.stuck[0]) + '</span>' : '');
    }
    showTry(null);
  }
  /* The line above the chart: the colour pointed at, or the one in the selected place. */
  function showTry(hex) {
    const el = $('#tryNote'); if (!el || !V.analysis) return;
    const pl = activePlace(), cur = study()[pl.key];
    if (!hex && !cur) { V.result('colour', pl.label + ' is empty.', ''); el.innerHTML = pl.label + V.say(' is empty. Point at a colour in the palette to try one there.', ' is empty. Tap a colour in the palette to put one there.'); return; }
    const h = hex || cur, t = E.scoreColour(h, V.analysis).tier;
    let s = (hex ? 'Trying ' : '') + '<strong>' + esc(nameOf(h)) + '</strong> ' + pl.label.toLowerCase() + ' ' + tt(t) + ': ';
    // the one-line result: the colour, where, its tier, and the first sentence of the verdict
    let line = (hex ? 'Trying ' : '') + nameOf(h) + ' ' + pl.label.toLowerCase() + ' T' + t + ': ', level = '';
    if (fit) {
      const j = fit.judge(h, nameOf(h));
      s += '<span class="fit-' + j.state + '-t">' + FIT_WORD[j.state] + '</span>' + esc(j.why);
      line += FIT_WORD[j.state].trim(); level = j.state === 'out' ? 'bad' : '';
    } else {
      const note = pl.face ? E.TIER_TEXT[t].note : t > 2 ? 'Weak at the face, fine down here.' : 'Fine here.';
      s += esc(note); line += note.split('. ')[0].replace(/\.?$/, '.'); level = pl.face && t > 2 ? 'bad' : '';
    }
    el.innerHTML = s;
    V.result('colour', line, level);
  }
  function markPalette() {
    const sel = selHex();
    $$('#palette .swatch').forEach(function (b) { b.classList.toggle('sel', b.dataset.hex.toLowerCase() === sel); });
    markFit();
    markMap();
  }

  /* ---- Colour map: every hue and lightness at one strength, each square scored at the face.
     Size carries the verdict (full = tier 1, smaller = tier 2, dots = tiers 3 and 4), so the
     shape of what suits you can be read without relying on colour. ---- */
  const MAP = { cols: 36, rows: 15, cells: [], cell: 0 };
  function renderMap() {
    const cv = $('#colourMap');
    if (!cv || !V.analysis) return;
    const wCss = cv.parentNode.clientWidth;
    if (!wCss) return;
    const C = parseFloat($('#mapChroma').value);
    $('#mapHint').textContent = C < 0.05 ? 'greyed, close to neutral' : C < 0.1 ? 'muted, like most cloth' : C < 0.15 ? 'clear' : 'vivid';
    const cell = Math.max(8, Math.floor(wCss / MAP.cols)), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = cell * MAP.cols + 'px'; cv.style.height = cell * MAP.rows + 'px';
    cv.width = cell * MAP.cols * dpr; cv.height = cell * MAP.rows * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    MAP.cells = []; MAP.cell = cell; MAP.C = C;
    for (let r = 0; r < MAP.rows; r++) {
      for (let k = 0; k < MAP.cols; k++) {
        const L = 0.96 - r * 0.058, rgb = VC.oklchToRgb([L, C, k * 10]);
        if (!rgb) { MAP.cells.push(null); continue; }
        const hex = VC.rgbToHex(rgb), sc = E.scoreColour(hex, V.analysis);
        // Size carries the verdict, so it reads without relying on colour: a full square suits you
        // anywhere (T1) or as the one deliberate colour (T2, with a white dot); a small square
        // belongs away from the face (T3, T4). No square: the screen cannot show that colour.
        const full = cell - 2, w = sc.tier > 2 ? Math.max(3, Math.round(full * 0.42)) : full;
        const x = k * cell + 1 + (full - w) / 2, y = r * cell + 1 + (full - w) / 2;
        c.fillStyle = hex; c.beginPath();
        if (c.roundRect) c.roundRect(x, y, w, w, 2); else c.rect(x, y, w, w);
        c.fill();
        if (sc.tier === 2) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + w - 3, y + w - 3, Math.max(1.5, w * 0.12), 0, Math.PI * 2); c.fill(); }
        MAP.cells.push({ hex: hex, tier: sc.tier, score: sc.score, L: L, h: k * 10 });
      }
    }
    markMap();
  }
  function markMap() {
    const ring = $('#mapRing'); if (!ring || !MAP.cell) return;
    const cur = study()[study().active];
    if (!cur) { ring.hidden = true; return; }
    const ok = VC.rgbToOklch(VC.hexToRgb(cur));
    const r = Math.round((0.96 - ok[0]) / 0.058), k = Math.round(ok[2] / 10) % MAP.cols;
    const near = Math.abs(ok[1] - MAP.C) < 0.035 && r >= 0 && r < MAP.rows && MAP.cells[r * MAP.cols + k];
    ring.hidden = !near;
    if (near) { ring.style.left = k * MAP.cell + 'px'; ring.style.top = r * MAP.cell + 'px'; ring.style.width = ring.style.height = MAP.cell + 'px'; }
  }
  function mapCell(e) {
    const rect = $('#colourMap').getBoundingClientRect();
    const k = Math.floor((e.clientX - rect.left) / MAP.cell), r = Math.floor((e.clientY - rect.top) / MAP.cell);
    if (k < 0 || r < 0 || k >= MAP.cols || r >= MAP.rows) return null;
    const c = MAP.cells[r * MAP.cols + k];
    return c ? Object.assign({ k: k, r: r }, c) : null;
  }
  $('#colourMap').addEventListener('pointermove', function (e) {
    const c = mapCell(e), tip = $('#mapTip');
    tip.hidden = !c; if (!c) return;
    const lab = VC.hexToLab(c.hex), nearN = D.colours.map(function (q) { return { n: q.name, d: VC.deltaE2000(lab, VC.hexToLab(q.hex)) }; }).sort(function (a, b) { return a.d - b.d; })[0];
    tip.innerHTML = '<span class="d" style="background:' + c.hex + '"></span>' + (nearN.d < 6 ? 'close to ' + esc(nearN.n) : c.hex.toUpperCase()) + ' ' + tt(c.tier) +
      '<span class="tip-w">' + { 1: 'anywhere', 2: 'deliberate colour', 3: 'below the belt', 4: 'away from the face' }[c.tier] + '</span>';
    tip.style.left = Math.min((c.k + 0.5) * MAP.cell, MAP.cols * MAP.cell - 80) + 'px'; tip.style.top = c.r * MAP.cell + 'px';
  });
  $('#colourMap').addEventListener('pointerleave', function () { $('#mapTip').hidden = true; MAP.hover = null; previewColour(null); showTry(null); renderTester(); });
  $('#colourMap').addEventListener('pointermove', function (e) { const c = mapCell(e); if (c && c.hex !== MAP.hover) { MAP.hover = c.hex; previewColour(c.hex); showTry(c.hex); renderTester(c.hex); } });
  $('#colourMap').addEventListener('click', function (e) { const c = mapCell(e); if (c) { previewColour(null); selectColour(c.hex); } });
  $('#mapChroma').addEventListener('input', renderMap);
  window.addEventListener('resize', function () { if (V.activeTab === 'colour') renderMap(); });

  /* Put a colour in the selected place of the study. */
  function selectColour(hex) {
    study()[study().active] = hex;
    save();
    renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
  }

  /* ---- The study's three places, as a choice of where the next colour goes ---- */
  /* Whether each filled place is part of a problem with the others, as on the Dresser rows:
     the same judgement as the palette marks, for the colour already in the place. */
  function studyStatus() {
    const o = studyOutfit(), out = {};
    if (filled().length < 2) return out;
    PLACES.forEach(function (p) { if (o[p.slot]) out[p.key] = E.fitFor(o, V.analysis, p.slot).judge(o[p.slot].hex, o[p.slot].name); });
    return out;
  }
  function renderStudy() {
    const st = study(), sts = studyStatus();
    $('#study').innerHTML = PLACES.map(function (p) {
      const hex = st[p.key], act = st.active === p.key, ss = hex ? sts[p.key] : null;
      const t = hex ? E.scoreColour(hex, V.analysis).tier : null;
      return '<div class="place' + (act ? ' active' : '') + (hex ? '' : ' empty') + (ss && ss.state !== 'ok' ? ' st-' + ss.state : '') + '" data-p="' + p.key + '"' + (ss && ss.why ? ' title="' + esc(ss.why) + '"' : '') + '>' +
        '<button type="button" class="g-pick" role="radio" aria-checked="' + act + '">' +
        '<span class="chip" style="background:' + (hex || 'transparent') + '"></span>' +
        '<span class="g-text"><span class="g-name">' + p.label + '</span><span class="g-colour">' + (hex ? esc(nameOf(hex)) : 'empty: ' + p.hint) + '</span>' + VWARD.statusLine(ss) + '</span>' +
        '<span class="g-pill">' + (hex && (p.face || t > 2) ? tt(t) : '') + '</span></button>' +
        (hex ? '<button type="button" class="btn ghost small p-clear" aria-label="Clear ' + p.label.toLowerCase() + '">Clear</button>' : '') +
        '</div>';
    }).join('');
    $$('#study .place').forEach(function (row) {
      const key = row.dataset.p;
      $('.g-pick', row).addEventListener('click', function () { st.active = key; save(); renderStudy(); markPalette(); renderTester(); V.syncChart(); });
      const cl = $('.p-clear', row);
      if (cl) cl.addEventListener('click', function () { st[key] = null; st.active = key; save(); renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart(); });
    });
    $$('.wearing').forEach(function (el) { el.textContent = activePlace().label.toLowerCase(); });
    syncThemeFromStudy();
    renderPairs();   // the pair lists follow the study (see renderPairs)
  }

  function ruleList(rules) {
    const icon = function (s) { return s >= 0.85 ? '<span class="ok">✓</span>' : s >= 0.5 ? '<span class="meh">~</span>' : '<span class="no">✕</span>'; };
    const badge = function (lv) { return '<span class="badge ' + lv.replace('/', '') + '">' + lv + '</span>'; };
    return '<ul class="rules">' + rules.map(function (x) {
      return '<li>' + icon(x.score) + '<span>' + badge(x.level) + ' ' + esc(x.text).replace(/#[0-9a-fA-F]{6}\b/g, function (h) { return '<span class="hexsw" style="background:' + h + '" role="img" aria-label="colour ' + h + '" title="' + h + '"></span>'; }) + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---- Why this colour: the colour pointed at, or the one in the selected place, scored at your
     face rule by rule. This is about you and the colour alone; the marks are about the study. ---- */
  let whyOpen = false;
  function renderTester(hexArg) {
    const pl = activePlace(), hex = hexArg || study()[pl.key];
    if (!hex) { $('#testerOut').innerHTML = V.say('<p class="small muted">Point at a colour, or put one in the study, to see why it suits you or not.</p>', '<p class="small muted">Put a colour in the study to see why it suits you or not.</p>'); return; }
    const r = E.scoreColour(hex, V.analysis);
    const head = '<div class="verdict"><span class="t">' + esc(nameOf(hex)) + '</span><span>' + tt(r.tier) + ' <span class="score">' + r.score.toFixed(2) + '</span></span></div>';
    const where = pl.face ? E.TIER_TEXT[r.tier].note
      : r.tier === 4 ? 'Below the belt: loud anywhere, allowed here as the one bold move of an outfit.'
        : r.tier === 3 ? 'Below the belt: this is where tier 3 colours belong, far enough from the face that its rules hardly apply.'
          : 'Below the belt: fine here, and it would also work at the face.';
    $('#testerOut').innerHTML = head + '<p class="small muted" style="margin:0.3rem 0 0">' + where + '</p>' +
      '<details class="face-score"' + (whyOpen ? ' open' : '') + '><summary>' + (pl.face ? 'Rule by rule' : 'How it scores at the face') + '</summary>' + ruleList(r.rules) + '</details>';
    const d = $('#testerOut details'); if (d) d.addEventListener('toggle', function () { whyOpen = d.open; });
  }

  /* ---- The study as a whole: the rules between its colours, and the step to a real outfit ---- */
  function renderStudySum() {
    const f = filled(), box = $('#studySum');
    if (f.length < 2) {
      box.innerHTML = '<h4 class="outfit-h">The study together</h4><p class="small muted">Put a colour in a second place to see how they work together.</p>';
      return;
    }
    const checks = E.checkOutfit(studyOutfit(), V.analysis).filter(function (c) { return c.group === 'colour' && c.id !== 'step' && c.id !== 'frame'; });
    const bad = checks.filter(function (c) { return c.score < 0.85; }).sort(function (a, b) { return a.score - b.score; });
    const good = checks.filter(function (c) { return c.score >= 0.85; });
    const pp = placeProblems(study());
    const ppList = pp.length ? '<ul class="rules">' + pp.map(function (x) {
      return '<li>' + (x.state === 'out' ? '<span class="no">✕</span>' : '<span class="meh">~</span>') + '<span><strong>' + esc(x.places.join(' and ')) + ':</strong> ' + esc(x.why) + '</span></li>';
    }).join('') + '</ul>' : '';
    box.innerHTML = '<h4 class="outfit-h">The study together</h4>' + ppList +
      (bad.length ? ruleList(bad) : pp.length ? '' : '<p class="small">No rule between these colours is broken.</p>') +
      (good.length ? '<details class="face-score"><summary>' + good.length + ' rule' + (good.length > 1 ? 's' : '') + ' passed</summary>' + ruleList(good) + '</details>' : '') +
      '<div class="next-step with-note"><button type="button" class="btn small" id="toOutfit">Send to the Dresser</button><span class="ns-note">Puts these colours on your outfit there: near the face on the shirt (or the outer layer, if dark), the accent on the tie or scarf, below the belt on the trousers. Your other pieces stay; Undo there takes it back.</span>' +
      '</div>';
    $('#toOutfit').addEventListener('click', studyToOutfit);
  }
  /* The study as pieces: near the face becomes the shirt when light, or the outer layer over the
     current shirt when dark; the accent a tie when the shirt has a collar, otherwise a scarf. */
  function studyToOutfit() {
    const st = study(), o = V.state.outfit, notes = [];
    VWARD.snapshot();                         // so Undo on the Dresser takes it back
    if (st.face) {
      const L = VC.hexToLab(st.face)[0];
      if (L >= 55 || !o.jacket) { o.shirt.hex = st.face; o.shirt.on = true; notes.push(nameOf(st.face) + ' ' + window.VGARM.kind('shirt', o.shirt).name.toLowerCase()); }
      else { o.jacket.hex = st.face; o.jacket.on = true; notes.push(nameOf(st.face) + ' ' + window.VGARM.kind('jacket', o.jacket).name.toLowerCase()); }
    }
    if (st.accent) {
      // the accent goes on the tie when the shirt has a collar, otherwise on a scarf
      if (window.VGARM.kind('shirt', o.shirt).tieable) { o.tie.hex = st.accent; o.tie.on = true; notes.push(nameOf(st.accent) + ' ' + window.VGARM.kind('tie', o.tie).name.toLowerCase()); }
      else { o.scarf.hex = st.accent; o.scarf.on = true; notes.push(nameOf(st.accent) + ' scarf'); }
    }
    if (st.below) { o.trousers.hex = st.below; notes.push(nameOf(st.below) + ' trousers'); }
    save();
    showTab('outfit');
    VWARD.note('From the study: ' + notes.join(', ') + '.');
  }

  /* ---- The palette card: one or two printed pages to keep, built from the same analysis. The
     browser's print dialogue saves it as a PDF. Printed colours drift from cloth, so every colour
     carries its name. ---- */
  function buildCard() {
    const a = V.analysis; if (!a) return '';
    const other = E.analyseProfile(E.seasonProfile(V.state, summerOn() ? 'winter' : 'summer'));
    const season = summerOn() ? 'summer' : 'winter', otherName = summerOn() ? 'winter' : 'summer';
    const scored = D.colours.map(function (c) { return Object.assign({ name: c.name }, E.scoreColour(c.hex, a)); });
    const chip = function (hex, name) { return '<span class="pc-c"><i style="background:' + hex + '"></i>' + esc(name) + '</span>'; };
    const bald = a.hairStyle === 'none';
    // the step between layers at the face, as the Dresser measures it (engine.js, checkOutfit)
    const lo = Math.round(a.band[0]), hi = Math.round(a.band[1]);
    const metal = a.lean < 0.35 ? 'Silver, steel, white gold or gunmetal; your colouring is cool, so gold is a stray warm note.'
      : a.lean > 0.65 ? 'Yellow gold or rose gold agree with your warm colouring; silver is the cooler alternative.'
        : 'Either; keep one metal through the outfit.';
    const sm = E.summary(a);
    const moves = D.colours.map(function (c) { return { name: c.name, hex: c.hex, a: E.scoreColour(c.hex, a).tier, b: other ? E.scoreColour(c.hex, other).tier : null }; })
      .filter(function (x) { return x.b && x.a !== x.b && Math.min(x.a, x.b) <= 2; });
    let h = '<h1>Palette card' + (V.state.name ? ': ' + esc(V.state.name) : '') + '</h1>' +
      '<p class="pc-sub">Valet, ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + '. Colours for ' + season + '. Printed colours are approximate: go by the names, and check cloth in daylight.</p>' +
      '<h2>Your colouring</h2><div class="pc-feats">' +
      '<span class="pc-feat"><span class="pc-dot" style="background:' + a.hex.skin + '"></span>Skin</span>' +
      (a.hex.hair ? '<span class="pc-feat"><span class="pc-dot" style="background:' + a.hex.hair + '"></span>' + (bald ? 'Brows' : 'Hair') + '</span>' : '') +
      (a.hex.eyes ? '<span class="pc-feat"><span class="pc-dot" style="background:' + a.hex.eyes + '"></span>Eyes</span>' : '') + '</div>' +
      '<p>Contrast <strong>' + a.contrastLevel + '</strong> (' + Math.round(a.contrast) + '), undertone <strong>' + a.tempLevel + '</strong> (' + a.confidence + ' confidence), colour strength <strong>' + a.chromaLevel + '</strong>, depth <strong>' + a.depthLevel + '</strong>.</p>' +
      '<h2>Where each colour can go</h2>' +
      [1, 2, 3, 4].map(function (t) {
        const list = scored.filter(function (s) { return s.tier === t; }).sort(function (x, y) { return y.score - x.score; });
        return '<div class="pc-tier"><h3>T' + t + ' ' + TIER_HEAD[t] + ': ' + E.TIER_TEXT[t].note + '</h3>' +
          (list.length ? '<div class="pc-sw">' + list.map(function (s) { return chip(s.hex, s.name); }).join('') + '</div>' : '<p>None in the library.</p>') + '</div>';
      }).join('') +
      (moves.length ? '<h3>In ' + otherName + '</h3><p>' + moves.map(function (x) { return esc(x.name) + ' T' + x.a + ' becomes T' + x.b; }).join('; ') + '.</p>' : '') +
      '<h2>Rules of thumb for you</h2><ul>' +
      '<li><strong>Light-dark step at the face:</strong> the layers near your face should differ by ' + lo + ' to ' + hi + ' in lightness (L*), about as much as your own features do. Less looks flat; much more takes over the face.</li>' +
      '<li><strong>Pattern near the face:</strong> a pattern\'s own light-dark contrast up to ' + hi + '. At most two patterns, at different scales, sharing a colour, with one plain layer.</li>' +
      '<li><strong>Colour:</strong> two neutrals and one colour never fails. One deliberate (T2) colour per outfit. A colour is one piece, not top and trousers together.</li>' +
      '<li><strong>Below the belt:</strong> shoes the trousers\' depth or darker; belt matches the shoes; socks take the trousers\' colour, or a distinct tone of it.</li>' +
      '<li><strong>Metal:</strong> ' + metal + ' Keep one metal through an outfit; a two-tone watch is the exception.</li>' +
      (V.state.outfit && V.state.outfit.acc && V.state.outfit.acc.glasses && V.state.outfit.acc.glasses.on ? '<li><strong>Glasses:</strong> they sit at the face, so the Dresser judges them with the colours there' + (a.underEye === 'deep' ? '; with deep-set eyes, check that the bottom rim does not sit on the shadow' : '') + '.</li>' : '') +
      (a.redness !== 'none' ? '<li><strong>Redness:</strong> reds and pinks near the face pick out the red in the skin, and greens push it redder. Blues and greys are the calm choice.</li>' : '') +
      '</ul>' +
      (sm.tests.length ? '<h2>Daylight tests to run</h2><ul>' + sm.tests.map(function (t) { return '<li><strong>' + esc(t.title) + '.</strong> ' + esc(t.text) + '</li>'; }).join('') + '</ul>' : '');
    h += cardCombos(chip);
    if ($('#printTheme').checked) h += cardTheme(chip);
    h += '<p class="pc-foot">Tiers come from your measured colouring: contrast, undertone, colour strength and the effect of a colour beside the skin. They are a strong working hypothesis; if a garment passes the daylight test but breaks a rule here, trust the daylight.</p>';
    return h;
  }
  /* The card keeps only what works: combinations that pass every rule of the study this season
     (the tested ones, the saved ones and the study as it stands), and for each core colour near the
     face, the core colours that go with it. Saved combinations that fail are left out and counted. */
  function cardCombos(chip) {
    if (pairCache.key !== pairKey()) pairCache = { key: pairKey(), v: {}, trios: null };
    const sw = function (c) { return PLACES.filter(function (p) { return c[p.key]; }).map(function (p) { return chip(c[p.key], nameOf(c[p.key])); }).join(' '); };
    const key = function (c) { return PLACES.map(function (p) { return c[p.key] || ''; }).join('|'); };
    const seen = {}, rows = [];
    const add = function (c, label) { const k = key(c); if (seen[k]) return; seen[k] = 1; rows.push('<li><strong>' + esc(label) + ':</strong> ' + sw(c) + '</li>'); };
    let left = 0;
    combos().forEach(function (c) { if (comboVerdict(c).st === 'ok') add(c, c.name); else left++; });
    const st = study();
    if (filled().length > 1 && comboVerdict(st).st === 'ok') add(st, 'In the study');
    tested().forEach(function (t) { add({ face: t.face.hex, accent: t.accent.hex, below: t.below.hex }, 'Tested'); });
    let h = rows.length ? '<h2>Combinations that work</h2><p class="pc-note">Near the face, accent, below the belt. Each passes every rule this season.</p><ul class="pc-combos">' + rows.join('') + '</ul>' +
      (left ? '<p class="pc-note">' + left + ' saved combination' + (left > 1 ? 's are' : ' is') + ' left out: ' + (left > 1 ? 'they break' : 'it breaks') + ' a rule this season.</p>' : '') : '';
    const S = coreSets();
    const okWith = function (f, place) {
      return S[place].filter(function (c) { if (c.hex === f.hex) return false; const o = { face: f.hex }; o[place] = c.hex; return judgePair(o).st === 'ok'; });
    };
    const names = function (l) { return l.length ? l.map(function (c) { return chip(c.hex, c.name); }).join(' ') : '<span class="pc-note">none in the core palette</span>'; };
    h += '<h2>What goes together</h2><p class="pc-note">For each core colour near the face, the core colours that go with it with no rule broken.</p>' +
      '<table class="pc-pairs"><thead><tr><th>Near the face</th><th>Accent</th><th>Below the belt</th></tr></thead><tbody>' +
      S.face.map(function (f) { return '<tr><td>' + chip(f.hex, f.name) + '</td><td>' + names(okWith(f, 'accent')) + '</td><td>' + names(okWith(f, 'below')) + '</td></tr>'; }).join('') +
      '</tbody></table>';
    return h;
  }
  /* The colour built around (Build around one colour), on the card when asked for: where it can go
     on you, and, with it in that place, which core colours go with it in the other places, by the
     same pair judgement as What goes together. A colour that suits only below the belt or away from
     the face says so, with its versions that suit the face. */
  function cardTheme(chip) {
    const hex = themeHex(); if (!hex) return '';
    if (pairCache.key !== pairKey()) pairCache = { key: pairKey(), v: {}, trios: null };
    const t = E.themePalette(hex, V.analysis), plan = E.themeStudy(hex, V.analysis, t), S = coreSets();
    const name = nameOf(hex), place = plan.place === 'face' ? 'face' : 'below';
    const label = { face: 'Near the face', accent: 'Accent (tie, scarf, pocket square)', below: 'Below the belt' };
    const where = t.tier <= 2 ? 'It suits you near the face, so it can go anywhere: it is planned here near the face.'
      : t.tier === 3 ? 'It does not suit you near the face: wear it below the belt only (trousers, shoes, belt), and keep a colour that suits you at the face.'
        : 'Keep it away from your face: below the belt, or in a small piece far from it.';
    const avoid = {}; t.avoid.forEach(function (c) { avoid[c.hex.toLowerCase()] = 1; });   // kept apart, as on screen
    const okWith = function (other) {
      return S[other].filter(function (c) {
        if (c.hex.toLowerCase() === hex.toLowerCase() || avoid[c.hex.toLowerCase()]) return false;
        const o = {}; o[place] = hex; o[other] = c.hex; return judgePair(o).st === 'ok';
      });
    };
    const names = function (l) { return l.length ? l.map(function (c) { return chip(c.hex, c.name); }).join(' ') : '<span class="pc-note">none in the core palette</span>'; };
    const others = PLACES.map(function (p) { return p.key; }).filter(function (k) { return k !== place; });
    const combo = {}; combo[place] = hex; if (plan.other) combo[place === 'face' ? 'below' : 'face'] = plan.other; if (plan.accent) combo.accent = plan.accent;
    const cv = comboVerdict(combo);
    return '<div class="pc-theme"><h2>Built around ' + esc(name) + '</h2>' +
      '<p class="pc-note">From the colour study on the Palette tab (Build around one colour), for ' + (summerOn() ? 'summer' : 'winter') + '.</p>' +
      '<p>' + chip(hex, name + ' T' + t.tier) + ' <strong>' + esc(t.where.title) + '.</strong> ' + esc(where) + (t.reason && t.tier > 1 ? ' Why: ' + esc(t.reason) : '') + '</p>' +
      (t.tier > 2 && t.versions.length ? '<p><strong>Its versions that suit you at the face:</strong> ' + names(t.versions) + '</p>' : '') +
      '<table class="pc-pairs"><thead><tr><th>Place</th><th>What goes there</th></tr></thead><tbody>' +
      '<tr><td><strong>' + label[place] + '</strong></td><td>' + chip(hex, name) + '</td></tr>' +
      others.map(function (k) { return '<tr><td>' + label[k] + '</td><td>' + names(okWith(k)) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      (cv.st === 'ok' && Object.keys(combo).length > 1 ? '<p><strong>A combination that works:</strong> ' + PLACES.filter(function (p) { return combo[p.key]; }).map(function (p) { return chip(combo[p.key], p.label + ': ' + nameOf(combo[p.key])); }).join(' ') + '</p>' : '') +
      (t.avoid.length ? '<p><strong>Keep apart from it:</strong> ' + t.avoid.map(function (c) { return esc(c.name); }).join(', ') + '.</p>' : '') + '</div>';
  }
  /* The tick sits under Build around one colour; the note beside the print button says when the
     card will include it. */
  function syncPrintTheme() {
    const nm = themeHex() ? nameOf(themeHex()) : 'this colour', on = $('#printTheme').checked;
    $('#printThemeName').textContent = nm;
    $('#printCardNote').textContent = 'A palette card to keep: your tiers, rules of thumb, the combinations that work and what goes with what' +
      (on ? ', and ' + nm + ', the colour you built around.' : '.');
  }
  $('#printTheme').addEventListener('change', function () { V.state.printTheme = $('#printTheme').checked; save(); syncPrintTheme(); });
  $('#printCardBtn').addEventListener('click', function () {
    $('#printCard').classList.remove('outfit');   // in case the outfit card's afterprint never came
    $('#printCard').innerHTML = buildCard();
    window.print();
  });


  /* Build around one colour (suggest.js, themePalette). The theme is kept with the profile. */
  function themeHex() {
    const sel = $('#themeBase');
    return sel.value === 'custom' ? $('#themeCustom').value : sel.value;
  }
  /* The list and the colour square show the same theme: a list choice sets the square; a square
     choice selects the named colour it matches, or "Your own colour" with the nearest name. */
  function syncThemeControls(hex) {
    const sel = $('#themeBase'), opt = sel.querySelector('option[value="custom"]');
    const lib = D.colours.find(function (c) { return c.hex.toLowerCase() === hex.toLowerCase(); });
    $('#themeCustom').value = hex.toLowerCase();
    if (lib) { sel.value = lib.hex; opt.textContent = 'Your own colour (use the square)'; return; }
    const lab = VC.hexToLab(hex), near = D.colours.map(function (c) { return { n: c.name, d: VC.deltaE2000(lab, VC.hexToLab(c.hex)) }; }).sort(function (a, b) { return a.d - b.d; })[0];
    sel.value = 'custom';
    opt.textContent = 'Your own colour, ' + hex.toUpperCase() + (near.d < 10 ? ' (close to ' + near.n + ')' : '');
  }
  /* What "Put … in the study" will leave in the study, place by place. */
  function toStudyNote(hex, plan) {
    const face = plan.place === 'face';
    const parts = [nameOf(hex) + (face ? ' near the face' : ' below the belt')];
    if (plan.other) parts.push(nameOf(plan.other) + (face ? ' below the belt' : ' near the face'));
    if (plan.accent) parts.push(nameOf(plan.accent) + ' as the accent');
    return 'Replaces what is in the study now with ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]) +
      ', chosen together so they work with each other' + (plan.fails ? ' as far as the theme allows' : '') + '.';
  }
  function renderTheme() {
    const hex = themeHex(), t = E.themePalette(hex, V.analysis), plan = E.themeStudy(hex, V.analysis, t);
    syncThemeControls(hex);
    syncThemeFromStudy();
    const chip = function (c, note) {
      return '<button class="theme-chip" data-hex="' + c.hex + '"' + (note ? ' title="' + esc(note) + '"' : '') + '><span class="d" style="background:' + c.hex + '"></span>' + esc(c.name) + ' ' + tt(c.tier) + '</button>';
    };
    const group = function (title, note, items, noteOf) {
      if (!items.length) return '';
      return '<div class="theme-group"><h4>' + title + '</h4><p>' + note + '</p><div class="theme-row">' + items.map(function (c) { return chip(c, noteOf ? noteOf(c) : ''); }).join('') + '</div></div>';
    };
    const lvl = t.tier <= 2 ? 'good' : t.tier === 3 ? 'ok' : 'bad';
    $('#themeOut').innerHTML =
      '<div class="theme-head ' + lvl + '"><span class="theme-sw" style="background:' + hex + '"></span><div><strong>' + esc(nameOf(hex)) + ' ' + tt(t.tier) + '</strong>' +
        '<span class="theme-where">' + esc(t.where.title) + '.</span><span class="small">' + esc(t.where.text) + (t.reason && t.tier > 1 ? ' Why: ' + esc(t.reason) : '') + '</span></div></div>' +
      group(t.tier > 2 ? 'Its versions that suit you at the face' : '', 'The nearest colours of the same family that work at your face.', t.versions) +
      group('Neutrals to wear with it', 'They suit you near the face and separate clearly from the theme colour.', t.neutrals) +
      group('Colours that go with it', 'They suit you and relate to it: neighbours are calm, opposites lively. Use one at a time, as an accent.', t.partners, function (c) { return c.rel; }) +
      group('Keep apart from it', 'Too close to it, or competing with it. Point for the reason.', t.avoid, function (c) { return c.why; }) +
      '<div class="next-step with-note"><button type="button" class="btn small" id="themeToStudy">Put ' + esc(nameOf(hex)) + ' in the study</button><span class="ns-note">' + toStudyNote(hex, plan) + '</span></div>';
    $$('#themeOut .theme-chip').forEach(function (b) { b.addEventListener('click', function () { previewColour(null); selectColour(b.dataset.hex); }); hoverPreview(b); });
    $('#themeToStudy').addEventListener('click', function () {
      // the theme where it can go, with the neutral and accent chosen together (suggest.js,
      // themeStudy); an accent only when the theme is below the belt
      const st = study(), other = plan.place === 'face' ? 'below' : 'face';
      st[plan.place] = hex; st[other] = plan.other; st.accent = plan.accent;
      st.active = plan.place; save();
      renderStudy(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
      $('#study').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    V.state.theme = hex; save();
    $('#printTheme').checked = !!V.state.printTheme; syncPrintTheme();
  }

  function fillSelects() {
    const opts = D.colours.map(function (c) { return '<option value="' + c.hex + '">' + esc(c.name) + '</option>'; }).join('');
    $('#themeBase').innerHTML = opts + '<option value="custom">Your own colour (use the square)</option>';
    const saved = V.state.theme && D.colours.find(function (c) { return c.hex.toLowerCase() === V.state.theme.toLowerCase(); });
    if (saved) $('#themeBase').value = saved.hex;
    else if (V.state.theme) { $('#themeBase').value = 'custom'; $('#themeCustom').value = V.state.theme; }
    else $('#themeBase').value = (D.colours.find(function (c) { return c.name === 'Forest'; }) || D.colours[0]).hex;
  }
  $('#themeBase').addEventListener('change', renderTheme);
  $('#themeCustom').addEventListener('input', function () {
    const h = $('#themeCustom').value, lib = D.colours.find(function (c) { return c.hex.toLowerCase() === h.toLowerCase(); });
    $('#themeBase').value = lib ? lib.hex : 'custom'; renderTheme();
  });
  // choosing "Your own colour" in the list opens the square's colour picker
  $('#themeBase').addEventListener('change', function () { if ($('#themeBase').value === 'custom') { try { $('#themeCustom').showPicker(); } catch (e) { $('#themeCustom').click(); } } });
  /* The two buttons between the theme and the study go in opposite directions, so each names the
     colour it moves: "Use Light blue from the study" (study to theme) at the top, "Put Cornflower in
     the study" (theme to study) at the bottom. */
  function studyColourForTheme() {
    const st = study(), f = filled()[0];
    return st[st.active] || (f ? st[f.key] : null);
  }
  function syncThemeFromStudy() {
    const b = $('#themeFromStudy'); if (!b) return;
    const h = studyColourForTheme(), cur = themeHex();
    const useful = !!h && (!cur || h.toLowerCase() !== cur.toLowerCase());
    b.hidden = !useful;
    if (!useful) return;
    b.innerHTML = '<span class="dd" style="background:' + h + '"></span>Use ' + esc(nameOf(h)) + ' from the study';
    b.title = 'Make ' + nameOf(h) + ', the colour selected in the study, the theme colour';
  }
  $('#themeFromStudy').addEventListener('click', function () {
    const h = studyColourForTheme(); if (!h) return;
    const lib = D.colours.find(function (c) { return c.hex.toLowerCase() === h.toLowerCase(); });
    if (lib) $('#themeBase').value = lib.hex; else { $('#themeBase').value = 'custom'; $('#themeCustom').value = h; }
    renderTheme();
  });

  function renderColour() {
    const has = !!V.analysis;
    $('#colourEmpty').hidden = has;
    $('#colourBody').hidden = !has;
    if (!has) return;
    renderCore(); renderStudy(); renderCombos(); renderPalette(); renderTester(); renderStudySum(); renderMap(); renderTheme();
  }
  /* ---- Saved combinations: the study kept under a name, with the profile (and in its file).
     Each is judged again with the current colouring and season, by the same rules as the study,
     so a combination that suited winter may show a note in summer. ---- */
  const combos = function () { if (!Array.isArray(V.state.combos)) V.state.combos = []; return V.state.combos; };
  /* The study's judgement of a combination, the same as its place cards and its summary: each
     place judged against the others (the palette marks: light-dark step, frame, near matches),
     and the rules between the colours as a group. The worst decides the mark. */
  function placeProblems(c) {
    const o = studyOutfit(null, false, c), out = [];
    if (PLACES.filter(function (p) { return c[p.key]; }).length < 2) return out;
    PLACES.forEach(function (p) {
      if (!o[p.slot]) return;
      const j = E.fitFor(o, V.analysis, p.slot).judge(o[p.slot].hex, o[p.slot].name);
      if (j && j.state !== 'ok') {
        const same = out.find(function (x) { return x.why === j.why; });
        if (same) { same.places.push(p.label); if (j.state === 'out') same.state = 'out'; }
        else out.push({ places: [p.label], state: j.state, why: j.why });
      }
    });
    return out.sort(function (x, y) { return (y.state === 'out') - (x.state === 'out'); });
  }
  function comboVerdict(c) {
    const o = studyOutfit(null, false, c), n = PLACES.filter(function (p) { return c[p.key]; }).length;
    const checks = E.checkOutfit(o, V.analysis).filter(function (x) { return x.group === 'colour' && x.id !== 'step' && x.id !== 'frame'; });
    const pp = placeProblems(c);
    const fails = checks.filter(function (x) { return x.score < 0.5; }).length + pp.filter(function (x) { return x.state === 'out'; }).length;
    const warns = checks.filter(function (x) { return x.score >= 0.5 && x.score < 0.85; }).length + pp.filter(function (x) { return x.state !== 'out'; }).length;
    const worstCheck = checks.filter(function (x) { return x.score < 0.85; }).sort(function (x, y) { return x.score - y.score; })[0];
    const first = pp.length && (pp[0].state === 'out' || !worstCheck || worstCheck.score >= 0.5) ? pp[0].places.join(' and ') + ': ' + pp[0].why : worstCheck && worstCheck.text;
    return { st: fails ? 'no' : warns ? 'meh' : 'ok', mark: fails ? '✕' : warns ? '!' : '✓', why: first || (n < 2 ? 'One colour on its own.' : 'No rule between these colours is broken.') };
  }
  function renderCombos() {
    const box = $('#combos'), list = combos(), st = study();
    const same = function (c) { return PLACES.every(function (p) { return (c[p.key] || '') === (st[p.key] || ''); }); };
    $('#comboSave').disabled = !filled().length;
    if (!list.length) { box.innerHTML = '<p class="small muted combo-empty">Saved combinations appear here, judged again for the season you are in.</p>'; return; }
    box.innerHTML = '<h4 class="outfit-h">Saved combinations</h4><ul class="combos">' + list.map(function (c, i) {
      const v = comboVerdict(c);
      return '<li class="' + (same(c) ? 'on' : '') + '"><button type="button" class="combo-open" data-i="' + i + '" title="' + esc(v.why) + '">' +
        '<span class="combo-sw">' + PLACES.map(function (p) { return '<i style="background:' + (c[p.key] || 'transparent') + '"' + (c[p.key] ? '' : ' class="none"') + ' title="' + esc(p.label + ': ' + (c[p.key] ? nameOf(c[p.key]) : 'empty')) + '"></i>'; }).join('') + '</span>' +
        '<span class="combo-name">' + esc(c.name) + '</span><span class="combo-m ' + v.st + '">' + v.mark + '</span></button>' +
        '<button type="button" class="combo-rm" data-i="' + i + '" aria-label="Delete ' + esc(c.name) + '">✕</button></li>';
    }).join('') + V.say('</ul><p class="small muted">Click one to put it back in the study. ✓ no rule broken, ! worth knowing, ✕ a rule fails; point at it for why.</p>', '</ul><p class="small muted">Tap one to put it back in the study. ✓ no rule broken, ! worth knowing, ✕ a rule fails; put it back in the study to see why.</p>');
    $$('.combo-open', box).forEach(function (b) {
      b.addEventListener('click', function () {
        const c = list[+b.dataset.i], s2 = study();
        PLACES.forEach(function (p) { s2[p.key] = c[p.key] || null; });
        $('#comboName').value = c.name; save();
        renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
      });
    });
    $$('.combo-rm', box).forEach(function (b) {
      b.addEventListener('click', function () { list.splice(+b.dataset.i, 1); save(); renderCombos(); });
    });
  }
  $('#comboSave').addEventListener('click', function () {
    const st = study(), f = filled(); if (!f.length) return;
    const name = $('#comboName').value.trim() || f.map(function (p) { return nameOf(st[p.key]); }).join(', ');
    const list = combos(), c = { name: name.slice(0, 60) };
    PLACES.forEach(function (p) { c[p.key] = st[p.key] || null; });
    const at = list.findIndex(function (x) { return x.name.toLowerCase() === c.name.toLowerCase(); });
    if (at >= 0) list[at] = c; else list.unshift(c);
    if (list.length > 24) list.length = 24;
    $('#comboName').value = c.name; save(); renderCombos();
    const b = $('#comboSave'); b.textContent = at >= 0 ? 'Updated' : 'Saved'; clearTimeout(b._t); b._t = setTimeout(function () { b.textContent = 'Save'; }, 1500);
  });
  $('#comboName').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#comboSave').click(); });
  $('#studyClear').addEventListener('click', function () {
    const st = study(); PLACES.forEach(function (p) { st[p.key] = null; }); st.active = 'face';
    $('#comboName').value = ''; save();
    renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
  });
  function renderCore() {
    $('#corePal').innerHTML = '<h3>Your core palette <span class="season-tag">' + (summerOn() ? 'summer' : 'winter') + '</span></h3>' +
      V.say('<p class="small muted">The best of each tier for your colouring this season, chosen so that no two look alike. It is built from your profile, so the study and the theme never change it. Click a colour to put it in the study, ', '<p class="small muted">The best of each tier for your colouring this season, chosen so that no two look alike. It is built from your profile, so the study and the theme never change it. Tap a colour to put it in the study, ') + '<span class="wearing">' + esc(activePlace().label.toLowerCase()) + '</span>.</p>' +
      coreRows(V.analysis, true) +
      // the third step of the welcome's path: from the palette to an outfit
      '<div class="next-step with-note"><button type="button" class="btn small" id="toDresser">Next: try an outfit</button><span class="ns-note">The Dresser checks a whole outfit. Choose the best colours there gives each piece the colour that works best with the rest; or put colours in the study here and send them over.</span></div>';
    $('#toDresser').addEventListener('click', function () { showTab('outfit'); });
    $$('#corePal button.gl-c').forEach(function (b) { b.addEventListener('click', function () { previewColour(null); selectColour(b.dataset.hex); }); hoverPreview(b); });
    renderPairs();
  }

  /* ---- What goes together: the core palette tells what suits you one colour at a time; this says
     which of its colours go with each other. Choose a colour for near the face, and every other
     core colour is tried with it, as an accent and below the belt, by the study's rules (so it is
     the same as putting the pair in the study and reading the marks). Under it, a few tested
     combinations of three, all from the core palette. Pair results are kept until the profile
     or season changes. ---- */
  let pairFace = null; let pairStudyFace; let pairCache = { key: null, v: {}, trios: null };
  // the analysis is rebuilt whenever anything in the profile or the season changes, so it is the key
  function pairKey() { return V.analysis; }
  function judgePair(c) {
    const k = PLACES.map(function (p) { return c[p.key] || ''; }).join('|');
    if (!(k in pairCache.v)) pairCache.v[k] = comboVerdict(c);
    return pairCache.v[k];
  }
  function coreSets() {
    const sm = E.summary(V.analysis), uniq = function (l) { const seen = {}; return l.filter(function (c) { const k = c.hex.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }); };
    return { face: uniq(sm.neutrals.concat(sm.colours, sm.deliberate)), accent: uniq(sm.colours.concat(sm.deliberate, sm.neutrals)), below: uniq(sm.neutrals.concat(sm.below)) };
  }
  /* Which colours could pass in one place, given the others: one fitFor for the place judges every
     library colour at once (the palette marks). A colour must be 'ok' there to pass the study, so
     this only skips colours that would fail; each survivor is still judged in full (judgePair). */
  function okInPlace(c, place) {
    const slot = PLACES.find(function (p) { return p.key === place; }).slot;
    return E.fitFor(studyOutfit(null, false, c), V.analysis, slot).byHex;
  }
  function tested() {
    if (pairCache.trios) return pairCache.trios;
    const S = coreSets(), out = [], usedAcc = {}, usedBelow = {};
    const passes = function (byHex, hex) { const j = byHex[hex.toLowerCase()]; return !j || j.state === 'ok'; };
    S.face.forEach(function (f) {
      // the best colour below the belt for this face colour, then the best accent with both
      const okBelow = okInPlace({ face: f.hex }, 'below');
      const belows = S.below.filter(function (b) { return b.hex !== f.hex && passes(okBelow, b.hex) && judgePair({ face: f.hex, below: b.hex }).st === 'ok'; });
      // every (below, accent) that could pass, in the order the full search would meet them; the
      // first with the lowest cost that passes in full is the one the full search would keep
      const cands = [];
      belows.sort(function (x, y) { return (usedBelow[x.hex] || 0) - (usedBelow[y.hex] || 0); }).slice(0, 3).forEach(function (b) {
        const okAcc = okInPlace({ face: f.hex, below: b.hex }, 'accent');
        S.accent.forEach(function (a) {
          if (a.hex === f.hex || a.hex === b.hex || isNeutralHex(a.hex) || !passes(okAcc, a.hex)) return;
          cands.push({ face: f, accent: a, below: b, cost: (usedAcc[a.hex] || 0) * 2 + (usedBelow[b.hex] || 0), i: cands.length });
        });
      });
      cands.sort(function (x, y) { return x.cost - y.cost || x.i - y.i; });
      const best = cands.find(function (t) { return judgePair({ face: t.face.hex, accent: t.accent.hex, below: t.below.hex }).st === 'ok'; });
      if (best) { out.push(best); usedAcc[best.accent.hex] = (usedAcc[best.accent.hex] || 0) + 1; usedBelow[best.below.hex] = (usedBelow[best.below.hex] || 0) + 1; }
    });
    // three with a neutral near the face (the everyday way), three with a colour there
    const neutral = out.filter(function (t) { return isNeutralHex(t.face.hex); }), colour = out.filter(function (t) { return !isNeutralHex(t.face.hex); });
    pairCache.trios = neutral.slice(0, 3).concat(colour.slice(0, 3));
    return pairCache.trios;
  }
  const isNeutralHex = function (hex) { return VC.labToLch(VC.hexToLab(hex))[1] < 12; };
  /* The tested combinations take a moment to work out, so they are worked out while the browser is
     idle after the profile changes, and the Palette tab draws first and fills them in after. */
  let pairsLater = 0; let warmLater = 0;
  function warmPairs() {
    // wait until the profile has stopped changing (a slider being dragged), then use idle time
    clearTimeout(warmLater);
    warmLater = setTimeout(function () {
      const a = V.analysis, run = function () { if (a && a === V.analysis) { if (pairCache.key !== pairKey()) pairCache = { key: pairKey(), v: {}, trios: null }; tested(); } };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 }); else run();
    }, 600);
  }
  function renderPairs() {
    const box = $('#pairs'); if (!box || !V.analysis) return;
    if (pairCache.key !== pairKey()) pairCache = { key: pairKey(), v: {}, trios: null };
    if (!pairCache.trios) {
      if (!box.innerHTML) box.innerHTML = '<h3>What goes together</h3><p class="small muted">Working out which of your core colours go together…</p>';
      clearTimeout(pairsLater); pairsLater = setTimeout(function () { tested(); renderPairs(); }, 30);
      return;
    }
    const S = coreSets();
    // follow the study: when a core colour is put near the face there, the lists switch to it
    const sf = study().face, sfCore = sf && S.face.some(function (c) { return c.hex === sf; });
    if (sf !== pairStudyFace) { pairStudyFace = sf; if (sfCore) pairFace = sf; }
    if (!pairFace || !S.face.some(function (c) { return c.hex === pairFace; })) pairFace = sfCore ? sf : S.face[0].hex;
    const chip = function (c, cls, title, attrs) {
      return '<button type="button" class="gl-c' + (cls ? ' ' + cls : '') + '" data-hex="' + c.hex + '"' + (attrs || '') + (title ? ' title="' + esc(title) + '"' : '') + '><i style="background:' + c.hex + '"></i>' + esc(c.name) + '</button>';
    };
    // When the study has this colour near the face, each list is judged with the study's other
    // place in it too, so a combination can be built a step at a time: face, then below, then accent.
    const st0 = study(), ctx = st0.face === pairFace ? st0 : null;
    const sort = function (place) {
      const other = place === 'accent' ? 'below' : 'accent';
      return S[place].filter(function (c) { return c.hex !== pairFace; }).map(function (c) {
        const o = { face: pairFace }; o[place] = c.hex;
        if (ctx && ctx[other] && ctx[other] !== c.hex) o[other] = ctx[other];
        return { c: c, v: judgePair(o) };
      });
    };
    const withOther = function (place) {
      const other = place === 'accent' ? 'below' : 'accent';
      return ctx && ctx[other] ? ' <span class="pair-ctx">with ' + esc(nameOf(ctx[other])) + (other === 'below' ? ' below the belt' : ' as the accent') + ', from the study</span>' : '';
    };
    const group = function (title, list, place) {
      const by = function (st) { return list.filter(function (x) { return x.v.st === st; }); };
      const ok = by('ok'), meh = by('meh'), no = by('no');
      return '<div class="gl-row" data-place="' + place + '"><div class="gl-h"><strong>' + title + '</strong>' + withOther(place) + '</div><div class="pair-lists">' +
        (ok.length ? '<div class="pl-row"><span class="pl-lab ok">✓ goes with it</span><div class="gl-chips">' + ok.map(function (x) { return chip(x.c, 'pk-ok', x.v.why); }).join('') + '</div></div>' : '') +
        (meh.length ? '<div class="pl-row"><span class="pl-lab meh">! with care</span><div class="gl-chips">' + meh.map(function (x) { return chip(x.c, 'pk-meh', x.v.why); }).join('') + '</div></div>' : '') +
        (no.length ? '<div class="pl-row"><span class="pl-lab no">✕ not with it</span><div class="gl-chips">' + no.map(function (x) { return chip(x.c, 'pk-no', x.v.why); }).join('') + '</div></div>' : '') +
        '</div></div>';
    };
    const f = S.face.find(function (c) { return c.hex === pairFace; });
    const trios = tested();
    box.innerHTML = '<h3>What goes together</h3>' +
      V.say('<p class="small muted">Your core palette says what suits you, one colour at a time. Choose one for near the face, and every other core colour is tried with it as an accent and below the belt, by the same rules as the study. Point at a colour for the reason.</p>', '<p class="small muted">Your core palette says what suits you, one colour at a time. Choose one for near the face, and every other core colour is tried with it as an accent and below the belt, by the same rules as the study. Tap a colour for the reason.</p>') +
      '<div class="gl-chips pair-pick" role="radiogroup" aria-label="Colour near the face">' + S.face.map(function (c) { return chip(c, c.hex === pairFace ? 'on' : '', null, ' role="radio" aria-checked="' + (c.hex === pairFace) + '"'); }).join('') + '</div>' +
      '<p class="pair-for">With <strong>' + esc(f.name) + '</strong> near the face:</p>' +
      group('Accent (tie, scarf, pocket square)', sort('accent'), 'accent') + group('Below the belt', sort('below'), 'below') +
      '<div class="pair-actions"><button type="button" class="btn ghost small" id="pairToStudy">Put ' + esc(f.name) + ' in the study, near the face</button></div>' +
      (trios.length ? '<h4 class="outfit-h">Tested combinations from your core palette</h4><ul class="combos trios">' + trios.map(function (t, i) {
        return '<li><button type="button" class="combo-open" data-t="' + i + '" title="Put it in the study"><span class="combo-sw"><i style="background:' + t.face.hex + '"></i><i style="background:' + t.accent.hex + '"></i><i style="background:' + t.below.hex + '"></i></span>' +
          '<span class="combo-name">' + esc(t.face.name) + ', ' + esc(t.accent.name) + ' accent, ' + esc(t.below.name) + ' below</span><span class="combo-m ok">✓</span></button></li>';
      }).join('') + V.say('</ul><p class="small muted">Each passes every rule of the study: near the face, the accent, below the belt. Click one to put it in the study, then save it or send it to the Dresser. To test any other pair yourself, put a colour in the study, choose another place, and read the palette: a plain swatch goes with what is there, "!" bends a rule, struck through clashes.</p>', '</ul><p class="small muted">Each passes every rule of the study: near the face, the accent, below the belt. Tap one to put it in the study, then save it or send it to the Dresser. To test any other pair yourself, put a colour in the study, choose another place, and read the palette: a plain swatch goes with what is there, "!" bends a rule, struck through clashes.</p>') : '');
    $$('.pair-pick button', box).forEach(function (b) { b.addEventListener('click', function () { pairFace = b.dataset.hex; renderPairs(); }); });
    // the colour goes into the study beside this face colour; the study's other place stays,
    // unless the study had another colour near the face, when it is emptied with it
    $$('.pair-lists button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        const place = b.closest('.gl-row').dataset.place, st = study();
        if (st.face !== pairFace) { PLACES.forEach(function (p) { st[p.key] = null; }); st.face = pairFace; $('#comboName').value = ''; }
        previewColour(null); selectPlaceColour(place, b.dataset.hex);
      });
    });
    $('#pairToStudy').addEventListener('click', function () { selectPlaceColour('face', pairFace); });
    $$('.trios .combo-open', box).forEach(function (b) {
      b.addEventListener('click', function () {
        const t = trios[+b.dataset.t], st = study();
        st.face = t.face.hex; st.accent = t.accent.hex; st.below = t.below.hex; st.active = 'accent'; $('#comboName').value = '';
        save(); renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
        $('#study').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }
  /* Put a colour in one place of the study and select that place. */
  function selectPlaceColour(place, hex) {
    const st = study(); st[place] = hex; st.active = place; save();
    renderStudy(); renderCombos(); markPalette(); renderTester(); renderStudySum(); V.syncChart();
  }



  Object.assign(V, { PLACES });
})();
