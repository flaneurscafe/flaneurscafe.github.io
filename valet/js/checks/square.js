/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: the pocket square: a breast pocket, white linen, and how it sits with the tie, shirt and jacket.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const VC = X.VC, okc = X.okc, G = X.G, PARAMS = X.PARAMS;

  E.part('square', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, L = ctx.L, K = ctx.K, out = ctx.out, add = ctx.add;
    // Pocket square: needs a breast pocket; white linen is never wrong; matching the tie exactly
    // looks bought as a set. A square picks up a colour from the tie or shirt rather than copying it.
    if (L.square) {
      if (!((L.jacket && K.jacket.pocket) || (L.coat && K.coat.pocket))) add({ id: 'square', score: 0.2, slots: ['square'],
        text: 'A pocket square needs a breast pocket: a tailored jacket, a blazer, or an overcoat with one. Take it off, or wear one of them.' });
      else {
        const sq = VC.hexToLab(L.square.mean), white = sq[0] > 88 && okc(L.square.mean)[1] < 0.03;
        // an exact match: the same colour, the same pattern and the same cloth, as if cut from one piece (Gentleman's
        // Gazette's crossed example is a tie and square of one tweed). The same colour in another cloth is tone on
        // tone, which the softer notes below judge.
        const oneCloth = L.tie && (G.cloth('tie', o.tie) || {}).id === (G.cloth('square', o.square) || {}).id;
        if (L.tie && K.tie.knotted && oneCloth && VC.deltaE2000(sq, VC.hexToLab(L.tie.mean)) < PARAMS.squareSetDE && L.square.pat.type === L.tie.pat.type)
          add({ id: 'sqmatch', score: 0.3, slots: ['square'], fixes: [{ label: 'A white linen square', slot: 'square', set: { hex: '#f7f6f2', cloth: 'linen', pat: { type: 'solid' } } }],
            text: 'Square and ' + K.tie.name.toLowerCase() + ' match: Flusser calls a matching tie and handkerchief the sign of an unsure dresser, and a way to lead the eye across the body and away from the face (Dressing the Man, pp. 216\u2013217). Let the square echo a colour of the tie, shirt or jacket, or wear white linen.' });
        else if (white) add({ id: 'square', score: 1, slots: ['square'], text: 'White linen square: never wrong.' });

        // With a tie (Flusser, Dressing the Man, pp. 216-217): the tie decides the square. A plain square goes
        // with a patterned tie, and not in the tie's ground colour; a plain square echoes a colour of the tie,
        // shirt or jacket rather than matching it; and the two differ in surface, a matte square with a silk
        // tie's lustre and a silk square with a dull wool or linen tie. White linen is the fallback that always
        // works, so it is exempt from all of this.
        if (!white && L.tie && K.tie.knotted && !out.some(function (c) { return (c.id === 'square' || c.id === 'sqmatch') && c.score < 0.85; })) {
          const sqPlain = !L.square.visible, tiePlain = !L.tie.visible;
          if (sqPlain && tiePlain) add({ id: 'hank', score: 0.7, slots: ['square', 'tie'],
            text: 'A plain square with a plain ' + K.tie.name.toLowerCase() + ': Flusser keeps the plain square for a patterned tie. A patterned square, or white linen, sits better here.' });
          else if (sqPlain && VC.deltaE2000(sq, VC.hexToLab(L.tie.hex)) < PARAMS.squareSetDE) add({ id: 'hank', score: 0.7, slots: ['square'],
            text: 'The square is the ground colour of the ' + K.tie.name.toLowerCase() + ': it brackets the chest and leads the eye away from the face. Pick up one of the tie\'s other colours, or the shirt\'s (Flusser).' });
          else if (sqPlain) {
            const others = [].concat(L.tie.colours, L.shirt ? L.shirt.colours : [], L.jacket ? L.jacket.colours : []);
            const echoes = others.some(function (h) { return VC.deltaE2000(sq, VC.hexToLab(h)) < PARAMS.patternShareDE; });
            add({ id: 'hank', score: echoes ? 1 : 0.9, slots: echoes ? [] : ['square'], hint: !echoes,   // hint: shown as advice (i), not a tick
              text: echoes ? 'The square echoes a colour of the tie, shirt or jacket without matching the tie, as Flusser advises.' : 'Hint: the square repeats no colour of the tie, shirt or jacket; Flusser would have it echo one of them.' });
          }
          const sheenOf = function (k) { const c = G.cloth(k, o[k]); return c ? c.sheen || 0 : 0; };
          const tieSilk = sheenOf('tie') >= 1, sqSilk = sheenOf('square') >= 1;
          if (tieSilk === sqSilk) add({ id: 'hank', score: 0.8, slots: ['square'],
            text: tieSilk ? 'A silk square with a silk ' + K.tie.name.toLowerCase() + ': Flusser pairs a tie\'s lustre with a matte square, in linen or cotton, so the two do not look like a set.'
              : 'A matte square with a matte ' + K.tie.name.toLowerCase() + ': Flusser gives a dull wool or linen tie the lift of a silk square.' });
        }
      }
    }
  });
})();
