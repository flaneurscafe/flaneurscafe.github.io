/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Fit tab: sizes from your measurements, a garment's measurements or its label checked
   against you, and what to look for at the try-on. Drawing only: every number comes from js/fit.js
   (window.VFIT), which has no page code and is tested on its own. Part of the interface. */
(function () {
  'use strict';
  const F = window.VFIT;
  const CUT_NAME = F.CUT_NAME, CUT_ORDER = F.CUT_ORDER, LABELS = F.LABELS, CHECKS = F.CHECKS, TRYON = F.TRYON, MAX_SIZES = F.MAX_SIZES, CLEAN = F.CLEAN;
  const sizes = F.sizes, collar = F.collar, watchRange = F.watchRange, lengthLetter = F.lengthLetter, checkGarment = F.checkGarment,
    checkLabel = F.checkLabel, verdictOf = F.verdictOf, bestSize = F.bestSize, periodFit = F.periodFit, clean = F.clean;

  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const CUT_HELP = { slim: 'close to the body; little room under it', modern: 'shaped at the waist, room to move: today\'s tailored default', classic: 'fuller through chest and seat, drapes rather than follows' };
  const STATE_WORD = { right: 'Right', close: 'Wearable', tight: 'Tight', loose: 'Loose', short: 'Short', long: 'Long' };
  const ALTER_WORD = { easy: 'easy to alter', some: 'alterable within limits', no: 'cannot be altered' };
  const AGAINST = { yours: 'against yours', proportion: 'Proportion target', rule: 'for you', body: 'your body' };


  function render(root, api) {
    const st = api.state(), m = st.measurements || {};
    // cleaned once and then kept, so every handler works on the same object even when a render
    // happens inside another (removing an edited input can fire its change event)
    if (!st.fitCheck || !st.fitCheck[CLEAN]) st.fitCheck = clean(st.fitCheck);
    const fc = st.fitCheck;
    const labelOf = api.labelOf;
    const prop = {};
    if (window.VPROP && m.height > 0) {
      try { window.VPROP.targets(m, st.shape || {}, st.period || 'classic', { hairStyle: st.hairStyle }).list.forEach(function (t) { prop[t.id] = t; }); } catch (e) { /* the check works without it */ }
    }
    const perName = window.VPROP && window.VPROP.PERIODS[st.period] ? window.VPROP.PERIODS[st.period].name : null;
    // the targets of every period, for the line that says which periods a garment suits
    const allProps = {};
    if (window.VPROP && m.height > 0) Object.keys(window.VPROP.PERIODS).forEach(function (id) {
      try { const pp = {}; window.VPROP.targets(m, st.shape || {}, id, { hairStyle: st.hairStyle }).list.forEach(function (t) { pp[t.id] = t; }); allProps[id] = pp; } catch (e) { /* skipped */ }
    });
    const PN = function (id) { return window.VPROP.PERIODS[id].name + (id === (st.period || 'classic') ? ' (chosen)' : ''); };
    const periodsHtml = function (res) {
      const pf = periodFit(fc.kind, res, allProps);
      if (!pf) return '';
      const list = function (ids) { return ids.length ? ids.map(PN).join(', ') : 'none'; };
      return '<div class="fc-periods why-host"><strong>Periods it suits on you</strong> <span class="badge B">B</span> ' + window.VWHY.button(window.VWHY.MAP.periods, 'B', 'periods') +
        '<p>' + (pf.fields.length > 1 ? (pf.all.length ? 'All of it: ' + esc(list(pf.all)) + '.' : 'No single period: its measurements belong to different ones.') : '') + '</p><ul>' +
        pf.fields.map(function (x) { return '<li>' + esc(x.label) + ' ' + x.value + ' cm: ' + esc(list(x.fits)) + '</li>'; }).join('') +
        '</ul><p class="small muted">From the measurements that change with the period; within a centimetre of a period\'s range counts. Period ranges are tendencies, so read this as "in the range for", not "authentic to".</p></div>';
    };
    const sz = sizes(m), groups = [];
    sz.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
    let h = '<h2>Fit &amp; size</h2><p class="lede">Whether a garment will fit you, before you buy it: from the measurements the shop gives, from its size label, or against one of yours that fits. Then your sizes, and what to look for when you try it on.</p>';

    // the check comes first: it is what the page is for
    const def = CHECKS[fc.kind], hasLabel = !!LABELS[fc.kind];
    const mode = hasLabel ? fc.mode : 'measure';
    h += '<h3>Will it fit?</h3>' +
      '<div class="fit-controls">' +
      '<div><span class="flabel">Garment</span><div class="seg" role="radiogroup" id="fcKind">' + Object.keys(CHECKS).map(function (k) { return '<button type="button" role="radio" data-v="' + k + '" aria-checked="' + (fc.kind === k) + '">' + CHECKS[k].name + '</button>'; }).join('') + '</div></div>' +
      (def.cut ? '<div><span class="flabel">The cut you want</span><div class="seg" role="radiogroup" id="fcWant">' + CUT_ORDER.map(function (c) { return '<button type="button" role="radio" data-v="' + c + '" aria-checked="' + (fc.want === c) + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</button>'; }).join('') + '</div>' +
        '<p class="small muted fc-cuthelp">' + CUT_NAME[fc.want].replace(/^./, function (c) { return c.toUpperCase(); }) + ': ' + CUT_HELP[fc.want] + '.</p></div>' : '') +
      (hasLabel ? '<div><span class="flabel">Check by</span><div class="seg" role="radiogroup" id="fcMode"><button type="button" role="radio" data-v="measure" aria-checked="' + (mode === 'measure') + '">Its measurements</button><button type="button" role="radio" data-v="label" aria-checked="' + (mode === 'label') + '">Its size label</button></div></div>' : '') +
      '</div>';
    if (mode === 'label') {
      const L = fc.label[fc.kind];
      const res = checkLabel(fc.kind, L.sys, +L.n, m, fc.want);
      h += '<div class="fc-form"><label>Size system <select id="fcSys">' + LABELS[fc.kind].map(function (s) { return '<option value="' + s.id + '"' + (L.sys === s.id ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select></label>' +
        '<label>Size on the label <input type="number" id="fcN" step="any" min="1" value="' + esc(L.n) + '"></label></div>' +
        (res ? (res.missing ? '<p class="small muted">Needs your ' + res.missing.map(labelOf).join(' and ').toLowerCase() + ' (You tab).</p>'
          : '<div class="fc-res why-host"><p class="fc-line ' + res.state + '"><strong>' + STATE_WORD[res.state] + '.</strong> ' + esc(res.text) + ' ' + window.VWHY.button(window.VWHY.MAP.label, 'B', 'label') + '</p></div>') : '<p class="small muted">Enter the size on the label.</p>');
    } else {
      const list = fc.sizes[fc.kind], ref = fc.ref[fc.kind];
      const hasRef = Object.keys(ref).length > 0;
      h += '<p class="small fc-intro">Copy the garment\'s own measurements from the shop\'s size chart (not the body sizes it is meant for); leave out what the chart does not give. Add more sizes from the same chart to compare them. ' +
        'If you have one of the same kind that fits well, measure it the same way and fill in the first column: nothing judges a new garment better.</p>';
      h += '<div class="fc-scroll"><table class="fc-grid"><thead><tr><th scope="col">Measurement</th><th scope="col" class="fc-ref">One of yours that fits</th>' +
        list.map(function (z, i) { return '<th scope="col"><input type="text" class="fc-name" data-sname="' + i + '" maxlength="12" placeholder="Size ' + (i + 1) + '" value="' + esc(z.n) + '" aria-label="Name of size ' + (i + 1) + '">' + (list.length > 1 ? '<button type="button" class="fc-del" data-sdel="' + i + '" aria-label="Remove size ' + (i + 1) + '">×</button>' : '') + '</th>'; }).join('') +
        (list.length < MAX_SIZES ? '<th scope="col"><button type="button" class="btn ghost small" id="fcAdd">Add a size</button></th>' : '') + '</tr></thead><tbody>' +
        def.fields.map(function (f) {
          const cell = function (val, attr) { return '<td><input type="number" step="0.5" min="1" ' + attr + ' value="' + esc(val || '') + '" aria-label="' + esc(f.label) + '"></td>'; };
          return '<tr><th scope="row">' + f.label + (f.flat ? '<label class="check small fc-flat"><input type="checkbox" data-flat="' + f.key + '"' + (fc.flat[f.key] ? ' checked' : '') + '> measured flat, across</label>' : '') + '</th>' +
            cell(ref[f.key], 'data-ref="' + f.key + '"') + list.map(function (z, i) { return cell(z.v[f.key], 'data-s="' + i + '" data-f="' + f.key + '"'); }).join('') + (list.length < MAX_SIZES ? '<td></td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
      // the seat's shape changes what to look for in trousers (tailoring convention, B)
      const seatShape = (st.shape || {}).seat;
      if (fc.kind === 'trousers' && seatShape === 'prominent') h += '<p class="small fc-note"><span class="badge B">B</span> <strong>Your seat:</strong> with a prominent seat or a hollow lower back, choose seat ease at the upper end of the cut and a rise that is not low. If the chart gives a back rise, it should be clearly longer than the front. Side adjusters or braces follow the back better than a belt. A low, slim cut gaps at the back of the waistband.</p>';
      if (fc.kind === 'trousers' && seatShape === 'flat') h += '<p class="small fc-note"><span class="badge B">B</span> <strong>Your seat:</strong> with a flat seat, trousers cut for an average one sag under it. Seat ease at the lower end of the cut suits you, and a tailor can take in the seat seam.</p>';
      if (def.fields.some(function (f) { return f.key === 'length'; })) h += '<p class="small muted fc-note">Lengths here run from the base of the collar at the back. Charts that measure from the shoulder\'s highest point, beside the collar, give about 2 cm more: take that off.</p>';
      const ctx = { prop: prop, ref: ref, periods: allProps };
      const results = list.map(function (z) { return checkGarment(fc.kind, z.v, fc.flat, m, fc.want, ctx); });
      const judged = results.filter(function (r) { return verdictOf(r); }).length;
      const best = judged > 1 ? bestSize(results) : -1;
      const nameOf = function (i) { return list[i].n ? list[i].n : 'Size ' + (i + 1); };
      if (best >= 0) {
        const v = verdictOf(results[best]);
        h += '<div class="ov-verdict mini ' + v.level + '"><div><strong>' + (v.level === 'bad' ? 'None of these fits; the nearest is ' : 'Best of these: ') + esc(nameOf(best)) + '</strong><span>' + esc(v.title) + '. ' + esc(v.text) + '</span></div></div>';
      }
      const any = results.some(function (r) { return r.length; });
      h += any ? results.map(function (res, i) {
        if (!res.length) return '';
        const v = verdictOf(res);
        const body = '<ul class="fc-list">' + res.map(function (r) {
          if (r.implausible) return '<li><strong>' + r.label + ':</strong> ' + r.garment + ' cm is not a garment measurement; check the number and the units.</li>';
          if (r.halfHint) return '<li><strong>' + r.label + ':</strong> ' + r.garment + ' cm is far less than your body, so it is probably measured flat, across one side: tick <em>measured flat</em> to double it.</li>';
          if (r.missing) return '<li><strong>' + r.label + ':</strong> needs your ' + r.missing.map(labelOf).join(' and ').toLowerCase() + ' (You tab).</li>';
          const src = r.against === 'rule' ? [window.VWHY.MAP.rule[r.key] || 'f-lengths', 'B'] : window.VWHY.MAP.against[r.against] || [null];
          return '<li class="fc-line why-host ' + r.state + '"><strong>' + r.label + '</strong> <span class="fc-num">' + r.garment + ' cm; ' + AGAINST[r.against] + ' ' + r.target + (r.diff ? ' (' + (r.diff > 0 ? '+' : '') + r.diff + ')' : '') + '</span><br><strong>' + STATE_WORD[r.state] + '.</strong> ' + esc(r.text.replace(/^(Right|Long|Short|Tight|Loose|Close)[:,] /, '').replace(/^./, function (c) { return c.toUpperCase(); })) + (r.alter && r.state !== 'right' ? ' <em>(' + ALTER_WORD[r.alter] + ')</em>' : '') + ' ' + window.VWHY.button(src[0], src[1], r.against === 'rule' ? 'rule:' + r.key : 'against:' + r.against) + '</li>';
        }).join('') + '</ul>' + periodsHtml(res);
        if (list.length === 1) return (v ? '<div class="ov-verdict mini ' + v.level + '"><div><strong>' + v.title + '</strong><span>' + esc(v.text) + '</span></div></div>' : '') + body;
        return '<details class="fc-size"' + (i === best || best < 0 ? ' open' : '') + '><summary><strong>' + esc(nameOf(i)) + '</strong>' + (v ? ' <span class="fc-tag ' + v.level + '">' + esc(v.title) + '</span>' : '') + '</summary>' + body + '</details>';
      }).join('') : '<p class="small muted">Enter at least one measurement.</p>';
      // where the judgement comes from
      const props = def.fields.filter(function (f) { return f.prop && prop[f.prop] && prop[f.prop].lo != null; });
      h += '<p class="small muted fc-src">' + (hasRef ? 'Where you filled in your own garment, the new one is judged against it. ' : '') +
        (props.length ? 'The ' + props.map(function (f) { return f.label.split(',')[0].toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' ' + (props.length > 1 ? 'are' : 'is') + ' judged against the Proportion targets for your build' + (perName ? ' and the period chosen there (' + esc(perName) + ')' : '') + '. ' : '') +
        'The rest against your body plus the ease of the cut, or a tailoring rule.</p>';
    }

    h += '<h3>Your sizes</h3><p class="small">Worked out from your measurements. A starting point: brands cut differently, and the check above is the reliable test.</p><div class="fit-sizes">' + groups.map(function (g) {
      return '<div class="fit-group"><h4>' + g + '</h4><dl>' + sz.filter(function (x) { return x.group === g; }).map(function (x) {
        return x.needs ? '<div class="fit-row miss"><dt>' + x.label + '</dt><dd>needs ' + x.needs.map(labelOf).join(' and ').toLowerCase() + '</dd></div>'
          : '<div class="fit-row why-host"><dt>' + x.label + ' ' + x.level.split('/').map(function (l) { return '<span class="badge ' + l + '">' + l + '</span>'; }).join(' ') + '</dt><dd><strong>' + esc(x.value) + '</strong><span>' + esc(x.how) + ' ' + window.VWHY.button(window.VWHY.MAP.size[x.label], x.level, 'size:' + x.label) + '</span></dd></div>';
      }).join('') + '</dl></div>';
    }).join('') + '</div>' +
      (sz.some(function (x) { return x.needs; }) ? '<p class="small muted">Missing measurements can be added on the <a href="#" data-goto-fit="you">You</a> tab.</p>' : '');

    h += '<h3>At the try-on</h3><p class="small">What to look for, in the order a tailor would, and why.</p>' + TRYON.map(function (g) {
      return '<details class="fit-try"><summary>' + g.name + '</summary><ul>' + g.items.map(function (i) { return '<li><strong>' + i[0] + '.</strong> ' + esc(i[1]) + '</li>'; }).join('') + '</ul></details>';
    }).join('');
    root.innerHTML = h;

    const redo = function () { api.save(); render(root, api); };
    const seg = function (id, key) { root.querySelectorAll('#' + id + ' button').forEach(function (b) { b.addEventListener('click', function () { fc[key] = b.dataset.v; redo(); }); }); };
    seg('fcKind', 'kind'); seg('fcWant', 'want'); seg('fcMode', 'mode');
    root.querySelectorAll('[data-goto-fit]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); api.goto(a.dataset.gotoFit); }); });
    const sys = root.querySelector('#fcSys'), n = root.querySelector('#fcN');
    if (sys) sys.addEventListener('change', function () { fc.label[fc.kind].sys = sys.value; redo(); });
    if (n) n.addEventListener('change', function () { fc.label[fc.kind].n = n.value; redo(); });
    const list = fc.sizes[fc.kind];
    root.querySelectorAll('[data-s]').forEach(function (i) { i.addEventListener('change', function () { list[+i.dataset.s].v[i.dataset.f] = i.value; redo(); }); });
    root.querySelectorAll('[data-ref]').forEach(function (i) { i.addEventListener('change', function () { fc.ref[fc.kind][i.dataset.ref] = i.value; redo(); }); });
    root.querySelectorAll('[data-sname]').forEach(function (i) { i.addEventListener('change', function () { list[+i.dataset.sname].n = i.value; redo(); }); });
    root.querySelectorAll('[data-sdel]').forEach(function (b) { b.addEventListener('click', function () { list.splice(+b.dataset.sdel, 1); redo(); }); });
    const add = root.querySelector('#fcAdd');
    if (add) add.addEventListener('click', function () { if (list.length < MAX_SIZES) list.push({ n: '', v: {} }); redo(); });
    root.querySelectorAll('[data-flat]').forEach(function (i) { i.addEventListener('change', function () { fc.flat[i.dataset.flat] = i.checked; redo(); }); });
  }

  window.VFITUI = { render: render };
})();
