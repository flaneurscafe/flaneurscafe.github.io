/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: question 2, contrast: the light-dark step at the neck, and the outfit's contrast against the face's.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const stepOver = X.stepOver, PARAMS = X.PARAMS, round = X.round, seenColours = X.seenColours;

  E.part('contrast', /** @param {ValetCtx} ctx */ function (ctx) {
    const p = ctx.p, L = ctx.L, K = ctx.K, LC = ctx.LC, out = ctx.out, add = ctx.add, nm = ctx.nm, lum = ctx.lum, lo = ctx.lo, hi = ctx.hi;
    // A light-dark step at the face (Outfit Check, question 2), in proportion to the face: the layer
    // next to the neck against the one that meets it at the neck. In the order they sit there: a
    // scarf, which lies against the collar whatever is worn over the shirt; else a knit or waistcoat,
    // which is put on before the jacket; else the jacket; else a coat worn straight over the shirt;
    // else a tie. A hat, or a coat over a jacket, is further out, so it neither rescues a flat shirt
    // and jacket nor is blamed for a strong step.
    // with a contrast collar, the collar is what meets the next layer at the neck
    const neckMean = LC ? LC.mean : L.shirt ? L.shirt.mean : null;
    const nmNeck = function () { return LC ? nm('shirt') + ' (' + LC.name.toLowerCase() + ' collar)' : nm('shirt'); };
    const over = stepOver(function (k) { return !!L[k]; }, function (k) { return lum(k === 'shirt' && LC ? LC.mean : L[k].mean); });
    if (L.shirt && over) {
      const best = Math.abs(lum(neckMean) - lum(L[over].mean)), pair = ['shirt', over];
      if (best < lo * PARAMS.stepNear) add({ id: 'step', score: 0.35, slots: [over, 'shirt'], level: 'A/B',
        text: 'Light-dark step: ' + nmNeck() + ' and ' + nm(over) + ' are close in lightness (' + round(best) + '; your face carries at least ' + round(lo) + '). The frame goes flat: make one clearly lighter or darker.' });
      else if (best < lo) add({ id: 'step', score: 0.65, slots: [over, 'shirt'], level: 'A/B',
        text: 'Light-dark step: ' + nmNeck() + ' against ' + nm(over) + ' (' + round(best) + ') is a little short of what your face carries (' + round(lo) + '). It still frames the face; a slightly lighter shirt or darker layer frames it more clearly.' });
      else if (p.contrastLevel === 'low' && best > hi) add({ id: 'step', score: 0.6, slots: pair, level: 'A/B',
        text: 'Light-dark step: ' + nmNeck() + ' against ' + nm(over) + ' (' + round(best) + ') is far stronger than your own low contrast.' });
      else add({ id: 'step', score: 1, slots: pair, level: 'A/B', text: 'Light-dark step: ' + nmNeck() + ' against ' + nm(over) + ' (' + round(best) + ') gives the face a frame.' });
    } else if (L.shirt && K.shirt.frame) {
      add({ id: 'step', score: 0.75, slots: ['shirt'],
        text: 'One layer at the face: ' + (K.shirt.frame === 'neck' ? 'the roll neck' : 'the collar of the ' + K.shirt.name.toLowerCase()) + ' is the only frame. Fine on a warm day; a jacket, a knit or a tie adds a second (rule 8).' });
    }

    // The outfit's contrast against the face's (Flusser, Dressing the Man, pp. 20-22, 26-29): the colours of
    // an outfit should show about as much light-dark contrast as the face shows between skin and hair. Only
    // the ends of the scale are judged, as Flusser does: a muted face is overwhelmed by a stark outfit, and a
    // high-contrast face is dampened by a tonal one; a medium face carries the widest range. Measured over
    // the main pieces and the colours a pattern shows (seenColours), as the lightness range from darkest to
    // lightest. Where the light-dark step at the collar has already said the same, it is not said twice.
    {
      // at the face, as in Flusser's examples (the tie's stripes, the shirt against the suit): the trousers are
      // far from it, and a dark pair under a pale top does not give the face the contrast it carries
      let pieces = ['shirt', 'tie', 'scarf', 'mid', 'jacket', 'coat'].filter(function (k) { return L[k]; });
      // with a single top the outfit is that top and the trousers, seen together, so they count
      if (pieces.length < 2 && L.trousers) pieces = pieces.concat(['trousers']);
      const Ls = []; pieces.forEach(function (k) { seenColours(L[k]).forEach(function (h) { Ls.push(lum(h)); }); });
      if (LC && pieces.indexOf('shirt') >= 0) Ls.push(lum(LC.mean));   // a contrast collar is a colour at the face too
      const stepSaid = out.some(function (c) { return c.id === 'step' && c.score < 0.85 && /^Light-dark step/.test(c.text); });   // not the one-layer note
      if (Ls.length >= 2 && !stepSaid) {
        const range = Math.max.apply(null, Ls) - Math.min.apply(null, Ls);
        if (p.contrastLevel === 'low' && range > hi) add({ id: 'ocontrast', level: 'B', score: 0.65, slots: [],
          text: 'Outfit contrast: from darkest to lightest the outfit spans ' + round(range) + ' in lightness, more than your low-contrast colouring carries (' + round(hi) + '). Stark light-dark contrast takes the eye from a muted face; softer steps suit it (Flusser).' });
        // "the same degree of contrast" (Flusser, Dressing the Man, p. 20): a high-contrast face asks for a high-contrast outfit at the face,
        // the same band that makes the face high contrast (PARAMS.contrastHigh), not half of it
        else if (p.contrastLevel === 'high' && range < PARAMS.contrastHigh) add({ id: 'ocontrast', level: 'B', score: 0.65, slots: [],
          text: 'Outfit contrast: at the face the outfit spans only ' + round(range) + ' in lightness, less than your high-contrast colouring shows (' + round(PARAMS.contrastHigh) + ' or more). A tonal outfit dampens a face like yours; a clearly lighter or darker piece near the face livens it (Flusser).' });
        else if (p.contrastLevel !== 'medium') add({ id: 'ocontrast', level: 'B', score: 1, slots: [],
          text: 'Outfit contrast: a range of ' + round(range) + ' in lightness, in keeping with your ' + p.contrastLevel + '-contrast colouring.' });
      }
    }
  });
})();
