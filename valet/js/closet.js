/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — My garments: the clothes you own (or are thinking of buying), one entry per piece, and the
   outfits they make together. No page code and no rules of its own: every outfit is judged by the
   rule engine (js/engine.js) exactly as the Dresser judges the outfit you are editing. The Dresser's
   My garments view (js/ui/closet.js) draws this; tests/closet.js checks it. window.VCLOSET.

   How outfits are found (around one garment, or for a garment you might buy):
   1. The core of an outfit is the next-to-the-neck layer, trousers and shoes, with or without a knit
      or waistcoat and with or without a jacket. Every combination of your garments is tried.
   2. Neckwear, a pocket square and socks are then added one at a time, each only where it lowers the
      outfit's penalty: the best tie for that core, then the best square, then the best socks. This
      keeps the count of checks near the number of cores instead of multiplying it. They are tried
      only on a core that is not already a good outfit and fails at most one rule: one piece can mend
      one failure, not two.
   3. The garment asked about is always worn, and only what can go with it is tried (a tie needs a
      shirt with a collar band, a square a jacket with a breast pocket).
   4. Each outfit is judged with the colouring of its season (summer cloth: summer colouring), like
      Saved outfits. */
// @ts-check
(function () {
  'use strict';
  const G = window.VGARM, O = window.VOUTFIT, E = window.VENGINE;
  const MAX = 300;                                    // garments kept
  const CORE = ['shirt', 'trousers', 'shoes', 'mid', 'jacket'];
  const NEEDED = ['shirt', 'trousers', 'shoes'];
  const EXTRA = ['tie', 'square', 'socks'];          // added one at a time where they help
  const FIELDS = G.PIECE_KEYS;                       // every setting a piece carries (garments.js)
  const LEVELS = { good: 0, ok: 1, fix: 2, bad: 3 };
  const GOOD = function (level) { return level === 'good' || level === 'ok'; };
  const idOk = function (id) { return typeof id === 'string' && /^[a-z0-9]{1,40}$/i.test(id); };

  /* ---------- The list ---------- */
  /* A garment: { id, name, slot, own, added, piece, note }. piece holds what the Dresser holds for that
     position (colour, type, cloth, pattern…), made safe the same way. own: false for a garment you
     are thinking of buying, which is tried only when you ask about it. */
  function cleanPiece(slot, p) {
    const o = {}; o[slot] = Object.assign({}, p || {}, { on: true });
    const x = O.normOutfit(o)[slot], out = {};
    FIELDS.forEach(function (f) { if (x[f] !== undefined) out[f] = f === 'pat' ? JSON.parse(JSON.stringify(x.pat)) : x[f]; });
    return out;
  }
  function normGarments(list) {
    if (!Array.isArray(list)) return [];
    const seen = {};
    return list.slice(0, MAX).filter(function (g) {
      return g && typeof g === 'object' && idOk(g.id) && G.byKey[g.slot] && !seen[g.id] && (seen[g.id] = true);
    }).map(function (g) {
      return { id: g.id, name: String(g.name || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || 'Untitled', slot: g.slot,
        own: g.own !== false, added: /^\d{4}-\d{2}-\d{2}$/.test(g.added || '') ? g.added : '', piece: cleanPiece(g.slot, g.piece),
        note: String(g.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) };
    });
  }
  function newId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* A garment from a piece of the outfit being edited. */
  function fromPiece(slot, piece, name, own) {
    return { id: newId(), name: String(name || '').trim().slice(0, 80) || 'Untitled', slot: slot, own: own !== false,
      added: new Date().toISOString().slice(0, 10), piece: cleanPiece(slot, piece) };
  }
  /* A name for a garment saved without one: its colour, its pattern if it has one, and its type
     ("Navy blazer", "Navy tartan jacket"), so two pieces of one colour are told apart in the lists. */
  function autoName(slot, piece, nameOf) {
    const k = G.kind(slot, piece), n = nameOf(piece.hex), p = window.VPAT.norm(piece.pat);
    return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + (p.type !== 'solid' ? window.VPAT.byId[p.type].name.toLowerCase() + ' ' : '') + k.name.toLowerCase();
  }
  /* Its type, cloth and pattern in words, for the list. */
  function describe(g) {
    const k = G.kind(g.slot, g.piece), c = G.cloth(g.slot, g.piece), p = window.VPAT.norm(g.piece.pat);
    // a shirt's collar when it is not the default semi-spread self collar
    const cs = k.collars ? G.collarOf(g.piece) : null, ch = k.collars ? G.contrastCollar(g.slot, g.piece) : null;
    const collar = cs && (cs.id !== 'semispread' || ch || g.piece.collarBand === 'tall') ? (ch ? 'contrast ' : '') + (g.piece.collarBand === 'tall' ? 'tall ' : '') + cs.name.toLowerCase() + ' collar' : '';
    return [k.name, k.brogue && g.piece.brogue === 'brogue' ? 'brogued' : '', c ? O.clothWord(c) : '', p.type !== 'solid' ? window.VPAT.byId[p.type].name.toLowerCase() : '', collar].filter(Boolean).join(', ');
  }
  /* Merging an imported list: a garment already there (same slot, name and piece) is skipped; a
     different one that carries an id already in use gets a new id. incoming: made safe. */
  function merge(list, incoming) {
    const sig = function (g) { return JSON.stringify([g.slot, g.name, g.piece]); };
    const have = {}; list.forEach(function (g) { have[sig(g)] = true; });
    let added = 0, same = 0;
    incoming.forEach(function (g) {
      if (list.length >= MAX) return;
      if (have[sig(g)]) { same++; return; }
      if (list.some(function (x) { return x.id === g.id; })) g.id = newId();
      list.push(g); have[sig(g)] = true; added++;
    });
    return { added: added, same: same };
  }

  /* ---------- Building one outfit from garments ---------- */
  /* base: the outfit whose accessories (glasses, watch, buckle…) and occasion are kept; every
     position is first taken off, then the chosen garments are put on. */
  function bareFrom(base, occasion) {
    const o = O.normOutfit(base);
    G.SLOTS.forEach(function (k) { o[k].on = false; });
    o.locks = {}; delete o.savedId; o.name = '';
    if (occasion) o.occasion = occasion;
    return o;
  }
  function wear(o, g) {
    const x = o[g.slot];
    FIELDS.forEach(function (f) { delete x[f]; }); delete x.gid;
    Object.assign(x, JSON.parse(JSON.stringify(g.piece)), { on: true });
    if (g.id && idOk(g.id) && g.id !== 'probe') x.gid = g.id;   // which garment it is, for the Dresser
  }
  function build(bare, pick) {
    const o = JSON.parse(JSON.stringify(bare));
    Object.keys(pick).forEach(function (k) { if (pick[k]) wear(o, pick[k]); });
    return o;
  }
  /* Whether a garment can be worn with what is already chosen. */
  function allowed(slot, g, pick) {
    const k = G.kind(slot, g.piece);
    if (slot === 'tie') return !!pick.shirt && G.neckwearAllowed(k, G.kind('shirt', pick.shirt.piece));
    if (slot === 'square') return ['jacket', 'coat'].some(function (s) { return pick[s] && G.kind(s, pick[s].piece).pocket; });
    if (slot === 'boutonniere') return ['jacket', 'coat'].some(function (s) { return pick[s] && G.kind(s, pick[s].piece).frame === 'lapel'; });
    return true;
  }

  /* ---------- Finding outfits ---------- */
  /* opts: { base, occasion, profile (for the Proportion checks), nameOf, analysisFor(season) → the
     colouring for 'winter' or 'summer' (null: the season you are in) }. fixed: the garment always
     worn (from the list or not: a colour you might buy). Returns a job: step(ms) works for about ms
     milliseconds and returns true when finished; run() finishes it at once. job.results holds one
     entry per outfit tried: { pick (slot → garment), level, title, fails (rule names), failIds,
     penalty }. job.missing names the positions you have no garment for; job.needs, when nothing
     can be tried, what the garment needs that you do not have. */
  function around(garments, fixed, opts) {
    const pool = {};
    garments.forEach(function (g) { if ((g.own || g.id === fixed.id) && g.id !== fixed.id) (pool[g.slot] = pool[g.slot] || []).push(g); });
    const bare = bareFrom(opts.base, opts.occasion);
    const missing = [];
    const options = {};
    CORE.forEach(function (slot) {
      if (fixed.slot === slot) { options[slot] = [fixed]; return; }
      const own = pool[slot] || [];
      if (NEEDED.indexOf(slot) >= 0) {
        if (own.length) options[slot] = own;
        else { missing.push(slot); options[slot] = [{ id: '', name: '', slot: slot, own: true, piece: cleanPiece(slot, O.normOutfit(opts.base)[slot]), standIn: true }]; }
      } else options[slot] = [null].concat(own);
    });
    // what the fixed garment needs: a collar for neckwear, a pocket or lapel for the square and flower
    if (fixed.slot === 'tie') options.shirt = options.shirt.filter(function (s) { return G.neckwearAllowed(G.kind('tie', fixed.piece), G.kind('shirt', s.piece)); });
    if (fixed.slot === 'square' || fixed.slot === 'boutonniere') options.jacket = options.jacket.filter(function (j) { return j && allowed(fixed.slot, fixed, { jacket: j }); });
    const cores = [];
    (function walk(i, pick) {
      if (i === CORE.length) { cores.push(Object.assign({}, pick)); return; }
      options[CORE[i]].forEach(function (g) { pick[CORE[i]] = g; walk(i + 1, pick); });
    })(0, {});
    const extraFixed = CORE.indexOf(fixed.slot) < 0;
    const aCache = {};
    const analysis = function (o) {
      const se = O.seasonOf(o), key = se === 'summer' || se === 'winter' ? se : 'now';
      if (!(key in aCache)) aCache[key] = opts.analysisFor(key === 'now' ? null : key);
      return aCache[key];
    };
    let checks = 0;
    function judge(pick) {
      const o = build(bare, pick), a = analysis(o); checks++;
      if (!a) return null;
      const ch = E.checkOutfit(O.engineOutfit(o, opts.profile, opts.nameOf), a), v = E.verdict(ch);
      const bad = ch.filter(function (c) { return c.score < 0.5 && E.kindOf(c) !== 'context'; });
      return { pick: pick, level: v.level, title: v.title, failIds: bad.map(function (c) { return c.id; }),
        fails: bad.map(function (c) { return (E.RULES[c.id] && E.RULES[c.id].name) || c.id; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }),
        penalty: E.penalty(ch) };
    }
    const better = function (x, y) { return !y || LEVELS[x.level] < LEVELS[y.level] || (x.level === y.level && x.penalty < y.penalty - 1e-9); };
    // when nothing can be tried, why: what the garment needs is not among yours
    const needs = !cores.length ? (fixed.slot === 'tie' ? 'a shirt with a collar band' : fixed.slot === 'square' ? 'a jacket with a breast pocket' : fixed.slot === 'boutonniere' ? 'a jacket with lapels' : '') : '';
    const job = { results: [], missing: missing, needs: needs, cores: cores.length, coreList: cores.map(function (c) { return Object.assign({}, c); }), checks: function () { return checks; }, done: false };
    let i = 0;
    function one() {
      const pick = cores[i++];
      if (extraFixed) pick[fixed.slot] = fixed;
      if (extraFixed && !allowed(fixed.slot, fixed, pick)) return;
      let best = judge(pick); if (!best) return;
      if (best.level !== 'good' && best.failIds.length <= 1) EXTRA.forEach(function (slot) {
        if (slot === fixed.slot) return;
        (pool[slot] || []).forEach(function (g) {
          if (!allowed(slot, g, best.pick)) return;
          const p = Object.assign({}, best.pick); p[slot] = g;
          const r = judge(p); if (r && better(r, best)) best = r;
        });
      });
      job.results.push(best);
    }
    job.step = function (ms) {
      const until = Date.now() + (ms || 30);
      while (i < cores.length && Date.now() < until) one();
      job.done = i >= cores.length; job.progress = cores.length ? i / cores.length : 1;
      return job.done;
    };
    job.run = function () { while (!job.step(1e9)); return job; };
    return job;
  }

  /* ---------- Which colour to buy ----------
     spec: { slot, kind, cloth, pat } of a garment you might buy; colours: [{ name, hex }] to try. Every
     colour is tried as that garment in the same sample of outfits made from your own garments (at
     most SAMPLE of them, spread evenly over all the combinations), and so are the garments you own in
     that position, so the two can be compared. Only the core of each outfit is judged here, without
     the tie, square and socks pass, to keep it quick; "What goes with it?" then gives the full count
     for one colour. Returns a job like around(); job.rows: [{ hex, name, garment (if owned), share
     (outfits that pass / outfits tried), good (pass: good outfit or works), clean (good outfit: nothing to
     note), cleanShare, tried, pen (penalties summed) }]. */
  const SAMPLE = 150;
  function screen(garments, spec, colours, opts) {
    const own = garments.filter(function (g) { return g.own && g.slot === spec.slot; });
    const cands = colours.map(function (c) { return { hex: c.hex, name: c.name, garment: null }; })
      .concat(own.map(function (g) { return { hex: g.piece.hex, name: g.name, garment: g }; }));
    const probe = { id: 'probe', name: '', slot: spec.slot, own: false, piece: cleanPiece(spec.slot, spec) };
    // the sample: the cores around a garment of this kind, every n-th of them
    const all = around(garments, probe, opts);
    const cores = all.coreList;
    const step = Math.max(1, Math.ceil(cores.length / SAMPLE)), sample = cores.filter(function (c, i) { return i % step === 0; });
    const bare = bareFrom(opts.base, opts.occasion), aCache = {};
    const analysis = function (o) {
      const se = O.seasonOf(o), key = se === 'summer' || se === 'winter' ? se : 'now';
      if (!(key in aCache)) aCache[key] = opts.analysisFor(key === 'now' ? null : key);
      return aCache[key];
    };
    let ci = 0, si = 0, checks = 0;
    const job = { rows: cands.map(function (c) { return Object.assign(c, { good: 0, clean: 0, tried: 0, share: 0, pen: 0 }); }), sample: sample.length, missing: all.missing, done: false, checks: function () { return checks; } };
    function one() {
      const c = job.rows[ci], core = sample[si];
      const g = c.garment || { id: 'probe', slot: spec.slot, piece: Object.assign({}, probe.piece, { hex: c.hex }) };
      const pick = Object.assign({}, core); pick[spec.slot] = g;
      if (allowed(spec.slot, g, pick)) {
        const o = build(bare, pick), a = analysis(o); checks++;
        if (a) { const ch = E.checkOutfit(O.engineOutfit(o, opts.profile, opts.nameOf), a), v = E.verdict(ch); c.tried++; c.pen += E.penalty(ch); if (GOOD(v.level)) c.good++; if (v.level === 'good') c.clean++; }
      }
      if (++si >= sample.length) { si = 0; c.share = c.tried ? c.good / c.tried : 0; c.cleanShare = c.tried ? c.clean / c.tried : 0; ci++; }
    }
    job.step = function (ms) {
      const until = Date.now() + (ms || 30);
      while (ci < job.rows.length && sample.length && Date.now() < until) one();
      job.done = ci >= job.rows.length || !sample.length; job.progress = job.rows.length ? ci / job.rows.length : 1;
      // ties broken first by the share of outfits with nothing to note, then by the smaller average penalty
      if (job.done) job.rows.sort(function (x, y) {
        return y.share - x.share || y.cleanShare - x.cleanShare || (x.tried ? x.pen / x.tried : 0) - (y.tried ? y.pen / y.tried : 0);
      });
      return job.done;
    };
    job.run = function () { while (!job.step(1e9)); return job; };
    return job;
  }

  /* ---------- Reading the results ---------- */
  /* Outfits from one finished job: counts by verdict, the best ones, and those Valet turns down that
     come closest, so that a false fail can be seen and marked. Only one outfit per combination of
     the main layers is listed, so that the best list is not ten versions of the same outfit with
     different socks, and no more than a third of a list shares its trousers, shoes or shirt. */
  function summarise(job, n) {
    n = n || 12;
    const sorted = job.results.slice().sort(function (x, y) { return LEVELS[x.level] - LEVELS[y.level] || x.penalty - y.penalty; });
    const count = { good: 0, ok: 0, fix: 0, bad: 0 };
    sorted.forEach(function (r) { count[r.level] = (count[r.level] || 0) + 1; });
    const key = function (r) { return ['shirt', 'mid', 'jacket', 'trousers'].map(function (k) { return r.pick[k] ? r.pick[k].id : '-'; }).join('|'); };
    // and, so that the list shows the range of what works, at most a third of it with the same
    // trousers, shoes or next-to-the-neck layer; if that leaves the list short, the rest is filled in order
    const pickFrom = function (list, m) {
      const seen = {}, out = [], used = {}, cap = Math.max(1, Math.ceil(m / 3));
      const tag = function (r) { return ['trousers', 'shoes', 'shirt'].map(function (k) { return k + ':' + (r.pick[k] ? r.pick[k].id : '-'); }); };
      list.forEach(function (r) {
        if (out.length >= m || seen[key(r)]) return;
        if (tag(r).some(function (t) { return (used[t] || 0) >= cap; })) return;
        seen[key(r)] = true; out.push(r); tag(r).forEach(function (t) { used[t] = (used[t] || 0) + 1; });
      });
      list.forEach(function (r) { if (out.length < m && !seen[key(r)]) { seen[key(r)] = true; out.push(r); } });
      return out.sort(function (x, y) { return LEVELS[x.level] - LEVELS[y.level] || x.penalty - y.penalty; });
    };
    return {
      tried: sorted.length, count: count, joins: count.good + count.ok,
      best: pickFrom(sorted.filter(function (r) { return GOOD(r.level); }), n),
      nearly: pickFrom(sorted.filter(function (r) { return r.level === 'fix'; }), 6),
      no: pickFrom(sorted.filter(function (r) { return r.level === 'bad'; }), 3)
    };
  }
  /* The outfit of one result, ready to wear or save. */
  function outfitOf(r, opts) { return build(bareFrom(opts.base, opts.occasion), r.pick); }
  /* Which garment is worn in each position of a result: slot → garment id. */
  function idsOf(r) { const out = {}; Object.keys(r.pick).forEach(function (k) { if (r.pick[k] && r.pick[k].id) out[k] = r.pick[k].id; }); return out; }

  window.VCLOSET = { MAX: MAX, CORE: CORE, EXTRA: EXTRA, normGarments: normGarments, cleanPiece: cleanPiece, newId: newId, fromPiece: fromPiece, autoName: autoName,
    describe: describe, merge: merge, around: around, screen: screen, SAMPLE: SAMPLE, summarise: summarise, outfitOf: outfitOf, idsOf: idsOf, isGood: GOOD };
})();
