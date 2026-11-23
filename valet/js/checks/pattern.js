/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: question 5, pattern: how many read from 3 m, their scales, types and contrast.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const VC = X.VC, PARAMS = X.PARAMS, suitWorn = X.suitWorn, G = X.G, wardrobeNeutral = X.wardrobeNeutral, colourName = X.colourName, P = X.P, SCALE_TEXT = X.SCALE_TEXT, FACE = X.FACE, round = X.round;

  E.part('pattern', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, L = ctx.L, K = ctx.K, face = ctx.face, near = ctx.near, add = ctx.add, nm = ctx.nm, hi = ctx.hi, worn = ctx.worn;
    /* --- pattern --- */
    const pats = near.filter(function (k) { return L[k].visible; });   // the face layers and the pocket square, a hand from the face
    const allPats = worn.filter(function (k) { return L[k].visible; });
    const tex = worn.filter(function (k) { return L[k].texture; });
    // Why a patterned cloth does not count: tonal, or too fine or faint to read from 3 m.
    const texWhy = function (k) {
      const r = L[k].reads[3];
      return nm(k) + (r.state === 'plain' ? ' (plain from 3 m)' : ' (texture from 3 m)');
    };
    if (!allPats.length) {
      add({ id: 'pcount', group: 'pattern', score: 1, slots: [],
        text: 'No visible pattern' + (tex.length ? '; ' + tex.map(texWhy).join(', ') + (tex.length > 1 ? ' read' : ' reads') + ' as texture, which adds interest without competing.' : '. Texture in the cloth adds interest without pattern (rule 6).') });
    }
    if (allPats.length && pats.length <= 2) add({ id: 'pcount', group: 'pattern', score: 1, slots: [],
      text: (pats.length ? pats.length + ' visible pattern' + (pats.length > 1 ? 's' : '') + ' near the face, within the limit of two.' : 'Pattern only below the face, where it competes least.') +
        (tex.length ? ' ' + tex.map(texWhy).join(', ') + (tex.length > 1 ? ' do' : ' does') + ' not count.' : '') });
    if (pats.length > 2) add({ id: 'pcount', group: 'pattern', score: 0.3, slots: pats.slice(1),
      text: pats.length + ' patterns near the face. At most two (rule 7): make one of them plain.', fix: { kind: 'solid', slot: pats[pats.length - 1] } });
    if (face.length >= 2 && face.every(function (k) { return L[k].visible; })) add({ id: 'anchor', group: 'pattern', score: 0.45, slots: pats.slice(-1),
      text: 'Every layer at the face is patterned. One plain layer anchors the others (rule 7).', fix: { kind: 'solid', slot: pats[pats.length - 1] } });
    const shareColour = function (A, B) { return A.colours.some(function (x) { return B.colours.some(function (y) { return VC.deltaE2000(VC.hexToLab(x), VC.hexToLab(y)) < PARAMS.patternShareDE; }); }); };
    for (let i = 0; i < pats.length; i++) for (let j = i + 1; j < pats.length; j++) {
      const A = L[pats[i]], B = L[pats[j]], ratio = Math.max(A.pat.scale, B.pat.scale) / Math.min(A.pat.scale, B.pat.scale);
      // A/B: the eye's channels are tuned to orientation as well as size (Blakemore and Campbell 1969), and
      // colour is seen partly apart from lightness (Mullen 1985), so two patterns of a different kind (a stripe
      // and a check) and in different colours interfere less at one scale: a note. Alike in kind or colour, they fail.
      const apart = A.family !== B.family && !shareColour(A, B);
      if (ratio < 1.8 && apart) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 0.6, slots: [pats[j]],
        text: nm(pats[i]) + ' (' + A.label + ') and ' + nm(pats[j]) + ' (' + B.label + ') are at nearly the same scale, but different in kind and colour, which keeps them apart. A clearer difference in scale (about two or more) is the safer choice.' });
      else if (ratio < 1.8) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 0.4, slots: [pats[j]],
        text: nm(pats[i]) + ' (' + A.label + ') and ' + nm(pats[j]) + ' (' + B.label + ') are at nearly the same scale. Patterns of similar size interfere and seem to move; vary the scale by about two or more.' });
      else if (pats.length === 2) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 1, slots: [],
        text: nm(pats[i]) + ' and ' + nm(pats[j]) + ' are at different scales (' + A.label + ' against ' + B.label + '), so each keeps its own identity.' });
    }
    // a suit is one cloth: its jacket and trousers are one pattern, not two (hips, medium patterns, busy)
    const suitPat = suitWorn(o, L, K, (function () { const c = {}; ['jacket', 'trousers'].forEach(function (k) { c[k] = G.cloth(k, o[k]); }); return c; })());
    const onePats = suitPat ? allPats.filter(function (k) { return k !== 'trousers'; }) : allPats;
    // the top layer and the trousers meet at the hips; the same scale interferes there too (unless a suit)
    const topP = L.jacket ? 'jacket' : L.mid ? 'mid' : null;
    if (topP && L[topP].visible && L.trousers && L.trousers.visible && !(topP === 'jacket' && suitPat)) {
      const A = L[topP], Bt = L.trousers, ratio = Math.max(A.pat.scale, Bt.pat.scale) / Math.min(A.pat.scale, Bt.pat.scale);
      if (ratio < 1.8) add({ id: 'phip', group: 'pattern', level: 'A/B', score: 0.5, slots: ['trousers'],
        text: nm(topP) + ' (' + A.label + ') and ' + nm('trousers') + ' (' + Bt.label + ') meet at the hips at nearly the same scale: patterns of similar size interfere. Vary the scale by about two or more, or make one plain.' });
    }
    /* Echo (B): a pattern's colour picked up elsewhere in the outfit, subtly, ties it together
       (Flusser, Dressing the Man, p. 70; Gentleman's Gazette; Permanent Style). It helps but is not required, and the sources warn against
       obvious matching (Boyer), so this never lowers a verdict: a tick when it is done, a suggestion when
       it is not. Whether the colours relate at all is judged with every colour, under colours together. */
    {
      const elsewhere = function (k, hex) {
        return worn.find(function (o) { return o !== k && L[o].colours.some(function (h, i) { return (i === 0 || L[o].visible) && VC.deltaE2000(VC.hexToLab(h), VC.hexToLab(hex)) < PARAMS.patternShareDE; }); });
      };
      const echoed = [], loose = [];
      allPats.forEach(function (k) {
        L[k].colours.filter(function (h) { return !wardrobeNeutral(h); }).forEach(function (h) {
          const o = elsewhere(k, h); (o ? echoed : loose).push({ k: k, hex: h, o: o });
        });
      });
      if (loose.length) add({ id: 'pecho', group: 'pattern', score: 0.9, slots: [loose[0].k],
        text: 'The ' + colourName(loose[0].hex) + ' in the ' + nm(loose[0].k).toLowerCase() + ' appears nowhere else. Picking it up somewhere, subtly (socks, a pocket square, a knit), ties the outfit together; it is a choice, not a rule.' });
      else if (echoed.length) add({ id: 'pecho', group: 'pattern', score: 1, slots: [],
        text: 'The ' + colourName(echoed[0].hex) + ' in the ' + nm(echoed[0].k).toLowerCase() + ' is picked up by the ' + nm(echoed[0].o).toLowerCase() + ': a repeated colour ties the outfit together.' });
    }
    const medium = onePats.filter(function (k) { return L[k].cls.id === 'medium'; });
    if (medium.length > 1) add({ id: 'pmed', group: 'pattern', score: 0.5, slots: medium.slice(1),
      text: 'Two medium-scale patterns (' + medium.map(nm).join(', ') + '). The medium pattern is the one statement of an outfit.' });
    // Which patterns and what scale each garment type takes (Style Guide, section 7), from garments.js.
    worn.forEach(function (k) {
      const t = L[k].pat.type, cl = G.cloth(k, o[k]);
      if (t !== 'solid' && cl && !G.patOK(cl.id, t)) add({ id: 'ptype', group: 'pattern', score: 0.3, slots: [k],
        text: nm(k) + ': ' + L[k].typeName.toLowerCase() + ' is not made in ' + cl.name.toLowerCase().replace(/ \(shiny\)$/, '') + '. The weave or print does not exist in that cloth.' });
      else if (t !== 'solid' && K[k].pats.indexOf(t) < 0) add({ id: 'ptype', group: 'pattern', score: 0.6, slots: [k],
        text: nm(k) + ': ' + L[k].typeName.toLowerCase() + ' is not a cloth the guide uses for a ' + K[k].name.toLowerCase() + '.' +
          (K[k].pats.length > 1 ? ' It uses ' + K[k].pats.filter(function (x) { return x !== 'solid'; }).map(function (x) { return P().byId[x].name.toLowerCase(); }).join(', ') + '.' : ' It is worn plain.') });
    });
    allPats.forEach(function (k) {
      const c = L[k].cls.id, over = G.scaleOver(K[k], c), kn = K[k].name.toLowerCase();
      if (c === 'huge') add({ id: 'psize', group: 'pattern', score: 0.3, slots: [k], text: nm(k) + ': a repeat over 15 cm is too large to wear.' });
      else if (over >= 2) add({ id: 'psize', group: 'pattern', score: 0.4, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is far too big for a ' + kn + ', which takes ' + SCALE_TEXT[K[k].maxScale] + '.' });
      else if (over === 1 && o.propOn && o.frame === 'big') add({ id: 'psize', group: 'pattern', score: 0.8, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is a step above what a ' + kn + ' usually takes, but a broad frame carries it.' });
      else if (over === 1) add({ id: 'psize', group: 'pattern', score: 0.6, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is loud on a ' + kn + ', which usually takes ' + SCALE_TEXT[K[k].maxScale] + '. A bold move.' + (o.propOn && o.frame === 'small' ? ' On a slight frame even more so.' : '') });
      else if (over === 0 && o.propOn && o.frame === 'small' && c === 'medium') add({ id: 'psize', group: 'pattern', score: 0.85, slots: [k], text: nm(k) + ': a medium repeat (' + L[k].label + ') is at the top of what a slight frame carries; the smaller end of medium suits it better.' });
      if (FACE.indexOf(k) >= 0 && L[k].dL > hi) add({ id: 'pcontrast', group: 'pattern', level: 'A/B', score: 0.6, slots: [k],
        text: nm(k) + ': the pattern\'s own light-dark contrast (' + round(L[k].dL) + ') is stronger than your face carries (up to ' + round(hi) + '). It will take the attention.' });
    });
    if (onePats.length > 3) add({ id: 'pbusy', group: 'pattern', score: 0.5, slots: onePats.slice(3), text: onePats.length + ' patterned pieces in one outfit: busy' + (suitPat ? ', counting the suit once.' : '.') });
  });
})();
