/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — The Proportion and Fit tabs (proportion.js, fit.js).
   Part of the interface; the parts share window.VAPP (see core.js). */
// @ts-check
(function () {
  'use strict';
  const V = window.VAPP;
  const { $, $$, MEASURES, esc, openMeasures, save, showTab } = V;
  Object.assign(V, { renderFit, renderProportion });

  /* Fit & size (fit.js) */
  function renderFit() {
    const has = Object.keys(V.state.measurements || {}).some(function (k) { return V.state.measurements[k] > 0; });
    $('#fitEmpty').hidden = has; $('#fitBody').hidden = !has;
    if (has) window.VFITUI.render($('#fitBody'), {
      state: function () { return V.state; }, save: save, goto: function (t) { if (t === 'you') openMeasures(); else showTab(t); },
      labelOf: function (k) { const m = MEASURES.find(function (x) { return x.key === k; }); return m ? m.label : k; }
    });
  }

  /* ---------- Proportion (proportion.js) ---------- */
  function renderProportion() {
    const m = V.state.measurements || {}, has = m.height > 0;
    $('#propEmpty').hidden = has; $('#propBody').hidden = !has;
    if (!has) return;
    const PR = window.VPROP, per = PR.PERIODS[V.state.period] ? V.state.period : 'classic';
    const res = PR.targets(m, V.state.shape || {}, per, { hairStyle: V.state.hairStyle });
    $('#propPeriod').innerHTML = Object.keys(PR.PERIODS).map(function (id) {
      return '<button type="button" role="radio" data-per="' + id + '" aria-checked="' + (id === per) + '">' + esc(PR.PERIODS[id].name) + '</button>';
    }).join('');
    $('#propPeriodNote').textContent = PR.PERIODS[per].note;
    $$('#propPeriod button').forEach(function (b) { b.addEventListener('click', function () { V.state.period = b.dataset.per; save(); renderProportion(); }); });
    const desc = PR.describe(res.d);
    $('#propDescribe').innerHTML = desc.length ? '<ul class="prop-desc">' + desc.map(function (x) {
      return '<li><span class="pd-label">' + esc(x.label) + '</span><span class="pd-bar" title="' + x.pct + 'th percentile"><i style="left:' + x.pct + '%"></i></span><span class="pd-text">' + esc(x.text) + '</span></li>';
    }).join('') + '</ul><p class="small muted">Among the 4,082 men of the ANSUR II survey (2012). The marker shows where you sit; the middle of the bar is the middle of the survey. Neither end is better.</p>'
      : '<p class="small muted">Add your inside leg, back-neck to floor and waist height to see how your proportions compare.</p>';
    const est = Object.keys(res.d.est);
    const groups = [];
    res.list.forEach(function (t) { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
    const fmt = function (t) { return t.lo == null ? '' : (t.lo === t.hi ? t.lo : t.lo + '–' + t.hi) + (t.unit ? ' ' + t.unit : ''); };
    $('#propTargets').innerHTML = (est.length ? '<p class="small prop-est">Estimated from your height until you measure them: ' + est.map(function (k) { const x = MEASURES.find(function (q) { return q.key === k; }); return esc(x ? x.label.toLowerCase() : k); }).join(', ') + '. Targets that use them are marked.</p>' : '') +
      groups.map(function (g) {
        return '<div class="prop-group"><h4>' + esc(g) + '</h4><ul class="prop-list">' + res.list.filter(function (t) { return t.group === g; }).map(function (t) {
          if (t.needs) return '<li class="prop-t needs"><strong>' + esc(t.label) + '</strong><span class="small muted">Needs: ' + esc(t.needs.map(function (k) { const x = MEASURES.find(function (q) { return q.key === k; }); return x ? x.label.toLowerCase() : k; }).join(', ')) + '.</span></li>';
          return '<li class="prop-t why-host" data-t="' + t.id + '"><div class="pt-head"><span class="badge ' + t.grade + '">' + t.grade + '</span><strong>' + esc(t.label) + '</strong>' +
            (fmt(t) ? '<span class="pt-val">' + fmt(t) + '</span>' : '') + (t.est.length ? '<span class="pt-est" title="Uses a measurement estimated from your height">estimate</span>' : '') + '</div>' +
            '<p>' + esc(t.text) + '</p><p class="small muted">' + esc(t.why) + (t.note ? ' ' + esc(t.note) : '') + ' ' + window.VWHY.button(window.VWHY.MAP.target[t.id], t.grade, 'target:' + t.id) + '</p>' +
            (t.uses.length ? '<p class="pt-uses">From: ' + t.uses.map(function (k) { const x = MEASURES.find(function (q) { return q.key === k; }); const nmk = x ? x.label.toLowerCase() : k; return res.d.est[k] ? '<em>' + esc(nmk) + ' (estimated)</em>' : (V.state.measurements[k] > 0 ? esc(nmk) : '<em>' + esc(nmk) + ' (not measured)</em>'); }).join(', ') + '.</p>' : '') + '</li>';
        }).join('') + '</ul></div>';
      }).join('');
    propRes = res;
    $('#propFigure').innerHTML = propFigure(res);
    renderPropTry();
    $$('#propTargets .prop-t[data-t]').forEach(function (li) {
      const on = function (x) { $$('#propFigure [data-line]').forEach(function (g) { g.classList.toggle('hl', x && g.dataset.line === li.dataset.t); g.classList.toggle('dim', !!x && g.dataset.line !== li.dataset.t); }); };
      li.addEventListener('mouseenter', function () { on(true); });
      li.addEventListener('mouseleave', function () { on(false); });
    });
  }
  /* Try it: a jacket length and a waistband height, drawn on the figure with where they land.
     Not saved; it starts at the middle of the targets each time the page is drawn. */
  let propRes = null; let propTry = null;
  function renderPropTry() {
    const res = propRes, box = $('#propTry'); if (!res || !box) return;
    const v = res.d.v, jl = res.list.find(function (t) { return t.id === 'jacketLength'; });
    if (!v.backNeckFloor || !v.waistHeight || !jl || jl.lo == null) { box.innerHTML = ''; return; }
    const per = window.VPROP.PERIODS[res.period].waistband;
    if (!propTry || propTry.period !== res.period) propTry = { period: res.period, jacket: Math.round((jl.lo + jl.hi) / 2), waist: Math.round(v.waistHeight + (per[0] + per[1]) / 2) };
    box.innerHTML = '<h4>Try it</h4>' +
      '<label class="try-row">Jacket length <input type="range" id="tryJacket" min="' + Math.round(jl.lo - 8) + '" max="' + Math.round(jl.hi + 8) + '" step="0.5" value="' + propTry.jacket + '"><output id="tryJacketOut"></output></label>' +
      '<label class="try-row">Waistband height <input type="range" id="tryWaist" min="' + Math.round(v.inseam + 12) + '" max="' + Math.round(v.waistHeight + 6) + '" step="0.5" value="' + propTry.waist + '"><output id="tryWaistOut"></output></label>' +
      '<p class="small" id="tryNoteProp" aria-live="polite"></p>';
    const upd = function () {
      propTry.jacket = +$('#tryJacket').value; propTry.waist = +$('#tryWaist').value;
      const hem = v.backNeckFloor - propTry.jacket, above = hem - v.inseam, legs = propTry.waist / res.d.v.height;
      $('#tryJacketOut').textContent = propTry.jacket + ' cm';
      $('#tryWaistOut').textContent = propTry.waist + ' cm';
      const inT = propTry.jacket >= jl.lo && propTry.jacket <= jl.hi;
      $('#tryNoteProp').textContent = 'Jacket hem ' + Math.round(hem) + ' cm from the floor: ' +
        (above <= 1 ? 'it covers the seat' : above <= 5 ? 'it covers about three quarters of the seat' : 'it stops short of the seat') +
        (inT ? ', within your target.' : propTry.jacket < jl.lo ? ', shorter than your target.' : ', longer than your target: the legs start lower.') +
        ' Waistband ' + Math.round(propTry.waist) + ' cm: ' + (propTry.waist >= v.waistHeight ? 'at or above your natural waist, the longest leg line.' : Math.round(v.waistHeight - propTry.waist) + ' cm below your natural waist; the legs read ' + (v.waistHeight - propTry.waist > 4 ? 'noticeably ' : '') + 'shorter.') +
        ' (Legs start at ' + Math.round(legs * 100) + ' % of your height.)';
      const svg = $('#propFigure svg'); if (!svg) return;
      const old = svg.querySelector('.pf-try'); if (old) old.remove();
      const top = 15, floor = 421, px = function (cm) { return floor - cm / v.height * (floor - top); };
      svg.insertAdjacentHTML('beforeend', '<g class="pf-try"><line x1="30" x2="210" y1="' + px(hem).toFixed(1) + '" y2="' + px(hem).toFixed(1) + '"/><line x1="30" x2="210" y1="' + px(propTry.waist).toFixed(1) + '" y2="' + px(propTry.waist).toFixed(1) + '"/>' +
        '<text x="26" y="' + (px(hem) + 3).toFixed(1) + '" text-anchor="end">hem</text><text x="26" y="' + (px(propTry.waist) + 3).toFixed(1) + '" text-anchor="end">waist</text></g>');
    };
    $('#tryJacket').addEventListener('input', upd); $('#tryWaist').addEventListener('input', upd);
    upd();
  }
  /* The proportion card, printed: period, measurements, and every target with its range. */
  $('#propPrint').addEventListener('click', function () {
    const PR = window.VPROP, per = PR.PERIODS[V.state.period] ? V.state.period : 'classic';
    const res = PR.targets(V.state.measurements || {}, V.state.shape || {}, per, { hairStyle: V.state.hairStyle });
    const ms = MEASURES.filter(function (x) { return V.state.measurements[x.key] > 0; });
    let h = '<h1>Proportion card' + (V.state.name ? ': ' + esc(V.state.name) : '') + '</h1>' +
      '<p class="pc-sub">Valet, ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + '. ' + esc(PR.PERIODS[per].name) + '. Garment lengths are measured down the centre back from the base of the collar.</p>' +
      '<h2>Measurements</h2><p>' + ms.map(function (x) { return esc(x.label) + ' ' + V.state.measurements[x.key] + ' cm'; }).join('; ') + '.' +
      (Object.keys(res.d.est).length ? ' Estimated from height: ' + Object.keys(res.d.est).map(function (k) { const x = MEASURES.find(function (q) { return q.key === k; }); return esc(x ? x.label.toLowerCase() : k); }).join(', ') + '.' : '') + '</p>' +
      '<h2>Targets</h2><table class="pc-pairs pc-prop"><thead><tr><th>Garment</th><th>Target</th><th>Why</th></tr></thead><tbody>' +
      res.list.filter(function (t) { return !t.needs; }).map(function (t) {
        return '<tr><td><strong>' + esc(t.group) + '</strong><br>' + esc(t.label) + '</td><td>' + (t.lo != null ? (t.lo === t.hi ? t.lo : t.lo + '–' + t.hi) + ' ' + t.unit : '') + (t.est.length ? ' (estimate)' : '') + '</td><td>' + esc(t.text) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="pc-foot">Ranges, not single figures: home measurements carry a centimetre or two of error, and tailors differ. A garment that already fits you is the best reference. A: measured or geometry; B: tailoring convention.</p>';
    $('#printCard').classList.remove('outfit');
    $('#printCard').innerHTML = h;
    window.print();
  });
  /* The figure to scale: the measuring guide's outline, stretched piece by piece so its neck, waist
     and crotch sit at the person's own heights, with each target's hem drawn across it. */
  function propFigure(res) {
    const v = res.d.v, H = v.height, top = 15, floor = 421, px = function (cm) { return floor - cm / H * (floor - top); };
    // the outline's own landmarks (drawing units) and the person's (cm), top of the head to the floor
    const from = [15, 79, 196, 262, 421], to = [px(H), px(v.backNeckFloor), px(v.waistHeight), px(v.inseam), floor];
    const map = function (y) {
      for (let i = 1; i < from.length; i++) if (y <= from[i]) return to[i - 1] + (to[i] - to[i - 1]) * (y - from[i - 1]) / (from[i] - from[i - 1]);
      return floor;
    };
    const t = {}; res.list.forEach(function (x) { t[x.id] = x; });
    const items = [];
    const band = function (id, loCm, hiCm, label, cls) {
      if (loCm == null || hiCm == null) return;
      const y1 = px(Math.max(loCm, hiCm)), y2 = px(Math.min(loCm, hiCm));
      items.push({ id: id, y1: y1, y2: y2, ym: (y1 + y2) / 2, label: label, cls: cls });
    };
    const fromC7 = function (x) { return x ? [v.backNeckFloor - x.hi, v.backNeckFloor - x.lo] : [null, null]; };
    const jl = fromC7(t.jacketLength), kn = fromC7(t.knit), co = fromC7(t.coat);
    const per = window.VPROP.PERIODS[res.period].waistband, wb = v.waistHeight ? [v.waistHeight + per[0], v.waistHeight + per[1]] : [null, null];
    band('coat', co[0], co[1], 'coat hem', 'coat');
    band('jacketLength', jl[0], jl[1], 'jacket hem', 'jacket');
    band('knit', kn[0], kn[1], 'knit hem', 'knit');
    band('rise', wb[0], wb[1], 'waistband', 'waist');
    if (t.button) band('button', t.button.lo, t.button.hi, 'waist button', 'button');
    band('seat', v.inseam, v.inseam, 'crotch', 'crotch');
    // labels in a column on the right, pushed apart so they never overlap, each with a leader line
    items.sort(function (a, b) { return a.ym - b.ym; });
    let last = -Infinity;
    items.forEach(function (it) { it.ly = Math.max(it.ym, last + 12); last = it.ly; });
    const lines = items.map(function (it) {
      const shape = it.cls === 'crotch' ? '<line x1="40" x2="200" y1="' + it.ym.toFixed(1) + '" y2="' + it.ym.toFixed(1) + '"/>'
        : '<rect x="40" y="' + it.y1.toFixed(1) + '" width="160" height="' + Math.max(1.5, it.y2 - it.y1).toFixed(1) + '"/>';
      return '<g data-line="' + it.id + '" class="pf-line ' + it.cls + '">' + shape +
        '<polyline class="pf-lead" points="200,' + it.ym.toFixed(1) + ' 210,' + it.ym.toFixed(1) + ' 216,' + it.ly.toFixed(1) + ' 220,' + it.ly.toFixed(1) + '"/>' +
        '<text x="222" y="' + (it.ly + 3).toFixed(1) + '">' + it.label + '</text></g>';
    }).join('');
    return '<svg class="prop-fig" viewBox="0 0 300 430" role="img" aria-label="Your figure to scale with the targets">' +
      window.VMEASURE.figure(map) + lines + '</svg>' +
      (Object.keys(res.d.est).length ? '<p class="small muted">Some heights here are estimated from your height; measure them for a truer figure.</p>' : '');
  }

})();
