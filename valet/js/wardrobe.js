/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Outfit check tab. Every piece can be given a colour and a cloth; the outfit is then
   verified against the colour and pattern rules, each failing rule offers a fix, and open pieces
   can be suggested or filled in around the ones that are locked. Started by the interface (js/ui/main.js) with an API. */
(function () {
  'use strict';
  const VC = window.VC, E = window.VENGINE, D = window.VDATA, VP = window.VPAT;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* One row per position (garments.js). The row is named by what is worn there now; the
     position is the small line above it. */
  const G = window.VGARM;
  const PIECES = G.POSITIONS.map(function (pos) {
    const p = { key: pos.key, position: pos.label, face: pos.face, optional: pos.optional, cloth: true, kinds: pos.kinds };
    Object.defineProperty(p, 'label', { get: function () { return kindOf(pos.key).name; } });
    return p;
  });
  const kindOf = function (k) { return G.kind(k, S().outfit[k]); };
  const lname = function (k) { return kindOf(k).name.toLowerCase(); };
  const FAMILIES = [['all', 'All'], ['Neutral', 'Neutrals'], ['Blue', 'Blues'], ['Green', 'Greens'], ['Red', 'Reds'], ['Yellow', 'Yellows'], ['Purple', 'Purples']];
  const ACCENT_NEUTRALS = ['#f7f6f2', '#c9cbcd', '#8e9196', '#3d4045', '#1d2a44', '#161616'];
  const PX_PER_CM = 96 / 2.54;

  let api = null, open = null, tab = 'colour', filter = { fam: 'all', q: '', faceOnly: true }, undo = [], lastNote = '';

  const S = function () { return api.state(); };
  const tt = function (t) { return '<span class="tt t' + t + '" title="Tier ' + t + ': ' + E.TIER_TEXT[t].note.replace(/"/g, '') + '">T' + t + '</span>'; };
  const piece = function (k) { return S().outfit[k]; };
  const worn = function (k) { return piece(k).on !== false; };
  function engineOutfit(o) {
    o = o || S().outfit;
    const out = {};
    PIECES.forEach(function (p) {
      const x = o[p.key];
      out[p.key] = x.on === false ? null : { hex: x.hex, name: api.nameOf(x.hex), kind: x.kind, cloth: x.cloth, band: x.band, brim: x.brim, pat: x.pat || { type: 'solid' }, rise: x.rise, length: x.length };
    });
    // the Proportion checks, with the body's percentiles if measured
    {
      out.propOn = true;
      out.body = window.VBODY && S().measurements && S().measurements.height > 0 ? window.VBODY.derive(S().measurements, S().shape).pct : {};
      out.frame = window.VPROP ? window.VPROP.frameSize(S().measurements) : null;
      out.shape = S().shape || {};
      out.hairStyle = S().hairStyle;
    }
    out.occasion = o.occasion || 'smart';
    out.m = S().measurements || {};
    out.acc = JSON.parse(JSON.stringify(o.acc || {}));
    out.acc.wrist = +(S().measurements && S().measurements.wrist) || null;
    return out;
  }
  /* Whether each worn piece is, right now, part of a problem it could fix: the same judgement as
     the marks on the colour swatches (fitFor), for the colour the piece already has. A piece is
     flagged only when another colour in its place would do better, so a problem between two
     pieces flags both, and one that no colour here can mend flags neither. Recomputed whenever
     anything in the outfit changes, so a piece that becomes a problem because of another change
     says so on its own row. */
  let statusKey = '', statusVal = {};
  function status() {
    const a = api.analysis(); if (!a) return {};
    const o = engineOutfit(), key = JSON.stringify(o) + '|' + a.contrast + '|' + a.lean + '|' + a.redness + '|' + a.underEye + '|' + a.glasses;
    if (key === statusKey) return statusVal;
    const out = {};
    PIECES.forEach(function (p) { if (o[p.key]) out[p.key] = E.fitFor(o, a, p.key).judge(o[p.key].hex, o[p.key].name); });
    statusKey = key; statusVal = out;
    return out;
  }
  // The row line and class for one piece's status.
  function statusLine(st) {
    if (!st || st.state === 'ok') return '';
    const first = st.why.split(/(?<=\.)\s/)[0];
    return '<span class="g-why fit-' + st.state + '-t">' + (st.state === 'out' ? 'Clashes: ' : 'Careful: ') + '<span class="g-why-t">' + esc(first) + '</span></span>';
  }
  /* One colour in one piece, judged with the rest of the outfit: '' when it fits, otherwise a
     Careful or Clashes line with the reason. */
  function fitLine(k, hex) {
    const a = api.analysis(); if (!a || !piece(k)) return '';
    const j = E.fitFor(engineOutfit(), a, k).judge(hex, api.nameOf(hex));
    return j.state === 'ok' ? '<span class="g-why fit-ok-t">Works with the rest of the outfit.</span>' : statusLine(j);
  }
  /* withLocks: the action also changes locks (Keep this, the clash buttons), so Undo puts them back
     too. Otherwise Undo leaves locks as they are now, so a lock set by hand is not undone. */
  function snapshot(withLocks) {
    const o = JSON.parse(JSON.stringify(S().outfit));
    if (withLocks) o.__locks = true;
    undo.push(JSON.stringify(o)); if (undo.length > 30) undo.shift();
  }
  function commit(note) { const fixed = fitPatterns(); lastNote = [note, fixed].filter(Boolean).join(' '); api.commit(); render(); }
  /* A pattern has to exist in its cloth (garments.js, CLOTH_PATS): whatever changed a piece's type,
     cloth or pattern (a button, a fix, Keep this), a pattern its cloth cannot carry becomes plain. */
  function clothWord(c) { return c.name.replace(/ \(shiny\)$/, '').replace(/^Cotton twill \(chino\)$/, 'cotton twill').toLowerCase(); }
  function fitPatterns() {
    const notes = [];
    G.SLOTS.forEach(function (k) {
      const x = S().outfit[k]; if (!x) return;
      const pat = VP.norm(x.pat), c = G.cloth(k, x);
      if (pat.type === 'solid' || !c || G.patOK(c.id, pat.type)) return;
      x.pat = { type: 'solid' };
      if (x.on !== false) notes.push('The ' + lname(k) + ' is now plain: ' + VP.byId[pat.type].name.toLowerCase() + ' is not made in ' + clothWord(c) + '.');
    });
    return notes.join(' ');
  }

  /* ---------- Rendering ---------- */
  function render() {
    const a = api.analysis();
    $('#outfitEmpty').hidden = !!a; $('#outfitBody').hidden = !a;
    if (!a) return;
    const o = engineOutfit(), checks = E.checkOutfit(o, a), v = E.verdict(checks);
    const nm = $('#ovName'); if (nm && document.activeElement !== nm) nm.value = S().outfit.name || '';
    renderOccasion();
    renderVerdict(v, checks, E.skinClashes(o, a), o, a);
    renderOverview(checks);
    renderPieces(a);
    renderAcc();
    renderChecks(checks, a);
    $('#ovUndo').disabled = !undo.length;
  }

  /* The verdict, with clashes against your skin put first and kept on screen for as long as they
     last. A clash on a piece you are keeping cannot be fixed by the rest of the outfit, so the
     verdict says so instead of "one fix away". */
  const what = function (c) { return c.name + ' ' + c.piece; };
  /* The verdict's title and text, with a clash against the skin taking over. */
  function headline(v, clashes) {
    const hard = (clashes || []).filter(function (c) { return !c.soft; }), locks = S().outfit.locks;
    const kept = hard.filter(function (c) { return locks[c.slot]; });
    const list = function (xs) { return xs.length < 3 ? xs.join(' and ') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; };
    let title = v.title, text = v.text, level = v.level;
    if (hard.length) {
      title = 'Clashes with your skin';
      level = kept.length || v.level === 'bad' ? 'bad' : 'fix';
      const others = Math.max(0, v.fails - 1);
      text = kept.length
        ? 'You are keeping the ' + list(kept.map(what)) + ', and ' + (kept.length > 1 ? 'they are' : 'it is') + ' not for you near the face. Changing the other pieces cannot fix that.'
        : 'Swap the ' + list(hard.map(what)) + ' and the rest can stay.';
      if (others) text += ' ' + others + ' other rule' + (others > 1 ? 's' : '') + ' fail' + (others > 1 ? '' : 's') + ' too.';
    }
    return { title: title, text: text, level: level };
  }
  function renderVerdict(v, checks, clashes, o, a) {
    const hd = headline(v, clashes), title = hd.title, text = hd.text, level = hd.level;
    $('#ovVerdict').className = 'ov-verdict ' + level;
    $('#ovVerdict').innerHTML = '<div><strong>' + title + '</strong><span>' + esc(text) + '</span></div>' +
      '<span class="ov-counts"><span class="no">' + v.fails + ' fail' + (v.fails === 1 ? '' : 's') + '</span><span class="meh">' + v.warns + ' to note</span></span>' +
      (clashes && clashes.length ? clashList(clashes, o, a) : '') +
      (lastNote ? '<p class="ov-note">' + esc(lastNote) + '</p>' : '');
    $$('#ovVerdict [data-cl]').forEach(function (b) {
      const c = clashes[+b.dataset.cl], act = b.dataset.act;
      if (act === 'swap' && b.dataset.hex) {
        b.addEventListener('pointerenter', function () { api.preview(c.slot, { hex: b.dataset.hex }); });
        b.addEventListener('pointerleave', function () { api.preview(null); });
      }
      b.addEventListener('click', function () {
        api.preview(null);
        if (act === 'swap') {
          snapshot(true); S().outfit.locks[c.slot] = false; piece(c.slot).hex = b.dataset.hex;
          commit('Swapped the ' + what(c) + ' for ' + api.nameOf(b.dataset.hex) + '.');
        } else if (act === 'lower') {
          snapshot(true); piece('trousers').hex = piece(c.slot).hex; piece('trousers').pat = { type: 'solid' };
          S().outfit.locks[c.slot] = false; piece(c.slot).hex = b.dataset.hex;
          commit('Moved ' + c.name + ' below the belt as trousers, and gave the ' + c.piece + ' ' + api.nameOf(b.dataset.hex) + '.');
        } else if (act === 'open') { open = c.slot; tab = 'colour'; render(); const el = $('.ov-piece[data-k="' + c.slot + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }
  /* One line per clashing piece: the colour, its tier, why, and what can be done about it. */
  function clashList(clashes, o, a) {
    const locks = S().outfit.locks;
    return '<div class="ov-clash" role="alert"><p class="cl-h">Against your skin</p><ul>' + clashes.map(function (c, i) {
      const best = E.suggest(o, a, c.slot, 1)[0];
      const canLower = !c.soft && c.slot !== 'trousers' && !locks.trousers && o.trousers && !c.patterned;
      const why = c.reasons.length ? c.reasons.join('; ') : 'weak against your colouring';
      return '<li class="' + (c.soft ? 'soft' : '') + '"><span class="d" style="background:' + c.hex + '"></span><span class="cl-t">' +
        '<strong>' + esc(c.name) + ' ' + esc(c.piece) + '</strong> <span class="tt t' + c.tier + '">T' + c.tier + '</span>' +
        (locks[c.slot] ? ' <span class="cl-kept">kept by you</span>' : '') +
        '<span class="cl-why">' + esc(why.charAt(0).toUpperCase() + why.slice(1)) + '.' +
        (c.soft ? ' A small accent, so this is a note, not a failure.' : '') +
        (c.patterned ? ' Judged by the colour the pattern adds up to from a step away.' : '') + '</span>' +
        '<span class="cl-act">' +
        (best ? '<button type="button" class="btn small" data-cl="' + i + '" data-act="swap" data-hex="' + best.hex + '"><span class="dd" style="background:' + best.hex + '"></span>' + (locks[c.slot] ? 'Unlock and swap for ' : 'Swap for ') + esc(best.name) + '</button>' : '') +
        (canLower && best ? '<button type="button" class="btn small ghost" data-cl="' + i + '" data-act="lower" data-hex="' + best.hex + '">Wear ' + esc(c.name) + ' as trousers instead</button>' : '') +
        '<button type="button" class="btn small ghost" data-cl="' + i + '" data-act="open">More colours</button>' +
        '</span></span></li>';
    }).join('') + '</ul></div>';
  }

  /* The occasion sets how formal the outfit should be. */
  function renderOccasion() {
    const box = $('#ovOccasion'); if (!box) return;
    const cur = S().outfit.occasion || 'smart', occ = G.OCCASIONS.find(function (x) { return x.id === cur; });
    box.innerHTML = '<span class="flabel">Occasion</span><div class="seg" role="radiogroup" aria-label="Occasion">' + G.OCCASIONS.map(function (x) {
      return '<button type="button" role="radio" data-occ="' + x.id + '" aria-checked="' + (x.id === cur) + '">' + x.name + '</button>';
    }).join('') + '</div><p class="small muted occ-note">' + esc(occ.note.replace(/^./, function (c) { return c.toUpperCase(); })) + '.</p>';
    $$('[data-occ]', box).forEach(function (b) { b.addEventListener('click', function () { S().outfit.occasion = b.dataset.occ; commit(''); }); });
  }
  /* One line per question of the Outfit Check card, and the rest: pass, to note or fail. Click to
     go to its checks. */
  function renderOverview(checks) {
    const box = $('#ovOverview'); if (!box) return;
    box.innerHTML = E.SECTIONS.map(function (sec) {
      const mine = checks.filter(function (c) { return E.sectionOf(c) === sec.id; });
      if (!mine.length) return '';
      const worst = Math.min.apply(null, mine.map(function (c) { return c.score; }));
      const st = worst < 0.5 ? 'no' : worst < 0.85 ? 'meh' : 'ok';
      return '<button type="button" class="ovw ' + st + '" data-sec="' + sec.id + '" title="' + esc(sec.q) + '"><span class="ovw-i">' + (st === 'ok' ? '✓' : st === 'meh' ? '~' : '✕') + '</span>' + sec.title.replace(/^\d\. /, '') + '</button>';
    }).join('');
    $$('.ovw', box).forEach(function (b) { b.addEventListener('click', function () { const t = $('#sec-' + b.dataset.sec); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
  }

  function chipStyle(x) {
    const pat = VP.norm(x.pat);
    return pat.type === 'solid' ? 'background:' + x.hex : 'background-image:url(' + VP.thumb(x.hex, pat, 12, 3) + ');background-size:cover';
  }
  function patLabel(x) {
    const pat = VP.norm(x.pat);
    return pat.type === 'solid' ? 'plain' : VP.byId[pat.type].name.toLowerCase() + ', ' + (Math.round(pat.scale * 10) / 10) + ' cm';
  }

  function renderPieces(a) {
    const box = $('#ovPieces');
    const stAll = status();
    // Only what is worn (and what every outfit needs) gets a row; the rest waits in the Add bar.
    box.innerHTML = PIECES.filter(function (p) { return !p.optional || worn(p.key); }).map(function (p) {
      const st = stAll[p.key];
      const x = piece(p.key), on = worn(p.key), locked = !!S().outfit.locks[p.key], isOpen = open === p.key;
      const t = on ? E.scoreColour(VP.mean(x.hex, x.pat), a).tier : null;
      const pill = on ? tt(t) : '';
      return '<div class="ov-piece' + (isOpen ? ' open' : '') + (on ? '' : ' off') + (on && st && st.state !== 'ok' ? ' st-' + st.state : '') + '" data-k="' + p.key + '"' + (on && st && st.why ? ' title="' + esc(st.why) + '"' : '') + '>' +
        '<div class="ov-row">' +
        '<button type="button" class="ov-pick" aria-expanded="' + isOpen + '">' +
        '<span class="chip" style="' + (on ? chipStyle(x) : '') + '"></span>' +
        '<span class="g-text">' + (p.kinds.length > 1 ? '<span class="g-pos">' + p.position + '</span>' : '') + '<span class="g-name">' + p.label + '</span><span class="g-colour">' + (on ? esc(api.nameOf(x.hex)) + (G.cloth(p.key, x) ? ', ' + G.cloth(p.key, x).name.toLowerCase().replace(/ \(shiny\)$/, ' (shiny)') : '') + (VP.norm(x.pat).type !== 'solid' ? ', ' + patLabel(x) : '') : 'not worn') + '</span>' + (on ? statusLine(st) : '') + '</span>' +
        '<span class="g-pill">' + pill + '</span></button>' +
        (p.optional ? '<button type="button" class="btn ghost small ov-on"' + (!on && blockedWhy(p.key) ? ' disabled title="' + esc(blockedWhy(p.key)) + '"' : '') + '>' + (on ? 'Take off' : 'Put on') + '</button>' : '') +
        '<button type="button" class="ov-lock" aria-pressed="' + locked + '" title="' + (locked ? 'Locked: suggestions keep it' : 'Unlocked: suggestions may change it') + '" aria-label="Lock the ' + p.label.toLowerCase() + '">' +
        (locked ? '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>' : '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0"/></svg>') +
        '</button></div>' +
        (isOpen && on ? '<div class="ov-editor"></div>' : '') + '</div>';
    }).join('') + addBar();
    $$('.add-bar [data-add]', box).forEach(function (b) {
      b.addEventListener('click', function () { const k = b.dataset.add; snapshot(); open = k; tab = 'colour'; commit(putOn(k) || 'Added: ' + kindOf(k).name.toLowerCase() + '. ' + (G.byKey[k].kinds.length > 1 ? 'Choose what it is and its colour below.' : 'Choose its colour below.')); });
    });
    $$('.ov-piece', box).forEach(function (el) {
      const k = el.dataset.k;
      $('.ov-pick', el).addEventListener('click', function () {
        if (!worn(k)) { if (blockedWhy(k)) { lastNote = blockedWhy(k); render(); return; } snapshot(); open = k; commit(putOn(k)); return; }
        if (open !== k) tab = 'colour';
        open = open === k ? null : k; render();
      });
      const on = $('.ov-on', el);
      if (on) on.addEventListener('click', function () { snapshot(); let note = ''; if (worn(k)) { piece(k).on = false; if (open === k) open = null; } else note = putOn(k); commit(note); });
      $('.ov-lock', el).addEventListener('click', function () { S().outfit.locks[k] = !S().outfit.locks[k]; api.save(); render(); });
      const ed = $('.ov-editor', el);
      if (ed) renderEditor(ed, k, a);
    });
  }

  /* ---------- Editor for one piece: colour and cloth ---------- */
  function renderEditor(ed, k, a) {
    const p = PIECES.find(function (x) { return x.key === k; }), x = piece(k), cur = kindOf(k);
    const kindRow = p.kinds.length > 1 ? '<div class="kind-row" role="radiogroup" aria-label="What it is"><span class="kind-lab">What it is</span>' + p.kinds.map(function (t) {
      const why = kindBlocked(k, t);
      return '<button type="button" role="radio" class="kind" data-kind="' + t.id + '" aria-checked="' + (t.id === cur.id) + '"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="' + esc(kindNote(t)) + '"') + '>' + t.name + '</button>';
    }).join('') + '</div><p class="ed-note kind-note">' + esc(kindNote(cur)) + '</p>' : '';
    const keepRow = '<div class="keep-row"><button type="button" class="btn small ghost ov-keep">Keep this, fix the rest</button><span class="ed-note">For a piece you own: Valet changes the other open pieces, and adds or removes a layer, to make it work. If nothing can, it says so.</span></div>';
    // the cut that sets where the piece meets the next ): trousers' rise, a knit's length
    const CUTS = { trousers: { key: 'rise', label: 'Rise', opts: [['high', 'High: at the natural waist or above'], ['mid', 'Mid: a little below it'], ['low', 'Low: on the hips']], def: 'mid' },
      mid: { key: 'length', label: 'Length', opts: [['short', 'Short: to a high waistband (1930s)'], ['regular', 'Regular: over the waistband'], ['long', 'Long: to the hips']], def: 'regular' } };
    const cut = CUTS[k] && !(k === 'mid' && cur.vest) && CUTS[k];   // a waistcoat's length is its points: no choice
    const cutRow = cut ? '<div class="kind-row cut-row" role="radiogroup" aria-label="' + cut.label + '"><span class="kind-lab">' + cut.label + '</span>' + cut.opts.map(function (o) {
      return '<button type="button" role="radio" class="kind cut" data-cut="' + o[0] + '" aria-checked="' + ((x[cut.key] || cut.def) === o[0]) + '" title="' + esc(o[1]) + '">' + o[1].split(':')[0] + '</button>';
    }).join('') + '</div><p class="ed-note">' + esc(cut.opts.find(function (o) { return o[0] === (x[cut.key] || cut.def); })[1]) + '. It sets where this piece meets the next; see Proportion in the checks.</p>' : '';
    ed.innerHTML = kindRow + cutRow + keepRow + (p.cloth ? '<div class="seg ed-tabs" role="tablist"><button type="button" role="tab" data-t="colour" aria-selected="' + (tab === 'colour') + '">Colour</button>' +
      '<button type="button" role="tab" data-t="cloth" aria-selected="' + (tab === 'cloth') + '">' + (kindOf(k).pats.length > 1 ? 'Cloth and pattern' : 'Cloth') + '</button></div>' : '') +
      '<div class="ed-body"></div>';
    $$('.ed-tabs button', ed).forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.t; renderEditor(ed, k, a); }); });
    $$('.kind:not(.cut)', ed).forEach(function (b) { b.addEventListener('click', function () { setKind(k, b.dataset.kind); }); });
    $$('.cut', ed).forEach(function (b) { b.addEventListener('click', function () { snapshot(); piece(k)[cut.key] = b.dataset.cut; commit(cut.label + ': ' + b.textContent.toLowerCase() + '.'); }); });
    $('.ov-keep', ed).addEventListener('click', function () { keepAndFix(k); });
    const body = $('.ed-body', ed);
    if (tab === 'cloth' && p.cloth) clothEditor(body, k, x, a); else colourEditor(body, k, x, a, p);
  }

  /* The optional positions not worn now, as one row of Add buttons. */
  // Add buttons name the position; the title lists the types to choose from once it is added.
  const ADD_NAME = { hat: 'Headwear', tie: 'Neckwear', scarf: 'Scarf', mid: 'Knit or waistcoat', jacket: 'Jacket or coat', square: 'Pocket square', socks: 'Socks' };
  function addBar() {
    const off = PIECES.filter(function (p) { return p.optional && !worn(p.key); });
    if (!off.length) return '';
    return '<div class="add-bar"><span class="add-lab">Add</span>' + off.map(function (p) {
      const why = blockedWhy(p.key);
      return '<button type="button" class="add-btn" data-add="' + p.key + '"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="' + esc(p.kinds.map(function (t) { return t.name; }).join(', ')) + '"') + '><span aria-hidden="true">+</span> ' + (ADD_NAME[p.key] || p.position) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- Garment types ---------- */
  function kindNote(t) {
    const fr = { collar: 'its collar frames the face', neck: 'the roll neck frames the face', lapel: 'lapels frame the face', shawl: 'the shawl collar frames the face', scarf: 'a scarf frames the face' }[t.frame];
    const pats = t.pats.filter(function (x) { return x !== 'solid'; }).map(function (x) { return VP.byId[x].name.toLowerCase(); });
    return t.name + ': ' + (fr || (t.frame === null && G.byKey.shirt.kinds.concat(G.byKey.mid.kinds).indexOf(t) >= 0 ? 'no collar, so something else must frame the face' : 'not a frame for the face')) +
      '. ' + (pats.length ? 'Patterns the guide uses on it: ' + pats.join(', ') + ' (up to ' + t.maxScale + ' scale).' : 'Worn plain.');
  }
  // Why a garment type cannot be chosen here now (or '' when it can).
  function kindBlocked(k, t) {
    if (k === 'tie' && t.needsCollar && !kindOf('shirt').collar) return 'A ' + t.name.toLowerCase() + ' needs a shirt collar: choose a shirt as the layer next to the neck first.';
    return '';
  }
  // Why a position cannot be put on now.
  function blockedWhy(k) {
    if (k === 'square' && !(worn('jacket') && kindOf('jacket').pocket)) return 'A pocket square needs a jacket with a breast pocket.';
    if (k === 'tie' && !kindOf('shirt').collar) return 'Neckwear (a tie, bow tie or cravat) needs a shirt collar. With a ' + lname('shirt') + ', add a scarf instead.';
    return '';
  }
  // Putting a piece on. Neckwear needs a collar; the Add button is disabled without one.
  function putOn(k) {
    piece(k).on = true;
    if (k === 'tie' && !kindOf('shirt').collar) { piece('tie').on = false; return 'A ' + lname('shirt') + ' has no collar for neckwear; add a scarf instead.'; }
    return '';
  }
  function setKind(k, id) {
    snapshot();
    const x = piece(k), t = G.byKey[k].kinds.find(function (q) { return q.id === id; }), notes = [t.name + ' chosen.'];
    x.kind = id;
    if (x.cloth && (!t.cloths || t.cloths.indexOf(x.cloth) < 0)) { x.cloth = t.cloths ? t.cloths[0] : undefined; }
    const pat = VP.norm(x.pat);
    if (pat.type !== 'solid' && t.pats.indexOf(pat.type) < 0) { x.pat = { type: 'solid' }; notes.push('Made it plain: ' + VP.byId[pat.type].name.toLowerCase() + ' is not used on a ' + t.name.toLowerCase() + '.'); }
    // what depends on this piece
    if (k === 'shirt' && !t.collar && worn('tie') && kindOf('tie').needsCollar) { notes.push('Took off the ' + lname('tie') + ': it needs a shirt collar. Add a scarf instead if you want one.'); piece('tie').on = false; }
    if (k === 'shirt' && !t.collar && S().outfit.acc.cufflinks.on) { S().outfit.acc.cufflinks.on = false; notes.push('Took off the cufflinks: they need shirt cuffs.'); }
    if (k === 'jacket' && !t.pocket && worn('square')) { piece('square').on = false; notes.push('Took off the pocket square: it needs a breast pocket.'); }
    commit(notes.join(' '));
  }
  function keepAndFix(k) {
    const a = api.analysis(), before = engineOutfit(), r = E.rescue(before, a, k, S().outfit.locks);
    const changed = [];
    snapshot(true);
    PIECES.forEach(function (p) {
      const b = before[p.key], n = r.outfit[p.key], x = piece(p.key);
      if (p.key === k) return;
      if (b && !n) { x.on = false; changed.push('took off the ' + lname(p.key)); }
      else if (n && !b) { x.on = true; x.hex = n.hex; if (n.kind) x.kind = n.kind; x.pat = n.pat || { type: 'solid' }; changed.push('added a ' + api.nameOf(n.hex) + ' ' + lname(p.key)); }
      else if (n && b && (n.hex !== b.hex || n.kind !== b.kind)) { x.hex = n.hex; if (n.kind) x.kind = n.kind; if (n.pat) x.pat = n.pat; changed.push(lname(p.key) + ' to ' + api.nameOf(n.hex)); }
    });
    S().outfit.locks[k] = true;
    const what = api.nameOf(piece(k).hex) + ' ' + lname(k);
    let note;
    if (r.ok) note = 'Kept the ' + what + ' (now locked)' + (changed.length ? ': ' + changed.join(', ') + '.' : '; it already works with the rest.') + ' Undo to go back.';
    else {
      if (!changed.length) undo.pop();
      note = r.atFace
        ? 'Kept the ' + what + ' (now locked). Its clash with your skin is shown above; the colour can still be worn ' + (k === 'shirt' || k === 'mid' ? 'as a layer under a closed jacket, or ' : '') + 'as trousers, socks or a bag.'
        : 'Even with the rest changed, the ' + what + ' still fails: ' + r.left.map(function (c) { return c.text; }).join(' ') + ' Take it off for this outfit.';
      if (changed.length) note += ' The rest was improved anyway: ' + changed.join(', ') + '. Undo to go back.';
    }
    commit(note);
  }

  /* ---------- Accessories ---------- */
  function renderAcc() {
    const box = $('#ovAcc'); if (!box) return;
    const acc = S().outfit.acc, wrist = +(S().measurements && S().measurements.wrist) || null;
    const accBlocked = function (d) { return (d.needs === 'tie' && !(worn('tie') && kindOf('tie').id === 'tie')) ? 'Needs a tie.' : (d.needs === 'cuffs' && !kindOf('shirt').collar) ? 'Needs a shirt with cuffs.' : ''; };
    const offs = G.ACCESSORIES.filter(function (d) { return !acc[d.key].on; });
    const a = api.analysis(), accChecks = a ? E.checkOutfit(engineOutfit(), a).filter(function (c) { return c.group === 'accessory' && c.score < 0.85; }) : [];
    box.innerHTML = G.ACCESSORIES.filter(function (d) { return acc[d.key].on; }).map(function (d) {
      const mine = accChecks.filter(function (c) { return c.acc === d.key; }).sort(function (p1, p2) { return p1.score - p2.score; })[0];
      const st = mine ? { state: mine.score < 0.5 ? 'out' : 'care', why: mine.text } : null;
      const x = acc[d.key], on = !!x.on, blocked = (d.needs === 'tie' && !(worn('tie') && kindOf('tie').id === 'tie')) ? 'Needs a tie.' : (d.needs === 'cuffs' && !kindOf('shirt').collar) ? 'Needs a shirt with cuffs.' : '';
      const hint = d.key === 'watch' ? (wrist ? 'suits ' + E.watchRange(wrist).join('–') + ' mm for your wrist' : 'classic 36–40 mm') :
        { cufflinks: 'classic 12–18 mm', tiebar: 'about ¾ of the tie: up to 60 mm on an 8 cm tie', ring: 'classic up to 15 mm', earring: 'up to about 5 mm' }[d.key];
      return '<div class="acc-item' + (on ? '' : ' off') + (st ? ' st-' + st.state : '') + '" data-a="' + d.key + '">' +
        '<div class="acc-head"><span><strong>' + d.name + '</strong>' + statusLine(st) + '</span><button type="button" class="btn ghost small acc-rm">Remove</button></div>' +
        (blocked ? '<span class="ed-note fit-care-t">' + blocked + '</span>' : '') +
        (on ? '<span class="acc-fields">' +
          '<label>Metal <select class="acc-metal">' + d.metals.map(function (m) { return '<option value="' + m + '"' + (x.metal === m ? ' selected' : '') + '>' + G.metalBy[m].name + '</option>'; }).join('') + '</select></label>' +
          (d.stone ? '<label>Stone <select class="acc-stone">' + G.STONES.map(function (st) { return '<option value="' + st.id + '"' + (x.stone === st.id ? ' selected' : '') + '>' + st.name + '</option>'; }).join('') + '</select></label>' : '') +
          (d.size ? '<label>' + d.size.label + ' <input type="number" class="acc-size" min="' + d.size.min + '" max="' + d.size.max + '" step="1" value="' + (x.size || '') + '"> mm</label><span class="ed-note">' + hint + '</span>' : '') +
          '</span>' + (d.note ? '<p class="ed-note">' + esc(d.note) + '</p>' : '') : '') +
        '</div>';
    }).join('') + (offs.length ? '<div class="add-bar"><span class="add-lab">Add</span>' + offs.map(function (d) {
      const why = accBlocked(d);
      return '<button type="button" class="add-btn" data-acc="' + d.key + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '><span aria-hidden="true">+</span> ' + d.name + '</button>';
    }).join('') + '</div>' : '');
    $$('[data-acc]', box).forEach(function (b) { b.addEventListener('click', function () { snapshot(); acc[b.dataset.acc].on = true; commit(''); }); });
    $$('.acc-item', box).forEach(function (el) {
      const k = el.dataset.a, x = acc[k];
      $('.acc-rm', el).addEventListener('click', function () { snapshot(); x.on = false; commit(''); });
      const m = $('.acc-metal', el); if (m) m.addEventListener('change', function () { snapshot(); x.metal = m.value; commit(''); });
      const st = $('.acc-stone', el); if (st) st.addEventListener('change', function () { snapshot(); x.stone = st.value; commit(''); });
      const sz = $('.acc-size', el); if (sz) sz.addEventListener('change', function () { const v = +sz.value; if (v > 0) { snapshot(); x.size = v; commit(''); } });
    });
  }

  /* ---------- Colour from a photo ----------
     One photo is kept in memory for the session (never stored), so several pieces can be read from
     the same picture. A click averages a patch wide enough to cover the weave, ignoring the darkest
     and brightest tenth (shadows in folds, shine). Clicking white paper first corrects the light
     the same way the You tab does (Bradford white balance). */
  const photo = { base: null, white: null, whiteAt: null, raw: null, at: null, mode: 'cloth', open: false };
  function photoHtml() {
    return '<details class="photo-pick"' + (photo.open ? ' open' : '') + '><summary>From a photo</summary>' +
      '<p class="ed-note">A photo of the garment, ideally by a window with a sheet of white printer paper beside it. Click the paper first, which corrects the colour of the light; then click the cloth. The photo stays on this page and is not stored, so you can read several pieces from one picture.</p>' +
      '<div class="pp-bar"><label class="btn small ghost pp-choose">' + (photo.base ? 'Choose another photo' : 'Choose a photo') + '<input type="file" accept="image/*" class="pp-file" hidden></label>' +
      (photo.base ? '<div class="seg pp-mode" role="radiogroup" aria-label="What the next click reads"><button type="button" role="radio" data-m="white" aria-checked="' + (photo.mode === 'white') + '">White paper</button><button type="button" role="radio" data-m="cloth" aria-checked="' + (photo.mode === 'cloth') + '">Cloth</button></div>' : '') + '</div>' +
      (photo.base ? '<div class="pp-wrap"><canvas class="pp-cv"></canvas></div>' : '') +
      '<div class="pp-out"></div></details>';
  }
  function photoRadius() { return Math.max(4, Math.round(photo.base.width / 70)); }
  function photoSample(x, y) {
    const c = photo.base.getContext('2d'), r = photoRadius();
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), w = Math.min(photo.base.width - x0, 2 * r + 1), h = Math.min(photo.base.height - y0, 2 * r + 1);
    const d = c.getImageData(x0, y0, w, h).data, px = [];
    for (let i = 0; i < d.length; i += 4) {
      const lin = [VC.srgbToLinear(d[i]), VC.srgbToLinear(d[i + 1]), VC.srgbToLinear(d[i + 2])];
      px.push({ lin: lin, Y: 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] });
    }
    px.sort(function (p1, p2) { return p1.Y - p2.Y; });
    const keep = px.slice(Math.floor(px.length * 0.1), Math.ceil(px.length * 0.9)), acc = [0, 0, 0];
    keep.forEach(function (q) { acc[0] += q.lin[0]; acc[1] += q.lin[1]; acc[2] += q.lin[2]; });
    return VC.rgbToHex(acc.map(function (v) { return VC.linearToSrgb(v / keep.length); }));
  }
  function photoDraw(body) {
    const cv = $('.pp-cv', body); if (!cv || !photo.base) return;
    cv.width = photo.base.width; cv.height = photo.base.height;
    const c = cv.getContext('2d'); c.drawImage(photo.base, 0, 0);
    const r = photoRadius(), mark = function (pt, col) { if (!pt) return; c.lineWidth = Math.max(2, r / 3); c.strokeStyle = '#fff'; c.beginPath(); c.arc(pt.x, pt.y, r + c.lineWidth, 0, Math.PI * 2); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(pt.x, pt.y, r, 0, Math.PI * 2); c.stroke(); };
    mark(photo.whiteAt, '#2e5480'); mark(photo.at, '#7a2433');
  }
  function photoResult(body, k) {
    const out = $('.pp-out', body); if (!out) return;
    if (!photo.base) { out.innerHTML = ''; return; }
    if (!photo.raw) { out.innerHTML = '<p class="small muted">' + (photo.white ? 'Light corrected from the paper. Now click the cloth.' : 'Click the white paper, or skip it and click the cloth.') + '</p>'; return; }
    const hex = photo.white ? VC.rgbToHex(VC.whiteBalance(VC.hexToRgb(photo.raw), VC.hexToRgb(photo.white))) : photo.raw;
    const lab = VC.hexToLab(hex);
    const near = D.colours.map(function (c) { return { hex: c.hex, name: c.name, dE: VC.deltaE2000(lab, VC.hexToLab(c.hex)) }; }).sort(function (p1, p2) { return p1.dE - p2.dE; })[0];
    const t = E.scoreColour(hex, api.analysis()).tier, tn = E.scoreColour(near.hex, api.analysis()).tier;
    const warn = [];
    if (!photo.white) warn.push('No white paper read, so the colour of the light is in this reading: indoor bulbs make cloth look warmer and yellower than it is.');
    if (lab[0] < 10) warn.push('Very dark: the photo may be underexposed, and dark cloth often reads darker in photos than in hand.');
    if (lab[0] > 96) warn.push('Nearly white: the photo may be overexposed here.');
    const pat = VP.norm(piece(k).pat);
    out.innerHTML = '<div class="pp-res"><span class="d" style="background:' + hex + '"></span><span><strong>Read: ' + hex.toUpperCase() + '</strong> ' + tt(t) +
      '<br><span class="small">Nearest named colour: ' + esc(near.name) + ' ' + tt(tn) + ' (ΔE ' + (Math.round(near.dE * 10) / 10) + (near.dE < 3 ? ', hard to tell apart' : near.dE < 7 ? ', close' : ', not a close match') + ')</span></span></div>' +
      '<p class="pp-fit">' + fitLine(k, hex) + '</p>' +
      (warn.length ? '<p class="small muted">' + warn.join(' ') + '</p>' : '') +
      '<div class="pp-acts"><button type="button" class="btn small pp-use" data-hex="' + hex + '">Wear this colour</button>' +
      '<button type="button" class="btn small ghost pp-use" data-hex="' + near.hex + '">Wear ' + esc(near.name) + '</button>' +
      (pat.type !== 'solid' ? '<button type="button" class="btn small ghost pp-second" data-hex="' + hex + '">Use as the pattern\'s second colour</button>' : '') + '</div>';
    $$('.pp-use', out).forEach(function (b) { previewOn(b, k, function () { return { hex: b.dataset.hex }; }); b.addEventListener('click', function () { api.preview(null); setColour(k, b.dataset.hex); }); });
    const sec = $('.pp-second', out);
    if (sec) sec.addEventListener('click', function () { snapshot(); piece(k).pat = { type: pat.type, scale: pat.scale, hex2: sec.dataset.hex }; commit(kindOf(k).name + ': second colour from the photo.'); });
  }
  function photoWire(body, k) {
    const det = $('.photo-pick', body); if (!det) return;
    det.addEventListener('toggle', function () { photo.open = det.open; });
    $('.pp-file', body).addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const img = new Image();
      img.onload = function () {
        const sc = Math.min(1, 1000 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        Object.assign(photo, { base: cv, white: null, whiteAt: null, raw: null, at: null, mode: 'white', open: true });
        render();
      };
      img.src = URL.createObjectURL(f);
    });
    $$('.pp-mode button', body).forEach(function (b) { b.addEventListener('click', function () { photo.mode = b.dataset.m; $$('.pp-mode button', body).forEach(function (q) { q.setAttribute('aria-checked', String(q === b)); }); }); });
    const cv = $('.pp-cv', body);
    if (cv) cv.addEventListener('click', function (e) {
      const rc = cv.getBoundingClientRect(), pt = { x: Math.round((e.clientX - rc.left) * cv.width / rc.width), y: Math.round((e.clientY - rc.top) * cv.height / rc.height) };
      const hex = photoSample(pt.x, pt.y);
      if (photo.mode === 'white') {
        photo.white = hex; photo.whiteAt = pt; photo.mode = 'cloth';
        $$('.pp-mode button', body).forEach(function (q) { q.setAttribute('aria-checked', String(q.dataset.m === 'cloth')); });
      } else { photo.raw = hex; photo.at = pt; }
      photoDraw(body); photoResult(body, k);
    });
    photoDraw(body); photoResult(body, k);
  }

  function previewOn(el, k, getter) {
    el.addEventListener('pointerenter', function () { api.preview(k, getter()); });
    el.addEventListener('pointerleave', function () { api.preview(null); });
    el.addEventListener('focus', function () { api.preview(k, getter()); });
    el.addEventListener('blur', function () { api.preview(null); });
  }
  function setColour(k, hex) {
    snapshot(); piece(k).hex = hex; api.preview(null);
    commit(kindOf(k).name + ' set to ' + api.nameOf(hex) + '.');
  }

  let custTimer = 0;
  function colourEditor(body, k, x, a, p) {
    // Suggestions carry the same judgement as the library: one that would clash is not offered,
    // one that would bend a rule shows the "!" and the reason instead of a reason to wear it.
    const fitS = E.fitFor(engineOutfit(), a, k);
    const sug = E.suggest(engineOutfit(), a, k, 14).map(function (q) { return Object.assign(q, { j: fitS.judge(q.hex, q.name) }); })
      .filter(function (q) { return q.j.state !== 'out'; }).slice(0, 8);
    // What still works in this place, given the other pieces (engine.js, fitFor).
    const fit = S().fitMark !== false ? E.fitFor(engineOutfit(), a, k) : null;
    const sw = function (hex, name, tier, extra) {
      const j = fit && fit.byHex[hex.toLowerCase()];
      return '<button type="button" class="swatch t' + tier + (hex.toLowerCase() === x.hex.toLowerCase() ? ' sel' : '') + (j && j.state !== 'ok' ? ' fit-' + j.state : '') + '" data-hex="' + hex + '" title="' + esc(name) + ': tier ' + tier + (j && j.why ? '. ' + esc(j.why) : '') + '">' +
        '<span class="chip" style="background:' + hex + '">' + tt(tier) + '</span><span class="sname">' + esc(name) + '</span>' + (extra || '') + '</button>';
    };
    const lib = D.colours.map(function (c) { return { hex: c.hex, name: c.name, family: c.family, tier: E.scoreColour(c.hex, a).tier }; })
      .filter(function (c) {
        if (filter.fam !== 'all' && c.family !== filter.fam) return false;
        if (filter.q && c.name.toLowerCase().indexOf(filter.q.toLowerCase()) < 0) return false;
        if (p.face && filter.faceOnly && c.tier > 2) return false;
        return true;
      });
    const ok = VC.rgbToOklch(VC.hexToRgb(x.hex));
    body.innerHTML =
      '<h4>Suggested for this outfit</h4><p class="ed-note">The best colours for this piece, given everything else you are wearing; colours that would clash are left out, and "!" marks one that bends a rule. Hover to see it on the chart; click to wear it.</p>' +
      '<div class="sug-row">' + sug.map(function (s) {
        const care = s.j.state === 'care';
        return '<button type="button" class="sug' + (care ? ' fit-care' : '') + '" data-hex="' + s.hex + '"' + (care ? ' title="' + esc(s.j.why) + '"' : '') + '><span class="d" style="background:' + s.hex + '"></span><span><strong>' + esc(s.name) + '</strong> ' + tt(s.tier) +
          '<small>' + (care ? '<span class="fit-care-t">Careful:</span> ' + esc(s.j.why.split(/(?<=\.)\s/)[0]) : esc(s.why)) + '</small></span></button>';
      }).join('') + '</div>' +
      photoHtml() +
      '<h4>All colours</h4>' +
      '<div class="lib-bar"><input type="search" class="lib-q" placeholder="Search: navy, claret, anthracite…" value="' + esc(filter.q) + '" aria-label="Search colours">' +
      '<div class="fam-chips">' + FAMILIES.map(function (f) { return '<button type="button" data-fam="' + f[0] + '" aria-pressed="' + (filter.fam === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (p.face ? '<label class="check small"><input type="checkbox" class="lib-face"' + (filter.faceOnly ? ' checked' : '') + '> Only tiers 1 and 2 (this sits at the face)</label>' : '') +
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
    photoWire(body, k);
    const q = $('.lib-q', body);
    q.addEventListener('input', function () { filter.q = q.value; colourEditor(body, k, x, a, p); const n = $('.lib-q', body); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    $$('[data-fam]', body).forEach(function (b) { b.addEventListener('click', function () { filter.fam = b.dataset.fam; colourEditor(body, k, x, a, p); }); });
    const fo = $('.lib-face', body);
    if (fo) fo.addEventListener('change', function () { filter.faceOnly = fo.checked; colourEditor(body, k, x, a, p); });
    $('.lib-fit', body).addEventListener('change', function (e) { S().fitMark = e.target.checked; api.save(); colourEditor(body, k, x, a, p); });

    // custom colour from OKLCH sliders, with a live verdict and live preview
    let cur = x.hex;
    const show = function (hex, fromHex) {
      cur = hex;
      $('.cust-prev', body).style.background = hex;
      if (!fromHex) $('.cust-hex', body).value = hex;
      const t = E.scoreColour(hex, a).tier;
      $('.cust-tier', body).innerHTML = tt(t);
      clearTimeout(custTimer); custTimer = setTimeout(function () { const f = $('.cust-fit', body); if (f) f.innerHTML = fitLine(k, hex); }, 120);
      api.preview(k, { hex: hex });
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
    show(x.hex); api.preview(null);
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
    const kd = kindOf(k); if (!kd.cloths) return '';
    const cur = G.cloth(k, x);
    return '<h4>Cloth</h4><p class="ed-note">What it is made of sets how formal it is, which season it belongs to, and whether it shines.</p><div class="cloth-grid">' +
      kd.cloths.map(function (id) {
        const c = G.CLOTHS[id], f = kd.f == null ? null : Math.min(kd.f, c.f);
        return '<button type="button" class="cloth' + (cur.id === id ? ' sel' : '') + '" data-cloth="' + id + '" aria-pressed="' + (cur.id === id) + '">' +
          '<span class="cl-name">' + esc(c.name.replace(/ \(shiny\)$/, '')) + '</span><span class="cl-tags">' +
          (f != null ? '<span>' + FWORD[Math.max(0, f)] + '</span>' : '') + '<span>' + (c.season === 'all' ? 'all year' : c.season) + '</span>' + (c.sheen === 2 ? '<span class="cl-shiny">shiny</span>' : '') + '</span></button>';
      }).join('') + '</div>';
  }
  /* A brimmed hat's band colour and brim width. */
  function hatHtml(k, x) {
    if (k !== 'hat' || !kindOf(k).brim) return '';
    const band = x.band || '', brim = x.brim || 'medium';
    return '<div class="hat-extra"><h4>Band</h4><p class="ed-note">The ribbon (grosgrain) round the crown sits at the face, so its colour counts there. A darker band than the hat gives it a line.</p>' +
      '<div class="band-row">' + G.BANDS.map(function (h) { return '<button type="button" class="band' + (h.toLowerCase() === band.toLowerCase() ? ' sel' : '') + '" data-band="' + h + '" title="' + esc(api.nameOf(h)) + '" aria-label="' + esc(api.nameOf(h)) + ' band" style="background:' + h + '"></button>'; }).join('') +
      '<input type="color" class="band-any" value="' + (band || '#1d2a44') + '" aria-label="Any band colour" title="Any colour">' + (band ? ' <span class="small">' + esc(api.nameOf(band)) + '</span>' : ' <span class="small muted">no band chosen</span>') + '</div>' +
      '<h4>Brim</h4><div class="seg" role="radiogroup" aria-label="Brim width">' + G.BRIMS.map(function (b) { return '<button type="button" role="radio" data-brim="' + b.id + '" aria-checked="' + (b.id === brim) + '" title="' + b.cm + '">' + b.name + '</button>'; }).join('') + '</div>' +
      '<p class="ed-note">Narrow ' + G.BRIMS[0].cm + ', medium ' + G.BRIMS[1].cm + ', wide ' + G.BRIMS[2].cm + ' at the side. The brim should follow your frame.</p></div>';
  }
  function wireHat(body, k) {
    $$('[data-band]', body).forEach(function (b) { b.addEventListener('click', function () { snapshot(); piece(k).band = b.dataset.band; commit('Hat band: ' + api.nameOf(b.dataset.band) + '.'); }); });
    const any = $('.band-any', body); if (any) any.addEventListener('change', function () { snapshot(); piece(k).band = any.value; commit('Hat band: ' + api.nameOf(any.value) + '.'); });
    $$('[data-brim]', body).forEach(function (b) { b.addEventListener('click', function () { snapshot(); piece(k).brim = b.dataset.brim; commit('Brim: ' + b.dataset.brim + '.'); }); });
  }
  function wireCloth(body, k) {
    $$('.cloth', body).forEach(function (b) {
      b.addEventListener('click', function () { snapshot(); piece(k).cloth = b.dataset.cloth; commit(kindOf(k).name + ' in ' + G.CLOTHS[b.dataset.cloth].name.toLowerCase() + '.'); });
    });
  }
  function clothEditor(body, k, x, a) {
    if (kindOf(k).pats.length <= 1) { body.innerHTML = (clothHtml(k, x) || '<p class="ed-note">Worn plain.</p>') + hatHtml(k, x); wireCloth(body, k); wireHat(body, k); return; }
    const pat = VP.norm(x.pat), others = engineOutfit();
    const accents = [];
    Object.keys(others).forEach(function (o) {
      if (o === k || !others[o] || typeof others[o] !== 'object' || !others[o].hex) return;
      accents.push(others[o].hex);
      const op = VP.norm(others[o].pat); if (op.type !== 'solid') accents.push(op.hex2);
    });
    ACCENT_NEUTRALS.forEach(function (h) { accents.push(h); });
    const uniq = accents.filter(function (h, i) { return accents.findIndex(function (q) { return q.toLowerCase() === h.toLowerCase(); }) === i && h.toLowerCase() !== x.hex.toLowerCase(); }).slice(0, 12);
    // default second colour: one already in the outfit, at a moderate lightness step from the ground
    const L0 = VC.hexToLab(x.hex)[0], target = Math.min(35, (a.contrast * 1.5 + 15) * 0.55);
    const byStep = uniq.slice().sort(function (p1, p2) { return Math.abs(Math.abs(VC.hexToLab(p1)[0] - L0) - target) - Math.abs(Math.abs(VC.hexToLab(p2)[0] - L0) - target); });
    const hex2 = pat.type === 'solid' ? (byStep[0] || '#f7f6f2') : pat.hex2;
    const cls = pat.type === 'solid' ? null : VP.scaleClass(pat.scale);
    body.innerHTML = clothHtml(k, x) +
      '<h4>Pattern</h4><p class="ed-note">The patterns the guide uses on a ' + lname(k) + ', up to ' + kindOf(k).maxScale + ' scale. Typical use under each' +
        (function () { const cl = G.cloth(k, x); const n = cl ? kindOf(k).pats.filter(function (t) { return !G.patOK(cl.id, t); }).length : 0;
          return n ? '; greyed out: not made in ' + esc(clothWord(cl)) + '. Choose another cloth above for those.' : '.'; })() + '</p>' +
      '<div class="pat-grid">' + VP.TYPES.filter(function (t) { return kindOf(k).pats.indexOf(t.id) >= 0; }).map(function (t) {
        const tp = { type: t.id, scale: t.scale, hex2: hex2 }, cl = G.cloth(k, x), can = !cl || G.patOK(cl.id, t.id);
        return '<button type="button" class="pat' + (pat.type === t.id ? ' sel' : '') + (can ? '' : ' no-cloth') + '" data-type="' + t.id + '"' +
          (can ? '' : ' disabled title="Not made in ' + esc(clothWord(cl)) + '"') + '>' +
          '<span class="pat-img" style="' + (t.id === 'solid' ? 'background:' + x.hex : 'background-image:url(' + VP.thumb(x.hex, tp, t.scale < 1 ? 10 : t.scale > 4 ? 46 : 18, t.scale > 4 ? 2 : 4) + ')') + '"></span>' +
          '<span class="pat-name">' + t.name + '</span><span class="pat-use">' + (can ? t.use : 'not made in ' + esc(clothWord(cl))) + '</span></button>';
      }).join('') + '</div>' +
      (pat.type === 'solid' ? '' :
        '<h4>Scale</h4>' +
        '<label class="s-slider scale-slider"><span>Repeat</span><input type="range" class="pat-scale" min="' + toPos(VP.byId[pat.type].min || 0.15).toFixed(1) + '" max="' + toPos(VP.byId[pat.type].max || 20).toFixed(1) + '" step="0.5" value="' + toPos(pat.scale).toFixed(1) + '">' +
        '<span class="ends"><span>' + (VP.byId[pat.type].min || 0.15) + ' cm</span><span>' + (VP.byId[pat.type].max || 20) + ' cm</span></span></label>' +
        '<p class="ed-note">' + VP.byId[pat.type].name + ' is made from ' + (VP.byId[pat.type].min || 0.15) + ' to ' + (VP.byId[pat.type].max || 20) + ' cm a repeat.</p>' +
        '<p class="scale-read"><strong class="sc-cm">' + pat.scale + ' cm</strong> <span class="tierpill sc-cls">' + cls.label + '</span> <span class="sc-hand">' + cls.hand + '</span></p>' +
        '<h4>Second colour</h4><p class="ed-note">Colours already in the outfit come first: patterns that share a colour hold together.</p>' +
        '<div class="acc-row">' + uniq.map(function (h) {
          return '<button type="button" class="acc' + (h.toLowerCase() === hex2.toLowerCase() ? ' sel' : '') + '" data-hex="' + h + '" title="' + esc(api.nameOf(h)) + '" style="background:' + h + '"></button>';
        }).join('') + '<input type="color" class="acc-any" value="' + hex2 + '" aria-label="Any second colour" title="Any colour"></div>' +
        '<h4>About life size</h4><div class="life"><canvas class="life-cv"></canvas><div class="ruler"></div><p class="ed-note">10 cm of cloth at screen scale (approximate: screens differ).</p></div>' +
        '<h4>From a distance <button type="button" class="info" data-info="distance" aria-label="What is this?">?</button></h4>' +
        '<p class="ed-note">The same patch of cloth (<span class="dist-cm"></span>), then what the eye can still see of it from each distance, enlarged.</p>' +
        '<div class="dist-row">' + [0].concat(V().DISTANCES).map(function (d) {
          return '<figure class="dist" data-m="' + (d.m || 0) + '"><canvas></canvas><figcaption><strong>' + (d.m ? d.label : 'up close') + '</strong><span class="dist-state"></span><span class="dist-note">' + (d.m ? d.note : 'in your hand') + '</span></figcaption></figure>';
        }).join('') + '</div><p class="dist-why"></p><p class="dist-cam" hidden></p>');

    wireCloth(body, k);
    const apply = function (np, keep) {
      if (!keep) snapshot();
      piece(k).pat = np; commit(kindOf(k).name + ': ' + patLabel(piece(k)) + '.');
    };
    $$('.pat', body).forEach(function (b) {
      if (b.disabled) return;                       // not made in this cloth: no preview, no choice
      const t = VP.byId[b.dataset.type];
      const np = function () { return t.id === 'solid' ? { type: 'solid' } : { type: t.id, scale: pat.type === t.id ? pat.scale : t.scale, hex2: hex2 }; };
      previewOn(b, k, function () { return { hex: x.hex, pat: np() }; });
      b.addEventListener('click', function () { api.preview(null); apply(np()); });
    });
    if (pat.type === 'solid') return;
    const sc = $('.pat-scale', body);
    sc.addEventListener('input', function () {
      const cm = toCm(+sc.value), c = VP.scaleClass(cm);
      $('.sc-cm', body).textContent = cm + ' cm'; $('.sc-cls', body).textContent = c.label; $('.sc-hand', body).textContent = c.hand;
      api.preview(k, { hex: x.hex, pat: { type: pat.type, scale: cm, hex2: hex2 } });
      drawLife(body, x.hex, { type: pat.type, scale: cm, hex2: hex2 });
      drawDistance(body, x.hex, { type: pat.type, scale: cm, hex2: hex2 });
    });
    sc.addEventListener('change', function () { api.preview(null); apply({ type: pat.type, scale: toCm(+sc.value), hex2: hex2 }); });
    $$('.acc', body).forEach(function (b) {
      previewOn(b, k, function () { return { hex: x.hex, pat: { type: pat.type, scale: pat.scale, hex2: b.dataset.hex } }; });
      b.addEventListener('click', function () { api.preview(null); apply({ type: pat.type, scale: pat.scale, hex2: b.dataset.hex }); });
    });
    const any = $('.acc-any', body);
    any.addEventListener('input', function () { const np = { type: pat.type, scale: pat.scale, hex2: any.value }; api.preview(k, { hex: x.hex, pat: np }); drawLife(body, x.hex, np); drawDistance(body, x.hex, np); });
    any.addEventListener('change', function () { api.preview(null); apply({ type: pat.type, scale: pat.scale, hex2: any.value }); });
    drawLife(body, x.hex, pat);
    drawDistance(body, x.hex, pat);
  }
  function drawLife(body, hex, pat) {
    const cv = $('.life-cv', body); if (!cv) return;
    const w = Math.min(cv.parentNode.clientWidth || 380, Math.round(10 * PX_PER_CM)), h = Math.round(4 * PX_PER_CM), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d'), rep = Math.max(2, pat.scale * PX_PER_CM * dpr);
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

  /* ---------- Checks and fixes ---------- */
  function fixesFor(c, a) {
    if (c.score >= 0.85) return [];
    const locks = S().outfit.locks, out = [];
    if (c.fixes) return c.fixes.slice(0, 2).map(function (f) {
      return { label: f.label, run: function () {
        snapshot();
        if (f.acc) Object.assign(S().outfit.acc[f.acc], f.set);
        if (f.slot && f.on === false) piece(f.slot).on = false;
        if (f.slot && f.pat) piece(f.slot).pat = f.pat;
        if (f.slot && f.set) Object.assign(piece(f.slot), f.set);
        commit(f.label + '.');
      } };
    });
    if (c.id === 'band' && !locks.hat) return [{ label: 'Navy band', hex: '#1d2a44', run: function () { snapshot(); piece('hat').band = '#1d2a44'; commit('Hat band: navy.'); } }];
    if (c.id === 'brim' && !locks.hat) return [{ label: 'Medium brim', run: function () { snapshot(); piece('hat').brim = 'medium'; commit('Brim: medium.'); } }];
    if (c.group === 'accessory') return [];
    if (c.group === 'sheen' || c.group === 'formality' || c.group === 'season' || c.id === 'shoe') return wholeFixes(c, locks);
    if (c.group === 'pattern') return patternFixes(c, locks);
    if (c.fix && c.fix.kind === 'solid' && !locks[c.fix.slot]) out.push({ label: 'Make the ' + lname(c.fix.slot) + ' plain', run: function () { snapshot(); piece(c.fix.slot).pat = { type: 'solid' }; commit('Made the ' + lname(c.fix.slot) + ' plain.'); } });
    if (['neck', 'square', 'layer', 'frame'].indexOf(c.id) >= 0) {
      const k0 = (c.slots || [])[0];
      if (c.id === 'neck' && worn('tie') && !worn('scarf')) out.push({ label: 'A scarf instead', run: function () { snapshot(); piece('scarf').on = true; piece('scarf').hex = piece('tie').hex; piece('tie').on = false; commit('A scarf instead of the ' + lname('tie') + '.'); } });
      if ((c.id === 'neck' || c.id === 'square') && k0 && worn(k0)) out.push({ label: 'Take off the ' + lname(k0), run: function () { snapshot(); piece(k0).on = false; commit('Took off the ' + lname(k0) + '.'); } });
      if ((c.id === 'layer' || c.id === 'frame') && !locks.shirt) out.push({ label: 'Wear a shirt next to the neck', run: function () { snapshot(); piece('shirt').kind = 'shirt'; if (VP.norm(piece('shirt').pat).type === 'breton') piece('shirt').pat = { type: 'solid' }; commit('A shirt is next to the neck now; its collar frames the face.'); } });
      if (out.length) return out.slice(0, 2);
    }
    (c.slots || []).forEach(function (k) {
      if (out.length >= 2 || !piece(k) || locks[k] || !worn(k)) return;
      const fitK = E.fitFor(engineOutfit(), a, k);
      const best = E.suggest(engineOutfit(), a, k, 6).find(function (q) { return fitK.judge(q.hex, q.name).state === 'ok'; });
      if (best) out.push({ label: 'Try ' + best.name + ' ' + lname(k), hex: best.hex, slot: k, run: function () { setColour(k, best.hex); } });
    });
    if (!out.length && (c.slots || []).some(function (k) { return locks[k]; })) out.push({ label: 'Locked: unlock to get a fix', disabled: true });
    return out;
  }
  function patternFixes(c, locks) {
    const out = [], k = (c.slots || [])[0];
    if (!k || !piece(k) || locks[k]) return k && locks[k] ? [{ label: 'Locked: unlock to get a fix', disabled: true }] : [];
    const x = piece(k), pat = VP.norm(x.pat), lbl = lname(k);
    const setPat = function (np, note) { return function () { snapshot(); piece(k).pat = np; commit(note); }; };
    if (pat.type === 'solid') return out;
    if (c.id === 'pscale') {
      const up = Math.min(9, Math.round(pat.scale * 2.2 * 10) / 10);
      out.push({ label: 'Scale the ' + lbl + ' to ' + up + ' cm', run: setPat({ type: pat.type, scale: up, hex2: pat.hex2 }, 'The ' + lbl + ' pattern is now ' + up + ' cm.') });
    }
    if (c.id === 'psize' || c.id === 'pmed') {
      const down = { small: 1.5, medium: 4, large: 9 }[G.kind(k, piece(k)).maxScale] || 1.5;
      out.push({ label: 'Scale the ' + lbl + ' down to ' + down + ' cm', run: setPat({ type: pat.type, scale: down, hex2: pat.hex2 }, 'The ' + lbl + ' pattern is now ' + down + ' cm.') });
    }
    if (c.id === 'pshare' || c.id === 'pcontrast') {
      // a second colour that is shared with the rest of the outfit and sits closer to the ground
      const others = engineOutfit(), L0 = VC.hexToLab(x.hex)[0], hi = api.analysis().contrast * 1.5 + 15, cand = [];
      Object.keys(others).forEach(function (o) { if (o !== k && others[o] && typeof others[o] === 'object' && others[o].hex) { cand.push(others[o].hex); const op = VP.norm(others[o].pat); if (op.type !== 'solid') cand.push(op.hex2); } });
      const ok = cand.filter(function (h) { const d = Math.abs(VC.hexToLab(h)[0] - L0); return d >= 12 && d < hi * 0.85; })
        .sort(function (h1, h2) { return Math.abs(VC.hexToLab(h1)[0] - L0) - Math.abs(VC.hexToLab(h2)[0] - L0); });
      if (ok[0]) out.push({ label: 'Second colour: ' + api.nameOf(ok[0]), hex: ok[0], run: setPat({ type: pat.type, scale: pat.scale, hex2: ok[0] }, 'The ' + lbl + ' pattern now uses ' + api.nameOf(ok[0]) + '.') });
    }
    out.push({ label: 'Make the ' + lbl + ' plain', run: setPat({ type: 'solid' }, 'Made the ' + lbl + ' plain.') });
    return out.slice(0, 2);
  }
  /* The checks, in the Outfit Check card's order (engine.js SECTIONS): each section has its
     question, its checks worst first, and fixes where one exists. */
  function renderChecks(checks, a) {
    const icon = function (s) { return s >= 0.85 ? '<span class="ok">✓</span>' : s >= 0.5 ? '<span class="meh">~</span>' : '<span class="no">✕</span>'; };
    const badge = function (lv) { return '<span class="badge ' + lv.replace('/', '') + '">' + lv + '</span>'; };
    const fixMap = [];
    $('#ovChecks').innerHTML = E.SECTIONS.map(function (sec) {
      const list = checks.filter(function (c) { return E.sectionOf(c) === sec.id; }).sort(function (x, y) { return x.score - y.score; });
      if (!list.length) return '';
      return '<h3 class="ck-h" id="sec-' + sec.id + '">' + sec.title + '<span class="ck-q">' + esc(sec.q) + '</span></h3><ul class="rules ck">' + list.map(function (c) {
        const fx = fixesFor(c, a), base = fixMap.length; fixMap.push(fx);
        return '<li class="' + (c.score < 0.5 ? 'fail' : c.score < 0.85 ? 'warn' : 'pass') + '">' + icon(c.score) + '<span>' + badge(c.level) + ' ' + esc(c.text) +
          (fx.length ? '<span class="fixes">' + fx.map(function (f, j) {
            return '<button type="button" class="btn small' + (j ? ' ghost' : '') + '" data-c="' + base + '" data-f="' + j + '"' + (f.disabled ? ' disabled' : '') + '>' +
              (f.hex ? '<span class="d" style="background:' + f.hex + '"></span>' : '') + esc(f.label) + '</button>';
          }).join('') + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    }).join('');
    $$('#ovChecks [data-c]').forEach(function (b) {
      const f = fixMap[+b.dataset.c][+b.dataset.f]; if (!f || f.disabled) return;
      if (f.hex) previewOn(b, f.slot, function () { return { hex: f.hex }; });
      b.addEventListener('click', function () { api.preview(null); f.run(); });
    });
  }

  /* Fixes for cloth, formality and season: another cloth of the same garment, or another shoe. */
  function wholeFixes(c, locks) {
    const out = [], k = (c.slots || [])[0], a = api.analysis();
    if (!k || !piece(k) || !worn(k)) return out;
    if (locks[k]) return [{ label: 'Locked: unlock to get a fix', disabled: true }];
    const kd = kindOf(k), cur = G.cloth(k, piece(k)), occ = G.OCCASIONS.find(function (x) { return x.id === (S().outfit.occasion || 'smart'); });
    const season = a && a.season === 'summer' ? 'summer' : 'winter';
    const setCloth = function (id) { return { label: kindOf(k).name + ' in ' + G.CLOTHS[id].name.toLowerCase().replace(/ \(shiny\)$/, '') + ' instead', run: function () { snapshot(); piece(k).cloth = id; commit(kindOf(k).name + ' in ' + G.CLOTHS[id].name.toLowerCase() + '.'); } }; };
    const setKind = function (id) { const t = G.byKey[k].kinds.find(function (q) { return q.id === id; }); return { label: 'Wear ' + t.name.toLowerCase() + (/s$/.test(t.name) ? '' : 's') + ' instead', run: function () { snapshot(); piece(k).kind = id; if (piece(k).cloth && t.cloths.indexOf(piece(k).cloth) < 0) piece(k).cloth = t.cloths[0]; commit(t.name + ' instead.'); } }; };
    const fOf = function (id) { return kd.f == null ? null : Math.min(kd.f, G.CLOTHS[id].f); };
    const okCloth = function (id) { const cl = G.CLOTHS[id]; return cl.sheen < 2 && cl.season !== (season === 'summer' ? 'winter' : 'summer'); };
    const inRange = function (f) { return f != null && f >= occ.range[0] && f <= occ.range[1]; };
    if (c.id === 'sheen') { const id = (kd.cloths || []).find(function (q) { return G.CLOTHS[q].sheen < 2 && okCloth(q); }); if (id) out.push(setCloth(id)); }
    else if (c.id === 'season') { const id = (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q) && Math.abs((fOf(q) || 0) - (fOf(cur.id) || 0)) <= 1; }) || (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q); }); if (id) out.push(setCloth(id)); }
    else if (c.id === 'occasion' || c.id === 'formal') {
      const id = (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q) && inRange(fOf(q)); });
      if (id) out.push(setCloth(id));
      else if (k === 'shoes') { const t = G.byKey.shoes.kinds.find(function (q) { return inRange(q.f) && q.id !== kd.id; }); if (t) out.push(setKind(t.id)); }
    } else if (c.id === 'shoe') {
      if (k === 'shoes') out.push(setKind(occ.id === 'business' ? 'oxford' : 'loafer'));
      if (k === 'tie' || (worn('tie') && kindOf('tie').knotted)) out.push({ label: 'Take off the ' + lname('tie'), run: function () { snapshot(); piece('tie').on = false; commit('Took off the ' + lname('tie') + '.'); } });
    } else if (c.id === 'orphan') {
      const jc = G.cloth('jacket', piece('jacket'));
      if (kindOf('trousers').cloths.indexOf(jc.id) >= 0 && !locks.trousers) out.push({ label: 'Trousers in ' + jc.name.toLowerCase() + ', as a suit', run: function () { snapshot(); piece('trousers').cloth = jc.id; commit('Trousers in ' + jc.name.toLowerCase() + ': now a suit.'); } });
    }
    return out.slice(0, 2);
  }

  /* ---------- Whole-outfit actions ---------- */
  function completeOutfit() {
    const a = api.analysis(), before = engineOutfit(), after = E.complete(before, a, S().outfit.locks), changed = [];
    snapshot();
    PIECES.forEach(function (p) {
      if (after[p.key] && before[p.key] && after[p.key].hex !== before[p.key].hex) { piece(p.key).hex = after[p.key].hex; changed.push(lname(p.key) + ' to ' + after[p.key].name); }
    });
    if (!changed.length) { undo.pop(); commit('Nothing to change: no unlocked piece has a better colour for this outfit.'); return; }
    commit('Changed ' + changed.join(', ') + '. Undo to go back.');
  }

  function init(theApi) {
    api = theApi;
    $('#ovComplete').addEventListener('click', completeOutfit);
    $('#ovUndo').addEventListener('click', function () {
      const s = undo.pop(); if (!s) return;
      const o = JSON.parse(s), locks = o.__locks ? o.locks : S().outfit.locks;
      delete o.__locks;
      Object.keys(o).forEach(function (k) { S().outfit[k] = o[k]; });
      S().outfit.locks = locks; commit('Undone.');
    });
    $('#ovPrint').addEventListener('click', printCard);
    $('#ovName').addEventListener('input', function (e) { S().outfit.name = e.target.value.slice(0, 80); api.save(); });
    $('#ovReset').addEventListener('click', function () {
      snapshot(); api.resetOutfit(); open = null; commit('Back to the starting outfit.');
    });
  }

  function note(t) { lastNote = t || ''; render(); }

  /* ---------- The outfit card: one printed page, named, to keep or hand to a tailor ----------
     The browser's print dialogue saves it as a PDF; the page title becomes the file name, so it is
     set to the outfit's name while printing. Colour is only in the swatches and the chart; every
     colour carries its name, because printed colour drifts. */
  function buildCard() {
    const a = api.analysis(); if (!a) return '';
    const o = engineOutfit(), checks = E.checkOutfit(o, a), v = E.verdict(checks), hd = headline(v, E.skinClashes(o, a));
    const name = (S().outfit.name || '').trim(), stAll = status();
    const occ = G.OCCASIONS.find(function (x) { return x.id === o.occasion; });
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = PIECES.filter(function (p) { return o[p.key]; }).map(function (p) {
      const x = piece(p.key), c = G.cloth(p.key, x), st = stAll[p.key];
      const t = E.scoreColour(VP.mean(x.hex, x.pat), a).tier;
      return '<tr><td class="oc-sw"><i style="' + chipStyle(x) + '"></i></td>' +
        '<td><strong>' + esc(p.label) + '</strong>' + (p.kinds.length > 1 ? '<span class="oc-pos">' + esc(p.position) + '</span>' : '') + '</td>' +
        '<td>' + esc(api.nameOf(x.hex)) + '</td><td>' + (c ? esc(c.name) : '') + '</td><td>' + esc(patLabel(x)) + '</td>' +
        '<td class="oc-t">T' + t + '</td>' +
        '<td class="oc-st">' + (st && st.state !== 'ok' ? (st.state === 'out' ? '✕ ' : '! ') + esc(st.why.split(/(?<=\.)\s/)[0]) : '✓') + '</td></tr>';
    }).join('');
    const acc = S().outfit.acc, accs = G.ACCESSORIES.filter(function (d) { return acc[d.key].on; }).map(function (d) {
      const x = acc[d.key], st = d.stone && x.stone && x.stone !== 'none' ? G.stoneBy[x.stone] : null;
      return esc(d.name) + ': ' + esc(G.metalBy[x.metal].name.toLowerCase()) + (st ? ', ' + esc(st.name.toLowerCase()) : '') + (d.size && x.size ? ', ' + x.size + ' mm' : '');
    });
    const secs = E.SECTIONS.map(function (sec) {
      const mine = checks.filter(function (c) { return E.sectionOf(c) === sec.id; }).sort(function (x, y) { return x.score - y.score; });
      if (!mine.length) return '';
      const worst = mine[0].score, mark = worst < 0.5 ? '✕' : worst < 0.85 ? '!' : '✓';
      const notes = mine.filter(function (c) { return c.score < 0.85; });
      return '<li class="' + (worst < 0.5 ? 'no' : worst < 0.85 ? 'meh' : 'ok') + '"><span class="oc-m">' + mark + '</span><span><strong>' + esc(sec.title.replace(/^\d\. /, '')) + '</strong>' +
        (notes.length ? notes.map(function (c) { return '<span class="oc-why">' + esc(c.text) + '</span>'; }).join('') : '') + '</span></li>';
    }).join('');
    const chart = $('#chartOutfit svg.chart-svg');
    return '<h1>' + esc(name || 'Outfit card') + '</h1>' +
      '<p class="pc-sub">' + esc(occ ? occ.name : '') + ', ' + (api.season() === 'summer' ? 'summer' : 'winter') + '. ' + (S().name ? 'For ' + esc(S().name) + '. ' : '') + 'Valet, ' + date + '.</p>' +
      '<div class="oc-verdict ' + hd.level + '"><strong>' + esc(hd.title) + '.</strong> ' + esc(hd.text.replace(/ Fix the first one below; the others often follow\.| Apply its fix and this is a good outfit\./, '')) +
        ' <span class="oc-count">' + v.fails + ' fail' + (v.fails === 1 ? '' : 's') + ', ' + v.warns + ' to note</span></div>' +
      '<div class="oc-grid"><div>' +
      '<h2>Pieces, head to feet</h2><table class="oc-table"><thead><tr><th></th><th>Piece</th><th>Colour</th><th>Cloth</th><th>Pattern</th><th>Tier</th><th>With the rest</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (accs.length ? '<h2>Accessories</h2><p>' + accs.join('; ') + '.</p>' : '') +
      '</div>' + (chart ? '<div class="oc-chart chart-host">' + chart.outerHTML + '</div>' : '') + '</div>' +
      '<h2>The checks</h2><ul class="oc-checks">' + secs + '</ul>' +
      '<p class="pc-foot">T1 to T4: how each colour suits your face on its own (T1 anywhere, T2 the one deliberate colour, T3 below the belt, T4 away from the face). ✓ passes, ! worth knowing, ✕ fails. Printed colours are approximate: go by the names, and check cloth in daylight.</p>';
  }
  function printCard() {
    const card = $('#printCard'); if (!card) return;
    card.innerHTML = buildCard(); card.classList.add('outfit');
    const was = document.title, name = (S().outfit.name || '').trim();
    document.title = 'Valet outfit' + (name ? ' - ' + name : '');
    const back = function () { document.title = was; card.classList.remove('outfit'); window.removeEventListener('afterprint', back); };
    window.addEventListener('afterprint', back);
    window.print();
  }

  window.VWARD = { snapshot: snapshot, note: note, init: init, render: render, engineOutfit: engineOutfit, PIECES: PIECES, status: status, statusLine: statusLine, buildCard: buildCard };
})();
