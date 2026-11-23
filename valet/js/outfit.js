/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the outfit as data: its default, how a stored or imported outfit is made safe (normOutfit,
   normWardrobe), the season of an outfit read from its cloths, the outfit as the rule engine reads
   it, and merging imported saved outfits. No page code: the Dresser (js/ui/dresser.js) draws and
   edits outfits through these, and tests/outfit.js checks them on their own. window.VOUTFIT. */
(function () {
  'use strict';
  const G = window.VGARM, VP = window.VPAT;
  const isHex = function (h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); };

  /* The outfit: one entry per position in garments.js, each { hex, kind, cloth, pat, on } (a hat
     also has band and brim); pat is a cloth pattern (patterns.js). locks keep pieces fixed when the
     Dresser suggests or completes; name is the outfit's own name, for the printed card. */
  const DEFAULT_OUTFIT = {
    hat: { hex: '#3d4045', kind: 'flatcap', pat: { type: 'solid' }, on: false },
    shirt: { hex: '#c3d7ee', kind: 'shirt', pat: { type: 'solid' } }, tie: { hex: '#5e1f2c', kind: 'tie', pat: { type: 'solid' }, on: false },
    mid: { hex: '#3d4045', kind: 'crew', pat: { type: 'solid' }, on: false },
    jacket: { hex: '#1d2a44', kind: 'jacket', pat: { type: 'solid' }, on: true, buttons: 'silver' },   // a blazer's buttons start in the same metal as the default watch and buckle
    coat: { hex: '#3d4045', kind: 'overcoat', cloth: 'melton', pat: { type: 'solid' }, on: false },
    gloves: { hex: '#4a3326', kind: 'leather', pat: { type: 'solid' }, on: false },
    boutonniere: { hex: '#f7f6f2', kind: 'flower', pat: { type: 'solid' }, on: false, metal: 'silver' },
    scarf: { hex: '#3d4045', kind: 'scarf', cloth: 'cashmere', pat: { type: 'solid' }, on: false }, square: { hex: '#f7f6f2', kind: 'square', pat: { type: 'solid' }, on: false },
    trousers: { hex: '#8e9196', kind: 'trousers', pat: { type: 'solid' } },
    socks: { hex: '#1d2a44', kind: 'socks', pat: { type: 'solid' }, on: true }, shoes: { hex: '#4a3326', kind: 'loafer', cloth: 'calf' }, locks: {}, occasion: 'smart',
    acc: {
      glasses: { on: false, frame: 'gold', hex: '#161616' },
      watch: { on: true, metal: 'silver', size: 38, strap: 'leather', display: 'analogue' }, buckle: { on: true, metal: 'silver' }, braces: { on: false },
      cufflinks: { on: false, metal: 'silver', stone: 'none', size: 15 }, tiebar: { on: false, metal: 'silver', size: 45 },
      ring: { on: false, metal: 'silver', stone: 'none', size: 12 }
    }
  };
  /* Until 1.5 a coat was a kind of outer layer in the jacket's place. It moves to its own position,
     its type read from its cloth; a waxed cotton coat becomes a waxed jacket and stays. */
  function migrateCoat(o) {
    if (!o || !o.jacket || typeof o.jacket !== 'object' || o.jacket.kind !== 'coat' || (o.coat && typeof o.coat === 'object')) return o;
    o = Object.assign({}, o); const j = o.jacket, c = j.cloth;
    if (c === 'waxed') { o.jacket = Object.assign({}, j, { kind: 'waxed' }); return o; }
    const kind = c === 'gabardine' ? 'trench' : (c === 'nylonmatte' || c === 'nylongloss') ? 'parka' : 'overcoat';
    o.coat = Object.assign({}, j, { kind: kind });
    o.jacket = Object.assign({}, DEFAULT_OUTFIT.jacket, { on: false });
    if (o.locks && o.locks.jacket) { o.locks = Object.assign({}, o.locks, { coat: true, jacket: false }); }
    return o;
  }
  function normOutfit(o) {
    o = migrateCoat(o);
    const d = JSON.parse(JSON.stringify(DEFAULT_OUTFIT)), out = { locks: (o && o.locks) || {} };
    window.VGARM.SLOTS.forEach(function (k) {
      const v = o && o[k];
      out[k] = typeof v === 'string' ? Object.assign({}, d[k], { hex: v }) : Object.assign({}, d[k], v || {});
      if (!window.VGARM.byKey[k].kinds.some(function (t) { return t.id === out[k].kind; })) out[k].kind = d[k].kind;
      // colours go into the page's markup, so anything that is not a colour is replaced
      if (!isHex(out[k].hex)) out[k].hex = d[k].hex;
      if (out[k].rise != null && ['high', 'mid', 'low'].indexOf(out[k].rise) < 0) delete out[k].rise;
      if (out[k].length != null && ['short', 'regular', 'long'].indexOf(out[k].length) < 0) delete out[k].length;
      if (out[k].hex2 != null && !isHex(out[k].hex2)) delete out[k].hex2;                 // a spectator's second colour
      if (out[k].band != null && !isHex(out[k].band)) delete out[k].band;                 // a hat's band
      if (out[k].gid != null && !(typeof out[k].gid === 'string' && /^[a-z0-9]{1,40}$/i.test(out[k].gid))) delete out[k].gid;   // the garment it is (My garments)
      if (out[k].brim != null && !window.VGARM.BRIMS.some(function (b) { return b.id === out[k].brim; })) delete out[k].brim;
      if (out[k].buttons != null && !window.VGARM.BUTTONS.some(function (b) { return b[0] === out[k].buttons; })) delete out[k].buttons;
      if (out[k].metal != null && !window.VGARM.metalBy[out[k].metal]) out[k].metal = 'silver';           // a lapel pin's metal
      // a shirt's collar (1.17): its style, its band and a contrast colour; anything unknown is dropped, which reads as a semi-spread self collar
      if (out[k].collar != null && !window.VGARM.collarBy[out[k].collar]) delete out[k].collar;
      if (out[k].collarBand != null && !window.VGARM.COLLAR_BANDS.some(function (b) { return b.id === out[k].collarBand; })) delete out[k].collarBand;
      if (out[k].collarHex != null && !isHex(out[k].collarHex)) delete out[k].collarHex;
      if (!out[k].pat || typeof out[k].pat !== 'object') out[k].pat = { type: 'solid' };
      else if (out[k].pat.hex2 != null && !isHex(out[k].pat.hex2)) { out[k].pat = Object.assign({}, out[k].pat); delete out[k].pat.hex2; }
      // a pattern the garment does not take, or its cloth cannot carry, is worn plain
      const kd = window.VGARM.byKey[k].kinds.find(function (t) { return t.id === out[k].kind; }), pt = out[k].pat.type, cl = window.VGARM.cloth(k, out[k]);
      if (pt && pt !== 'solid' && ((kd && kd.pats.indexOf(pt) < 0) || (cl && !window.VGARM.patOK(cl.id, pt)))) out[k].pat = { type: 'solid' };
    });
    if (o && o.jacketOn === false) out.jacket.on = false;
    // Until v1.3 the scarf was a kind of neckwear: move such a scarf to its own position.
    if (o && o.tie && o.tie.kind === 'scarf' && !(o.scarf && o.scarf.on)) {
      out.scarf = Object.assign({}, d.scarf, { hex: o.tie.hex, pat: o.tie.pat || { type: 'solid' }, cloth: o.tie.cloth || d.scarf.cloth, on: o.tie.on !== false });
      out.tie = Object.assign({}, d.tie, { hex: o.tie.hex, on: false });
    }
    out.name = o && typeof o.name === 'string' ? o.name.slice(0, 80) : '';
    if (o && typeof o.savedId === 'string' && /^[a-z0-9]{1,40}$/i.test(o.savedId)) out.savedId = o.savedId;   // the wardrobe entry it came from
    out.occasion = window.VGARM.OCCASIONS.some(function (x) { return o && x.id === o.occasion; }) ? o.occasion : 'smart';
    out.acc = {};
    Object.keys(d.acc).forEach(function (k) {
      const x = out.acc[k] = Object.assign({}, d.acc[k], (o && o.acc && o.acc[k]) || {}), G = window.VGARM;
      if (k === 'braces') { x.on = !!x.on; delete x.metal; return; }   // nothing to set but whether they are worn
      if (k === 'glasses') {
        if (!G.FRAMES.some(function (f) { return f[0] === x.frame; })) x.frame = 'gold';
        if (!isHex(x.hex)) x.hex = '#161616';
        delete x.metal; return;
      }
      if (!G.metalBy[x.metal]) x.metal = d.acc[k].metal;
      if (x.stone != null && !G.stoneBy[x.stone]) x.stone = d.acc[k].stone;
      if (k === 'watch') {
        if (!G.STRAPS.some(function (t) { return t.id === x.strap; })) x.strap = d.acc.watch.strap;
        delete x.strapHex; delete x.dial;   // 1.6 kept strap and dial colours; they are not judged
        if (['analogue', 'digital'].indexOf(x.display) < 0) x.display = 'analogue';
      }
    });
    return out;
  }
  /* The saved outfits: each is checked like the outfit being edited, since its fields reach the page. */
  function normWardrobe(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 500).filter(function (w) { return w && typeof w === 'object' && w.outfit && typeof w.id === 'string' && /^[a-z0-9]{1,40}$/i.test(w.id); }).map(function (w) {
      const o = normOutfit(w.outfit); delete o.savedId; o.locks = {};
      const out = { id: w.id, name: String(w.name || '').slice(0, 80) || 'Untitled outfit', saved: /^\d{4}-\d{2}-\d{2}$/.test(w.saved || '') ? w.saved : '',
        season: ['winter', 'summer', 'all', 'mixed'].indexOf(w.season) >= 0 ? w.season : 'all', occasion: o.occasion, outfit: o };
      // your own verdict (1.13): good, so-so or bad, with the day and Valet's verdict at the time
      if (MARKS.indexOf(w.mark) >= 0) {
        out.mark = w.mark;
        if (/^\d{4}-\d{2}-\d{2}$/.test(w.marked || '')) out.marked = w.marked;
        if (typeof w.markVerdict === 'string') out.markVerdict = w.markVerdict.slice(0, 40);
      }
      if (w.fromMarks === true) out.fromMarks = true;   // saved by marking it in My garments: unmarking takes it out again
      // the garments it was made from (My garments): position → garment id
      if (w.from && typeof w.from === 'object') {
        const f = {}; G.SLOTS.forEach(function (k) { if (typeof w.from[k] === 'string' && /^[a-z0-9]{1,40}$/i.test(w.from[k])) f[k] = w.from[k]; });
        if (Object.keys(f).length) out.from = f;
      }
      return out;
    });
  }
  const MARKS = ['good', 'mid', 'bad'];
  /* Whether your mark and Valet's verdict disagree: you call it good and Valet fails it, or you call
     it bad and Valet passes it. So-so never disagrees. level: Valet's verdict level. */
  function disagrees(mark, level) {
    return (mark === 'good' && (level === 'fix' || level === 'bad')) || (mark === 'bad' && (level === 'good' || level === 'ok'));
  }

  /* ---------- Saved outfits ---------- */
  /* Grouped first by season, read from the cloths (winter cloth only: winter; summer cloth only:
     summer; neither: all year; both: mixed, which the season rule fails), then by the occasion. */
  const SEASONS = [['winter', 'Winter'], ['summer', 'Summer'], ['all', 'All year'], ['mixed', 'Winter and summer cloth mixed']];
  function seasonOf(o) {
    let w = 0, su = 0;
    G.SLOTS.forEach(function (k) {
      const x = o[k]; if (!x || x.on === false) return;
      const c = G.cloth(k, x), kd = G.kind(k, x), sea = (kd && kd.season) || (c && c.season);
      if (sea === 'winter') w++; else if (sea === 'summer') su++;
    });
    // both winter and summer cloth: the season rule fails it, so it is not filed as all year
    return w && su ? 'mixed' : w ? 'winter' : su ? 'summer' : 'all';
  }
  /* A name for an outfit saved without one: its first two main pieces. nameOf: hex → colour name. */
  function autoName(o, nameOf) {
    const parts = ['jacket', 'mid', 'shirt', 'trousers'].filter(function (k) { return o[k] && o[k].on !== false; }).slice(0, 2);
    return parts.map(function (k) { return nameOf(o[k].hex) + ' ' + G.kind(k, o[k]).name.toLowerCase(); }).join(', ');
  }
  /* The outfit as it is kept in the list: a copy, without the link to its entry or its locks. */
  function snapshotOutfit(o) {
    o = JSON.parse(JSON.stringify(o)); delete o.savedId; o.locks = {}; return o;
  }
  function newId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* What makes two outfits the same for a mark: the pieces worn (type, cloth, colour, pattern…) and
     the occasion. Accessories, names and locks do not count. */
  const SIG_FIELDS = ['hex', 'kind', 'cloth', 'pat', 'rise', 'length', 'hex2', 'buttons', 'metal', 'band', 'brim'];
  // added in 1.17, and only when set, so the marks on outfits saved before keep their signature
  const SIG_EXTRA = ['collar', 'collarBand', 'collarHex'];
  function outfitSig(o) {
    const out = [o.occasion || 'smart'];
    G.SLOTS.forEach(function (k) {
      const x = o[k]; if (!x || x.on === false) return;
      const sig = SIG_FIELDS.map(function (f) { const c = f === 'cloth' ? G.cloth(k, x) : null, v = f === 'pat' ? VP.norm(x.pat) : f === 'cloth' ? (c ? c.id : null) : x[f]; return v === undefined ? null : v; });
      // a value at its default is the same collar: semi-spread, a standard band, a collar in the body's own colour
      SIG_EXTRA.forEach(function (f) {
        const v = x[f], dflt = v == null || (f === 'collar' && v === 'semispread') || (f === 'collarBand' && v === 'standard') || (f === 'collarHex' && String(v).toLowerCase() === String(x.hex).toLowerCase());
        if (!dflt) sig.push(f + ':' + v);
      });
      out.push(k, sig);
    });
    return JSON.stringify(out);
  }
  /* Importing adds to the list: an outfit already there (same name and pieces) is skipped, and a
     different one that happens to carry the same id is kept under a new id. incoming must already be
     made safe (normWardrobe). Changes list; returns { added, same }. */
  function mergeWardrobe(list, incoming) {
    const sig = function (w) { return JSON.stringify([w.name, w.outfit]); };
    const have = {}; list.forEach(function (w) { have[sig(w)] = true; });
    let added = 0, same = 0;
    incoming.forEach(function (w) {
      if (have[sig(w)]) { same++; return; }
      if (list.some(function (x) { return x.id === w.id; })) w.id = newId();
      list.push(w); have[sig(w)] = true; added++;
    });
    return { added: added, same: same };
  }

  /* ---------- The outfit as the rule engine reads it ----------
     o: the outfit; profile: its measurements, shape and hair style (for the Proportion checks);
     nameOf: hex → colour name. A piece that is not worn is null. */
  function engineOutfit(o, profile, nameOf) {
    profile = profile || {};
    const out = {};
    G.SLOTS.forEach(function (k) {
      const x = o[k];
      out[k] = !x || x.on === false ? null : { hex: x.hex, name: nameOf(x.hex), kind: x.kind, cloth: x.cloth, band: x.band, brim: x.brim, pat: x.pat || { type: 'solid' }, rise: x.rise, length: x.length, hex2: x.hex2, buttons: x.buttons, metal: x.metal, collar: x.collar, collarBand: x.collarBand, collarHex: x.collarHex, collarName: isHex(x.collarHex) ? nameOf(x.collarHex) : undefined };
    });
    out.propOn = true;
    const m = profile.measurements;
    if (window.VBODY && m && m.height > 0) { const dd = window.VBODY.derive(m, profile.shape); out.body = Object.assign({ faceClass: dd.faceClass }, dd.pct); } else out.body = {};
    out.frame = window.VPROP ? window.VPROP.frameSize(m) : null;
    out.shape = profile.shape || {};
    out.hairStyle = profile.hairStyle;
    out.occasion = o.occasion || 'smart';
    out.m = m || {};
    out.acc = JSON.parse(JSON.stringify(o.acc || {}));
    out.acc.wrist = +(m && m.wrist) || null;
    return out;
  }

  /* A pattern has to exist in its cloth (garments.js, CLOTH_PATS): whatever changed a piece's type,
     cloth or pattern, a pattern its cloth cannot carry becomes plain. Changes o; returns a note for
     each worn piece that changed. */
  function clothWord(c) { return c.name.replace(/ \(shiny\)$/, '').replace(/^Cotton twill \(chino\)$/, 'cotton twill').toLowerCase(); }
  function fitPatterns(o) {
    const notes = [];
    G.SLOTS.forEach(function (k) {
      const x = o[k]; if (!x) return;
      const pat = VP.norm(x.pat), c = G.cloth(k, x);
      if (pat.type === 'solid' || !c || G.patOK(c.id, pat.type)) return;
      x.pat = { type: 'solid' };
      if (x.on !== false) notes.push('The ' + G.kind(k, x).name.toLowerCase() + ' is now plain: ' + VP.byId[pat.type].name.toLowerCase() + ' is not made in ' + clothWord(c) + '.');
    });
    return notes.join(' ');
  }

  window.VOUTFIT = { DEFAULT_OUTFIT: DEFAULT_OUTFIT, isHex: isHex, normOutfit: normOutfit, normWardrobe: normWardrobe, MARKS: MARKS, disagrees: disagrees, SEASONS: SEASONS, seasonOf: seasonOf,
    autoName: autoName, snapshotOutfit: snapshotOutfit, newId: newId, outfitSig: outfitSig, mergeWardrobe: mergeWardrobe, engineOutfit: engineOutfit, fitPatterns: fitPatterns, clothWord: clothWord };
})();
