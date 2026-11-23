/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: a brimmed hat: its band at the face, its brim against the frame.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const scoreCached = X.scoreCached, VC = X.VC, PARAMS = X.PARAMS;

  /* The band is a small colour right at the face, so it is judged like one: a band in a colour
     that does not suit you is noted (a navy band helps a natural straw panama, Style Guide). The
     brim should follow the frame: a narrow brim looks small on a tall, broad man, a wide one
     swamps a slight one; medium is the safe middle (B). m holds the body measurements, if any. */
  function hatChecks(piece, kd, p, add, nm, m) {
    const band = piece.band, nmHat = piece.name + ' ' + kd.name.toLowerCase();
    if (band) {
      const t = scoreCached(band, p).tier, dE = VC.deltaE2000(VC.hexToLab(band), VC.hexToLab(piece.hex));
      if (t > 2) add({ id: 'band', score: 0.7, slots: ['hat'], text: 'The band of the ' + nmHat + ' sits at the face, and its colour is tier ' + t + ' for you. A navy, charcoal, black or burgundy band would help.' });
      else if (dE < 6) add({ id: 'band', score: 0.9, slots: ['hat'], text: 'The band is almost the hat\'s colour, so it disappears; a band clearly darker than the hat gives it a line.' });
      else add({ id: 'band', score: 1, slots: [], text: 'Hat band: a colour that suits you at the face, clearly separate from the hat.' });
    }
    const brim = piece.brim || 'medium', h = +m.height || 0, sh = +m.shoulder || 0;
    const big = h >= PARAMS.frameTall || sh >= PARAMS.frameBroad, small = (h && h < PARAMS.frameShort) || (sh && sh < PARAMS.frameNarrow);
    if (brim === 'narrow' && big) add({ id: 'brim', score: 0.75, slots: ['hat'], text: 'A narrow brim looks small on a tall or broad frame; a medium brim keeps the hat in proportion to the shoulders.' });
    else if (brim === 'wide' && small) add({ id: 'brim', score: 0.75, slots: ['hat'], text: 'A wide brim can swamp a slight frame; a medium or narrow brim keeps the face the focus.' });
    else add({ id: 'brim', score: 1, slots: [], text: 'Brim: ' + brim + (h || sh ? ', in proportion to your frame.' : '. Medium is the safe middle for most frames.') });
  }

  E.part('hat', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, p = ctx.p, L = ctx.L, K = ctx.K, add = ctx.add, nm = ctx.nm;
    if (L.hat && K.hat.brim) hatChecks(o.hat, K.hat, p, add, nm, o.m || {});
  });
})();
