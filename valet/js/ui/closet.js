/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser's My garments view: the clothes you own and those you might buy, what goes
   with each of them, and which colour to buy. The finding and counting is in js/closet.js; every
   outfit is judged by the same engine as the Outfit view. Outfits you mark here (good, so-so, bad)
   are kept in Saved outfits with your mark beside Valet's verdict, so the two can be compared.
   Started by the Dresser (js/ui/dresser.js) with an API; window.VCLOSETUI. */
(function () {
  'use strict';
  const G = window.VGARM, E = window.VENGINE, O = window.VOUTFIT, C = window.VCLOSET, D = window.VDATA;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const num = function (n) { return Number(n).toLocaleString('en-GB'); };
  const plural = function (n, one, many) { return num(n) + ' ' + (n === 1 ? one : (many || one + 's')); };
  let h = null;                  // the Dresser's hooks (init)
  const S = function () { return h.api.state(); };
  function garments() { const st = S(); if (!Array.isArray(st.garments)) st.garments = []; return st.garments; }
  const byId = function (id) { return garments().find(function (g) { return g.id === id; }) || null; };

  /* ---------- What a question needs: the outfit to start from and the colouring ---------- */
  let occasion = null;           // the occasion asked about; starts as the current outfit's
  function opts() {
    return { base: S().outfit, occasion: occasion || S().outfit.occasion || 'smart', profile: S(), nameOf: h.api.nameOf,
      analysisFor: function (season) { return season ? h.api.analysisFor(season) : h.api.analysis(); } };
  }
  /* Counts found earlier, kept while nothing they depend on has changed. */
  function stamp() { const a = h.api.analysis(); return JSON.stringify([garments(), opts().occasion, a && a.hex, S().measurements, S().outfit.acc]); }
  let counts = {}, countStamp = '';
  function freshCounts() { const st = stamp(); if (st !== countStamp) { counts = {}; countStamp = st; } }

  /* ---------- Running a question in small steps, so the page stays responsive ---------- */
  let running = null;            // { job, kind, gid, stopped }
  function start(job, kind, info, onDone) {
    stop();
    const run = running = Object.assign({ job: job, kind: kind, stopped: false, onDone: onDone, stamp: stamp() }, info || {});
    (function tick() {
      if (run.stopped || running !== run) return;
      const done = job.step(25);
      paintAsk();
      if (done) { running = null; run.finished = true; last = run; if (onDone) onDone(run); paintAsk(); paintList(); return; }
      setTimeout(tick, 0);
    })();
    last = run; paintAsk();
  }
  function stop() { if (running) { running.stopped = true; running = null; } }
  let last = null;               // the last question asked, finished or not

  /* What goes with a garment. */
  function ask(id) {
    const g = byId(id); if (!g) return;
    const job = C.around(garments(), g, opts());
    start(job, 'around', { gid: id, occ: opts().occasion }, function (run) {
      run.sum = C.summarise(job);
      freshCounts(); counts[id] = { joins: run.sum.joins, tried: run.sum.tried };
    });
    scrollToAsk();
  }
  /* Which colour to buy for a position. */
  function buy(spec) {
    const a = h.api.analysis(); if (!a) return;
    const face = G.FACE.indexOf(spec.slot) >= 0 || spec.slot === 'coat';
    const colours = D.colours.filter(function (c) { return E.scoreColour(c.hex, a).tier <= (face ? 2 : 3); });
    const job = C.screen(garments(), spec, colours, opts());
    start(job, 'buy', { spec: spec, occ: opts().occasion, colours: colours.length });
    scrollToAsk();
  }
  function scrollToAsk() { const el = $('#clAsk'); if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' }); }

  /* ---------- Marks: your judgement next to Valet's ---------- */
  const MARKS = [['good', 'Good'], ['mid', 'So-so'], ['bad', 'Bad']];
  function nameFor(r) {
    const parts = ['jacket', 'mid', 'shirt', 'trousers'].filter(function (k) { return r.pick[k] && r.pick[k].name; }).map(function (k) { return r.pick[k].name; });
    return parts.join(', ').slice(0, 80) || 'Outfit from My garments';
  }
  function markHtml(sig) {
    const m = h.markOf(sig);
    return '<span class="cl-marks" role="group" aria-label="Your verdict">' + MARKS.map(function (x) {
      return '<button type="button" class="btn ghost small cl-mark m-' + x[0] + '" data-mark="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</span>';
  }

  /* ---------- Drawing ---------- */
  let note = '', removed = null, buyOpen = false, buySpec = { slot: 'mid', kind: 'vneck', cloth: 'merino' };
  function render() {
    const box = $('#drGarments'); if (!box) return;
    // an answer worked out for another colouring, season or list is asked again
    if (last && last.stamp !== stamp()) {
      if (last.kind === 'around' && byId(last.gid)) ask(last.gid);
      else if (last.kind === 'buy') buy(last.spec);
      else { stop(); last = null; }
    }
    const list = garments();
    box.innerHTML =
      '<p class="cl-lede">The clothes you own, one piece each. Ask what goes with one: Valet tries it with your other garments and judges every outfit as the Outfit view does. Mark the outfits you would and would not wear; Saved outfits then shows where you and Valet disagree. How it works, section 10, says how the outfits are found.</p>' +
      '<div class="dr-tools"><label class="btn ghost small">Import garments<input type="file" id="clImport" accept="application/json,.json" hidden></label>' +
      '<button type="button" class="btn ghost small" id="clExport"' + (list.length ? '' : ' disabled') + '>Export garments</button></div>' +
      (note ? '<p class="dr-note" role="status">' + esc(note) + '</p>' : '') +
      '<div class="cl-occ"><span class="flabel">Occasion</span><div class="seg" role="radiogroup" aria-label="Occasion for the outfits">' + G.OCCASIONS.map(function (x) {
        return '<button type="button" role="radio" data-cocc="' + x.id + '" aria-checked="' + (opts().occasion === x.id) + '">' + esc(x.name) + '</button>';
      }).join('') + '</div></div>' +
      '<div id="clAsk" class="cl-ask" aria-live="polite"></div>' +
      '<div id="clBuy"></div>' +
      '<div id="clList"></div>';
    wireTop(box);
    paintAsk(); paintBuy(); paintList();
  }
  function wireTop(box) {
    $('#clExport', box).addEventListener('click', exportFile);
    $('#clImport', box).addEventListener('change', function (e) {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { let d = null; try { d = JSON.parse(t); } catch (err) { /* not JSON */ } importFile(d); render(); });
      e.target.value = '';
    });
    $$('[data-cocc]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        occasion = b.dataset.cocc; $$('[data-cocc]', box).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        if (last && last.kind === 'around' && byId(last.gid)) ask(last.gid);
        else if (last && last.kind === 'buy') buy(last.spec);
        else paintList();
      });
    });
  }

  /* The list, by position, in the Dresser's order from head to feet. */
  function paintList() {
    const box = $('#clList'); if (!box) return;
    const list = garments();
    const undoBar = removed ? '<div class="dr-undo">Removed “' + esc(removed.item.name) + '”. <button type="button" class="btn ghost small" id="clUndo">Undo</button></div>' : '';
    if (!list.length) {
      box.innerHTML = undoBar + '<p class="dr-empty">No garments yet. Under <strong>Outfit</strong>, open a piece and press <strong>Save to my garments</strong>: what it is, its cloth, colour and pattern are kept. Or import a garments file. Colours read from photos with white paper (<em>From photos…</em>) make the answers trustworthy.</p>';
      wireUndo(box); return;
    }
    freshCounts();
    box.innerHTML = undoBar + G.POSITIONS.map(function (pos) {
      const mine = list.filter(function (g) { return g.slot === pos.key; }); if (!mine.length) return '';
      return '<section class="cl-group"><h3>' + esc(pos.label) + ' <span class="dr-n">' + mine.length + '</span></h3><ul class="cl-list">' + mine.map(function (g) {
        const k = counts[g.id], asking = last && last.gid === g.id;
        return '<li class="cl-item' + (g.own ? '' : ' maybe') + (asking ? ' cur' : '') + '" data-id="' + esc(g.id) + '">' +
          '<i class="cl-chip" style="' + h.chipStyle(g.piece) + '" aria-hidden="true"></i>' +
          '<div class="cl-text"><input type="text" class="cl-name" value="' + esc(g.name) + '" maxlength="80" aria-label="Name of this garment">' +
          '<span class="cl-desc">' + esc(h.api.nameOf(g.piece.hex)) + ' · ' + esc(C.describe(g)) + '</span>' +
          (g.note ? '<span class="cl-desc">' + esc(g.note) + '</span>' : '') +
          '<span class="cl-meta">' + (g.own ? '' : '<span class="cl-tag">Thinking of buying</span> ') + (k ? 'In ' + plural(k.joins, 'good outfit') + ' of ' + num(k.tried) + ' tried' : '') + '</span></div>' +
          '<div class="cl-acts"><button type="button" class="btn small" data-ask>What goes with it?</button>' +
          '<button type="button" class="btn ghost small" data-wear>Wear</button>' +
          '<label class="cl-own"><input type="checkbox" data-own' + (g.own ? ' checked' : '') + '> I own it</label>' +
          '<button type="button" class="btn ghost small" data-del aria-label="Delete ' + esc(g.name) + '">Delete</button></div></li>';
      }).join('') + '</ul></section>';
    }).join('');
    $$('.cl-item', box).forEach(function (li) {
      const id = li.dataset.id, g = byId(id); if (!g) return;
      $('[data-ask]', li).addEventListener('click', function () { ask(id); paintList(); });
      $('[data-wear]', li).addEventListener('click', function () { h.wearGarment(g); });
      $('[data-own]', li).addEventListener('change', function (e) { g.own = e.target.checked; h.api.save(); paintList(); });
      const nm = $('.cl-name', li);
      nm.addEventListener('change', function () { g.name = nm.value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || g.name; nm.value = g.name; h.api.save(); });
      $('[data-del]', li).addEventListener('click', function () {
        const all = garments(), i = all.indexOf(g); if (i < 0) return;
        removed = { item: g, at: i }; all.splice(i, 1); h.api.save();
        if (last && last.gid === id) { stop(); last = null; paintAsk(); }
        paintList();
      });
    });
    wireUndo(box);
  }
  function wireUndo(box) {
    const u = $('#clUndo', box);
    if (u) u.addEventListener('click', function () { if (removed) { garments().splice(removed.at, 0, removed.item); removed = null; h.api.save(); paintList(); } });
  }

  /* Positions with no garment of yours: the current outfit's pieces are used in their place. */
  const NEED_WORDS = { shirt: 'shirt or other layer next to the neck', trousers: 'trousers', shoes: 'shoes' };
  function missingNote(list) {
    const w = list.map(function (k) { return NEED_WORDS[k] || G.byKey[k].label.toLowerCase(); });
    return '<p class="cl-warn">No ' + (w.length < 3 ? w.join(' or ') : w.slice(0, -1).join(', ') + ' or ' + w[w.length - 1]) + ' of your own in My garments' +
      (list.length ? ', so the ' + (list.length === 1 ? 'one' : 'ones') + ' in the outfit you are dressing stand' + (list.length === 1 ? 's' : '') + ' in' : '') + '. A piece you are only thinking of buying does not count.</p>';
  }
  /* The answer to the question asked: progress while it runs, then the outfits. */
  function paintAsk() {
    const box = $('#clAsk'); if (!box) return;
    if (!last) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    if (last.kind === 'buy') { paintBuyAnswer(box); return; }
    const g = byId(last.gid); if (!g) { box.innerHTML = ''; return; }
    const job = last.job, occName = G.OCCASIONS.find(function (x) { return x.id === last.occ; }).name.toLowerCase();
    let html = '<div class="cl-ask-h"><h3>With the ' + esc(g.name) + '</h3><button type="button" class="btn ghost small" id="clClose">Close</button></div>';
    if (job.missing.length) html += missingNote(job.missing);
    if (!last.finished) {
      html += '<p class="cl-prog">Trying ' + plural(job.cores, 'combination') + ' for ' + esc(occName) + '… ' + Math.round((job.progress || 0) * 100) + '% <button type="button" class="btn ghost small" id="clStop">Stop</button></p>';
      box.innerHTML = html; wireAsk(box); return;
    }
    const s = last.sum, c = s.count;
    html += '<p class="cl-sum">' + plural(s.tried, 'outfit') + ' tried for ' + esc(occName) + ': <strong>' + num(c.good) + ' good outfit' + (c.good === 1 ? '' : 's') + '</strong>, ' + num(c.ok) + ' that work, ' + num(c.fix) + ' one fix away, ' + num(c.bad) + ' to start again.' +
      (g.own ? '' : ' Bought, it would join <strong>' + plural(s.joins, 'good outfit') + '</strong> (good or works).') +
      (C.EXTRA.indexOf(g.slot) < 0 ? ' A tie, square or socks are added only where they make an outfit better; ask about one to see what it goes with.' : '') + '</p>';
    if (!s.tried) html += '<p class="dr-empty">' + (job.needs ? 'Nothing to try it with: it needs ' + esc(job.needs) + ', and there is none among your garments.' : 'Nothing to try it with: add garments for the other positions.') + '</p>';
    if (s.best.length) html += '<h4>The best</h4><ul class="cl-outfits">' + s.best.map(card).join('') + '</ul>';
    else if (s.tried) html += '<p class="dr-empty">None of these outfits passes. The closest are below.</p>';
    const no = s.nearly.concat(s.no);
    if (no.length) html += '<h4>Turned down</h4><p class="cl-hint">The closest outfits Valet fails. If you would wear one, mark it Good: that is where a rule may be wrong.</p><ul class="cl-outfits">' + no.map(card).join('') + '</ul>';
    box.innerHTML = html; wireAsk(box);
    $$('.cl-outfit', box).forEach(function (li, i) {
      const r = s.best.concat(no)[i], o = C.outfitOf(r, opts()), sig = O.outfitSig(o);
      $('[data-wear]', li).addEventListener('click', function () { o.name = nameFor(r); h.wearOutfit(o, 'Wearing ' + nameFor(r) + ', from My garments.'); });
      $$('[data-mark]', li).forEach(function (b) {
        b.addEventListener('click', function () {
          const was = h.markOf(sig), m = was === b.dataset.mark ? null : b.dataset.mark;
          h.mark(o, sig, m, { name: nameFor(r), from: C.idsOf(r), verdict: r.title });
          $$('[data-mark]', li).forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.mark === m)); });
        });
      });
    });
  }
  function card(r) {
    const o = C.outfitOf(r, opts()), sig = O.outfitSig(o);
    const pieces = G.SLOTS.filter(function (k) { return r.pick[k]; });
    return '<li class="cl-outfit lv-' + esc(r.level) + '"><div class="dr-strip" aria-hidden="true">' + pieces.map(function (k) { return '<i style="' + h.chipStyle(r.pick[k].piece) + '"></i>'; }).join('') + '</div>' +
      '<div class="dr-text"><span class="cl-pieces">' + pieces.map(function (k) { return esc(r.pick[k].name || ('current ' + G.byKey[k].label.toLowerCase())); }).join(' · ') + '</span>' +
      '<span class="dr-verdict"><strong>' + esc(r.title) + '</strong>' + (r.fails.length ? ': ' + esc(r.fails.join(', ')) : '') + '</span></div>' +
      '<div class="cl-oacts"><button type="button" class="btn small" data-wear>Wear</button>' + markHtml(sig) + '</div></li>';
  }
  function wireAsk(box) {
    const st = $('#clStop', box); if (st) st.addEventListener('click', function () { stop(); last = null; paintAsk(); paintList(); });
    const cl = $('#clClose', box); if (cl) cl.addEventListener('click', function () { stop(); last = null; paintAsk(); paintList(); });
  }

  /* ---------- Which colour to buy ---------- */
  const BUY_SLOTS = ['shirt', 'mid', 'jacket', 'coat', 'trousers', 'shoes', 'tie', 'scarf', 'square', 'socks', 'hat'];
  function paintBuy() {
    const box = $('#clBuy'); if (!box) return;
    const pos = G.byKey[buySpec.slot], kind = pos.kinds.find(function (k) { return k.id === buySpec.kind; }) || pos.kinds[0];
    const cloths = kind.cloths || [];
    if (cloths.indexOf(buySpec.cloth) < 0) buySpec.cloth = cloths[0];
    box.innerHTML = '<details class="cl-buy"' + (buyOpen ? ' open' : '') + '><summary>Which colour to buy?</summary>' +
      '<p class="cl-hint">Choose what you are thinking of buying. Valet tries it in every colour that suits you at that place (tier 1 or 2 at the face, up to tier 3 below it) in the same ' + C.SAMPLE + ' outfits made from your garments, and the pieces you already own there too, so you can see which colours would do more than what you have.</p>' +
      '<div class="cl-buyform"><label>Position <select id="clBuySlot">' + BUY_SLOTS.map(function (k) { return '<option value="' + k + '"' + (k === buySpec.slot ? ' selected' : '') + '>' + esc(G.byKey[k].label) + '</option>'; }).join('') + '</select></label>' +
      '<label>Type <select id="clBuyKind">' + pos.kinds.map(function (k) { return '<option value="' + k.id + '"' + (k.id === kind.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select></label>' +
      (cloths.length ? '<label>Cloth <select id="clBuyCloth">' + cloths.map(function (c) { return '<option value="' + c + '"' + (c === buySpec.cloth ? ' selected' : '') + '>' + esc(G.CLOTHS[c].name) + '</option>'; }).join('') + '</select></label>' : '') +
      '<button type="button" class="btn small" id="clBuyGo"' + (garments().length ? '' : ' disabled') + '>Find the best colours</button></div></details>';
    const d = $('details', box); d.addEventListener('toggle', function () { buyOpen = d.open; });
    $('#clBuySlot', box).addEventListener('change', function (e) { buySpec = { slot: e.target.value, kind: G.byKey[e.target.value].kinds[0].id }; paintBuy(); });
    $('#clBuyKind', box).addEventListener('change', function (e) { buySpec.kind = e.target.value; buySpec.cloth = null; paintBuy(); });
    const cl = $('#clBuyCloth', box); if (cl) cl.addEventListener('change', function (e) { buySpec.cloth = e.target.value; });
    $('#clBuyGo', box).addEventListener('click', function () { buy(Object.assign({ pat: { type: 'solid' } }, buySpec)); });
  }
  function paintBuyAnswer(box) {
    const sp = last.spec, kind = G.kind(sp.slot, sp), job = last.job, occName = G.OCCASIONS.find(function (x) { return x.id === last.occ; }).name.toLowerCase();
    const what = kind.name.toLowerCase() + (sp.cloth && G.CLOTHS[sp.cloth] ? ' in ' + O.clothWord(G.CLOTHS[sp.cloth]) : '');
    let html = '<div class="cl-ask-h"><h3>Which colour? ' + esc(what.charAt(0).toUpperCase() + what.slice(1)) + '</h3><button type="button" class="btn ghost small" id="clClose">Close</button></div>';
    if (job.missing.length) html += missingNote(job.missing);
    if (!last.finished) {
      html += '<p class="cl-prog">Trying ' + plural(last.colours, 'colour') + ' in ' + plural(job.sample, 'outfit') + ' each, for ' + esc(occName) + '… ' + Math.round((job.progress || 0) * 100) + '% <button type="button" class="btn ghost small" id="clStop">Stop</button></p>';
      box.innerHTML = html; wireAsk(box); return;
    }
    const a = h.api.analysis(), rows = job.rows, top = rows.filter(function (r) { return !r.garment; }).slice(0, 10), owned = rows.filter(function (r) { return r.garment; });
    const shown = rows.filter(function (r) { return top.indexOf(r) >= 0 || owned.indexOf(r) >= 0; });
    html += '<p class="cl-sum">Each colour was tried in the same ' + plural(job.sample, 'outfit') + ' made from your garments, for ' + esc(occName) + ' (the core of each outfit: no tie, square or socks added). The share is how many of them pass: a good outfit, or one that works. Equal shares are ordered by how little Valet has to note.' +
      (owned.length ? ' Yours in this position are marked.' : '') + '</p>';
    html += '<ol class="cl-buylist">' + shown.map(function (r) {
      const rank = rows.indexOf(r) + 1, t = E.scoreColour(r.hex, a).tier;
      return '<li class="' + (r.garment ? 'own' : '') + '"><span class="cl-rank">' + rank + '</span><i class="cl-chip" style="background:' + esc(r.hex) + '"></i>' +
        '<span class="cl-bname">' + esc(r.garment ? r.name : r.name + ' ' + kind.name.toLowerCase()) + (r.garment ? ' <span class="cl-tag">yours</span>' : ' <span class="tt t' + t + '">T' + t + '</span>') + '</span>' +
        '<span class="cl-share"><span class="cl-bar"><i style="width:' + Math.round(r.share * 100) + '%"></i></span>' + Math.round(r.share * 100) + '%</span>' +
        (r.garment ? '' : '<button type="button" class="btn ghost small" data-try="' + esc(r.hex) + '">Think about it</button>') + '</li>';
    }).join('') + '</ol>';
    box.innerHTML = html; wireAsk(box);
    $$('[data-try]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        const piece = Object.assign({}, sp, { hex: b.dataset.try });
        const g = C.fromPiece(sp.slot, piece, C.autoName(sp.slot, piece, h.api.nameOf), false);
        garments().push(g); h.api.save();
        note = 'Added “' + g.name + '” as thinking of buying.';
        render(); ask(g.id);
      });
    });
  }

  /* ---------- Saving a piece of the outfit as a garment (from the piece editor) ---------- */
  function editorRow(k, x) {
    const g = x.gid ? byId(x.gid) : null;
    const same = g && g.slot === k && JSON.stringify(C.cleanPiece(k, x)) === JSON.stringify(g.piece);
    return '<div class="keep-row cl-save-row">' + (g
      ? (same ? '<span class="ed-note">This is your garment “' + esc(g.name) + '”.</span>'
        : '<button type="button" class="btn small ghost" data-gsave="update">Update “' + esc(g.name) + '”</button><button type="button" class="btn small ghost" data-gsave="new">Save as a new garment</button>')
      : '<button type="button" class="btn small ghost" data-gsave="new">Save to my garments</button><button type="button" class="btn small ghost" data-gsave="maybe">…as thinking of buying</button>') +
      '<span class="ed-note">My garments keeps what it is, its cloth, colour and pattern, so Valet can find what goes with it.</span></div>';
  }
  function wireEditor(ed, k) {
    $$('[data-gsave]', ed).forEach(function (b) {
      b.addEventListener('click', function () {
        const x = S().outfit[k], how = b.dataset.gsave;
        if (how === 'update') {
          const g = byId(x.gid); if (!g) return;
          g.piece = C.cleanPiece(k, x); h.api.save(); h.note('Updated “' + g.name + '” in My garments.');
          return;
        }
        if (garments().length >= C.MAX) { h.note('My garments is full (' + C.MAX + ').'); return; }
        const g = C.fromPiece(k, x, C.autoName(k, x, h.api.nameOf), how !== 'maybe');
        garments().push(g); x.gid = g.id; h.api.save();
        h.note('Saved “' + g.name + '” to My garments' + (how === 'maybe' ? ', as thinking of buying' : '') + '. Rename it there.');
      });
    });
  }

  /* ---------- Files ---------- */
  function exportFile() {
    const out = { app: 'valet', kind: 'garments', version: 1, valet: h.api.version, saved: new Date().toISOString().slice(0, 10), garments: garments() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'valet-garments-' + out.saved + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    note = 'Exported ' + plural(out.garments.length, 'garment') + '.'; render();
  }
  /* A garments file, or a profile file with garments in it. Adds to the list (see VCLOSET.merge). */
  function importFile(data) {
    if (!data || data.app !== 'valet' || !Array.isArray(data.garments)) { note = 'That file has no Valet garments in it.'; return; }
    const incoming = C.normGarments(data.garments), r = C.merge(garments(), incoming);
    note = !incoming.length ? 'The file holds no garments.'
      : 'Imported ' + plural(r.added, 'garment') + (r.same ? '; ' + num(r.same) + ' already here ' + (r.same === 1 ? 'was' : 'were') + ' skipped' : '') + (incoming.length > r.added + r.same ? '; the list is full at ' + C.MAX : '') + '.';
    if (r.added) h.api.save();
  }

  window.VCLOSETUI = {
    init: function (hooks) { h = hooks; },
    render: render, editorRow: editorRow, wireEditor: wireEditor, stop: stop,
    count: function () { return garments().length; }
  };
})();
