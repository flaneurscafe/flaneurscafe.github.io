/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser tab: drawing and editing. Every piece can be given a colour and a cloth; the
   outfit is then verified against the colour and pattern rules, each failing rule offers a fix, and
   open pieces can be suggested or filled in around the ones that are locked. The outfit as data (its
   defaults, making it safe, its season, the form the engine reads) is in js/outfit.js; the rules are
   in js/engine.js; the fixes and what a change of garment type takes with it in js/dress.js.
   Started by the interface (js/ui/main.js) with an API; window.VWARD.
   The Dresser is five files (1.21), loaded in this order: this one (helpers, the verdict, the rows of
   the body, garment types, the checks, whole-outfit actions), dresser-saved.js (Saved outfits),
   dresser-editor.js (one piece's colour, cloth and pattern), dresser-acc.js (accessories) and
   dresser-card.js (the printed card, and window.VWARD). They share their helpers and the few values
   more than one of them changes (the API, the note, the view, the editor's tab and filters) through
   window.VDRCORE, here DR: a name written DR.x is defined in another of the five files. */
// @ts-check
(function () {
  'use strict';
  // the Dresser's helpers and shared state, for its other files (dresser-saved, -editor, -acc, -card.js)
  const DR = window.VDRCORE = /** @type {any} */ ({});
  const VC = window.VC, E = window.VENGINE, D = window.VDATA, VP = window.VPAT, O = window.VOUTFIT, X = window.VDRESS;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // A check names a colour that has no name by its code (#c27676); show the colour itself, with the code kept for a mouse-over and a screen reader.
  const escs = function (s) { return esc(s).replace(/#[0-9a-fA-F]{6}\b/g, function (h) { return '<span class="hexsw" style="background:' + h + '" role="img" aria-label="colour ' + h + '" title="' + h + '"></span>'; }); };

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
  // the share of a pattern's second colour, in plain steps (patterns.js keeps any value from 2% to 90%)
  const COVER_STEPS = [{ v: null }, { v: 0.1, label: 'A touch' }, { v: 0.33, label: 'About a third' }, { v: 0.5, label: 'About half' }, { v: 0.7, label: 'Most' }];
  const PX_PER_CM = 96 / 2.54;
  // a spectator's second colour, named (these are not in the colour library)
  const SPEC2 = [['White', '#f2efe6'], ['Cream', '#e6dbc4'], ['Black', '#161616'], ['Dark brown', '#3b2417'], ['Tan', '#a8733f'], ['Navy', '#1d2a44']];
  const spec2Name = function (h) { const c = SPEC2.find(function (x) { return x[1] === String(h).toLowerCase(); }); return c ? c[0].toLowerCase() : DR.api.nameOf(h); };

  DR.api = null; DR.tab = 'colour'; DR.filter = { fam: 'all', q: '', faceOnly: true }; DR.lastNote = ''; let open = null, undo = [];
  // the second colour of a pattern: whether "More colours" is open, and its own search (1.19.1)
  DR.secMore = false; const secFilter = { fam: 'all', q: '' };

  const S = function () { return DR.api.state(); };
  // the first sentence, with its full stop (no lookbehind: Safari before 16.4 cannot parse one)
  const firstSentence = function (t) { const m = String(t).match(/^.*?\.(?=\s|$)/); return m ? m[0] : String(t); };
  const tt = function (t) { return '<span class="tt t' + t + '" title="Tier ' + t + ': ' + E.TIER_TEXT[t].note.replace(/"/g, '') + '">T' + t + '</span>'; };
  const piece = function (k) { return S().outfit[k]; };
  const worn = function (k) { return piece(k).on !== false; };
  // the outfit as the rule engine reads it (js/outfit.js), with the profile's measurements
  function engineOutfit(o) { return O.engineOutfit(o || S().outfit, S(), DR.api.nameOf); }
  /* Whether each worn piece is, right now, part of a problem it could fix: the same judgement as
     the marks on the colour swatches (fitFor), for the colour the piece already has. A piece is
     flagged only when another colour in its place would do better, so a problem between two
     pieces flags both, and one that no colour here can mend flags neither. Recomputed whenever
     anything in the outfit changes, so a piece that becomes a problem because of another change
     says so on its own row. */
  let statusKey = '', statusVal = {};
  function status() {
    const a = DR.api.analysis(); if (!a) return {};
    const o = engineOutfit(), key = JSON.stringify(o) + '|' + a.contrast + '|' + a.lean + '|' + a.redness + '|' + a.underEye;
    if (key === statusKey) return statusVal;
    const out = {};
    PIECES.forEach(function (p) { if (o[p.key]) out[p.key] = E.fitFor(o, a, p.key).judge(o[p.key].hex, o[p.key].name); });
    statusKey = key; statusVal = out;
    return out;
  }
  // The row line and class for one piece's status.
  function statusLine(st) {
    if (!st || st.state === 'ok') return '';
    const first = firstSentence(st.why);
    return '<span class="g-why fit-' + st.state + '-t">' + (st.state === 'out' ? 'Clashes: ' : 'Careful: ') + '<span class="g-why-t">' + esc(first) + '</span></span>';
  }
  /* One colour in one piece, judged with the rest of the outfit: '' when it fits, otherwise a
     Careful or Clashes line with the reason. */
  function fitLine(k, hex) {
    const a = DR.api.analysis(); if (!a || !piece(k)) return '';
    const j = E.fitFor(engineOutfit(), a, k).judge(hex, DR.api.nameOf(hex));
    return j.state === 'ok' ? '<span class="g-why fit-ok-t">Works with the rest of the outfit.</span>' : statusLine(j);
  }
  /* withLocks: the action also changes locks (Keep this, the clash buttons), so Undo puts them back
     too. Otherwise Undo leaves locks as they are now, so a lock set by hand is not undone. */
  function snapshot(withLocks) {
    const o = JSON.parse(JSON.stringify(S().outfit));
    if (withLocks) o.__locks = true;
    undo.push(JSON.stringify(o)); if (undo.length > 30) undo.shift();
  }
  function commit(note) { const fixed = fitPatterns(); DR.lastNote = [note, fixed].filter(Boolean).join(' '); DR.api.commit(); render(); }
  // a pattern its cloth cannot carry becomes plain (js/outfit.js)
  function fitPatterns() { return O.fitPatterns(S().outfit); }

  /* ---------- Rendering ---------- */
  function render() {
    const a = DR.api.analysis();
    $('#outfitEmpty').hidden = !!a; $('#outfitBody').hidden = !a;
    if (!a) return;
    const o = engineOutfit(), checks = E.checkOutfit(o, a), v = E.verdict(checks);
    const nm = $('#ovName'); if (nm && document.activeElement !== nm) nm.value = S().outfit.name || '';
    renderOccasion();
    renderVerdict(v, checks, E.skinClashes(o, a), o, a);
    renderOverview(checks);
    renderPieces(a);
    DR.renderAcc();
    renderChecks(checks, a);
    DR.renderSave();
    $('#ovUndo').disabled = !undo.length;
    DR.aCache = {};
    DR.renderWardrobe(a);
    const gc = $('#clCount'); if (gc) gc.textContent = window.VCLOSETUI.count() ? '(' + window.VCLOSETUI.count() + ')' : '';
    if (DR.view === 'garments') window.VCLOSETUI.render();   // a change of colouring or season asks its question again
  }

  /* The verdict, with clashes against your skin put first and kept on screen for as long as they
     last. A clash on a piece you are keeping cannot be fixed by the rest of the outfit, so the
     verdict says so instead of "one fix away". */
  const what = function (c) { return c.name + ' ' + c.piece; };
  /* The verdict's title and text, with a clash against the skin taking over. */
  function headline(v, clashes) {
    if (v.impossible) return { level: v.level, title: v.title, text: v.text };   // what cannot be worn comes before how it looks
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
    window.VAPP.result('outfit', title, level);
    $('#ovVerdict').innerHTML = '<div><strong>' + title + '</strong><span>' + esc(text) + '</span></div>' +
      '<span class="ov-counts"><span class="no">' + v.fails + ' fail' + (v.fails === 1 ? '' : 's') + '</span><span class="meh">' + v.warns + ' to note</span></span>' +
      (clashes && clashes.length ? clashList(clashes, o, a) : '') +
      (DR.lastNote ? '<p class="ov-note">' + esc(DR.lastNote) + '</p>' : '');
    $$('#ovVerdict [data-cl]').forEach(function (b) {
      const c = clashes[+b.dataset.cl], act = b.dataset.act;
      if (act === 'swap' && b.dataset.hex) {
        b.addEventListener('pointerenter', function () { DR.api.preview(c.slot, { hex: b.dataset.hex }); });
        b.addEventListener('pointerleave', function () { DR.api.preview(null); });
      }
      b.addEventListener('click', function () {
        DR.api.preview(null);
        if (act === 'swap') {
          snapshot(true); S().outfit.locks[c.slot] = false; piece(c.slot).hex = b.dataset.hex;
          commit('Swapped the ' + what(c) + ' for ' + DR.api.nameOf(b.dataset.hex) + '.');
        } else if (act === 'lower') {
          snapshot(true); piece('trousers').hex = piece(c.slot).hex; piece('trousers').pat = { type: 'solid' };
          S().outfit.locks[c.slot] = false; piece(c.slot).hex = b.dataset.hex;
          commit('Moved ' + c.name + ' below the belt as trousers, and gave the ' + c.piece + ' ' + DR.api.nameOf(b.dataset.hex) + '.');
        } else if (act === 'open') { open = c.slot; DR.tab = 'colour'; render(); const el = $('.ov-piece[data-k="' + c.slot + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
      const mine = checks.filter(function (c) { return E.sectionOf(c) === sec.id && E.kindOf(c) !== 'context'; });
      if (!mine.length) return '';
      const worst = Math.min.apply(null, mine.map(function (c) { return c.score; }));
      const st = worst < 0.5 ? 'no' : worst < 0.85 ? 'meh' : 'ok';
      return '<button type="button" class="ovw ' + st + '" data-sec="' + sec.id + '" title="' + esc(sec.q) + '"><span class="ovw-i">' + (st === 'ok' ? '✓' : st === 'meh' ? '~' : '✕') + '</span>' + sec.title.replace(/^\d\. /, '') + '</button>';
    }).join('');
    $$('.ovw', box).forEach(function (b) { b.addEventListener('click', function () { const t = $('#sec-' + b.dataset.sec); if (t) { t.open = true; t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); });
  }

  function chipStyle(x) {
    const pat = VP.norm(x.pat);
    if (x.kind === 'spectator' && x.hex2) return 'background:linear-gradient(90deg,' + x.hex + ' 0 58%,' + x.hex2 + ' 58% 100%)';
    return pat.type === 'solid' ? 'background:' + x.hex : 'background-image:url(' + VP.thumb(x.hex, pat, 12, 3) + ');background-size:cover';
  }
  function patLabel(x) {
    const pat = VP.norm(x.pat);
    return pat.type === 'solid' ? 'plain' : VP.byId[pat.type].name.toLowerCase() + ', ' + (Math.round(pat.scale * 10) / 10) + ' cm' + (pat.cover != null ? ', ' + Math.round(pat.cover * 100) + '% second colour' : '');
  }

  /* The outfit laid out on the body: a row for each level from head to feet, and in each row the
     layers from the innermost on the left to the outermost on the right. A position not worn keeps
     its place as an empty slot, so a piece is added where it is worn. */
  const ZONES = [
    { id: 'head', label: 'Head', keys: ['hat'], acc: ['glasses'] },
    { id: 'upper', label: 'Head to belt', keys: ['shirt', 'tie', 'mid', 'jacket', 'square', 'boutonniere', 'coat', 'scarf'], acc: ['tiebar'] },
    { id: 'hands', label: 'Hands', keys: ['gloves'], acc: ['watch', 'cufflinks', 'ring'] },
    { id: 'legs', label: 'Waist and legs', keys: ['trousers'], acc: ['buckle', 'braces'] },
    { id: 'feet', label: 'Feet', keys: ['socks', 'shoes'], acc: [] }
  ];
  function renderPieces(a) {
    const box = $('#ovPieces');
    const stAll = status();
    const placed = {}; ZONES.forEach(function (z) { z.keys.forEach(function (k) { placed[k] = true; }); });
    const slot = function (p) {
      if (!p.optional || worn(p.key)) return tileHtml(p);
      const why = blockedWhy(p.key);
      return '<button type="button" class="add-btn slot-add" data-add="' + p.key + '"' + (why ? ' disabled aria-describedby="why-' + p.key + '"' : ' title="' + esc(p.kinds.map(function (t) { return t.name; }).join(', ')) + '"') + '>' +
        '<span class="slot-plus" aria-hidden="true">+</span><span class="slot-name">' + (DR.ADD_NAME[p.key] || p.label) + '</span>' +
        (why ? '<span class="slot-why" id="why-' + p.key + '">' + esc(why) + '</span>' : '') + '</button>';
    };
    const byKey = {}; PIECES.forEach(function (p) { byKey[p.key] = p; });
    /** @type {{ label: string, id: string, acc?: string[], list: any[] }[]} */
    const zones = ZONES.map(function (z) { return { label: z.label, id: z.id, acc: z.acc, list: z.keys.filter(function (k) { return byKey[k]; }).map(function (k) { return byKey[k]; }) }; });
    // anything a later version adds that has no place yet goes at the end, so nothing is lost
    const rest = PIECES.filter(function (p) { return !placed[p.key]; });
    if (rest.length) zones.push({ label: 'Other', id: 'other', list: rest });
    box.innerHTML = zones.map(function (z) {
      return '<section class="ov-zone" data-zone="' + z.id + '"><h4 class="ov-zone-lab">' + z.label + (z.list.length > 1 ? ' <span class="ov-zone-dir">inner \u2192 outer</span>' : '') + '</h4>' +
        '<div class="ov-zone-grid">' + z.list.map(slot).join('') + '</div>' +
        (z.acc && z.acc.length ? '<div class="ov-zone-grid ov-zone-acc" data-acc-zone="' + z.id + '" aria-label="Accessories at this level"></div>' : '') + '</section>';
    }).join('');
    function tileHtml(p) {
      const st = stAll[p.key];
      const x = piece(p.key), on = worn(p.key), locked = !!S().outfit.locks[p.key], isOpen = open === p.key;
      const t = on ? E.scoreColour(VP.mean(x.hex, x.pat), a).tier : null;
      const pill = on ? tt(t) : '';
      return '<div class="ov-piece' + (isOpen ? ' open' : '') + (on ? '' : ' off') + (on && st && st.state !== 'ok' ? ' st-' + st.state : '') + '" data-k="' + p.key + '"' + (on && st && st.why ? ' title="' + esc(st.why) + '"' : '') + '>' +
        '<div class="ov-row">' +
        '<button type="button" class="ov-pick" aria-expanded="' + isOpen + '">' +
        '<span class="chip" style="' + (on ? chipStyle(x) : '') + '"></span>' +
        '<span class="g-text">' + (p.kinds.length > 1 ? '<span class="g-pos">' + p.position + '</span>' : '') + '<span class="g-name">' + p.label + '</span><span class="g-colour">' + (on ? esc(DR.api.nameOf(x.hex)) + (G.cloth(p.key, x) ? ', ' + G.cloth(p.key, x).name.toLowerCase().replace(/ \(shiny\)$/, ' (shiny)') : '') + (VP.norm(x.pat).type !== 'solid' ? ', ' + patLabel(x) : '') : 'not worn') + '</span>' + (on ? statusLine(st) : '') + '</span>' +
        '<span class="g-pill">' + pill + '</span></button>' +
        (p.optional ? '<button type="button" class="btn ghost small ov-on"' + (!on && blockedWhy(p.key) ? ' disabled title="' + esc(blockedWhy(p.key)) + '"' : '') + '>' + (on ? 'Take off' : 'Put on') + '</button>' : '') +
        '<button type="button" class="ov-lock" aria-pressed="' + locked + '" title="' + (locked ? 'Locked: suggestions keep it' : 'Unlocked: suggestions may change it') + '" aria-label="Lock the ' + p.label.toLowerCase() + '">' +
        (locked ? '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>' : '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0"/></svg>') +
        '</button></div>' +
        (isOpen && on ? '<div class="ov-editor"></div>' : '') + '</div>';
    }
    $$('[data-add]', box).forEach(function (b) {
      b.addEventListener('click', function () { const k = b.dataset.add; snapshot(); open = k; DR.tab = 'colour'; commit(putOn(k) || 'Added: ' + kindOf(k).name.toLowerCase() + '. ' + (G.byKey[k].kinds.length > 1 ? 'Choose what it is and its colour below.' : 'Choose its colour below.')); });
    });
    $$('.ov-piece', box).forEach(function (el) {
      const k = el.dataset.k;
      $('.ov-pick', el).addEventListener('click', function () {
        if (!worn(k)) { if (blockedWhy(k)) { DR.lastNote = blockedWhy(k); render(); return; } snapshot(); open = k; commit(putOn(k)); return; }
        if (open !== k) DR.tab = 'colour';
        open = open === k ? null : k; render();
      });
      const on = $('.ov-on', el);
      if (on) on.addEventListener('click', function () { snapshot(); let note = ''; if (worn(k)) { piece(k).on = false; if (open === k) open = null; } else note = putOn(k); commit(note); });
      $('.ov-lock', el).addEventListener('click', function () { S().outfit.locks[k] = !S().outfit.locks[k]; DR.api.save(); render(); });
      const ed = $('.ov-editor', el);
      if (ed) DR.renderEditor(ed, k, a);
    });
  }

  /* ---------- Garment types ---------- */
  function kindNote(t) {
    if (t.note) return t.name + ': ' + t.note;
    const fr = { collar: 'its collar frames the face', neck: 'the roll neck frames the face', lapel: 'lapels frame the face', shawl: 'the shawl collar frames the face', scarf: 'a scarf frames the face' }[t.frame];
    const pats = t.pats.filter(function (x) { return x !== 'solid'; }).map(function (x) { return VP.byId[x].name.toLowerCase(); });
    return t.name + ': ' + (fr || (t.frame === null && G.byKey.shirt.kinds.concat(G.byKey.mid.kinds).indexOf(t) >= 0 ? 'no collar, so something else must frame the face' : 'not a frame for the face')) +
      '. ' + (pats.length ? 'Patterns the guide uses on it: ' + pats.join(', ') + ' (up to ' + t.maxScale + ' scale).' : 'Worn plain.');
  }
  // Why a garment type cannot be chosen here now (or '' when it can).
  // what can be put on, and why not: js/dress.js
  function kindBlocked(k, t) { return X.kindBlocked(S().outfit, k, t); }
  const hasLapel = function () { return X.hasLapel(S().outfit); };
  function blockedWhy(k) { return X.blockedWhy(S().outfit, k); }
  function putOn(k) { return X.putOn(S().outfit, k); }
  function setKind(k, id) { snapshot(); commit(applyKind(k, id).join(' ')); }
  // a change of garment type with what follows from it (js/dress.js); returns the notes
  function applyKind(k, id) { return X.applyKind(S().outfit, k, id); }
  // Keep this, fix the rest (js/dress.js): kept for Undo with the locks, since it locks the piece
  function keepAndFix(k) {
    snapshot(true);
    const r = X.keepAndFix(S().outfit, k, { a: DR.api.analysis(), nameOf: DR.api.nameOf, profile: S() });
    if (!r.undoable) undo.pop();
    commit(r.note);
  }

  /* ---------- Checks and fixes ---------- */
  /* The fixes under a check are decided in js/dress.js (tested by tests/fixes.js); here they become
     buttons: pressing one keeps the outfit for Undo, applies the fix and shows its note. */
  function fixesFor(c, a) {
    return X.fixesFor(c, { o: S().outfit, a: a, nameOf: DR.api.nameOf, profile: S() }).map(function (f) {
      return f.disabled ? f : Object.assign({}, f, { run: function () { snapshot(); commit(f.apply(S().outfit)); } });
    });
  }
  /* The checks, in the Outfit Check card's order (rules.js SECTIONS): each section has its
     question, its checks worst first, and fixes where one exists. */
  /* The checks. First what matters most: at most two findings, an impossible combination before a
     failure and a failure before a note, a measured rule before a convention, then by weight. Then
     every check, by the card's sections, one tap away (open by default when nothing is flagged, and
     kept open once opened). Context (advice about your frames, face or build) is information: it is
     marked i and never sets a section's status. */
  /* A check's sentence is a button ending in "Why": the bubble it opens is js/ui/why.js, shared with
     Proportion and Fit. */

  function renderChecks(checks, a) {
    // advice (a context check, or a hint that only suggests) gets an i, not a tick that reads as a pass
    const advice = function (c) { return E.kindOf(c) === 'context' || (c.hint && c.score >= 0.85); };
    const icon = function (s, c) { return c && advice(c) ? '<span class="ck-i" aria-label="information">i</span>' : s >= 0.85 ? '<span class="ok">✓</span>' : s >= 0.5 ? '<span class="meh">~</span>' : '<span class="no">✕</span>'; };
    const badge = function (lv) { return '<span class="badge ' + lv.replace('/', '') + '">' + lv + '</span>'; };
    const fixMap = [];
    const rank = function (c) {
      const k = E.kindOf(c), w = (E.RULES[c.id] && E.RULES[c.id].weight) || 1;
      return (k === 'possibility' && c.score < 0.5 ? 0 : c.score < 0.5 ? 100 : 200) + (k === 'perceptual' ? 0 : 10) - (1 - c.score) * w;
    };
    const flagged = checks.filter(function (c) { return c.score < 0.85 && E.kindOf(c) !== 'context'; }).sort(function (x, y) { return rank(x) - rank(y); });
    const row = function (c) {
        const fx = fixesFor(c, a), base = fixMap.length; fixMap.push(fx);
        const ctx = advice(c);
        const how = E.RULES[c.id] && E.RULES[c.id].how;
        // data-ci: the check's place in the engine's list, for tools/fixes.py (invisible)
        return '<li class="' + (ctx ? 'ctx' : c.score < 0.5 ? 'fail' : c.score < 0.85 ? 'warn' : 'pass') + '" data-ci="' + checks.indexOf(c) + '">' + icon(c.score, c) + '<span>' +
          (how ? '<button type="button" class="rule-help" data-how="' + how + '" data-level="' + esc(c.level || 'B') + '" aria-expanded="false">' + badge(c.level) + ' ' + escs(c.text) +
            ' <span class="rule-why">Why<span class="rule-chev" aria-hidden="true"></span></span></button>' : badge(c.level) + ' ' + escs(c.text)) +
          (fx.length ? '<span class="fixes">' + fx.map(function (f, j) {
            return '<button type="button" class="btn small' + (j ? ' ghost' : '') + '" data-c="' + base + '" data-f="' + j + '"' + (f.disabled ? ' disabled' : '') + '>' +
              (f.hex ? '<span class="d" style="background:' + f.hex + '"></span>' : '') + esc(f.label) + '</button>';
          }).join('') + '</span>' : '') + '</span></li>';
    };
    const top = flagged.slice(0, 2);
    // A check shown under What matters most is not repeated in its section (1.18); the section says where it is.
    // A section with only ticks is folded: its chip at the top already shows the tick, and it opens on a click.
    const sections = E.SECTIONS.map(function (sec) {
      const all = checks.filter(function (c) { return E.sectionOf(c) === sec.id; });
      const list = all.filter(function (c) { return top.indexOf(c) < 0; }).sort(function (x, y) { return x.score - y.score; });
      const moved = all.length - list.length;
      if (!all.length) return '';
      const quiet = !moved && list.every(function (c) { return c.score >= 0.85 && !advice(c); });
      // what the eye measures first, then the conventions, each under a caption when a section has both
      const measured = list.filter(function (c) { return E.kindOf(c) === 'perceptual'; }), rest = list.filter(function (c) { return E.kindOf(c) !== 'perceptual'; });
      const both = measured.length && rest.length;
      const ul = function (l, cap) { return l.length ? (both ? '<p class="ck-kind">' + cap + '</p>' : '') + '<ul class="rules ck">' + l.map(row).join('') + '</ul>' : ''; };
      const head = '<h3 class="ck-h">' + sec.title + '<span class="ck-q">' + esc(sec.q) + (quiet ? (list.length === 1 ? ' It passes.' : ' All ' + list.length + ' pass.') : '') + '</span></h3>';
      const body = (moved ? '<p class="ck-moved">' + (moved === 1 ? 'One check' : moved + ' checks') + ' of this question ' + (moved === 1 ? 'is' : 'are') + ' under What matters most, above.</p>' : '') +
        ul(measured, 'Measured: what the eye sees') + ul(rest, 'Convention: what tailoring expects');
      return '<details class="ck-sec" id="sec-' + sec.id + '"' + (quiet ? '' : ' open') + '><summary>' + head + '</summary>' + body + '</details>';
    }).join('');
    const more = flagged.length - top.length;
    $('#ovChecks').innerHTML = (top.length ? '<h3 class="ck-h ck-top">What matters most</h3><ul class="rules ck ck-first">' + top.map(row).join('') + '</ul>' : '') +
      '<div class="ck-all" id="ckAll">' + (top.length ? '<h3 class="ck-h ck-every">Every check, by the card\'s questions' + (more > 0 ? '<span class="ck-q">' + more + ' more to note or fix below</span>' : '') + '</h3>' : '') + sections + '</div>';
    $$('#ovChecks [data-c]').forEach(function (b) {
      const f = fixMap[+b.dataset.c][+b.dataset.f]; if (!f || f.disabled) return;
      if (f.hex) DR.previewOn(b, f.slot, function () { return { hex: f.hex }; });
      b.addEventListener('click', function () { DR.api.preview(null); f.run(); });
    });
  }

  /* ---------- Whole-outfit actions ---------- */
  // Choose the best colours (js/dress.js)
  function completeOutfit() {
    snapshot();
    const r = X.completeOutfit(S().outfit, { a: DR.api.analysis(), nameOf: DR.api.nameOf, profile: S() });
    if (!r.undoable) undo.pop();
    commit(r.note);
  }

  /* A garment from My garments put on in its position of the outfit being edited. */
  const PIECE_FIELDS = G.PIECE_KEYS;   // every setting a piece carries (garments.js)
  function wearGarment(g) {
    snapshot();
    const k = g.slot, x = piece(k);
    PIECE_FIELDS.forEach(function (f) { delete x[f]; });
    Object.assign(x, JSON.parse(JSON.stringify(g.piece)), { gid: g.id });
    const notes = applyKind(k, x.kind).slice(1);   // what follows from its type (not "… chosen.")
    const why = blockedWhy(k);
    if (why) { x.on = false; notes.unshift(why); } else { const n = putOn(k); if (n) notes.push(n); }
    open = k; DR.tab = 'colour';
    DR.setView('outfit');
    commit((x.on ? 'Wearing “' + g.name + '”.' : 'Could not put on “' + g.name + '”.') + (notes.length ? ' ' + notes.join(' ') : ''));
  }
  function wearOutfit(o, msg) {
    snapshot(true); DR.api.setOutfit(o); open = null;
    DR.setView('outfit'); commit(msg);
  }
  function init(theApi) {
    DR.api = theApi;
    window.VCLOSETUI.init({ api: DR.api, chipStyle: chipStyle, wearGarment: wearGarment, wearOutfit: wearOutfit, markOf: DR.markOf, mark: DR.setMark, note: note,
      showGarments: function () { DR.setView('garments'); } });
    $$('.dr-views [data-view]').forEach(function (b) { b.addEventListener('click', function () { DR.setView(b.dataset.view); }); });
    $('#ovComplete').addEventListener('click', completeOutfit);
    $('#ovUndo').addEventListener('click', function () {
      const s = undo.pop(); if (!s) return;
      const o = JSON.parse(s), locks = o.__locks ? o.locks : S().outfit.locks;
      delete o.__locks;
      Object.keys(o).forEach(function (k) { S().outfit[k] = o[k]; });
      S().outfit.locks = locks; commit('Undone.');
    });
    $('#ovPrint').addEventListener('click', DR.printCard);
    $('#ovName').addEventListener('input', function (e) { S().outfit.name = e.target.value.slice(0, 80); DR.api.save(); });
    $('#ovReset').addEventListener('click', function () {
      snapshot(); DR.api.resetOutfit(); open = null; commit('Back to the starting outfit.');
    });
  }

  function note(t) { DR.lastNote = t || ''; render(); }
  Object.assign(DR, { ACCENT_NEUTRALS: ACCENT_NEUTRALS, COVER_STEPS: COVER_STEPS, FAMILIES: FAMILIES, PIECES: PIECES, PX_PER_CM: PX_PER_CM, S: S, SPEC2: SPEC2, ZONES: ZONES, blockedWhy: blockedWhy, chipStyle: chipStyle, commit: commit, engineOutfit: engineOutfit, firstSentence: firstSentence, fitLine: fitLine, headline: headline, init: init, keepAndFix: keepAndFix, kindBlocked: kindBlocked, kindNote: kindNote, kindOf: kindOf, lname: lname, note: note, patLabel: patLabel, piece: piece, render: render, secFilter: secFilter, setKind: setKind, snapshot: snapshot, spec2Name: spec2Name, status: status, statusLine: statusLine, tt: tt, worn: worn });
})();
