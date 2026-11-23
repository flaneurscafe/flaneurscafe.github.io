/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: question 3, frame: what frames the face, and a V-neck over a collarless top.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const G = X.G;

  E.part('frame', /** @param {ValetCtx} ctx */ function (ctx) {
    const L = ctx.L, K = ctx.K, face = ctx.face, add = ctx.add, nm = ctx.nm;
    // What frames the face: a collar, a roll neck, a shawl collar, lapels or a scarf. A T-shirt
    // or a crew-neck knit leaves the neck bare, so the face has no edge (Outfit Check, question 2).
    const framers = face.filter(function (k) { return K[k].frame; });
    const necked = face.filter(function (k) { return k !== 'hat'; });
    if (framers.length) add({ id: 'frame', score: 1, slots: [],
      text: 'Frame: ' + framers.map(function (k) { return nm(k) + ' (' + { collar: 'collar', neck: 'roll neck', lapel: 'lapels', shawl: 'shawl collar', scarf: 'scarf' }[K[k].frame] + ')'; }).join(', ') + (framers.length > 1 ? ' frame' : ' frames') + ' the face.' });
    if (necked.length && !framers.length) add({ id: 'frame', score: 0.6, slots: [K.mid && L.mid ? 'mid' : 'shirt'],
      text: 'Nothing frames the face: ' + face.filter(function (k) { return k !== 'hat'; }).map(nm).join(' and ') + (face.filter(function (k) { return k !== 'hat'; }).length > 1 ? ' leave' : ' leaves') + ' the neck bare. A collar, a roll neck or a jacket gives the face an edge. Fine for casual summer wear.' });
    // A V-neck is cut to show a collar (and a tie); over a collarless top the V shows bare skin or a T-shirt.
    // a waistcoat is cut for a dress shirt (and a tie); a V-neck knit for any collar, a polo's included
    if (L.mid && K.mid.needsCollarUnder && !(K.mid.vest ? K.shirt.tieable : K.shirt.collar)) add({ id: 'layer', score: 0.65, slots: ['mid'],
      text: (K.mid.vest ? 'A waistcoat is cut to show a dress shirt\'s collar (and a tie). Over a ' + K.shirt.name.toLowerCase() + ' it does not sit right; wear a shirt under it.' : 'A V-neck knit is cut to show a shirt collar. Over a ' + K.shirt.name.toLowerCase() + ' the V frames nothing; choose a crew neck, or a collared shirt under it.') });
    if (L.tie && !G.neckwearAllowed(K.tie, K.shirt)) add({ id: 'neck', score: 0.2, slots: ['tie'],
      text: 'A ' + K.tie.name.toLowerCase() + ' needs a shirt\'s collar and full button front to sit under' + (K.shirt.collar ? '; a ' + K.shirt.name.toLowerCase() + '\'s soft collar and short placket are not cut for one' : '') + '. Take it off, or wear a shirt.' });
  });
})();
