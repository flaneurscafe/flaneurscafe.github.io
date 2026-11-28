/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser, part 5 of 5: the printed outfit card and the printed list of saved outfits,
   and window.VWARD, the Dresser's face to the rest of the page. Shares the Dresser's helpers and state
   through window.VDRCORE (js/ui/dresser.js). */
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


  /* ---------- The outfit card: one printed page, named, to keep or hand to a tailor ----------
     The browser's print dialogue saves it as a PDF; the page title becomes the file name, so it is
     set to the outfit's name while printing. Colour is only in the swatches and the chart; every
     colour carries its name, because printed colour drifts. */
  function buildCard() {
    const a = DR.api.analysis(); if (!a) return '';
    const o = DR.engineOutfit(), checks = E.checkOutfit(o, a), v = E.verdict(checks), hd = DR.headline(v, E.skinClashes(o, a));
    const name = (DR.S().outfit.name || '').trim(), stAll = DR.status();
    const occ = G.OCCASIONS.find(function (x) { return x.id === o.occasion; });
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = DR.PIECES.filter(function (p) { return o[p.key]; }).map(function (p) {
      const x = DR.piece(p.key), c = G.cloth(p.key, x), st = stAll[p.key];
      const t = E.scoreColour(VP.mean(x.hex, x.pat), a).tier;
      return '<tr><td class="oc-sw"><i style="' + DR.chipStyle(x) + '"></i></td>' +
        '<td><strong>' + esc(p.label) + '</strong>' + (p.kinds.length > 1 ? '<span class="oc-pos">' + esc(p.position) + '</span>' : '') + '</td>' +
        '<td>' + esc(DR.api.nameOf(x.hex) + pieceExtra(p.key, x)) + '</td><td>' + (c ? esc(c.name) : '') + '</td><td>' + esc(DR.patLabel(x)) + '</td>' +
        '<td class="oc-t">T' + t + '</td>' +
        '<td class="oc-st">' + (st && st.state !== 'ok' ? (st.state === 'out' ? '✕ ' : '! ') + esc(DR.firstSentence(st.why)) : '✓') + '</td></tr>';
    }).join('');
    const acc = DR.S().outfit.acc, accs = G.ACCESSORIES.filter(function (d) { return acc[d.key].on; }).map(function (d) {
      const x = acc[d.key], st = d.stone && x.stone && x.stone !== 'none' ? G.stoneBy[x.stone] : null;
      if (d.glasses) return esc(DR.glassesWord(x));
      if (d.plain) return esc(d.name);
      return esc(d.name) + ': ' + esc(G.metalBy[x.metal].name.toLowerCase()) + (st ? ', ' + esc(st.name.toLowerCase()) : '') + (d.size && x.size ? ', ' + x.size + ' mm' : '');
    });
    const secs = E.SECTIONS.map(function (sec) {
      const mine = checks.filter(function (c) { return E.sectionOf(c) === sec.id; }).sort(function (x, y) { return x.score - y.score; });
      if (!mine.length) return '';
      const worst = mine[0].score, mark = worst < 0.5 ? '✕' : worst < 0.85 ? '!' : '✓';
      const notes = mine.filter(function (c) { return c.score < 0.85; });
      return '<li class="' + (worst < 0.5 ? 'no' : worst < 0.85 ? 'meh' : 'ok') + '"><span class="oc-m">' + mark + '</span><span><strong>' + esc(sec.title.replace(/^\d\. /, '')) + '</strong>' +
        (notes.length ? notes.map(function (c) { return '<span class="oc-why">' + escs(c.text) + '</span>'; }).join('') : '') + '</span></li>';
    }).join('');
    const chart = $('#chartOutfit svg.chart-svg');
    return '<h1>' + esc(name || 'Outfit card') + '</h1>' +
      '<p class="pc-sub">' + esc(occ ? occ.name : '') + ', ' + DR.api.season() + '. ' + (DR.S().name ? 'For ' + esc(DR.S().name) + '. ' : '') + 'Valet, ' + date + '.</p>' +
      '<div class="oc-verdict ' + hd.level + '"><strong>' + esc(hd.title) + '.</strong> ' + esc(hd.text.replace(/ Fix the first one below; the others often follow\.| Apply its fix and this is a good outfit\./, '')) +
        ' <span class="oc-count">' + v.fails + ' fail' + (v.fails === 1 ? '' : 's') + ', ' + v.warns + ' to note</span></div>' +
      '<div class="oc-grid"><div>' +
      '<h2>Pieces, head to feet</h2><table class="oc-table"><thead><tr><th></th><th>Piece</th><th>Colour</th><th>Cloth</th><th>Pattern</th><th>Tier</th><th>With the rest</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (accs.length ? '<h2>Accessories</h2><p>' + accs.join('; ') + '.</p>' : '') +
      '</div>' + (chart ? '<div class="oc-chart chart-host">' + chart.outerHTML + '</div>' : '') + '</div>' +
      '<h2>The checks</h2><ul class="oc-checks">' + secs + '</ul>' +
      '<p class="pc-foot">T1 to T4: how each colour suits your face on its own (T1 anywhere, T2 the one deliberate colour, T3 below the belt, T4 away from the face). ✓ passes, ! worth knowing, ✕ fails. Printed colours are approximate: go by the names, and check cloth in daylight.</p>';
  }
  /* The whole wardrobe as one document, to print or save as PDF from the print dialog: grouped like
     the wardrobe view, one block per outfit (kept on one page), each with its verdict worked out now,
     its pieces, its accessories and the points to watch. */
  function wardrobeDoc() {
    const a = DR.api.analysis(), list = DR.wardrobe(); if (!a || !list.length) return '';
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    list.forEach(function (w) { w.season = DR.seasonOf(w.outfit); });   // from the cloths as the rules now read them, not as saved
    const order = O.seasonOrder(a && a.season);
    const block = function (w) {
      const aw = DR.analysisFor(w, a), o = DR.engineOutfit(w.outfit), checks = E.checkOutfit(o, aw), v = E.verdict(checks), hd = DR.headline(v, E.skinClashes(o, aw));
      const rows = DR.PIECES.filter(function (p) { return o[p.key]; }).map(function (p) {
        const x = w.outfit[p.key], kd = G.kind(p.key, x), c = G.cloth(p.key, x), t = E.scoreColour(VP.mean(x.hex, x.pat), aw).tier;
        const extra = pieceExtra(p.key, x);
        return '<tr><td class="oc-sw"><i style="' + DR.chipStyle(x) + '"></i></td><td><strong>' + esc(kd.name) + '</strong></td><td>' + esc(DR.api.nameOf(x.hex) + extra) + '</td><td>' + (c ? esc(c.name) : '') + '</td><td>' + esc(DR.patLabel(x)) + '</td><td class="oc-t">T' + t + '</td></tr>';
      }).join('');
      const acc = w.outfit.acc || {}, accs = G.ACCESSORIES.filter(function (d) { return acc[d.key] && acc[d.key].on; }).map(function (d) {
        const x = acc[d.key], st = d.stone && x.stone && x.stone !== 'none' ? G.stoneBy[x.stone] : null;
        const watch = d.watch ? ', ' + ((G.STRAPS.find(function (t) { return t.id === x.strap; }) || {}).name || '').toLowerCase() + (x.display === 'digital' ? ', digital' : '') : '';
        if (d.glasses) return esc(DR.glassesWord(x));
      if (d.plain) return esc(d.name);
      return esc(d.name) + ': ' + esc(G.metalBy[x.metal].name.toLowerCase()) + (st ? ', ' + esc(st.name.toLowerCase()) : '') + (d.size && x.size ? ', ' + x.size + ' mm' : '') + esc(watch);
      });
      const watch = checks.filter(function (c) { return c.score < 0.85; }).sort(function (x, y) { return x.score - y.score; }).slice(0, 4);
      return '<div class="wd-item"><h4>' + esc(w.name) + '</h4>' +
        '<div class="oc-verdict ' + hd.level + '"><strong>' + esc(hd.title) + '.</strong> <span class="oc-count">' + v.fails + ' fail' + (v.fails === 1 ? '' : 's') + ', ' + v.warns + ' to note</span></div>' +
        '<table class="oc-table"><thead><tr><th></th><th>Piece</th><th>Colour</th><th>Cloth</th><th>Pattern</th><th>Tier</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        (accs.length ? '<p class="wd-acc">' + accs.join('; ') + '.</p>' : '') +
        (watch.length ? '<ul class="wd-notes">' + watch.map(function (c) { return '<li>' + (c.score < 0.5 ? '✕ ' : '! ') + escs(DR.firstSentence(c.text)) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="wd-saved">Saved ' + esc(w.saved || '') + '.</p></div>';
    };
    const body = order.map(function (se) {
      const inS = list.filter(function (w) { return w.season === se[0]; }); if (!inS.length) return '';
      return '<h2>' + se[1] + '</h2>' + G.OCCASIONS.map(function (oc) {
        const items = inS.filter(function (w) { return (w.occasion || 'smart') === oc.id; }); if (!items.length) return '';
        return '<h3>' + esc(oc.name) + '</h3>' + items.map(block).join('');
      }).join('');
    }).join('');
    const counts = order.map(function (se) { const n = list.filter(function (w) { return w.season === se[0]; }).length; return n ? se[1] + ' ' + n : ''; }).filter(Boolean).join(', ');
    return '<h1>Saved outfits</h1><p class="pc-sub">' + (DR.S().name ? 'For ' + esc(DR.S().name) + '. ' : '') + list.length + ' outfit' + (list.length === 1 ? '' : 's') + ' (' + esc(counts) + '), grouped by season and occasion. Summer outfits are judged with your summer colouring, winter ones with your winter colouring, all-year ones with the ' + DR.api.season() + ' colouring in use now. Valet, ' + date + '.</p>' + body;
  }
  function printWardrobe() {
    const card = $('#printCard'); if (!card) return;
    card.innerHTML = wardrobeDoc(); card.classList.add('outfit', 'wardrobe-doc');
    const was = document.title;
    document.title = 'Valet saved outfits ' + new Date().toISOString().slice(0, 10);
    const back = function () { document.title = was; card.classList.remove('outfit', 'wardrobe-doc'); window.removeEventListener('afterprint', back); };
    window.addEventListener('afterprint', back);
    window.print();
  }

  /* What a piece's colour name leaves out: a spectator's second colour, a blazer's buttons. */
  function pieceExtra(k, x) {
    const kd = G.kind(k, x);
    if (kd.twoTone && x.hex2) return ' and ' + DR.spec2Name(x.hex2);
    if (kd.metal) return ' (' + G.metalBy[x.metal || 'silver'].name.toLowerCase() + ')';
    if (kd.buttons) return ', ' + (G.BUTTONS.find(function (b) { return b[0] === (x.buttons || 'silver'); }) || [0, ''])[1].toLowerCase() + ' buttons';
    return '';
  }
  function printCard() {
    const card = $('#printCard'); if (!card) return;
    card.innerHTML = buildCard(); card.classList.add('outfit');
    const was = document.title, name = (DR.S().outfit.name || '').trim();
    document.title = 'Valet outfit' + (name ? ' - ' + name : '');
    const back = function () { document.title = was; card.classList.remove('outfit'); window.removeEventListener('afterprint', back); };
    window.addEventListener('afterprint', back);
    window.print();
  }

  window.VWARD = { wardrobeDoc: wardrobeDoc, snapshot: DR.snapshot, note: DR.note, init: DR.init, render: DR.render, engineOutfit: DR.engineOutfit, PIECES: DR.PIECES, status: DR.status, statusLine: DR.statusLine, buildCard: buildCard };
  Object.assign(DR, { printCard: printCard, printWardrobe: printWardrobe });
})();
