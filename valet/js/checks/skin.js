/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: question 1, against your skin: each colour near the face judged by the colour it shows there.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const bestAtFace = X.bestAtFace, seenColours = X.seenColours, skinReasons = X.skinReasons;

  E.part('skin', /** @param {ValetCtx} ctx */ function (ctx) {
    const p = ctx.p, L = ctx.L, LC = ctx.LC, face = ctx.face, near = ctx.near, add = ctx.add, nm = ctx.nm;
    /* --- colour --- */
    // Each piece is judged by the colour it shows best at the face: its one colour, or for a pattern
    // that reads at 3 m, the better of its main colours (seenColours).
    const best = {}; near.forEach(function (k) { best[k] = bestAtFace(L[k], p); });
    if (LC && best.shirt) {
      const bc = bestAtFace(LC, p);
      if (bc.s.tier > best.shirt.s.tier || (bc.s.tier === best.shirt.s.tier && bc.s.score < best.shirt.s.score)) best.shirt = Object.assign({ collar: true }, bc);
    }
    const weak = !near.length ? [] : near.filter(function (k) { return best[k].s.tier > 2; });
    // A small accent (square, flower) is a note. So is a colour kept from the face by temperature alone:
    // the warm-cool lean is the least certain thing Valet reads from a face, and the sources that use
    // it give no measurement for it (section 3), so on its own it never fails an outfit.
    const tempSoft = function (k) { return best[k].s.tempOnly; };
    // With a skin colour typed in or picked by name, every clash with it is a note: it rests on a guess
    // (in the GG test, a guessed skin produced seven false failures that the measured skin did not).
    const softFace = function (k) { return k === 'square' || k === 'boutonniere' || tempSoft(k) || p.skinMeasured === false; };
    const allSoft = weak.length && weak.every(softFace);
    // When the whole check is a note because of temperature, the sentence says so; when it fails anyway,
    // each piece that would only be a note is marked as such, so the reason is not misread.
    const tempOnlyNote = allSoft && p.skinMeasured === false && weak.some(function (k) { return k !== 'square' && k !== 'boutonniere'; })
      ? ' Your skin colour was entered by hand (or read without white paper), so a clash with it is a note: measure it from a daylight photo with white paper and it counts.'
      : allSoft && weak.some(tempSoft) ? ' A clash of temperature alone is a note, not a failure (section 3).' : '';
    const showColour = function (k) { const x = L[k]; if (best[k].collar) return ', its ' + LC.name.toLowerCase() + ' collar'; return x.visible && seenColours(x).length > 1 && best[k].hex !== x.hex ? ' at its best colour, ' + best[k].hex.toUpperCase() : ''; };
    if (near.length) add(weak.length
      ? { id: 'face', level: 'A/B', score: allSoft ? 0.6 : 0.3, n: weak.length, slots: weak, text: 'Clashes with your skin: ' + weak.map(function (k) { const r = skinReasons(best[k].hex, p); return nm(k) + ' (tier ' + best[k].s.tier + showColour(k) + (r.length ? ', ' + r[0] : '') + (!allSoft && tempSoft(k) ? '; temperature only, a note on its own' : '') + ')'; }).join(' and ') + '. Swap it, or move that colour below the belt.' + tempOnlyNote }
      : { id: 'face', level: 'A/B', score: 1, slots: face, text: 'Against your skin: everything near the face is tier 1 or 2 for you.' });
  });
})();
