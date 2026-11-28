/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser, part 3 of 5: the editor for one piece: its type, colour (the library, your
   own colours read from photos, a colour of your own), cloth, pattern and second colour, and how the
   pattern reads from a distance. Shares the Dresser's helpers and state through window.VDRCORE (js/ui/dresser.js). */
// @ts-check
(function () {
  'use strict';
  const DR = window.VDRCORE;
  const VC = window.VC, E = window.VENGINE, D = window.VDATA, VP = window.VPAT, O = window.VOUTFIT, X = window.VDRESS;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const escs = function (s) { return esc(s).replace(/#[0-9a-fA-F]{6}\b/g, function (h) { return '<span class="hexsw" style="background:' + h + '" role="img" aria-label="colour ' + h + '" title="' + h + '"></span>'; }); };
  const G = window.VGARM;


  /* ---------- Editor for one piece: colour and cloth ---------- */
  function renderEditor(ed, k, a) {
    const p = DR.PIECES.find(function (x) { return x.key === k; }), x = DR.piece(k), cur = DR.kindOf(k);
    const kindRow = p.kinds.length > 1 ? '<div class="kind-row" role="radiogroup" aria-label="What it is"><span class="kind-lab">What it is</span>' + p.kinds.map(function (t) {
      const why = DR.kindBlocked(k, t);
      return '<button type="button" role="radio" class="kind" data-kind="' + t.id + '" aria-checked="' + (t.id === cur.id) + '"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="' + esc(DR.kindNote(t)) + '"') + '>' + t.name + '</button>';
    }).join('') + '</div><p class="ed-note kind-note">' + esc(DR.kindNote(cur)) + '</p>' : '';
    const keepRow = '<div class="keep-row"><button type="button" class="btn small ghost ov-keep">Keep this, fix the rest</button><span class="ed-note">For a piece you own: Valet changes the other open pieces, and adds or removes a layer, to make it work. If nothing can, it says so.</span></div>';
    // the cut that sets where the piece meets the next ): trousers' rise, a knit's length
    const CUTS = { trousers: { key: 'rise', label: 'Rise', opts: [['high', 'High: at the natural waist or above'], ['mid', 'Mid: a little below it'], ['low', 'Low: on the hips']], def: 'mid' },
      mid: { key: 'length', label: 'Length', opts: [['short', 'Short: to a high waistband (1930s)'], ['regular', 'Regular: over the waistband'], ['long', 'Long: to the hips']], def: 'regular' } };
    const cut = CUTS[k] && !(k === 'mid' && cur.vest) && CUTS[k];   // a waistcoat's length is its points: no choice
    const cutRow = cut ? '<div class="kind-row cut-row" role="radiogroup" aria-label="' + cut.label + '"><span class="kind-lab">' + cut.label + '</span>' + cut.opts.map(function (o) {
      return '<button type="button" role="radio" class="kind cut" data-cut="' + o[0] + '" aria-checked="' + ((x[cut.key] || cut.def) === o[0]) + '" title="' + esc(o[1]) + '">' + o[1].split(':')[0] + '</button>';
    }).join('') + '</div><p class="ed-note">' + esc(cut.opts.find(function (o) { return o[0] === (x[cut.key] || cut.def); })[1]) + '. It sets where this piece meets the next; see Proportion in the checks.</p>' : '';
    const extraRow = cur.buttons ? '<div class="kind-row" role="radiogroup" aria-label="Buttons"><span class="kind-lab">Buttons</span>' + G.BUTTONS.map(function (b) {
        return '<button type="button" role="radio" class="kind btn-opt" data-btn="' + b[0] + '" aria-checked="' + ((x.buttons || 'silver') === b[0]) + '">' + b[1] + '</button>';
      }).join('') + '</div><p class="ed-note">Metal buttons count as metal in the outfit: keep the watch and buckle in the same metal.</p>'
      : cur.metal ? '<div class="kind-row" role="radiogroup" aria-label="Metal"><span class="kind-lab">Metal</span>' + ['silver', 'gold', 'gunmetal', 'rose'].map(function (m) {
        return '<button type="button" role="radio" class="kind pin-metal" data-metal="' + m + '" aria-checked="' + ((x.metal || 'silver') === m) + '"><i class="d" style="background:' + G.metalBy[m].hex + '"></i>' + G.metalBy[m].name + '</button>';
      }).join('') + '</div><p class="ed-note">It joins the one-metal rule: keep it in the metal of the watch, the buckle and any metal blazer buttons.</p>'
      : cur.twoTone ? '<div class="kind-row" role="radiogroup" aria-label="Toe cap and heel"><span class="kind-lab">Toe cap and heel</span>' + DR.SPEC2.map(function (c) {
        return '<button type="button" role="radio" class="kind spec2" data-hex2="' + c[1] + '" aria-checked="' + ((x.hex2 || '').toLowerCase() === c[1]) + '"><i class="d" style="background:' + c[1] + '"></i>' + c[0] + '</button>';
      }).join('') + '</div><p class="ed-note">The second colour of the spectator; the main colour, chosen below, is the rest of the upper.</p>' : '';
    // A woven shirt's collar (1.17): its style, its band, and a collar in another colour (contrast, Winchester)
    const cs = cur.collars ? G.collarOf(x) : null, cband = x.collarBand || 'standard', chex = G.contrastCollar(k, x);
    const collarRow = cs ? '<div class="kind-row" role="radiogroup" aria-label="Collar"><span class="kind-lab">Collar</span>' + G.COLLARS.map(function (c) {
        return '<button type="button" role="radio" class="kind collar-opt" data-collar="' + c.id + '" aria-checked="' + (c.id === x.collar) + '" title="' + esc(c.note) + '">' + c.name + '</button>';
      }).join('') + '</div><p class="ed-note">' + esc(x.collar && G.collarBy[x.collar] ? cs.note : 'Not chosen yet: read as a semi-spread. Choose the collar to have it judged against your face, the tie and the occasion.') + '</p>' +
      '<div class="kind-row" role="radiogroup" aria-label="Collar band"><span class="kind-lab">Band</span>' + G.COLLAR_BANDS.map(function (b) {
        return '<button type="button" role="radio" class="kind collar-band" data-cband="' + b.id + '" aria-checked="' + (b.id === cband) + '">' + b.name + '</button>';
      }).join('') + '</div>' +
      '<div class="kind-row" role="radiogroup" aria-label="Collar colour"><span class="kind-lab">Collar colour</span>' +
        '<button type="button" role="radio" class="kind collar-col" data-ccol="" aria-checked="' + !chex + '">The shirt\'s own</button>' +
        '<button type="button" role="radio" class="kind collar-col" data-ccol="#f7f6f2" aria-checked="' + (!!chex && chex.toLowerCase() === '#f7f6f2') + '"><i class="d" style="background:#f7f6f2"></i>White</button>' +
        '<input type="color" class="collar-any" value="' + (chex || '#f7f6f2') + '" aria-label="Any collar colour" title="Any colour">' + (chex && chex.toLowerCase() !== '#f7f6f2' ? ' <span class="small">' + esc(DR.api.nameOf(chex)) + '</span>' : '') +
      '</div><p class="ed-note">' + (chex ? 'A contrast (Winchester) collar: it meets the jacket at the neck, so the light-dark step at the face is read from it; the body still shows in the V. Business dress, less suited to casual wear.' : 'A band that stands taller frames the face more, which counts most without hair. A white collar on a coloured or striped body is a contrast (Winchester) collar.') + '</p>' : '';
    // A Cloth tab only when there is something to choose there: a fresh flower has no cloth and a
    // lapel pin is its metal, so neither gets one. A pin has no Colour list either: its metal row sets it.
    const hasCloth = p.cloth && !cur.metal && (!!cur.cloths || cur.pats.length > 1);
    ed.innerHTML = kindRow + cutRow + extraRow + collarRow + keepRow + (cur.metal ? '' : window.VCLOSETUI.editorRow(k, x)) + (hasCloth ? '<div class="seg ed-tabs" role="tablist"><button type="button" role="tab" data-t="colour" aria-selected="' + (DR.tab === 'colour') + '">Colour</button>' +
      '<button type="button" role="tab" data-t="cloth" aria-selected="' + (DR.tab === 'cloth') + '">' + (k === 'shoes' ? 'Upper' : DR.kindOf(k).pats.length > 1 ? 'Cloth and pattern' : 'Cloth') + '</button></div>' : '') +
      '<div class="ed-body"></div>';
    $$('.ed-tabs button', ed).forEach(function (b) { b.addEventListener('click', function () { DR.tab = b.dataset.t; renderEditor(ed, k, a); }); });
    $$('.kind:not(.cut):not(.btn-opt):not(.spec2):not(.pin-metal):not(.collar-opt):not(.collar-band):not(.collar-col)', ed).forEach(function (b) { b.addEventListener('click', function () { DR.setKind(k, b.dataset.kind); }); });
    $$('.btn-opt', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).buttons = b.dataset.btn; DR.commit('Buttons: ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.pin-metal', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).metal = b.dataset.metal; DR.piece(k).hex = G.metalBy[b.dataset.metal].hex; DR.commit('Lapel pin: ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.spec2', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).hex2 = b.dataset.hex2; DR.commit('Toe cap and heel: ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.cut', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k)[cut.key] = b.dataset.cut; DR.commit(cut.label + ': ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.collar-opt', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).collar = b.dataset.collar; DR.commit('Collar: ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.collar-band', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).collarBand = b.dataset.cband; DR.commit('Collar band: ' + b.textContent.toLowerCase() + '.'); }); });
    $$('.collar-col', ed).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); if (b.dataset.ccol) DR.piece(k).collarHex = b.dataset.ccol; else delete DR.piece(k).collarHex; DR.commit(b.dataset.ccol ? 'Collar: white, a contrast collar.' : 'Collar in the shirt\'s own colour.'); }); });
    const cany = $('.collar-any', ed); if (cany) cany.addEventListener('change', function () { DR.snapshot(); DR.piece(k).collarHex = cany.value; DR.commit('Collar colour: ' + DR.api.nameOf(cany.value) + '.'); });
    $('.ov-keep', ed).addEventListener('click', function () { DR.keepAndFix(k); });
    window.VCLOSETUI.wireEditor(ed, k);
    const body = $('.ed-body', ed);
    if (cur.metal) body.innerHTML = '';
    else if (DR.tab === 'cloth' && hasCloth) clothEditor(body, k, x, a); else colourEditor(body, k, x, a, p);
  }

  /* The optional positions not worn now, as one row of Add buttons. */
  // Add buttons name the position; the title lists the types to choose from once it is added.
  const ADD_NAME = { hat: 'Headwear', tie: 'Neckwear', scarf: 'Scarf', mid: 'Knit or waistcoat', jacket: 'Jacket', coat: 'Coat', square: 'Pocket square', boutonniere: 'Buttonhole', socks: 'Socks', gloves: 'Gloves' };
  function addBar() {
    const off = DR.PIECES.filter(function (p) { return p.optional && !DR.worn(p.key); });
    if (!off.length) return '';
    return '<div class="add-bar"><span class="add-lab">Add</span>' + off.map(function (p) {
      const why = DR.blockedWhy(p.key);
      return '<button type="button" class="add-btn" data-add="' + p.key + '"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="' + esc(p.kinds.map(function (t) { return t.name; }).join(', ')) + '"') + '><span aria-hidden="true">+</span> ' + (ADD_NAME[p.key] || p.position) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- My colours: read from photos of your own clothes ----------
     The colours themselves, the photos and the window that reads them are in js/ui/photos.js. Here
     they are shown for one piece, newest first, each with its tier and, like the library, marked when
     it would clash with the rest of the outfit; "From photos…" opens the window for this piece. */
  const MINE_SHOWN = 24;
  function mineHtml(k, x, a) {
    const list = DR.S().myColours || [];
    const fit = DR.S().fitMark !== false ? E.fitFor(DR.engineOutfit(), a, k) : null;
    const one = function (c) {
      const tier = E.scoreColour(c.hex, a).tier, j = fit ? fit.judge(c.hex, c.name) : null;
      return '<button type="button" class="swatch t' + tier + (c.hex === x.hex.toLowerCase() ? ' sel' : '') + (j && j.state !== 'ok' ? ' fit-' + j.state : '') + '" data-hex="' + c.hex + '" title="' + esc(c.name) + ': tier ' + tier + (c.paper ? '' : ', read without white paper') + (j && j.why ? '. ' + esc(j.why) : '') + '">' +
        '<span class="chip" style="background:' + c.hex + '">' + DR.tt(tier) + '</span><span class="sname">' + esc(c.name) + '</span></button>';
    };
    return '<h4>My colours</h4>' +
      (list.length ? '<div class="swatches lib mine">' + list.slice(0, MINE_SHOWN).map(one).join('') + '</div>' +
        (list.length > MINE_SHOWN ? '<p class="small muted">The newest ' + MINE_SHOWN + ' of ' + list.length + '; all of them are in From photos.</p>' : '')
        : '<p class="ed-note">Colours read from photos of your own clothes, kept and named, so every piece can wear them again.</p>') +
      '<button type="button" class="btn small ghost mine-open">From photos…</button>';
  }
  function openPhotos(k) {
    const pat = VP.norm(DR.piece(k).pat);
    window.VPHOTOS.open({
      piece: DR.kindOf(k).name, patterned: pat.type !== 'solid',
      fit: function (hex) { return DR.fitLine(k, hex); },
      wear: function (hex) { setColour(k, hex); },
      second: function (hex) { DR.snapshot(); DR.piece(k).pat = Object.assign({}, pat, { hex2: hex }); DR.commit(DR.kindOf(k).name + ': second colour from a photo.'); }
    });
  }
  function mineWire(body, k) {
    const b = $('.mine-open', body); if (!b) return;
    b.addEventListener('click', function () { openPhotos(k); });
  }

  function previewOn(el, k, getter) {
    el.addEventListener('pointerenter', function () { DR.api.preview(k, getter()); });
    el.addEventListener('pointerleave', function () { DR.api.preview(null); });
    el.addEventListener('focus', function () { DR.api.preview(k, getter()); });
    el.addEventListener('blur', function () { DR.api.preview(null); });
  }
  function setColour(k, hex) {
    DR.snapshot(); DR.piece(k).hex = hex; DR.api.preview(null);
    DR.commit(DR.kindOf(k).name + ' set to ' + DR.api.nameOf(hex) + '.');
  }

  let custTimer = 0;
  function colourEditor(body, k, x, a, p) {
    // Suggestions carry the same judgement as the library: one that would clash is not offered,
    // one that would bend a rule shows the "!" and the reason instead of a reason to wear it.
    const fitS = E.fitFor(DR.engineOutfit(), a, k);
    const sug = E.suggest(DR.engineOutfit(), a, k, 14).map(function (q) { return Object.assign(q, { j: fitS.judge(q.hex, q.name) }); })
      .filter(function (q) { return q.j.state !== 'out'; }).slice(0, 8);
    // What still works in this place, given the other pieces (suggest.js, fitFor).
    const fit = DR.S().fitMark !== false ? E.fitFor(DR.engineOutfit(), a, k) : null;
    const sw = function (hex, name, tier, extra) {
      const j = fit && fit.byHex[hex.toLowerCase()];
      return '<button type="button" class="swatch t' + tier + (hex.toLowerCase() === x.hex.toLowerCase() ? ' sel' : '') + (j && j.state !== 'ok' ? ' fit-' + j.state : '') + '" data-hex="' + hex + '" title="' + esc(name) + ': tier ' + tier + (j && j.why ? '. ' + esc(j.why) : '') + '">' +
        '<span class="chip" style="background:' + hex + '">' + DR.tt(tier) + '</span><span class="sname">' + esc(name) + '</span>' + (extra || '') + '</button>';
    };
    const lib = D.colours.map(function (c) { return { hex: c.hex, name: c.name, family: c.family, tier: E.scoreColour(c.hex, a).tier }; })
      .filter(function (c) {
        if (DR.filter.fam !== 'all' && c.family !== DR.filter.fam) return false;
        if (DR.filter.q && c.name.toLowerCase().indexOf(DR.filter.q.toLowerCase()) < 0) return false;
        if (p.face && DR.filter.faceOnly && c.tier > 2) return false;
        return true;
      });
    const ok = VC.rgbToOklch(VC.hexToRgb(x.hex));
    body.innerHTML =
      window.VAPP.say('<h4>Suggested for this outfit</h4><p class="ed-note">The best colours for this piece, given everything else you are wearing; colours that would clash are left out, and "!" marks one that bends a rule. Hover to see it on the chart; click to wear it.</p>', '<h4>Suggested for this outfit</h4><p class="ed-note">The best colours for this piece, given everything else you are wearing; colours that would clash are left out, and "!" marks one that bends a rule. Tap one to wear it; Undo takes it back.</p>') +
      '<div class="sug-row">' + sug.map(function (s) {
        const care = s.j.state === 'care';
        return '<button type="button" class="sug' + (care ? ' fit-care' : '') + '" data-hex="' + s.hex + '"' + (care ? ' title="' + esc(s.j.why) + '"' : '') + '><span class="d" style="background:' + s.hex + '"></span><span><strong>' + esc(s.name) + '</strong> ' + DR.tt(s.tier) +
          '<small>' + (care ? '<span class="fit-care-t">Careful:</span> ' + esc(DR.firstSentence(s.j.why)) : esc(s.why)) + '</small></span></button>';
      }).join('') + '</div>' +
      mineHtml(k, x, a) +
      '<h4>All colours</h4>' +
      '<div class="lib-bar"><input type="search" class="lib-q" placeholder="Search: navy, claret, anthracite…" value="' + esc(DR.filter.q) + '" aria-label="Search colours">' +
      '<div class="fam-chips">' + DR.FAMILIES.map(function (f) { return '<button type="button" data-fam="' + f[0] + '" aria-pressed="' + (DR.filter.fam === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (p.face ? '<label class="check small"><input type="checkbox" class="lib-face"' + (DR.filter.faceOnly ? ' checked' : '') + '> Only tiers 1 and 2 (this sits at the face)</label>' : '') +
      '<label class="check small"><input type="checkbox" class="lib-fit"' + (fit ? ' checked' : '') + '> Mark what clashes with the rest of the outfit</label>' +
      (fit ? '<p class="small muted lib-fitsum">' + fit.n.ok + ' of the ' + D.colours.length + ' colours work here. Struck through would break a rule, "!" would bend one; hover for the reason.</p>' : '') + '</div>' +
      '<div class="swatches lib">' + (lib.length ? lib.map(function (c) { return sw(c.hex, c.name, c.tier); }).join('') : '<p class="empty-tier">Nothing matches.</p>') + '</div>' +
      '<h4>Any colour</h4>' +
      '<div class="custom">' +
      '<span class="cust-prev" style="background:' + x.hex + '"></span>' +
      '<div class="cust-sliders">' +
      slider('L', 'Lightness', (ok[0] * 100).toFixed(1), 5, 98, 'darker', 'lighter') +
      slider('h', 'Hue', ok[2].toFixed(0), 0, 360, 'red · yellow · green', 'blue · violet') +
      slider('C', 'Strength', (ok[1] * 100).toFixed(1), 0, 30, 'greyer', 'more vivid') + '</div>' +
      '<div class="cust-out"><input type="text" class="cust-hex" value="' + x.hex + '" maxlength="7" spellcheck="false" aria-label="Hex colour"><span class="cust-tier"></span>' +
      '<button type="button" class="btn small cust-use">Wear this</button></div><p class="cust-fit"></p></div>';

    $$('.sug, .swatch', body).forEach(function (b) {
      previewOn(b, k, function () { return { hex: b.dataset.hex }; });
      b.addEventListener('click', function () { setColour(k, b.dataset.hex); });
    });
    mineWire(body, k);
    const q = $('.lib-q', body);
    q.addEventListener('input', function () { DR.filter.q = q.value; colourEditor(body, k, x, a, p); const n = $('.lib-q', body); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    $$('[data-fam]', body).forEach(function (b) { b.addEventListener('click', function () { DR.filter.fam = b.dataset.fam; colourEditor(body, k, x, a, p); }); });
    const fo = $('.lib-face', body);
    if (fo) fo.addEventListener('change', function () { DR.filter.faceOnly = fo.checked; colourEditor(body, k, x, a, p); });
    $('.lib-fit', body).addEventListener('change', function (e) { DR.S().fitMark = e.target.checked; DR.api.save(); colourEditor(body, k, x, a, p); });

    // custom colour from OKLCH sliders, with a live verdict and live preview
    let cur = x.hex;
    const show = function (hex, fromHex) {
      cur = hex;
      $('.cust-prev', body).style.background = hex;
      if (!fromHex) $('.cust-hex', body).value = hex;
      const t = E.scoreColour(hex, a).tier;
      $('.cust-tier', body).innerHTML = DR.tt(t);
      clearTimeout(custTimer); custTimer = setTimeout(function () { const f = $('.cust-fit', body); if (f) f.innerHTML = DR.fitLine(k, hex); }, 120);
      DR.api.preview(k, { hex: hex });
    };
    const fromSliders = function () {
      const v = {}; $$('.cust-sliders input', body).forEach(function (i) { v[i.dataset.ax] = parseFloat(i.value); });
      let C = v.C / 100, rgb = null;
      while (C >= 0 && !(rgb = VC.oklchToRgb([v.L / 100, C, v.h]))) C -= 0.004;   // stay inside what the screen can show
      show(VC.rgbToHex(rgb || [128, 128, 128]));
    };
    $$('.cust-sliders input', body).forEach(function (i) { i.addEventListener('input', fromSliders); });
    $('.cust-hex', body).addEventListener('input', function (e) { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) show(v[0] === '#' ? v.toLowerCase() : '#' + v.toLowerCase(), true); });
    $('.cust-use', body).addEventListener('click', function () { setColour(k, cur); });
    show(x.hex); DR.api.preview(null);
  }
  function slider(ax, label, v, lo, hi, l, r) {
    return '<label class="s-slider"><span>' + label + '</span><input type="range" data-ax="' + ax + '" min="' + lo + '" max="' + hi + '" step="0.5" value="' + v + '">' +
      '<span class="ends"><span>' + l + '</span><span>' + r + '</span></span></label>';
  }

  /* Scale slider on a log axis, 0.15 to 20 cm. */
  const toPos = function (cm) { return Math.log(cm / 0.15) / Math.log(20 / 0.15) * 100; };
  const toCm = function (pos) { return Math.round(0.15 * Math.pow(20 / 0.15, pos / 100) * 20) / 20; };

  /* The cloth a piece is made of: it sets formality, season and sheen (garments.js). */
  const FWORD = ['sportswear', 'casual', 'relaxed', 'smart casual', 'smart', 'business'];
  function clothHtml(k, x) {
    const kd = DR.kindOf(k); if (!kd.cloths) return '';
    const cur = G.cloth(k, x);
    // the tags say what this piece would be in that cloth, its knit and broguing included (G.cloth, G.formality)
    const as = function (id) { return Object.assign({}, x, { cloth: id }); };
    return (k === 'shoes' ? '<h4>Upper</h4><p class="ed-note">The leather of the upper sets how formal the shoe is and whether it shines.</p>'
      : '<h4>Cloth</h4><p class="ed-note">What it is made of sets how formal it is, which season it belongs to, and whether it shines.</p>') + '<div class="cloth-grid">' +
      kd.cloths.map(function (id) {
        const c = G.cloth(k, as(id)), f = kd.f == null ? null : G.formality(k, as(id));
        return '<button type="button" class="cloth' + (cur.id === id ? ' sel' : '') + '" data-cloth="' + id + '" aria-pressed="' + (cur.id === id) + '">' +
          '<span class="cl-name">' + esc(c.name.replace(/ \(shiny\)$/, '')) + '</span><span class="cl-tags">' +
          (f != null ? '<span>' + FWORD[Math.max(0, f)] + '</span>' : '') + '<span>' + (c.season === 'all' ? 'all year' : c.season) + '</span>' + (c.sheen === 2 ? '<span class="cl-shiny">shiny</span>' : '') + '</span></button>';
      }).join('') + '</div>' + makeHtml(k, x);
  }
  /* How a knit is knitted, and whether a shoe is brogued (1.19): apart from the yarn and the leather,
     because a chunky cable can be lambswool and a brogue can be an oxford (garments.js, KNITS, BROGUES). */
  function makeHtml(k, x) {
    const kd = DR.kindOf(k);
    if (kd.knit) {
      const cur = G.knitBy[x.knit] ? x.knit : 'fine';
      return '<h4>Knit</h4><div class="seg" role="radiogroup" aria-label="Knit">' + G.KNITS.map(function (n) { return '<button type="button" role="radio" data-knit="' + n.id + '" aria-checked="' + (n.id === cur) + '">' + esc(n.name) + '</button>'; }).join('') + '</div>' +
        '<p class="ed-note">' + esc(G.knitBy[cur].note) + '</p>';
    }
    if (kd.brogue) {
      const cur = x.brogue === 'brogue' ? 'brogue' : 'plain';
      return '<h4>Toe</h4><div class="seg" role="radiogroup" aria-label="Broguing">' + G.BROGUES.map(function (n) { return '<button type="button" role="radio" data-brogue="' + n.id + '" aria-checked="' + (n.id === cur) + '">' + esc(n.name) + '</button>'; }).join('') + '</div>' +
        '<p class="ed-note">Broguing (punched holes, a wing tip) is decoration on an oxford or a derby, and makes it a step less formal than the same shoe plain (Flusser, Dressing the Man, p. 198).</p>';
    }
    return '';
  }
  /* A brimmed hat's band colour and brim width. */
  function hatHtml(k, x) {
    if (k !== 'hat' || !DR.kindOf(k).brim) return '';
    const band = x.band || '', brim = x.brim || 'medium';
    return '<div class="hat-extra"><h4>Band</h4><p class="ed-note">The ribbon (grosgrain) round the crown sits at the face, so its colour counts there. A darker band than the hat gives it a line.</p>' +
      '<div class="band-row">' + G.BANDS.map(function (h) { return '<button type="button" class="band' + (h.toLowerCase() === band.toLowerCase() ? ' sel' : '') + '" data-band="' + h + '" title="' + esc(DR.api.nameOf(h)) + '" aria-label="' + esc(DR.api.nameOf(h)) + ' band" style="background:' + h + '"></button>'; }).join('') +
      '<input type="color" class="band-any" value="' + (band || '#1d2a44') + '" aria-label="Any band colour" title="Any colour">' + (band ? ' <span class="small">' + esc(DR.api.nameOf(band)) + '</span>' : ' <span class="small muted">no band chosen</span>') + '</div>' +
      '<h4>Brim</h4><div class="seg" role="radiogroup" aria-label="Brim width">' + G.BRIMS.map(function (b) { return '<button type="button" role="radio" data-brim="' + b.id + '" aria-checked="' + (b.id === brim) + '" title="' + b.cm + '">' + b.name + '</button>'; }).join('') + '</div>' +
      '<p class="ed-note">Narrow ' + G.BRIMS[0].cm + ', medium ' + G.BRIMS[1].cm + ', wide ' + G.BRIMS[2].cm + ' at the side. The brim should follow your frame.</p></div>';
  }
  function wireHat(body, k) {
    $$('[data-band]', body).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).band = b.dataset.band; DR.commit('Hat band: ' + DR.api.nameOf(b.dataset.band) + '.'); }); });
    const any = $('.band-any', body); if (any) any.addEventListener('change', function () { DR.snapshot(); DR.piece(k).band = any.value; DR.commit('Hat band: ' + DR.api.nameOf(any.value) + '.'); });
    $$('[data-brim]', body).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).brim = b.dataset.brim; DR.commit('Brim: ' + b.dataset.brim + '.'); }); });
  }
  function wireCloth(body, k) {
    $$('.cloth', body).forEach(function (b) {
      b.addEventListener('click', function () { DR.snapshot(); DR.piece(k).cloth = b.dataset.cloth; DR.commit(DR.kindOf(k).name + ' in ' + G.cloth(k, DR.piece(k)).name.toLowerCase() + '.'); });
    });
    $$('[data-knit]', body).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); if (b.dataset.knit === 'fine') delete DR.piece(k).knit; else DR.piece(k).knit = b.dataset.knit; DR.commit(DR.kindOf(k).name + ': ' + G.knitBy[b.dataset.knit].name.toLowerCase() + '.'); }); });
    $$('[data-brogue]', body).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); if (b.dataset.brogue === 'plain') delete DR.piece(k).brogue; else DR.piece(k).brogue = 'brogue'; DR.commit(DR.kindOf(k).name + (b.dataset.brogue === 'brogue' ? ', brogued.' : ', plain.')); }); });
  }
  /* A pattern's second colour (1.19.1). Before, a row of unnamed squares and the system colour
     picker: the names were only in hover titles, which a phone never shows, and the library and My
     colours were out of reach. Now each colour is named, with its tier, like the Colour tab; the
     colours already in the outfit come first, and "More colours" holds the rest. */
  // patterns usually made in more than two colours: the editor says how to choose the second (How it works, Tartan)
  const MULTI_PATS = ['tartan', 'glen', 'tattersall', 'repp', 'paisley', 'foulard'];
  function secSwatch(hex, name, hex2, a) {
    const tier = E.scoreColour(hex, a).tier;
    return '<button type="button" class="swatch sec-pick t' + tier + (hex.toLowerCase() === hex2.toLowerCase() ? ' sel' : '') + '" data-hex="' + hex + '" aria-pressed="' + (hex.toLowerCase() === hex2.toLowerCase()) + '" title="' + esc(name) + ': tier ' + tier + '">' +
      '<span class="chip" style="background:' + hex + '">' + DR.tt(tier) + '</span><span class="sname">' + esc(name) + '</span></button>';
  }
  function secLibHtml(x, hex2, a) {
    const lib = D.colours.filter(function (c) {
      if (c.hex.toLowerCase() === x.hex.toLowerCase()) return false;       // the ground itself makes no pattern
      if (DR.secFilter.fam !== 'all' && c.family !== DR.secFilter.fam) return false;
      return !DR.secFilter.q || c.name.toLowerCase().indexOf(DR.secFilter.q.toLowerCase()) >= 0;
    });
    return lib.length ? lib.map(function (c) { return secSwatch(c.hex, c.name, hex2, a); }).join('') : '<p class="empty-tier">Nothing matches.</p>';
  }
  function secondHtml(x, hex2, quick, a) {
    const mine = (DR.S().myColours || []).filter(function (c) { return c.hex.toLowerCase() !== x.hex.toLowerCase(); }).slice(0, MINE_SHOWN);
    return '<h4>Second colour: <span class="sec-now">' + esc(DR.api.nameOf(hex2)) + '</span></h4>' +
      '<p class="ed-note">Colours already in the outfit come first, then neutrals: patterns that share a colour hold together.</p>' +
      // patterns usually woven or printed in more than two colours (How it works, Tartan)
      (MULTI_PATS.indexOf(VP.norm(x.pat).type) >= 0 ? '<p class="ed-note sec-multi">If yours has more colours, choose the one that shows most against the ground. If two show about equally, try each: when the verdict holds both ways, either will do; when it changes, the outfit depends on that colour, and the message that changes says why. Black, grey and white count as neutrals, so a tartan\'s black rarely changes anything.</p>' : '') +
      '<div class="swatches sec-quick">' + quick.map(function (h) { return secSwatch(h, DR.api.nameOf(h), hex2, a); }).join('') + '</div>' +
      '<details class="sec-more"' + (DR.secMore ? ' open' : '') + '><summary>More colours</summary>' +
        (mine.length ? '<p class="sec-sub">My colours</p><div class="swatches sec-mine">' + mine.map(function (c) { return secSwatch(c.hex, c.name, hex2, a); }).join('') + '</div>' : '') +
        '<p class="sec-sub">All colours</p>' +
        '<div class="lib-bar"><input type="search" class="sec-q" placeholder="Search: navy, claret, anthracite…" value="' + esc(DR.secFilter.q) + '" aria-label="Search second colours">' +
        '<div class="fam-chips">' + DR.FAMILIES.map(function (f) { return '<button type="button" data-secfam="' + f[0] + '" aria-pressed="' + (DR.secFilter.fam === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="swatches lib sec-lib">' + secLibHtml(x, hex2, a) + '</div>' +
        '<div class="sec-other"><label class="sec-any">Any colour <input type="color" class="acc-any" value="' + hex2 + '" aria-label="Any second colour"></label>' +
        '<button type="button" class="btn small ghost sec-photo">From a photo…</button></div>' +
      '</details>';
  }
  function clothEditor(body, k, x, a) {
    if (DR.kindOf(k).pats.length <= 1) { body.innerHTML = (clothHtml(k, x) || '<p class="ed-note">Worn plain.</p>') + hatHtml(k, x); wireCloth(body, k); wireHat(body, k); return; }
    const pat = VP.norm(x.pat), others = DR.engineOutfit();
    const accents = [];
    Object.keys(others).forEach(function (o) {
      if (o === k || !others[o] || typeof others[o] !== 'object' || !others[o].hex) return;
      accents.push(others[o].hex);
      const op = VP.norm(others[o].pat); if (op.type !== 'solid') accents.push(op.hex2);
    });
    DR.ACCENT_NEUTRALS.forEach(function (h) { accents.push(h); });
    const uniq = accents.filter(function (h, i) { return accents.findIndex(function (q) { return q.toLowerCase() === h.toLowerCase(); }) === i && h.toLowerCase() !== x.hex.toLowerCase(); }).slice(0, 12);
    // default second colour: one already in the outfit, at a moderate lightness step from the ground
    const L0 = VC.hexToLab(x.hex)[0], target = Math.min(35, (a.contrast * 1.5 + 15) * 0.55);
    const byStep = uniq.slice().sort(function (p1, p2) { return Math.abs(Math.abs(VC.hexToLab(p1)[0] - L0) - target) - Math.abs(Math.abs(VC.hexToLab(p2)[0] - L0) - target); });
    const hex2 = pat.type === 'solid' ? (byStep[0] || '#f7f6f2') : pat.hex2;
    const cls = pat.type === 'solid' ? null : VP.scaleClass(pat.scale);
    body.innerHTML = clothHtml(k, x) +
      '<h4>Pattern</h4><p class="ed-note">The patterns the guide uses on a ' + DR.lname(k) + ', up to ' + DR.kindOf(k).maxScale + ' scale. Typical use under each' +
        (function () { const cl = G.cloth(k, x); const n = cl ? DR.kindOf(k).pats.filter(function (t) { return !G.patOK(cl.id, t); }).length : 0;
          return n ? '; greyed out: not made in ' + esc(DR.clothWord(cl)) + '. Choose another cloth above for those.' : '.'; })() + '</p>' +
      '<div class="pat-grid">' + VP.TYPES.filter(function (t) { return DR.kindOf(k).pats.indexOf(t.id) >= 0; }).map(function (t) {
        const tp = { type: t.id, scale: t.scale, hex2: hex2 }, cl = G.cloth(k, x), can = !cl || G.patOK(cl.id, t.id);
        return '<button type="button" class="pat' + (pat.type === t.id ? ' sel' : '') + (can ? '' : ' no-cloth') + '" data-type="' + t.id + '"' +
          (can ? '' : ' disabled title="Not made in ' + esc(DR.clothWord(cl)) + '"') + '>' +
          '<span class="pat-img" style="' + (t.id === 'solid' ? 'background:' + x.hex : 'background-image:url(' + VP.thumb(x.hex, tp, t.scale < 1 ? 10 : t.scale > 4 ? 46 : 18, t.scale > 4 ? 2 : 4) + ')') + '"></span>' +
          '<span class="pat-name">' + t.name + '</span><span class="pat-use">' + (can ? t.use : 'not made in ' + esc(DR.clothWord(cl))) + '</span></button>';
      }).join('') + '</div>' +
      (pat.type === 'solid' ? '' :
        '<h4>Scale</h4>' +
        '<label class="s-slider scale-slider"><span>Repeat</span><input type="range" class="pat-scale" min="' + toPos(VP.byId[pat.type].min || 0.15).toFixed(1) + '" max="' + toPos(VP.byId[pat.type].max || 20).toFixed(1) + '" step="0.5" value="' + toPos(pat.scale).toFixed(1) + '">' +
        '<span class="ends"><span>' + (VP.byId[pat.type].min || 0.15) + ' cm</span><span>' + (VP.byId[pat.type].max || 20) + ' cm</span></span></label>' +
        '<p class="ed-note">' + VP.byId[pat.type].name + ' is made from ' + (VP.byId[pat.type].min || 0.15) + ' to ' + (VP.byId[pat.type].max || 20) + ' cm a repeat.</p>' +
        '<p class="scale-read"><strong class="sc-cm">' + pat.scale + ' cm</strong> <span class="tierpill sc-cls">' + cls.label + '</span> <span class="sc-hand">' + cls.hand + '</span></p>' +
        secondHtml(x, hex2, uniq, a) +
        '<h4>How much of the cloth is the second colour</h4><p class="ed-note">Decides the colour the pattern adds up to from a distance. A dense foulard or a bold grid shows more of it than the drawing.</p>' +
        '<div class="seg cover-seg" role="radiogroup" aria-label="Share of the second colour">' + DR.COVER_STEPS.map(function (c) {
          const on = c.v == null ? pat.cover == null : pat.cover != null && Math.abs(pat.cover - c.v) < 0.005;
          return '<button type="button" role="radio" data-cover="' + (c.v == null ? '' : c.v) + '" aria-checked="' + on + '">' + (c.v == null ? 'As usually made (' + Math.round(VP.byId[pat.type].cover * 100) + '%)' : c.label) + '</button>';
        }).join('') + (pat.cover != null && !DR.COVER_STEPS.some(function (c) { return c.v != null && Math.abs(pat.cover - c.v) < 0.005; }) ? '<button type="button" role="radio" aria-checked="true" disabled>' + Math.round(pat.cover * 100) + '% (measured)</button>' : '') + '</div>' +
        '<h4>About life size</h4><div class="life"><canvas class="life-cv"></canvas><div class="ruler"></div><p class="ed-note">10 cm of cloth at screen scale (approximate: screens differ).</p></div>' +
        '<h4>From a distance <button type="button" class="info" data-info="distance" aria-label="What is this?">?</button></h4>' +
        '<p class="ed-note">The same patch of cloth (<span class="dist-cm"></span>), then what the eye can still see of it from each distance, enlarged.</p>' +
        '<div class="dist-row">' + /** @type {any[]} */ ([0]).concat(V().DISTANCES).map(function (d) {
          return '<figure class="dist" data-m="' + (d.m || 0) + '"><canvas></canvas><figcaption><strong>' + (d.m ? d.label : 'up close') + '</strong><span class="dist-state"></span><span class="dist-note">' + (d.m ? d.note : 'in your hand') + '</span></figcaption></figure>';
        }).join('') + '</div><p class="dist-why"></p><p class="dist-cam" hidden></p>');

    wireCloth(body, k);
    // a change of scale or second colour keeps the share; a new pattern type starts from its own default
    const keepCover = function (np) { if (pat.cover != null) np.cover = pat.cover; return np; };
    const apply = function (np, keep) {
      if (!keep) DR.snapshot();
      DR.piece(k).pat = np; DR.commit(DR.kindOf(k).name + ': ' + DR.patLabel(DR.piece(k)) + '.');
    };
    $$('.pat', body).forEach(function (b) {
      if (b.disabled) return;                       // not made in this cloth: no preview, no choice
      const t = VP.byId[b.dataset.type];
      const np = function () { return t.id === 'solid' ? { type: 'solid' } : { type: t.id, scale: pat.type === t.id ? pat.scale : t.scale, hex2: hex2 }; };
      previewOn(b, k, function () { return { hex: x.hex, pat: np() }; });
      b.addEventListener('click', function () { DR.api.preview(null); apply(np()); });
    });
    if (pat.type === 'solid') return;
    const sc = $('.pat-scale', body);
    sc.addEventListener('input', function () {
      const cm = toCm(+sc.value), c = VP.scaleClass(cm);
      $('.sc-cm', body).textContent = cm + ' cm'; $('.sc-cls', body).textContent = c.label; $('.sc-hand', body).textContent = c.hand;
      DR.api.preview(k, { hex: x.hex, pat: { type: pat.type, scale: cm, hex2: hex2 } });
      drawLife(body, x.hex, { type: pat.type, scale: cm, hex2: hex2 });
      drawDistance(body, x.hex, { type: pat.type, scale: cm, hex2: hex2 });
    });
    sc.addEventListener('change', function () { DR.api.preview(null); apply(keepCover({ type: pat.type, scale: toCm(+sc.value), hex2: hex2 })); });
    // the second colour: named picks, and More colours (My colours, the library, a photo, any colour)
    const wireSec = function (root) {
      $$('.sec-pick', root).forEach(function (b) {
        previewOn(b, k, function () { return { hex: x.hex, pat: { type: pat.type, scale: pat.scale, hex2: b.dataset.hex } }; });
        b.addEventListener('click', function () { DR.api.preview(null); apply(keepCover({ type: pat.type, scale: pat.scale, hex2: b.dataset.hex })); });
      });
    };
    wireSec(body);
    const more = $('.sec-more', body);
    more.addEventListener('toggle', function () { DR.secMore = more.open; });
    const paintLib = function () { const box = $('.sec-lib', body); box.innerHTML = secLibHtml(x, hex2, a); wireSec(box); };
    $('.sec-q', body).addEventListener('input', function (e) { DR.secFilter.q = e.target.value; paintLib(); });
    $$('[data-secfam]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        DR.secFilter.fam = b.dataset.secfam;
        $$('[data-secfam]', body).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        paintLib();
      });
    });
    $('.sec-photo', body).addEventListener('click', function () { openPhotos(k); });
    const any = $('.acc-any', body);
    any.addEventListener('input', function () { const np = { type: pat.type, scale: pat.scale, hex2: any.value }; DR.api.preview(k, { hex: x.hex, pat: np }); drawLife(body, x.hex, np); drawDistance(body, x.hex, np); });
    any.addEventListener('change', function () { DR.api.preview(null); apply(keepCover({ type: pat.type, scale: pat.scale, hex2: any.value })); });
    $$('.cover-seg [data-cover]', body).forEach(function (b) {
      if (b.disabled) return;
      b.addEventListener('click', function () {
        const np = { type: pat.type, scale: pat.scale, hex2: hex2 };
        if (b.dataset.cover !== '') np.cover = +b.dataset.cover;
        apply(np);
      });
    });
    drawLife(body, x.hex, pat);
    drawDistance(body, x.hex, pat);
  }
  function drawLife(body, hex, pat) {
    const cv = $('.life-cv', body); if (!cv) return;
    const w = Math.min(cv.parentNode.clientWidth || 380, Math.round(10 * DR.PX_PER_CM)), h = Math.round(4 * DR.PX_PER_CM), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d'), rep = Math.max(2, pat.scale * DR.PX_PER_CM * dpr);
    const t = VP.tile(hex, pat, Math.max(8, Math.round(rep)));
    c.fillStyle = c.createPattern(t, 'repeat'); c.fillRect(0, 0, cv.width, cv.height);
    $('.ruler', body).style.width = w + 'px';
  }

  /* ---------- From a distance: the same patch, as the eye still sees it (patterns.js) ---------- */
  const V = function () { return window.VVIS; };
  const STATE_WORD = { pattern: 'pattern', texture: 'texture', plain: 'plain' };
  function arcmin(deg) { const a = deg * 60; return a < 10 ? (Math.round(a * 10) / 10) + '′' : Math.round(a) + '′'; }
  function distanceWhy(hex, pat) {
    const r = V().DISTANCES.map(function (d) { return VP.reads(hex, pat, d.m); }), at3 = r[1];
    const dE = VC.deltaE2000(VC.hexToLab(hex), VC.hexToLab(pat.hex2));
    const states = r.map(function (x, i) { return x.state + ' ' + V().DISTANCES[i].label; });
    let s = '<strong>' + states[0].charAt(0).toUpperCase() + states[0].slice(1) + ', ' + states[1] + ', ' + states[2] + '.</strong> ';
    if (at3.state === 'pattern') s += 'Across a room it still reads as a pattern: the repeat spans ' + arcmin(at3.repeatDeg) + ' of arc, large enough to make out shapes. It counts towards the two-pattern limit at the face.';
    else if (at3.state === 'texture' && at3.why === 'fine') s += 'Across a room only a fine grain is left: one repeat spans ' + arcmin(at3.repeatDeg) + ' of arc, and detail that small is seen as grain, not shapes. It counts as texture.';
    else if (at3.state === 'texture') s += 'Across a room it is still there, but faint (about ' + Math.round(at3.contrast * 100) + '% contrast). It counts as texture.';
    else if (at3.why === 'fine') s += 'From 3 m the detail is finer than the eye can resolve at this contrast, so the cloth reads as plain.';
    else s += 'From 3 m there is too little light-dark difference to see it, so the cloth reads as plain.';
    if (dE < 12 && at3.state === 'pattern') s += ' Its two colours are close (tonal, ΔE ' + Math.round(dE) + '), so Valet counts it as texture anyway, as the Style Guide does.';
    if (r.some(function (x) { return x.colourOnly; })) s += ' At some distances only the colour difference shows, not light against dark; colour detail is the first to go.';
    return s;
  }
  function drawDistance(body, hex, pat) {
    const row = $('.dist-row', body); if (!row) return;
    pat = VP.norm(pat);
    const W = Math.max(2, Math.min(40, pat.scale * 6)), dpr = Math.min(window.devicePixelRatio || 1, 2);
    $('.dist-cm', body).textContent = (W < 10 ? Math.round(W * 10) / 10 : Math.round(W)) + ' cm across';
    $$('.dist', row).forEach(function (fig) {
      const m = +fig.dataset.m, cv = $('canvas', fig), px = Math.round((cv.clientWidth || 96) * dpr);
      cv.width = cv.height = px;
      const R = 64, t = VP.seenTile(hex, pat, m, R), c = cv.getContext('2d'), fill = c.createPattern(t, 'repeat');
      const k = px * pat.scale / W / R;
      if (fill.setTransform) fill.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
      c.imageSmoothingEnabled = true; c.fillStyle = fill; c.fillRect(0, 0, px, px);
      const st = $('.dist-state', fig);
      if (m) { const r = VP.reads(hex, pat, m); st.textContent = STATE_WORD[r.state]; st.className = 'dist-state ' + r.state; }
      else { st.textContent = ''; st.className = 'dist-state'; }
    });
    $('.dist-why', body).innerHTML = distanceWhy(hex, pat);
    const cam = VP.camera(hex, pat), ce = $('.dist-cam', body);
    ce.hidden = !cam;
    if (cam) ce.innerHTML = '<strong>On a video call</strong> this may shimmer or show false stripes. It has strong detail about ' + (Math.round(cam.periodMm * 10) / 10) + ' mm across, under four pixels of a typical 720p webcam picture of your head and shoulders.';
  }
  Object.assign(DR, { ADD_NAME: ADD_NAME, previewOn: previewOn, renderEditor: renderEditor });
})();
