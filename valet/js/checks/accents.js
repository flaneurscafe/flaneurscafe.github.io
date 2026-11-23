/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: accents: your own colours echoed, one statement per outfit, and the tie against the shirt.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const VC = X.VC, okc = X.okc, PARAMS = X.PARAMS, seenColours = X.seenColours, hueDist = X.hueDist, scoreCached = X.scoreCached, wardrobeNeutral = X.wardrobeNeutral;

  E.part('accents', /** @param {ValetCtx} ctx */ function (ctx) {
    const p = ctx.p, L = ctx.L, K = ctx.K, face = ctx.face, near = ctx.near, add = ctx.add, nm = ctx.nm, lum = ctx.lum;
    // Your own colours echoed (Flusser, Dressing the Man, pp. 23-24, 29-31): the second of his two ways to
    // bring the face forward is to repeat one of its own colours, of the hair (or brows) and of the eyes,
    // in a piece near it: a suit in the shade of the hair, a blue shirt or tie for blue eyes. Only colours
    // with some hue are echoed (a grey or black hair is a matter of contrast, section 4). A tick when it is
    // done, a hint when it is not: it never lowers a verdict.
    if (near.length && p.lab && (p.lab.hair || p.lab.eyes)) {
      const feats = [];
      if (p.lab.hair) feats.push({ what: 'your ' + (p.hairStyle === 'none' ? 'brows' : 'hair'), hex: VC.labToHex(p.lab.hair) });
      if (p.lab.eyes) feats.push({ what: 'your eyes', hex: VC.labToHex(p.lab.eyes) });
      const chromatic = feats.filter(function (f) { return okc(f.hex)[1] >= PARAMS.echoC; });
      if (chromatic.length) {
        let hit = /** @type {{ k: string, f: any } | null} */ (null);
        near.concat(L.jacket && near.indexOf('jacket') < 0 ? ['jacket'] : []).some(function (k) {
          return seenColours(L[k]).some(function (h) {
            const c = okc(h);
            const f = c[1] >= PARAMS.echoC && chromatic.find(function (f) { const fc = okc(f.hex); return hueDist(c[2], fc[2]) <= PARAMS.familyHue && Math.abs(lum(h) - lum(f.hex)) <= PARAMS.echoL; });
            if (f) hit = { k: k, f: f };
            return !!f;
          });
        });
        add({ id: 'echo', score: hit ? 1 : 0.9, slots: [], hint: !hit,   // hint: shown as advice (i), not a tick
          text: hit ? 'Echo: the ' + nm(hit.k) + ' picks up the colour of ' + hit.f.what + ', which draws the eye to the face (Flusser).'
            : 'Hint: nothing near the face repeats the colour of ' + chromatic.map(function (f) { return f.what; }).join(' or ') + '. Echoing one of them is Flusser\'s second way to bring the face forward.' });
      }
    }

    // The under-eye area: removed in 1.8. That dark clothing near the face deepens under-eye shadows is
    // colour-analysis lore with no study behind it and no established menswear writer stating it, so by
    // Valet's own definition it is C, and C claims do not judge (How it works, section 16).

    // One statement per outfit (Style Guide rule 4 and the bold-day rule). Tier 2 is "the one chosen
    // colour": a second, different tier 2 colour at the face competes with it, and so does a
    // tier 4 below the belt. Neutrals are not statements, and two pieces of one colour count once.
    const stated = [];
    face.forEach(function (k) {
      const sc = scoreCached(L[k].mean, p);
      if (sc.tier !== 2 || wardrobeNeutral(L[k].mean)) return;      // a menswear neutral (camel, navy, brown) is not a statement
      const f = stated.find(function (g) { return g.h != null && hueDist(g.h, sc.oklch[2]) <= PARAMS.familyHue; });
      if (f) f.slots.push(k); else stated.push({ h: sc.oklch[2], slots: [k], what: nm(k) + ' (tier 2)' });
    });
    if (L.trousers && scoreCached(L.trousers.mean, p).tier === 4) stated.push({ h: null, slots: ['trousers'], what: nm('trousers') + ' (tier 4)' });
    if (stated.length > 1) add({ id: 'budget', score: stated.length === 2 ? 0.6 : 0.4, slots: stated.slice(1).map(function (g) { return g.slots[0]; }),
      text: 'Statements: ' + stated.map(function (g) { return g.what; }).join(' and ') + '. A deliberate colour works as the one chosen colour of an outfit; keep everything else tier 1 or neutral (rule 4).' });

    // Tie against shirt.
    if (L.tie && L.shirt && K.tie.knotted) {
      // a tie whose pattern reads at 3 m stands clear of the shirt by its colours, not by their average
      const tieCols = seenColours(L.tie), shirtL = lum(L.shirt.mean), shirtLab = VC.hexToLab(L.shirt.mean);
      const dT = Math.max.apply(null, tieCols.map(function (h) { return Math.abs(lum(h) - shirtL); }));
      const dE = Math.max.apply(null, tieCols.map(function (h) { return VC.deltaE2000(VC.hexToLab(h), shirtLab); }));
      const tn = K.tie.name, tl = tn.toLowerCase();
      if (dT < PARAMS.tieL && dE < PARAMS.mergeTo) add({ id: 'tie', score: 0.45, slots: ['tie'], text: tn + ' and shirt are too alike to separate. The ' + tl + ' is usually darker than the shirt.' });
      else if (lum(L.tie.mean) > lum(L.shirt.mean) + 12) add({ id: 'tie', score: 0.75, slots: ['tie'], text: tn + ' lighter than the shirt: possible, but a darker ' + tl + ' on a lighter shirt is the reliable order.' });
    }
  });
})();
