/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser, part 4 of 5: accessories (watch, glasses, belt buckle, cufflinks, tie bar, ring),
   drawn in the rows of the body. Shares the Dresser's helpers and state through window.VDRCORE (js/ui/dresser.js). */
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


  /* ---------- Accessories ---------- */
  /* Accessories in the body-level rows (renderPieces makes a place under each row's pieces): a
     compact tile for one that is worn, opening to its controls; a dashed slot for one that is not,
     with the reason when it cannot be added. Anything a later version adds without a level goes to
     the row of the hands. */
  let openAcc = null;
  const ACC_ZONE = {}; DR.ZONES.forEach(function (z) { (z.acc || []).forEach(function (k) { ACC_ZONE[k] = z.id; }); });
  function accSummary(d, x) {
    if (d.glasses) return glassesWord(x).replace(/^Glasses: /, '');
    if (d.plain) return 'worn';
    const parts = [G.metalBy[x.metal] ? G.metalBy[x.metal].name.toLowerCase() : ''];
    if (d.stone && x.stone && x.stone !== 'none' && G.stoneBy[x.stone]) parts.push(G.stoneBy[x.stone].name.toLowerCase());
    if (d.size && x.size) parts.push(x.size + ' mm');
    if (d.watch) { const t = (G.STRAPS || []).find(function (q) { return q.id === x.strap; }); if (t) parts.push(t.name.toLowerCase()); if (x.display === 'digital') parts.push('digital'); }
    return parts.filter(Boolean).join(', ');
  }
  function renderAcc() {
    const host = $('#ovPieces'); if (!host) return;
    const box = host;
    const acc = DR.S().outfit.acc, wrist = +(DR.S().measurements && DR.S().measurements.wrist) || null;
    const accBlocked = function (d) { return (d.needs === 'tie' && !(DR.worn('tie') && DR.kindOf('tie').id === 'tie')) ? 'Needs a tie.' : (d.needs === 'cuffs' && !DR.kindOf('shirt').tieable) ? 'Needs a shirt with cuffs.' : ''; };
    const offs = G.ACCESSORIES.filter(function (d) { return !acc[d.key].on; });
    const a = DR.api.analysis(), accChecks = a ? E.checkOutfit(DR.engineOutfit(), a).filter(function (c) { return c.group === 'accessory' && c.score < 0.85; }) : [];
    const html = {};
    G.ACCESSORIES.forEach(function (d) {
      const z = ACC_ZONE[d.key] || 'hands';
      html[z] = html[z] || '';
      if (!acc[d.key].on) {
        const why = accBlocked(d);
        html[z] += '<button type="button" class="add-btn slot-add" data-acc="' + d.key + '"' + (why ? ' disabled aria-describedby="whya-' + d.key + '"' : '') + '><span class="slot-plus" aria-hidden="true">+</span><span class="slot-name">' + d.name + '</span>' +
          (why ? '<span class="slot-why" id="whya-' + d.key + '">' + esc(why) + '</span>' : '') + '</button>';
        return;
      }
      if (openAcc !== d.key) {
        const mine = accChecks.filter(function (c) { return c.acc === d.key; }).sort(function (p1, p2) { return p1.score - p2.score; })[0];
        const st = mine ? (mine.score < 0.5 ? 'out' : 'care') : null;
        html[z] += '<div class="acc-tile' + (st ? ' st-' + st : '') + '" data-a="' + d.key + '"><button type="button" class="acc-pick" aria-expanded="false"><strong>' + d.name + '</strong><span class="g-colour">' + esc(accSummary(d, acc[d.key])) + '</span>' +
          (st ? '<span class="acc-flag">' + (st === 'out' ? '✕' : '!') + ' ' + esc(mine.text.split('. ')[0].slice(0, 70)) + '</span>' : '') + '</button>' +
          '<button type="button" class="btn ghost small acc-rm">Take off</button></div>';
        return;
      }
      html[z] += itemHtml(d);
    });
    $$('[data-acc-zone]', host).forEach(function (el) { el.innerHTML = html[el.dataset.accZone] || ''; });
    function itemHtml(d) {
      const mine = accChecks.filter(function (c) { return c.acc === d.key; }).sort(function (p1, p2) { return p1.score - p2.score; })[0];
      const st = mine ? { state: mine.score < 0.5 ? 'out' : 'care', why: mine.text } : null;
      const x = acc[d.key], on = !!x.on, blocked = (d.needs === 'tie' && !(DR.worn('tie') && DR.kindOf('tie').id === 'tie')) ? 'Needs a tie.' : (d.needs === 'cuffs' && !DR.kindOf('shirt').tieable) ? 'Needs a shirt with cuffs.' : '';
      const hint = d.key === 'watch' ? (wrist ? 'suits ' + E.watchRange(wrist).join('–') + ' mm for your wrist' : 'classic 36–40 mm') :
        { cufflinks: 'classic 12–18 mm', tiebar: 'about ¾ of the tie: up to 60 mm on an 8 cm tie', ring: 'classic up to 15 mm' }[d.key];
      return '<div class="acc-item acc-open' + (on ? '' : ' off') + (st ? ' st-' + st.state : '') + '" data-a="' + d.key + '">' +
        '<div class="acc-head"><button type="button" class="acc-pick" aria-expanded="true"><strong>' + d.name + '</strong></button>' + DR.statusLine(st) + '<button type="button" class="btn ghost small acc-rm">Take off</button></div>' +
        (blocked ? '<span class="ed-note fit-care-t">' + blocked + '</span>' : '') +
        (on && d.plain ? (d.note ? '<p class="ed-note">' + esc(d.note) + '</p>' : '') :
         on && d.glasses ? glassesHtml(x) + (d.note ? '<p class="ed-note">' + esc(d.note) + '</p>' : '') :
         on ? '<span class="acc-fields">' +
          '<label>Metal <select class="acc-metal">' + d.metals.map(function (m) { return '<option value="' + m + '"' + (x.metal === m ? ' selected' : '') + '>' + G.metalBy[m].name + '</option>'; }).join('') + '</select></label>' +
          (d.stone ? '<label>Stone <select class="acc-stone">' + G.STONES.map(function (st) { return '<option value="' + st.id + '"' + (x.stone === st.id ? ' selected' : '') + '>' + st.name + '</option>'; }).join('') + '</select></label>' : '') +
          (d.size ? '<label>' + d.size.label + ' <input type="number" class="acc-size" min="' + d.size.min + '" max="' + d.size.max + '" step="1" value="' + (x.size || '') + '"> mm</label><span class="ed-note">' + hint + '</span>' : '') +
          '</span>' + (d.watch ? watchHtml(x) : '') + (d.note ? '<p class="ed-note">' + esc(d.note) + '</p>' : '') : '') +
        '</div>';
    }

    $$('[data-acc]', box).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); acc[b.dataset.acc].on = true; openAcc = b.dataset.acc; DR.commit(''); }); });
    $$('.acc-tile, .acc-item', box).forEach(function (el) {
      const k = el.dataset.a;
      $('.acc-pick', el).addEventListener('click', function () { openAcc = openAcc === k ? null : k; renderAcc(); });
      $('.acc-rm', el).addEventListener('click', function () { DR.snapshot(); acc[k].on = false; if (openAcc === k) openAcc = null; DR.commit(''); });
    });
    $$('.acc-item', box).forEach(function (el) {
      const k = el.dataset.a, x = acc[k];
      const m = $('.acc-metal', el); if (m) m.addEventListener('change', function () { DR.snapshot(); x.metal = m.value; DR.commit(''); });
      const st = $('.acc-stone', el); if (st) st.addEventListener('change', function () { DR.snapshot(); x.stone = st.value; DR.commit(''); });
      const sz = $('.acc-size', el); if (sz) sz.addEventListener('change', function () { const v = +sz.value; if (v > 0) { DR.snapshot(); x.size = v; DR.commit(''); } });
      $$('[data-frame]', el).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); x.frame = b.dataset.frame; DR.commit('Glasses: ' + b.textContent.toLowerCase() + '.'); }); });
      $$('[data-frame-hex]', el).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); x.hex = b.dataset.frameHex; DR.commit('Frame colour: ' + b.textContent.toLowerCase() + '.'); }); });
      const gh = $('.gl-hex', el); if (gh) gh.addEventListener('change', function () { DR.snapshot(); x.hex = gh.value.toLowerCase(); DR.commit(''); });
      const strap = $('.acc-strap', el); if (strap) strap.addEventListener('change', function () { DR.snapshot(); x.strap = strap.value; DR.commit(''); });
      $$('[data-display]', el).forEach(function (b) { b.addEventListener('click', function () { DR.snapshot(); x.display = b.dataset.display; DR.commit(''); }); });
    });
  }

  /* Glasses in words, for the printed card and the wardrobe PDF. */
  function glassesWord(x) {
    const f = (G.FRAMES.find(function (q) { return q[0] === x.frame; }) || G.FRAMES[0])[1].toLowerCase();
    const c = x.frame === 'acetate' ? (G.FRAME_COLOURS.find(function (q) { return q[1] === (x.hex || '').toLowerCase(); }) || [DR.api.nameOf(x.hex || '#161616')])[0].toLowerCase() : '';
    return 'Glasses: ' + (x.frame === 'acetate' ? c + ' acetate' : f) + ' frames';
  }
  /* Glasses: the frame, and an acetate frame's colour (a typical one, or any). */
  function glassesHtml(x) {
    const fr = x.frame || 'gold', cur = (x.hex || '#161616').toLowerCase();
    return '<div class="seg gl-frame" role="radiogroup" aria-label="Frame">' + G.FRAMES.map(function (f) {
        return '<button type="button" role="radio" data-frame="' + f[0] + '" aria-checked="' + (fr === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      (fr === 'acetate' ? '<div class="gl-colour"><span class="w-lab">Frame colour</span><div class="chips w-chips">' + G.FRAME_COLOURS.map(function (c) {
        const sel = c[1] === cur;
        return '<button type="button" class="chip' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '" data-frame-hex="' + c[1] + '"><i class="d" style="background:' + c[1] + '"></i>' + c[0] + '</button>';
      }).join('') + '</div><label class="gl-any">Any colour <input type="color" class="gl-hex" value="' + cur + '"></label></div>' : '');
  }
  /* The watch beyond its case: the strap and the display, the two things that set its register
     (a rubber strap or a digital display is sportswear). Strap and dial colours are taste, not judged. */
  function watchHtml(x) {
    const strap = G.STRAPS.find(function (t) { return t.id === (x.strap || 'leather'); }) || G.STRAPS[1];
    return '<div class="w-more">' +
      '<label>Strap <select class="acc-strap">' + G.STRAPS.map(function (t) { return '<option value="' + t.id + '"' + (t.id === strap.id ? ' selected' : '') + '>' + t.name + '</option>'; }).join('') + '</select></label>' +
      '<div class="seg w-display" role="radiogroup" aria-label="Display"><button type="button" role="radio" data-display="analogue" aria-checked="' + (x.display !== 'digital') + '">Analogue</button><button type="button" role="radio" data-display="digital" aria-checked="' + (x.display === 'digital') + '">Digital</button></div>' +
      '<p class="ed-note">Mechanical or quartz cannot be seen, so it is not judged; a digital display or a rubber strap can be, as sportswear.</p></div>';
  }
  Object.assign(DR, { glassesWord: glassesWord, renderAcc: renderAcc });
})();
