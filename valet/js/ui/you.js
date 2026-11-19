/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — The You tab: colour samplers and the photo, measurements and their guide, the season switch, the profile card.
   Part of the interface; the parts share window.VAPP (see core.js). */
(function () {
  'use strict';
  const V = window.VAPP;
  const { $, $$, D, E, HELPER_TEXT, MEASURES, SAMPLERS, VC, esc, infoBtn, save, showTab } = V;
  Object.assign(V, { coreRows, refreshEffects, renderHair, renderMeasures, renderProfileCard, renderSamplers, renderSeason, showGuide });

  /* ---------- Samplers ----------
     Each feature can come from the photo or be chosen by name. A name stands for a typical colour
     (data.js, features), so nobody has to mix a skin tone on sliders; the sliders are still there
     under "Fine-tune the colour" for anyone who wants them. Under every feature one paragraph
     says what the choice has just changed, and why. */
  const F = D.features;
  const byId = function (list, id) { return list.find(function (x) { return x.id === id; }); };
  function lchHex(L, C, h) { const r = h * Math.PI / 180; return VC.labToHex([L, C * Math.cos(r), C * Math.sin(r)]); }
  function hairTone(base, toneId) { return base.red || base.level === 1 ? F.hair.tones[1] : (byId(F.hair.tones, toneId) || F.hair.tones[1]); }
  /* The colour a name stands for. */
  function namedHex(key, n) {
    if (key === 'skin') { const d = byId(F.skin.depths, n.id), t = byId(F.skin.tones, n.tone) || F.skin.tones[1]; return lchHex(d.L, d.C, 57 + t.dh); }
    if (key === 'hair') { const h = byId(F.hair.bases, n.id), t = hairTone(h, n.tone); return lchHex(h.L, h.C * t.kC, h.h + t.dh); }
    return byId(F.eyes, n.id).hex;
  }
  function namedLabel(key, n) {
    if (key === 'skin') { const t = byId(F.skin.tones, n.tone) || F.skin.tones[1]; return byId(F.skin.depths, n.id).name + (t.id === 'neutral' ? '' : ', ' + t.name.toLowerCase() + ' undertone'); }
    if (key === 'hair') { const h = byId(F.hair.bases, n.id), t = hairTone(h, n.tone); return t.id === 'natural' ? h.name : t.name + ' ' + h.name.toLowerCase(); }
    return byId(F.eyes, n.id).name;
  }
  /* The name closest to any colour, so a photo sample or a hand-set colour can be read in words. */
  function nearestNamed(key, hex) {
    const lab = VC.hexToLab(hex);
    if (key === 'skin') {
      const lch = VC.labToLch(lab), lean = (lch[2] - 57) / 8;
      const d = F.skin.depths.slice().sort(function (x, y) { return Math.abs(x.L - lab[0]) - Math.abs(y.L - lab[0]); })[0];
      return { id: d.id, tone: lean < -0.35 ? 'pink' : lean > 0.35 ? 'golden' : 'neutral' };
    }
    let all = [];
    if (key === 'hair') F.hair.bases.forEach(function (h) { (h.red || h.level === 1 ? [F.hair.tones[1]] : F.hair.tones).forEach(function (t) { all.push({ id: h.id, tone: t.id }); }); });
    else all = F.eyes.map(function (e) { return { id: e.id }; });
    all.forEach(function (n) { n.d = VC.deltaE2000(lab, VC.hexToLab(namedHex(key, n))); });
    return all.sort(function (x, y) { return x.d - y.d; })[0];
  }
  function greyWord(g) { return g <= 0 ? 'none' : g <= 15 ? 'a few' : g <= 40 ? 'some grey' : g <= 65 ? 'salt and pepper' : g <= 90 ? 'mostly grey' : 'white'; }
  const SLIDERS = {
    skin: { L: [20, 96], h: [25, 85, 'pinker', 'more golden'], C: [4, 40] },
    hair: { L: [5, 92], h: [20, 100, 'redder', 'more ash-yellow'], C: [0, 45] },
    eyes: { L: [10, 75], h: [0, 360, 'hue', ''], C: [0, 45] }
  };
  const WHY = {
    skin: 'Your skin is what every colour is judged against. Its depth decides which colours separate from your face and which blend into it; its undertone decides whether warm or cool colours sit more easily beside it.',
    hair: 'Hair frames the face. The light-dark step between hair and skin is most of what writers on men’s dress call your contrast, and the clothes beside your face look right when their own light-dark step is about as strong.',
    brows: 'With no hair, the brows are the darkest line left on the face, so they stand in for hair. They are a thin line, not a frame, and count a little less.',
    eyes: 'Eyes are small, so they matter most at talking distance. They add to your contrast, and repeating their colour in a shirt or tie is the oldest trick for drawing attention to them.'
  };
  const marks = {};   // where each sample was taken on the photo (not stored)
  const fineOpen = {};  // which "Fine-tune" panels are open (not stored)

  const SEASON_LABEL = {
    white: { label: 'White reference, summer photo', sub: 'only needed if your summer skin comes from a new photo' },
    skin: { label: 'Skin in summer', sub: 'cheek or forehead, no shine' }
  };
  const summerOn = function () { return V.state.season === 'summer'; };
  /* Where a feature is kept: in summer, skin and its white paper live in their own store. */
  function store(key) { return summerOn() && (key === 'skin' || key === 'white') ? V.state.summer : V.state; }
  function setSample(key, hex, byHand, named) {
    const st = store(key);
    st.samples[key] = hex; V.state.note = '';
    st.manual[key] = !!byHand;
    if (named) st.named[key] = named; else delete st.named[key];
    if (st === V.state.summer && key === 'skin') V.state.summer.mode = hex ? 'own' : 'estimate';
    if (byHand) delete marks[key];
  }
  /* The undertone a summer skin starts from: the winter one. A tan darkens skin and adds a little
     red; it does not turn pink skin golden (Jiang et al. 2022: hue angle moved 0.5 to 2.4°). */
  function summerTone() {
    const w = V.state.named.skin || (V.state.samples.skin ? nearestNamed('skin', E.corrected(V.state, 'skin')) : null);
    return { tone: w ? w.tone : 'neutral' };
  }
  function pickNamed(key, n) { setSample(key, namedHex(key, n), true, n); V.update(); }
  const dot = function (hex) { return '<i class="fx-dot" style="background:' + hex + '"></i>'; };

  /* One paragraph under each feature: what the current choice sets, and why that matters. */
  function effectHtml(key) {
    const a = V.analysis;
    if (!a || !a.hex[key]) return '';
    const bald = V.state.hairStyle === 'none';
    if (key === 'skin') {
      const T = {
        cool: 'Blues, greys and blue-reds such as burgundy sit easily at your face; camel, mustard and orange pull against it.',
        warm: 'Earth colours, cream and warm reds sit easily at your face; icy blues and stark white pull against it.',
        neutral: 'Neither side is held against you: only the strongest warm or cool colours lose points at your face.'
      };
      return '<strong>What this sets.</strong> Depth: ' + a.depthLevel + '. Temperature: ' + a.tempLevel + '. ' + T[a.tempLevel] +
        (a.confidence === 'low' ? ' An undertone judged by eye is a guess; the daylight tests in your profile settle it.' : '');
    }
    if (key === 'hair') {
      const e = a.edges.find(function (x) { return x.key === 'hair'; }), feat = bald ? 'brows' : 'hair';
      const C = {
        low: 'Your face is drawn in soft steps, so soft steps suit the clothes beside it: mid-blue on pale blue rather than black on white.',
        medium: 'Most combinations work. The two edges to watch are very stark pairs (black with white) and very flat ones (pale on pale).',
        high: 'Your face has a strong light-dark step and can hold one in the clothes: navy with white. Pale on pale leaves it unframed.'
      };
      let s = '<strong>What this sets.</strong> Light-dark step between ' + feat + ' and skin: ' + Math.round(e.dL) + '. Your contrast: <strong>' + a.contrastLevel + '</strong> (' + Math.round(a.contrast) + ')' +
        (a.contrastEdge && a.contrastEdge.key !== 'hair' ? ', set by the ' + a.contrastPair.replace('skin – ', '') + ', which give the stronger step' : '') + '. ' + C[a.contrastLevel];
      if (a.noGrey) {
        const was = Math.round(a.noGrey.hairStep), now = Math.round(e.dL), d = now - was;
        s += '</p><p class="s-effect"><strong>What the grey does.</strong> Grey and coloured strands are too fine to see apart, so at talking distance your ' + feat + (bald ? ' read as ' : ' reads as ') + dot(a.hex.hair) + ' rather than ' + dot(a.hairBase) + '. ' +
          (Math.abs(d) < 3 ? 'The step to your skin barely moves (' + was + ' to ' + now + '): this colour and grey are about equally light.'
            : 'The step to your skin ' + (d < 0 ? 'closes' : 'opens') + ' from ' + was + ' to ' + now + (d < 0 ? ', because grey is nearer your skin than the colour was' : ', because grey is further from your skin than the colour was') + '.') + ' ' +
          (a.noGrey.contrastLevel !== a.contrastLevel ? 'Your contrast moves from ' + a.noGrey.contrastLevel + ' to ' + a.contrastLevel + ', and the palette follows.' : 'Your contrast stays ' + a.contrastLevel + '.') +
          (a.noGrey.chromaLevel !== a.chromaLevel ? ' Your colouring also reads more ' + a.chromaLevel + ', so very vivid colours ask for more care.' : '');
      }
      return s;
    }
    const e = a.edges.find(function (x) { return x.key === 'eyes'; });
    const ec = E.echoes(a).filter(function (c) { return c.of === 'eyes'; });
    return '<strong>What this sets.</strong> Light-dark step between iris and skin: ' + Math.round(e.dL) + '. ' +
      (ec.length ? 'Colours that echo your eyes: ' + ec.map(function (c) { return dot(c.hex) + esc(c.name) + ' ' + V.tt(c.tier); }).join(', ') + '.' : '');
  }
  function refreshEffects() {
    $$('#samplers [data-fx]').forEach(function (el) { el.innerHTML = '<p class="s-effect">' + effectHtml(el.dataset.fx) + '</p>'; el.hidden = !effectHtml(el.dataset.fx); });
  }

  function summerSkinHtml(n) {
    const m = V.state.summer.mode;
    return '<div class="s-row"><span class="s-lab">Summer skin' + infoBtn('season') + '</span><div class="seg" role="radiogroup" aria-label="Summer skin">' +
      '<button type="button" role="radio" data-summer="estimate" aria-checked="' + (m === 'estimate') + '">Estimate a light tan</button>' +
      '<button type="button" role="radio" data-summer="same" aria-checked="' + (m === 'same') + '">Same as winter</button>' +
      '<button type="button" role="radio" aria-checked="' + (m === 'own') + '" disabled title="Pick a depth above, or sample a summer photo">My own</button></div>' +
      '<p class="small muted">' + (m === 'own' ? 'Your summer skin is set. Choose an option here to go back to an estimate.'
        : 'If you tan more than lightly, pick the depth you reach by late summer above. Keep the undertone you have in winter: a tan darkens skin and adds a little red, but it does not turn pink skin golden.') + '</p></div>';
  }
  function chipsHtml(key, items, sel, hexFor) {
    return '<div class="chips">' + items.map(function (it) {
      return '<button type="button" class="chip' + (sel === it.id ? ' sel' : '') + '" data-pick="' + it.id + '" aria-pressed="' + (sel === it.id) + '"' + (it.level ? ' title="Level ' + it.level + ' on a hairdresser’s chart"' : '') + '><i style="background:' + hexFor(it) + '"></i>' + esc(it.name) + '</button>';
    }).join('') + '</div>';
  }
  function segHtml(group, label, items, sel, info) {
    return '<div class="s-row"><span class="s-lab">' + label + (info ? infoBtn(info) : '') + '</span><div class="seg" role="radiogroup" aria-label="' + label + '">' + items.map(function (t) {
      return '<button type="button" role="radio" data-' + group + '="' + t.id + '" aria-checked="' + (sel === t.id) + '">' + esc(t.name) + '</button>';
    }).join('') + '</div></div>';
  }
  function namedControls(key, raw) {
    const n = store(key).named[key], near = raw ? nearestNamed(key, raw) : null, bald = V.state.hairStyle === 'none';
    let h = '';
    if (key === 'skin') {
      const tone = n ? n.tone : near ? near.tone : summerTone().tone;
      h += '<div class="s-row"><span class="s-lab">Depth</span>' + chipsHtml(key, F.skin.depths, n && n.id, function (d) { return namedHex('skin', { id: d.id, tone: tone }); }) + '</div>' +
        segHtml('tone', 'Undertone', F.skin.tones, n ? n.tone : summerOn() && !raw ? summerTone().tone : null, 'undertone') +
        (summerOn() ? summerSkinHtml(n) : '');
    } else if (key === 'hair') {
      const tone = n ? n.tone || 'natural' : 'natural', base = n && byId(F.hair.bases, n.id);
      h += '<div class="s-row"><span class="s-lab">' + (bald ? 'Brow colour' : 'Colour') + '</span>' + chipsHtml(key, F.hair.bases, n && n.id, function (b) { return namedHex('hair', { id: b.id, tone: tone }); }) + '</div>';
      if (!base || (!base.red && base.level !== 1)) h += segHtml('tone', 'Tone', F.hair.tones, n ? tone : null, 'hairTone');
      const g = V.state.grey || 0;
      h += '<div class="s-row"><span class="s-lab">Grey' + infoBtn('grey') + '</span><label class="s-grey"><input type="range" data-grey min="0" max="100" step="5" value="' + g + '" aria-label="Share of grey ' + (bald ? 'in the brows' : 'hair') + ', percent">' +
        '<output>' + g + '% · ' + greyWord(g) + '</output></label></div>';
    } else {
      h += '<div class="s-row"><span class="s-lab">Colour</span>' + chipsHtml(key, F.eyes, n && n.id, function (e) { return e.hex; }) + '</div>';
    }
    if (raw && !n && near) h += '<p class="small muted">' + (store(key).manual[key] ? 'Set by hand' : 'From the photo') + '. Closest name: <strong>' + esc(namedLabel(key, near)) + '</strong>.</p>';
    return h;
  }
  function renderSamplers() {
    const box = $('#samplers');
    box.innerHTML = SAMPLERS.map(function (s0) {
      let s = s0.bald && V.state.hairStyle === 'none' ? Object.assign({}, s0, s0.bald) : s0;
      if (summerOn() && SEASON_LABEL[s.key]) s = Object.assign({}, s, SEASON_LABEL[s.key]);
      const st = store(s.key), raw = st.samples[s.key], act = V.activeSampler === s.key, n = st.named[s.key];
      const derived = summerOn() && s.key === 'skin' && !raw ? E.seasonProfile(V.state).samples.skin : null;
      let shown = raw && s.key !== 'white' ? E.corrected(E.seasonProfile(V.state), s.key) : raw || derived;
      const pigment = shown;
      if (s.key === 'hair' && shown) shown = E.hairShown(shown, V.state.grey || 0);
      const src = derived ? (V.state.summer.mode === 'same' ? 'same as winter' : 'estimated: a light tan') : !raw ? 'not set' : n ? namedLabel(s.key, n) : st.manual[s.key] ? 'set by hand' : (s.key !== 'white' && pigment !== raw ? 'from the photo, corrected' : 'from the photo');
      let body = '';
      if (act && s.key === 'white') {
        body = '<div class="s-body"><p class="small muted">Click the paper in the photo. There is nothing to set by hand: without a photo, leave this empty.</p>' +
          (raw ? '<button type="button" class="btn ghost small" data-clear>Remove the white reference</button>' : '') + '</div>';
      } else if (act) {
        const lch = VC.labToLch(VC.hexToLab(raw || namedHex(s.key, { skin: { id: 'light', tone: 'neutral' }, hair: { id: 'l4' }, eyes: { id: 'grey' } }[s.key]))), sl = SLIDERS[s.key];
        const slider = function (id, label, v, r, lo, hi) {
          return '<label class="s-slider"><span>' + label + '</span><input type="range" data-ax="' + id + '" min="' + r[0] + '" max="' + r[1] + '" step="0.5" value="' + Math.max(r[0], Math.min(r[1], v)).toFixed(1) + '">' +
            '<span class="ends"><span>' + lo + '</span><span>' + hi + '</span></span></label>';
        };
        body = '<div class="s-body">' +
          '<p class="s-why">' + WHY[s.key === 'hair' && V.state.hairStyle === 'none' ? 'brows' : s.key] + '</p>' +
          namedControls(s.key, raw) +
          '<div data-fx="' + s.key + '" hidden></div>' +
          '<details class="s-fine"' + (fineOpen[s.key] ? ' open' : '') + '><summary>Fine-tune the colour</summary><div class="s-fine-body">' +
          '<p class="small muted">Optional. The names above are enough for a good reading; use these only if none of them looks like you.</p>' +
          slider('L', 'Lightness', lch[0], sl.L, 'darker', 'lighter') +
          slider('h', 'Hue', lch[2], sl.h, sl.h[2], sl.h[3]) +
          slider('C', 'Strength', lch[1], sl.C, 'greyer', 'more vivid') +
          '<label class="s-exact">Exact colour <input type="color" value="' + (raw || '#cccccc') + '" aria-label="' + s.label + ' colour"></label></div></details></div>';
      }
      return '<div class="sampler' + (act ? ' active' : '') + '" data-key="' + s.key + '">' +
        '<button type="button" class="s-head" aria-expanded="' + act + '">' +
        '<span class="sw" style="background:' + (shown || 'transparent') + '">' + (pigment && pigment !== raw ? '<span class="raw" style="background:' + raw + '" title="As photographed, before correction"></span>' : '') + '</span>' +
        '<span class="s-text"><span class="lbl">' + s.label + '</span><span class="sub">' + s.sub + '</span></span>' +
        '<span class="s-src' + (raw ? '' : ' unset') + '">' + esc(src) + (s.key === 'hair' && raw && V.state.grey ? ', ' + V.state.grey + '% grey' : '') + '</span></button>' + infoBtn('s-' + s.key) + body + '</div>';
    }).join('');
    const warn = V.state.useWhite ? VC.whiteProblem(store('white').samples.white) : null;
    $('#whiteWarn').hidden = !warn; $('#whiteWarn').textContent = warn || '';
    $$('.sampler', box).forEach(function (el) {
      const key = el.dataset.key;
      $('.s-head', el).addEventListener('click', function () { V.activeSampler = key; renderSamplers(); });
      $$('[data-pick]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          const cur = store(key).named[key] || (key === 'skin' ? summerTone() : {});
          pickNamed(key, key === 'eyes' ? { id: b.dataset.pick } : { id: b.dataset.pick, tone: cur.tone || (key === 'skin' ? 'neutral' : 'natural') });
        });
      });
      $$('[data-tone]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          // An undertone or tone needs a depth to apply to: keep the chosen one, or the nearest to the current colour.
          const st = store(key), cur = st.named[key] || (st.samples[key] ? nearestNamed(key, st.samples[key]) : key === 'skin' ? Object.assign({ id: 'light' }, summerTone()) : { id: 'l4' });
          pickNamed(key, { id: cur.id, tone: b.dataset.tone });
        });
      });
      const gr = $('[data-grey]', el);
      if (gr) {
        gr.addEventListener('input', function () {
          V.state.grey = parseFloat(gr.value);
          $('output', gr.parentNode).textContent = V.state.grey + '% · ' + greyWord(V.state.grey);
          if (V.state.samples.hair) $('.sw', el).style.background = E.hairShown(E.corrected(V.state, 'hair'), V.state.grey);
          V.update(true);
        });
        gr.addEventListener('change', function () { V.update(); });
      }
      const fine = $('.s-fine', el);
      if (fine) fine.addEventListener('toggle', function () { fineOpen[key] = fine.open; });
      $$('input[data-ax]', el).forEach(function (inp) {
        inp.addEventListener('input', function () {
          const v = {}; $$('input[data-ax]', el).forEach(function (i) { v[i.dataset.ax] = parseFloat(i.value); });
          setSample(key, lchHex(v.L, v.C, v.h), true);
          $('.sw', el).style.background = key === 'hair' ? E.hairShown(store(key).samples[key], V.state.grey || 0) : store(key).samples[key];
          $('.s-src', el).textContent = 'set by hand'; $('.s-src', el).classList.remove('unset');
          const ex = $('.s-exact input', el); if (ex) ex.value = store(key).samples[key];
          $$('.chip', el).forEach(function (b) { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
          V.update(true);
        });
        inp.addEventListener('change', function () { V.update(); });
      });
      const ex = $('.s-exact input', el);
      if (ex) { ex.addEventListener('input', function () { setSample(key, ex.value, true); $('.sw', el).style.background = ex.value; V.update(true); }); ex.addEventListener('change', function () { V.update(); }); }
      const clr = $('[data-clear]', el);
      if (clr) clr.addEventListener('click', function () { store('white').samples.white = null; delete marks.white; V.update(); });
      $$('[data-summer]', el).forEach(function (b) {
        b.addEventListener('click', function () { V.state.summer.mode = b.dataset.summer; V.state.summer.samples.skin = null; V.state.summer.named = {}; V.state.summer.manual = {}; delete marks.skin; V.update(); });
      });
    });
    refreshEffects();
    renderMarks();
  }
  function renderMarks() {
    $('#photoMarks').innerHTML = SAMPLERS.filter(function (s) { return marks[s.key]; }).map(function (s) {
      const m = marks[s.key];
      return '<span class="mark' + (V.activeSampler === s.key ? ' active' : '') + '" style="left:' + m.x * 100 + '%;top:' + m.y * 100 + '%"><i style="background:' + store(s.key).samples[s.key] + '"></i><b>' + (s.key === 'hair' && V.state.hairStyle === 'none' ? 'Brows' : s.label.split(' ')[0]) + '</b></span>';
    }).join('');
  }

  /* ---------- Photo ---------- */
  const canvas = $('#photoCanvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  $('#photoInput').addEventListener('change', function (e) {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = function () {
      const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * sc);
      canvas.height = Math.round(img.height * sc);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      $('#canvasWrap').hidden = false;
      Object.keys(marks).forEach(function (k) { delete marks[k]; });
      V.activeSampler = 'white'; renderSamplers();
      $('#photoHint').textContent = 'Click the white paper first, then skin, hair and eyes. For hair, click a strand that still has its colour and set the grey with the slider. The magnifier shows exactly what is being read. The photo is not stored.';
    };
    img.src = URL.createObjectURL(f);
  });

  function patchRadius() { return Math.max(3, Math.round(canvas.width / 300)); }
  function samplePatch(x, y) {
    const r = patchRadius();
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
    const w = Math.min(canvas.width - x0, 2 * r + 1), h = Math.min(canvas.height - y0, 2 * r + 1);
    const data = ctx.getImageData(x0, y0, w, h).data;
    const acc = [0, 0, 0]; let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      acc[0] += VC.srgbToLinear(data[i]); acc[1] += VC.srgbToLinear(data[i + 1]); acc[2] += VC.srgbToLinear(data[i + 2]); n++;
    }
    return VC.rgbToHex(acc.map(function (v) { return VC.linearToSrgb(v / n); }));
  }
  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * canvas.width / rect.width),
      y: Math.round((e.clientY - rect.top) * canvas.height / rect.height),
      cx: e.clientX - rect.left, cy: e.clientY - rect.top, w: rect.width, h: rect.height
    };
  }
  /* Magnifier: the pixels under the pointer, the patch that will be averaged, and its colour. */
  const loupe = $('#loupe'), lctx = loupe.getContext('2d');
  canvas.addEventListener('pointermove', function (e) {
    const p = canvasPoint(e), r = patchRadius(), span = r * 9, S = loupe.width;
    loupe.hidden = false;
    const size = 132, left = p.cx + 20 + size > p.w ? p.cx - 20 - size : p.cx + 20, top = Math.max(4, Math.min(p.h - size - 4, p.cy - size / 2));
    loupe.style.left = left + 'px'; loupe.style.top = top + 'px';
    lctx.imageSmoothingEnabled = false; lctx.fillStyle = '#000'; lctx.fillRect(0, 0, S, S);
    lctx.drawImage(canvas, p.x - span, p.y - span, span * 2 + 1, span * 2 + 1, 0, 0, S, S);
    const k = S / (span * 2 + 1), box = (2 * r + 1) * k;
    lctx.strokeStyle = '#000'; lctx.lineWidth = 3; lctx.strokeRect((S - box) / 2, (S - box) / 2, box, box);
    lctx.strokeStyle = '#fff'; lctx.lineWidth = 1.5; lctx.strokeRect((S - box) / 2, (S - box) / 2, box, box);
    lctx.fillStyle = samplePatch(p.x, p.y); lctx.fillRect(0, S - 26, S, 26);
    lctx.strokeStyle = 'rgba(0,0,0,0.5)'; lctx.lineWidth = 1; lctx.strokeRect(0, S - 26, S, 26);
  });
  canvas.addEventListener('pointerleave', function () { loupe.hidden = true; });
  canvas.addEventListener('click', function (e) {
    const p = canvasPoint(e);
    setSample(V.activeSampler, samplePatch(p.x, p.y), false);
    marks[V.activeSampler] = { x: p.x / canvas.width, y: p.y / canvas.height };
    const order = SAMPLERS.map(function (s) { return s.key; });
    const next = order.find(function (k) { return !marks[k]; });
    if (next) V.activeSampler = next;
    V.update();
  });


  /* ---------- Measurements and the illustrated guide ---------- */
  let guideKey = null; let guideMethod = 'body';
  /* Shape: four choices a tape does not catch (shoulders, stomach, posture, seat). */
  $$('[data-shape]').forEach(function (sel) {
    sel.addEventListener('change', function () { V.state.shape = V.state.shape || {}; V.state.shape[sel.dataset.shape] = sel.value; save(); });
  });
  function syncShape() { $$('[data-shape]').forEach(function (sel) { sel.value = (V.state.shape || {})[sel.dataset.shape] || 'average'; }); }
  function measureCount() {
    const n = MEASURES.filter(function (m) { return V.state.measurements[m.key] > 0; }).length;
    $('#measureCount').textContent = n + ' of ' + MEASURES.length;
    $('#measureCount').title = n + ' of ' + MEASURES.length + ' measurements entered';
    $('#measureCount').classList.toggle('none', !n);
  }
  function renderMeasures() {
    syncShape(); measureCount();
    $('#measureGrid').innerHTML = MEASURES.map(function (m) {
      const v = V.state.measurements[m.key];
      return '<div class="field m-field' + (guideKey === m.key ? ' active' : '') + '" data-mk="' + m.key + '"><span class="flabel"><label for="m-' + m.key + '">' + m.label + '</label>' +
        '<button type="button" class="info" data-info="m-' + m.key + '" aria-label="How to measure ' + m.label.toLowerCase() + '">?</button></span>' +
        '<span class="m-input"><input id="m-' + m.key + '" type="number" inputmode="decimal" min="0" step="0.5" data-m="' + m.key + '" value="' + (v == null ? '' : v) + '"><span class="unit">cm</span></span></div>';
    }).join('');
    $$('#measureGrid input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const v = parseFloat(inp.value);
        if (isNaN(v)) delete V.state.measurements[inp.dataset.m]; else V.state.measurements[inp.dataset.m] = v;
        save(); renderProfileCard(); V.syncChartSoon(); renderGuideStatus(); measureCount();
      });
      inp.addEventListener('focus', function () { if (!$('#measureGuide').hidden) showGuide(inp.dataset.m); });
    });
    if (guideKey && !$('#measureGuide').hidden) showGuide(guideKey);
  }
  /* A plausible range for each measurement given height, to catch typing slips and mixed units. */
  function plausible(key, v) {
    const H = V.state.measurements.height || 178;
    const R = { height: [140, 215], chest: [0.42, 0.78], waist: [0.33, 0.8], seat: [0.42, 0.8], neck: [0.17, 0.28], shoulder: [0.2, 0.32],
      arm: [0.28, 0.42], inseam: [0.38, 0.52], backNeckFloor: [0.8, 0.9], waistHeight: [0.53, 0.67], faceWidth: [11, 17], faceLength: [9.5, 15.5], wrist: [13, 23], head: [50, 66], foot: [0.13, 0.17] }[key];
    if (!R) return null;
    const abs = ['height', 'faceWidth', 'faceLength', 'wrist', 'head'].indexOf(key) >= 0;
    const lo = abs ? R[0] : R[0] * H, hi = abs ? R[1] : R[1] * H;
    if (v < lo || v > hi) return 'That is outside the usual range for ' + (key === 'height' ? 'adults' : 'your height') + ' (' + Math.round(lo) + '–' + Math.round(hi) + ' cm). Check the units and where the tape sat.';
    return null;
  }
  function renderGuideStatus() {
    const m = MEASURES.find(function (x) { return x.key === guideKey; }), v = V.state.measurements[guideKey], el = $('#guideStatus');
    if (!el || !m) return;
    const warn = v != null ? plausible(guideKey, v) : null;
    el.className = 'g-status' + (warn ? ' warn' : v != null ? ' ok' : '');
    el.textContent = warn || (v != null ? m.label + ': ' + v + ' cm.' : 'Not measured yet; readings that need it are left out until you add it.');
  }
  function showGuide(key, scroll) {
    const m = MEASURES.find(function (x) { return x.key === key; }); if (!m) return;
    if (key !== guideKey) guideMethod = 'body';
    guideKey = key;
    $('#measureGuide').hidden = false;
    $$('#measureGrid .m-field').forEach(function (f) { f.classList.toggle('active', f.dataset.mk === key); });
    const VM = window.VMEASURE, hasG = VM && VM.hasGarment(key);
    if (!hasG) guideMethod = 'body';
    const idx = MEASURES.indexOf(m);
    $('#measureGuide').innerHTML =
      '<div class="g-head"><h3>' + m.label + '</h3><span class="g-who ' + m.helper + '">' + HELPER_TEXT[m.helper] + '</span>' +
      '<span class="g-nav"><button type="button" class="btn ghost small" data-step="-1"' + (idx ? '' : ' disabled') + '>Previous</button>' +
      '<button type="button" class="btn ghost small" data-step="1"' + (idx < MEASURES.length - 1 ? '' : ' disabled') + '>Next</button>' +
      '<button type="button" class="g-close" aria-label="Close the guide">×</button></span></div>' +
      '<div class="g-body"><div class="g-art">' +
      '<div class="seg" role="radiogroup" aria-label="Method"><button type="button" role="radio" data-gm="body" aria-checked="' + (guideMethod === 'body') + '">On the body</button>' +
      '<button type="button" role="radio" data-gm="garment" aria-checked="' + (guideMethod === 'garment') + '"' + (hasG ? '' : ' disabled title="Not available from a garment"') + '>From a garment</button></div>' +
      (VM ? VM.draw(key, guideMethod) : '') + '</div>' +
      '<div class="g-text">' +
      (guideMethod === 'body'
        ? '<p><strong>What:</strong> ' + esc(m.what) + '</p><p><strong>How:</strong> ' + esc(m.how) + '</p><p><strong>Who:</strong> ' + esc(m.helperNote) + '</p>'
        : '<p><strong>From a garment that fits:</strong> ' + esc(m.garment) + '</p>') +
      (!hasG && m.garment ? '<p class="muted small"><strong>From a garment:</strong> ' + esc(m.garment) + '</p>' : '') +
      '<p><strong>Used for:</strong> ' + esc(m.use) + '</p>' +
      '<p class="g-status" id="guideStatus"></p></div></div>';
    $('#measureGuide .g-close').addEventListener('click', function () {
      $('#measureGuide').hidden = true; $$('#measureGrid .m-field').forEach(function (f) { f.classList.remove('active'); });
    });
    $$('#measureGuide [data-gm]').forEach(function (b) { b.addEventListener('click', function () { guideMethod = b.dataset.gm; showGuide(key); }); });
    $$('#measureGuide [data-step]').forEach(function (b) {
      b.addEventListener('click', function () { const n = MEASURES[idx + +b.dataset.step]; if (n) { showGuide(n.key); $('#m-' + n.key).focus({ preventScroll: true }); } });
    });
    renderGuideStatus();
    if (scroll) $('#measureGuide').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function renderHair() {
    $$('#hairStyle button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.hair === V.state.hairStyle)); });
  }
  $$('#hairStyle button').forEach(function (b) {
    b.addEventListener('click', function () { V.state.hairStyle = b.dataset.hair; renderHair(); V.update(); });
  });
  $('#redness').addEventListener('change', function (e) { V.state.redness = e.target.value; V.update(); });
  $('#underEye').addEventListener('change', function (e) { V.state.underEye = e.target.value; V.update(); });
  $('#useWhite').addEventListener('change', function (e) { V.state.useWhite = e.target.checked; V.update(); });

  /* ---------- Season: one switch in the header; every tab follows it ---------- */
  function renderSeason() {
    $$('#season button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.season === V.state.season)); });
    document.body.classList.toggle('is-summer', summerOn());
  }
  $$('#season button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (V.state.season === b.dataset.season) return;
      V.state.season = b.dataset.season;
      if (summerOn() && V.activeTab === 'you') V.activeSampler = 'skin';
      V.update();
    });
  });

  /* Why a colour moved between seasons: the rule whose score changed most, in a few words, with
     that rule's own sentence from the season where it is weaker. */
  function seasonWhy(A, B) {
    const by = function (r) { const o = {}; r.rules.forEach(function (x) { o[x.id] = x; }); return o; };
    const a = by(A), b = by(B);
    let best = null;
    Object.keys(Object.assign({}, a, b)).forEach(function (id) {
      const sa = a[id] ? a[id].score : 1, sb = b[id] ? b[id].score : 1, d = sb - sa;
      if (!best || Math.abs(d) > Math.abs(best.d)) best = { id: id, d: d };
    });
    if (!best || Math.abs(best.d) < 0.02) return { short: 'overall score', full: 'Several small changes add up; no single rule moved much.' };
    const better = best.d > 0, weak = better ? a[best.id] : b[best.id];
    const heavy = weak && /Heavier contrast/.test(weak.text);
    const SHORT = {
      contrast: better ? (heavy ? 'less stark' : 'separates better') : (heavy ? 'too stark now' : 'less separation'),
      merge: better ? 'no longer blends in' : 'blends with the skin',
      temp: 'temperature', chroma: 'saturation', sim: 'Chevreul effect', glasses: 'frames'
    };
    return { short: SHORT[best.id] || best.id, full: (better ? 'In winter: ' : 'In summer: ') + (weak ? weak.text : '') };
  }

  /* What the time of year changes: the two readings side by side, and every colour whose tier
     at the face moves. Shown on the profile card. */
  function seasonCompare() {
    if (!V.state.samples.skin) return '';
    const w = E.analyseProfile(E.seasonProfile(V.state, 'winter')), su = E.analyseProfile(E.seasonProfile(V.state, 'summer'));
    if (!w || !su) return '';
    const moves = D.colours.map(function (c) {
      const A = E.scoreColour(c.hex, w), B = E.scoreColour(c.hex, su);
      return { name: c.name, hex: c.hex, a: A.tier, b: B.tier, why: seasonWhy(A, B) };
    // T3 and T4 both mean "not at the face" and differ only in why, so a move between them is not
    // shown as better or worse; only moves that change what can be worn at the face count.
    }).filter(function (x) { return x.a !== x.b && Math.min(x.a, x.b) <= 2; });
    const gain = moves.filter(function (x) { return x.b < x.a; }), lose = moves.filter(function (x) { return x.b > x.a; });
    const chip = function (x) { return '<span class="gl-c" title="' + esc(x.why.full) + '"><i style="background:' + x.hex + '"></i>' + esc(x.name) + ' ' + V.tt(x.a) + '<span class="arr">→</span>' + V.tt(x.b) + '<span class="of">' + esc(x.why.short) + '</span></span>'; };
    const how = V.state.summer.mode === 'own' ? 'your summer skin' : V.state.summer.mode === 'same' ? 'the same skin all year' : 'an estimated light tan';
    const dL = su.lab.skin[0] - w.lab.skin[0];
    let h = '<h3 style="margin-top:1.1rem">Winter and summer ' + infoBtn('season') + '</h3>' +
      '<p class="small">Summer uses ' + how + (Math.abs(dL) >= 0.5 ? ' (skin ' + Math.abs(Math.round(dL * 10) / 10) + ' L* ' + (dL < 0 ? 'darker' : 'lighter') + ')' : '') + '. ' +
      'Contrast ' + w.contrastLevel + ' (' + Math.round(w.contrast) + ') in winter, ' + su.contrastLevel + ' (' + Math.round(su.contrast) + ') in summer. ' +
      (moves.length ? 'At the face, ' + moves.length + ' colour' + (moves.length > 1 ? 's' : '') + ' change tier.' : 'No colour changes tier: the difference is too small to matter.') + '</p>';
    if (gain.length) h += '<div class="gl-row"><div class="gl-h"><strong>Better in summer</strong><span>hover a colour for the full reason</span></div><div class="gl-chips">' + gain.map(chip).join('') + '</div></div>';
    if (lose.length) h += '<div class="gl-row"><div class="gl-h"><strong>Better in winter</strong><span>hover a colour for the full reason</span></div><div class="gl-chips">' + lose.map(chip).join('') + '</div></div>';
    return h;
  }

  /* ---------- Profile card ---------- */
  function scaleRow(label, valueText, pos, cls, ends, extra) {
    return '<div class="dim"><div class="dim-head"><span>' + label + '</span><strong>' + valueText + (extra || '') + '</strong></div>' +
      '<div class="scale ' + cls + '"><span class="mark" style="left:' + Math.max(0, Math.min(100, pos)) + '%"></span></div>' +
      '<div class="scale-ends"><span>' + ends[0] + '</span><span>' + ends[1] + '</span></div></div>';
  }
  /* The face on a lightness scale: where skin, hair or brows and eyes sit, the step that sets the
     contrast, and the lightness a garment needs to frame the face (section 4 of How it works). */
  function ladder(a) {
    const W = 320, x = function (L) { return 12 + Math.max(0, Math.min(100, L)) / 100 * (W - 24); };
    const Ls = a.lab.skin[0], e = a.contrastEdge, lo = a.band[0], hi = a.band[1];
    let s = '<svg class="ladder" viewBox="0 0 ' + W + ' 92" role="img" aria-label="Lightness of your features from dark to light, with the contrast step of ' + Math.round(a.contrast) + ' and the garment lightness that frames you">' +
      '<defs><linearGradient id="lg"><stop offset="0" stop-color="#111"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>';
    [[Ls - hi, Ls - lo], [Ls + lo, Ls + hi]].forEach(function (b) {
      const a0 = Math.max(0, b[0]), a1 = Math.min(100, b[1]);
      if (a1 - a0 > 1) s += '<rect class="fit" x="' + x(a0) + '" y="56" width="' + (x(a1) - x(a0)) + '" height="9" rx="2"/>';
    });
    s += '<rect x="12" y="44" width="' + (W - 24) + '" height="9" rx="2" fill="url(#lg)" class="bar"/>';
    if (e) {
      const x0 = x(Math.min(Ls, e.L)), x1 = x(Math.max(Ls, e.L));
      s += '<path class="span" d="M' + x0 + ' 14 V8 H' + x1 + ' V14"/><text class="lab" x="' + (x0 + x1) / 2 + '" y="5.5" text-anchor="middle">step ' + Math.round(e.dL) + (e.w < 1 ? ' × ' + e.w : '') + '</text>';
      if (e.assumed) s += '<circle class="assumed" cx="' + x(e.L) + '" cy="30" r="8"/>';
    }
    ['eyes', 'hair', 'skin'].forEach(function (k) {
      if (!a.lab[k]) return;
      s += '<line class="stem" x1="' + x(a.lab[k][0]) + '" y1="38" x2="' + x(a.lab[k][0]) + '" y2="44"/><circle class="feat" cx="' + x(a.lab[k][0]) + '" cy="30" r="8.5" fill="' + a.hex[k] + '"><title>' + (k === 'hair' && a.hairStyle === 'none' ? 'brows' : k) + ', L* ' + Math.round(a.lab[k][0]) + '</title></circle>';
    });
    s += '<text class="lab" x="12" y="80">dark</text><text class="lab" x="' + (W - 12) + '" y="80" text-anchor="end">light</text>' +
      '<text class="lab fitlab" x="' + W / 2 + '" y="80" text-anchor="middle">green: garment lightness that frames you</text></svg>';
    return s;
  }
  /* The palette at a glance and the daylight tests that would firm the reading up. */
  function glance(a) {
    return '<h3 style="margin-top:1.1rem">At a glance</h3>' + coreRows(a, false) + tests(a);
  }
  /* The core palette: the best of each tier, spread so no two look alike (engine.js, summary), and
     the colours that echo the person's own. Rebuilt from the profile and the season every time, so
     nothing done in the study or the theme can change it. On the Palette tab the chips are buttons
     that put the colour in the study. */
  function coreRows(a, clickable) {
    const sm = E.summary(a), ec = E.echoes(a);
    const chip = function (c, extra, title) {
      const inner = '<i style="background:' + c.hex + '"></i>' + esc(c.name) + (extra || '');
      return clickable ? '<button type="button" class="gl-c" data-hex="' + c.hex + '" title="' + esc(title || c.name) + '">' + inner + '</button>'
        : '<span class="gl-c" title="' + esc(title || c.name) + '">' + inner + '</span>';
    };
    const row = function (title, note, list, extra, titleOf) {
      if (!list.length) return '';
      return '<div class="gl-row"><div class="gl-h"><strong>' + title + '</strong><span>' + note + '</span></div><div class="gl-chips">' +
        list.map(function (c) { return chip(c, extra && extra(c), titleOf && titleOf(c)); }).join('') + '</div></div>';
    };
    return row('Base', 'neutrals and quiet colours, anywhere', sm.neutrals) +
      row('Colour ' + V.tt(1), 'at the face', sm.colours) +
      row('Deliberate ' + V.tt(2), 'one per outfit', sm.deliberate) +
      row('Below the belt ' + V.tt(3), 'trousers, shoes, belts', sm.below) +
      row('Echo', 'repeats your own colouring ' + infoBtn('echo'), ec,
        function (c) { return ' ' + V.tt(c.tier) + '<span class="of">' + c.of + '</span>'; }, function (c) { return 'Echoes your ' + c.of; });
  }
  function tests(a) {
    const sm = E.summary(a);
    return (sm.tests.length ? '<h3 style="margin-top:1.1rem">Daylight tests to run</h3><ul class="tests">' + sm.tests.map(function (t) {
        return '<li><span class="pair"><i style="background:' + t.pair[0] + '"></i><i style="background:' + t.pair[1] + '"></i></span><span><strong>' + esc(t.title) + '</strong><br>' + esc(t.text) + '</span></li>';
      }).join('') + '</ul>' : '');
  }
  function renderProfileCard() {
    const card = $('#profileCard');
    if (!V.analysis) {
      card.innerHTML = '<h3>Your profile</h3><p class="muted">Sample at least your skin to start. Hair and eyes make the contrast reading meaningful; the white paper makes everything more reliable.</p>';
      return;
    }
    const a = V.analysis;
    const sw = ['skin', 'hair', 'eyes'].filter(function (k) { return a.hex[k]; }).map(function (k) {
      const lch = VC.labToLch(a.lab[k]);
      const nm = store(k).named[k] && !(k === 'skin' && a.tanFrom) ? namedLabel(k, store(k).named[k]) : namedLabel(k, nearestNamed(k, k === 'hair' ? a.hairBase : a.hex[k]));
      return '<figure><div class="dot" style="background:' + a.hex[k] + '"></div><strong>' + (k === 'hair' && a.hairStyle === 'none' ? 'brows' : k) + '</strong><br><span class="nm">' + esc(nm.toLowerCase()) + (k === 'hair' && a.grey ? ', ' + a.grey + '% grey' : '') + '</span><br>L* ' + Math.round(a.lab[k][0]) + ', C* ' + Math.round(lch[1]) + '<br>h ' + Math.round(lch[2]) + '°</figure>';
    }).join('');
    const ratios = E.bodyRatios(V.state.measurements);
    card.innerHTML =
      '<h3>' + (V.state.name ? esc(V.state.name) : 'Your profile') + ' <span class="season-tag">' + (summerOn() ? 'summer' : 'winter') + '</span></h3>' +
      (V.state.note ? '<p class="note small">' + esc(V.state.note) + '</p>' : '') +
      '<div class="profile-swatches">' + sw + '</div>' +
      '<div class="dim"><div class="dim-head"><span>Contrast <span class="badge A">A</span> <span class="badge B">B</span></span><strong>' + a.contrastLevel + ' (' + Math.round(a.contrast) + ')</strong></div>' + ladder(a) + '</div>' +
      scaleRow('Depth <span class="badge A">A</span>', a.depthLevel + ' (L* ' + Math.round(a.depth) + ')', 100 - a.depth, 'depth', ['light', 'deep']) +
      scaleRow('Temperature <span class="badge B">B</span>', a.tempLevel + ' (h ' + Math.round(a.skinHue) + '°) ', (a.lean + 1) * 50, 'temp', ['cool', 'warm'],
        ' <span class="conf ' + a.confidence + '">confidence ' + a.confidence + '</span>') +
      scaleRow('Chroma <span class="badge A">A</span>', a.chromaLevel + ' (C* ' + Math.round(a.chroma) + ')', a.chroma / 40 * 100, 'chroma', ['muted', 'clear']) +
      '<p class="small muted">Skin redness a* ' + Math.round(a.lab.skin[1]) + ', yellowness b* ' + Math.round(a.lab.skin[2]) + ': the temperature hue is the angle between the two, so a ruddy skin and a sallow one can share it (How it works, section 7). ' +
        'Strongest step: ' + esc(a.contrastPair) + (a.contrastEdge && a.contrastEdge.assumed ? ' (assumed, not sampled)' : '') + ', as ' + a.hairLabel + '.' +
        (a.hairStyle === 'none' && a.hex.hair ? ' Brows are a thin line, not a frame, so their step counts at 80%.' : '') +
        (a.noGrey ? ' Without the grey your contrast would read ' + a.noGrey.contrastLevel + ' (' + Math.round(a.noGrey.contrast) + ').' : '') +
        (a.tanFrom ? ' Summer skin ' + (a.tanFrom.estimate ? 'is estimated from winter' : 'is taken as the same as winter') + '.' : '') +
        (a.confidence === 'low' ? ' Temperature is an estimate: the skin was set by hand or the photo has no white reference.' : '') + '</p>' +
      (ratios.length ? '<h3 style="margin-top:1rem">Body ratios <span class="badge B">B</span></h3><ul class="ratios">' +
        ratios.map(function (r) { return '<li><span>' + r.label + '</span><span>' + r.value + '<br><span class="n">' + r.note + '</span></span></li>'; }).join('') + '</ul>' : '') +
      glance(a) +
      seasonCompare() +
      '<p class="next-step"><button type="button" class="btn small" id="toColour">Next: your palette</button></p>';
    $('#toColour').addEventListener('click', function () { showTab('colour'); });
  }


  Object.assign(V, { F, byId, marks, summerOn });
})();
