/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: the feet: shoes against the trousers, and socks.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const scoreCached = X.scoreCached, VC = X.VC, okc = X.okc, PARAMS = X.PARAMS, hueDist = X.hueDist;

  E.part('feet', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, p = ctx.p, L = ctx.L, face = ctx.face, add = ctx.add, nm = ctx.nm, lum = ctx.lum;
    // Below the belt.
    if (L.trousers && scoreCached(L.trousers.mean, p).tier === 4) add({ id: 'bold', score: 0.7, slots: ['trousers'],
      text: nm('trousers') + ': a tier 4 colour is loud anywhere. Allowed below the belt as the one bold move.' });
    if (L.shoes && L.trousers) {
      if (lum(L.shoes.mean) > lum(L.trousers.mean) + 8) add({ id: 'shoes', score: 0.6, slots: ['shoes'],
        text: 'Shoes lighter than the trousers pull the eye to the floor. Same depth or darker.' });
      const st = scoreCached(L.shoes.mean, p).temperature, topCool = face.every(function (k) { return scoreCached(L[k].mean, p).temperature <= 0.3; });
      if (st > 0.4 && lum(L.shoes.mean) > 45 && topCool) add({ id: 'shoes', score: 0.55, slots: ['shoes'],
        text: 'Light warm shoes clash with a cool outfit even at floor level. Keep brown shoes dark.' });
    }

    // Socks (Flusser, Dressing the Man, p. 173; Gentleman's Gazette; section 10 of How it works): the trousers are the anchor, never the
    // shoes. In business and evening dress the sock stays in the trousers' colour family, ideally a
    // distinct tone of it, lighter or darker (light blue with navy); an exact match is safe, and a deep,
    // muted colour is the one step outside the family (burgundy with grey). Below that, a muted
    // contrasting or complementary colour is fine. Never electric or neon, never white sports socks.
    if (L.socks && L.trousers) {
      const lS = lum(L.socks.mean), lT = lum(L.trousers.mean), dE = VC.deltaE2000(VC.hexToLab(L.socks.mean), VC.hexToLab(L.trousers.mean));
      const sc = okc(L.socks.mean), tc = okc(L.trousers.mean), formalOcc = o.occasion === 'business' || o.occasion === 'evening';
      const sockNeutral = sc[1] < 0.025, trNeutral = tc[1] < 0.025;
      const family = dE < PARAMS.nearTo || (sockNeutral && trNeutral) || (!sockNeutral && !trNeutral && hueDist(sc[2], tc[2]) <= PARAMS.sockFamilyHue);
      const deep = lS < PARAMS.sockDeepL && sc[1] <= PARAMS.sockDeepC;   // deep: dark and muted (burgundy, wine, forest), not royal blue
      const toShoes = L.shoes && VC.deltaE2000(VC.hexToLab(L.socks.mean), VC.hexToLab(L.shoes.mean)) < PARAMS.nearTo && dE >= 15;
      const fx = function (label) { return [{ label: label, slot: 'socks', set: { hex: L.trousers.mean } }]; };
      if (lS > 82 && sc[1] < 0.025) add({ id: 'socks', score: 0.3, slots: ['socks'],
        text: 'White socks with shoes: the eye goes straight to the ankle. Take the trousers\' colour family instead (no white sports socks with leather shoes).' });
      else if (sc[1] >= PARAMS.sockLoudC) add({ id: 'socks', score: formalOcc ? 0.4 : 0.6, slots: ['socks'],
        text: nm('socks') + ': an electric colour at the ankle is loud' + (formalOcc ? ', and the more formal the occasion the stricter the rule.' : '. A muted version of it works.') });
      else if (toShoes) add({ id: 'socks', score: 0.45, slots: ['socks'],
        text: nm('socks') + ' match the shoes, not the trousers: the colour changes at the trouser hem and the transition looks muddy. Take the trousers\' colour family.' });
      else if (family) add({ id: 'socks', score: 1, slots: ['socks'],
        text: nm('socks') + ': ' + (dE < PARAMS.nearTo ? 'the trousers\' own colour, the safe choice; a distinct tone of it (lighter or darker) is the more considered one.' : 'a distinct tone of the trousers\' colour: it belongs with them without simply copying them.') });
      else if (deep) add({ id: 'socks', score: formalOcc ? 0.95 : 1, slots: ['socks'],
        text: nm('socks') + ': a deep, muted colour at the ankle' + (formalOcc ? ', the one step outside the trousers\' family that business dress allows (burgundy with grey).' : ', which harmonises with the trousers.') });
      else if (formalOcc) add({ id: 'socks', score: 0.7, slots: ['socks'], fixes: fx('Socks in the trousers\' colour'),
        text: nm('socks') + ': outside the trousers\' colour family. For ' + (o.occasion === 'evening' ? 'evening' : 'business') + ' dress keep the socks in that family, or a deep muted colour; contrast is for less formal days.' });
      else add({ id: 'socks', score: 1, slots: ['socks'],
        text: nm('socks') + ': a contrasting colour at the ankle, which a smart-casual or casual outfit carries well.' });
    }
  });
})();
