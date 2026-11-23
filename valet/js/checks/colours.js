/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: colours together: one temperature above the waist, how many colours and whether they agree, near misses, top against bottom.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const scoreCached = X.scoreCached, okc = X.okc, wardrobeNeutral = X.wardrobeNeutral, hueDist = X.hueDist, PARAMS = X.PARAMS, G = X.G, VC = X.VC, samePattern = X.samePattern, round = X.round;

  E.part('colours', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, p = ctx.p, L = ctx.L, K = ctx.K, near = ctx.near, add = ctx.add, nm = ctx.nm, lum = ctx.lum, worn = ctx.worn;
    // One temperature above the waist.
    const temps = near.map(function (k) { return [k, scoreCached(L[k].mean, p).temperature]; }).filter(function (t) { return Math.abs(t[1]) > 0.3; });
    const warm = temps.filter(function (t) { return t[1] > 0; }), cool = temps.filter(function (t) { return t[1] < 0; });
    if (warm.length && cool.length) {
      const odd = warm.length <= cool.length ? warm : cool;
      add({ id: 'temp', score: 0.5, n: odd.length, slots: odd.map(function (t) { return t[0]; }),
        text: 'Temperature: ' + odd.map(function (t) { return nm(t[0]); }).join(' and ') + ' is ' + (odd === warm ? 'warm' : 'cool') + ' among ' + (odd === warm ? 'cool' : 'warm') + ' pieces above the waist. One temperature at a time (rule 2).' });
    }

    // How many colours, and whether they get on (section 9). Wardrobe neutrals are free.
    const chrom = [];
    worn.forEach(function (k) {
      L[k].colours.forEach(function (hex, i) {
        if (i === 1 && !L[k].visible && !L[k].twoTone) return;   // a texture's accent does not count; a spectator's second leather does
        const c = okc(hex);
        if (!wardrobeNeutral(hex) && c[1] >= 0.06) chrom.push({ k: k, hex: hex, h: c[2], C: c[1], Lk: c[0], small: k === 'tie' || k === 'shoes' || k === 'socks' || k === 'square' || k === 'boutonniere' || k === 'gloves' || i === 1 });
      });
    });
    const fam = [];
    chrom.forEach(function (c) {
      const f = fam.find(function (g) { return hueDist(g.h, c.h) <= PARAMS.familyHue; });
      if (f) f.items.push(c); else fam.push({ h: c.h, items: [c] });
    });
    if (fam.length === 2) {
      const a = fam[0], b = fam[1], d = hueDist(a.h, b.h);
      const calm = function (g) { return g.items.every(function (c) { return c.Lk < 0.45 || c.C < 0.09; }); };
      const accent = a.items.every(function (c) { return c.small; }) || b.items.every(function (c) { return c.small; });
      const names = a.items[0].k + ' and ' + b.items[0].k;
      if (Math.abs(d - 180) <= 30) add({ id: 'harmony', score: calm(a) || calm(b) ? 1 : 0.7, slots: [b.items[0].k], level: 'B',
        text: 'Colours: the ' + names + ' are complementary (about ' + Math.round(d) + '° apart). ' + (calm(a) || calm(b) ? 'One is dark or muted, which keeps it calm.' : 'Lively; it calms down if one of them is dark or muted.') });
      else if (accent) add({ id: 'harmony', score: 0.9, slots: [], text: 'Colours: two colour families, but one is a small accent (' + names + '). Accents may stand apart.' });
      else add({ id: 'harmony', score: 0.45, slots: [b.items[0].k], text: 'Colours: the ' + names + ' are ' + Math.round(d) + '° apart in hue, neither neighbours nor opposites. Two such colours compete. Make one a neutral, or move them closer.' });
    } else if (fam.length > 2) {
      const big = fam.filter(function (g) { return !g.items.every(function (c) { return c.small; }); });
      add({ id: 'harmony', score: big.length > 2 ? 0.35 : 0.6, slots: chrom.filter(function (c) { return !c.small; }).map(function (c) { return c.k; }).slice(1),
        text: 'Colours: ' + fam.length + ' colour families in one outfit. The template that never fails is two neutrals and one colour (rule 4).' });
    } else {
      add({ id: 'harmony', score: 1, slots: [], text: fam.length ? 'Colours: one colour family against neutrals, the classic template.' : 'Colours: all neutrals. Calm; a colour near the face would add interest.' });
    }

    // Near misses: two pieces almost but not quite the same colour (A: they read as a failed match).
    // Pieces that meet or sit near each other; the tie and the floor are only compared with neighbours.
    const pairs = [['jacket', 'trousers'], ['mid', 'jacket'], ['shirt', 'mid'], ['tie', 'mid'], ['shirt', 'jacket'], ['shirt', 'tie'], ['tie', 'jacket'],
      ['mid', 'trousers'], ['trousers', 'shoes'], ['shirt', 'trousers'],
      ['scarf', 'jacket'], ['scarf', 'mid'], ['scarf', 'shirt'], ['tie', 'scarf'],
      ['coat', 'jacket'], ['coat', 'mid'], ['coat', 'trousers'], ['scarf', 'coat'], ['boutonniere', 'tie']];
    let suitText = null;
    // Leather shoes are not compared with the trousers: leather and cloth never look like one material
    // meant to match, so black calf boots with black jeans read as black with black, not as a near miss.
    const leatherShoes = L.shoes && !!(G.cloth('shoes', o.shoes) || {}).leather;
    pairs.forEach(function (pr) {
      if (!L[pr[0]] || !L[pr[1]]) return;
      if (pr[1] === 'shoes' && leatherShoes) return;
      // A buttonhole flower close to the tie's colour is the echo Flusser recommends ("a similar shade"); only
      // an exact match looks studied (Dressing the Man, p. 217). So no near match here, and a note for an exact one.
      if (pr[0] === 'boutonniere' && pr[1] === 'tie') {
        const dA = VC.deltaE2000(VC.hexToLab(L.boutonniere.mean), VC.hexToLab(L.tie.mean));
        if (dA < PARAMS.nearFrom) add({ id: 'accentmatch', score: 0.8, slots: ['boutonniere'],
          text: nm('boutonniere') + ' and ' + nm('tie') + ' are exactly one colour: it looks studied. A similar shade, or a colour from the tie\'s pattern, echoes it better (Flusser).' });
        return;
      }
      const dE = VC.deltaE2000(VC.hexToLab(L[pr[0]].mean), VC.hexToLab(L[pr[1]].mean));
      if (dE < PARAMS.nearFrom && pr[0] === 'jacket' && pr[1] === 'trousers') {
        // a suit is one cloth as well as one colour; the same colour in two cloths looks like a
        // suit jacket that lost its trousers
        const cj = G.cloth('jacket', o.jacket), ct = G.cloth('trousers', o.trousers);
        const pj = L.jacket.pat, pt = L.trousers.pat, samePat = samePattern(pj, pt);
        if (K.jacket.suit && (!cj || !ct || cj.id === ct.id) && samePat) suitText = 'Jacket and trousers match in colour, cloth and pattern: this reads as a suit.';
        else if (K.jacket.suit && (!cj || !ct || cj.id === ct.id)) add({ id: 'orphan', group: 'formality', score: 0.5, slots: ['trousers'],
          text: 'Jacket and trousers are one colour and cloth but not one pattern (' + (pj.type === 'solid' ? 'plain' : L.jacket.typeName.toLowerCase()) + ' against ' + (pt.type === 'solid' ? 'plain' : L.trousers.typeName.toLowerCase()) + '): it reads as a suit jacket with the wrong trousers. Match the pattern, or make the trousers clearly different.' });
        else if (K.jacket.suit) add({ id: 'orphan', group: 'formality', score: 0.5, slots: ['trousers'],
          text: 'Jacket in ' + cj.name.toLowerCase() + ' and trousers in ' + ct.name.toLowerCase() + ', both ' + L.jacket.name.toLowerCase() + ': the same colour in two cloths looks like a suit jacket worn with the wrong trousers. Match the cloth too, or make the trousers clearly different.' });
      }
      else if (dE >= PARAMS.nearFrom && dE < PARAMS.nearTo) add({ id: 'near', score: 0.45, slots: [pr[1] === 'shoes' ? pr[0] : pr[1]], level: 'A/B',
        text: 'Near match: ' + nm(pr[0]) + ' and ' + nm(pr[1]) + ' are almost the same colour (ΔE ' + round(dE, 1) + '). Close but not equal reads as a mistake: match them or separate them.' });
    });
    if (suitText) add({ id: 'suit', score: 1, slots: [], text: suitText });

    // Top and bottom: clearly different in lightness, unless matched.
    const top = L.jacket ? 'jacket' : L.mid ? 'mid' : L.shirt ? 'shirt' : null;    // the outermost layer meets the trousers
    if (top && L.trousers) {
      const dTop = Math.abs(lum(L[top].mean) - lum(L.trousers.mean));
      const dETop = VC.deltaE2000(VC.hexToLab(L[top].mean), VC.hexToLab(L.trousers.mean));
      // Close in lightness, not matched. Whether that is good depends on the build (Flusser, pp. 52-54, 271):
      // it lengthens a short or heavy figure and is the dressier choice, and a tall one gains from a break.
      // With height known and Proportion & fit on, proportionChecks judges it; otherwise this is a note
      // about the wearer (context), never counted.
      const heightKnown = o.propOn && +((o.m || {}).height) > 0;
      if (dETop >= PARAMS.nearTo && dTop < PARAMS.halvesL && !heightKnown && !o.study) add({ id: 'halves', score: 0.8, slots: [],
        text: nm(top) + ' and ' + nm('trousers') + ' are close in lightness (step ' + round(dTop) + '). Whether that helps depends on your build: it lengthens a short or heavy figure and reads dressier, while a tall one gains from a contrasting trouser (Flusser). Turn on Proportion & fit and enter your height for a verdict.' });

      // One colour from collar to shoe. A matching top and trousers in a wardrobe neutral is tonal
      // dressing (the guide's charcoal-on-charcoal and all-black evening outfits); in a colour it reads
      // as a uniform, and a colour is meant to be one piece among neutrals (rule 4). A coloured suit
      // is the exception: jacket and trousers cut as one.
      if (!(top === 'jacket' && K.jacket.suit && dETop < PARAMS.nearFrom)) {
        const cT = okc(L[top].mean), cB = okc(L.trousers.mean);
        if (!wardrobeNeutral(L[top].mean) && !wardrobeNeutral(L.trousers.mean) && cT[1] >= 0.03 && cB[1] >= 0.03 && hueDist(cT[2], cB[2]) <= 30) {
          const same = dETop < 10;
          add({ id: 'dose', score: same ? 0.4 : 0.6, slots: ['trousers'],
            text: nm(top) + ' and ' + nm('trousers') + ': ' + (same ? 'one colour from collar to shoe reads as a uniform' : 'one colour family over the top and the legs is most of the body') +
              '. A colour works best as one piece in an outfit of neutrals (rule 4): grey, charcoal or navy trousers' + (L.jacket ? '' : ', or a neutral jacket over it') + '.' });
        }
      }
    }
  });
})();
