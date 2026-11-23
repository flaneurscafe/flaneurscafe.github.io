/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: the whole outfit: sheen, formality and season; coats, gloves and the buttonhole.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const G = X.G, suitWorn = X.suitWorn, PARAMS = X.PARAMS;

  /* Sheen, formality and season: what the cloths and shoe types say (Style Guide sections 4 to 6).
     o.occasion is 'casual', 'smart', 'business' or 'evening'; p.season is the season switch. */
  function wholeChecks(o, L, K, p, add, nm) {
    const C = {}, F = {};
    Object.keys(L).forEach(function (k) { C[k] = G.cloth(k, o[k]); F[k] = G.formality(k, o[k]); });
    // a dress shirt worn without a tie is open-collared: smart, not business (B)
    if (F.shirt != null && K.shirt.tieable && !(L.tie && K.tie.knotted)) F.shirt = Math.min(F.shirt, 4);
    const cn = function (k) { return C[k] ? C[k].name.toLowerCase().replace(/ \(shiny\)$/, '') : ''; };
    const csw = L.shirt && K.shirt.collars ? G.collarOf(o.shirt) : null;   // a collar that lowers the shirt's formality is named (garments.js)
    const what = function (k) { return L[k].name + ' ' + (C[k] ? cn(k) + ' ' : '') + (k === 'shirt' && csw && csw.f != null ? csw.name.toLowerCase() + ' ' : '') + K[k].name.toLowerCase(); };
    const occ = G.OCCASIONS.find(function (x) { return x.id === o.occasion; }) || G.OCCASIONS[1];

    // 4. Sheen: anything glossy near the face fails; below it, a caution; patent is for black tie.
    const shiny = Object.keys(L).filter(function (k) { return C[k] && C[k].sheen === 2; });
    const nearFace = G.NEAR.concat(['hat']);
    shiny.forEach(function (k) {
      if (nearFace.indexOf(k) >= 0) add({ id: 'sheen', group: 'sheen', score: 0.6, slots: [k], cloth: true,
        text: what(k) + ': shiny cloth near the face reads as cheap cloth: too much shine is the classic mark of polyester and of very fine, glossy suiting (Outfit Check, question 4). A matte version looks better.' });
      else if (k === 'shoes') {
        add({ id: 'sheen', group: 'sheen', score: o.occasion === 'evening' ? 0.85 : 0.55, slots: [k], cloth: true,
          text: 'Patent shoes are for black tie' + (o.occasion === 'evening' ? '; for a formal evening they are right.' : '. Polish calf to a glow instead.') });
      }
      else add({ id: 'sheen', group: 'sheen', score: 0.6, slots: [k], cloth: true, text: what(k) + ': shiny cloth looks cheap below the belt too. The matte version is the classic one.' });
    });
    if (!shiny.length) add({ id: 'sheen', group: 'sheen', score: 1, slots: [], text: 'Sheen: everything is matte or has only a soft sheen, which suits skin and keeps the outfit quiet.' });

    // Specific pairings from the Style Guide first; a piece named there is not repeated in the
    // general formality messages below.
    const shoeF = L.shoes ? F.shoes : null, tie = L.tie && K.tie.knotted, handled = {};
    const smart = Object.keys(L).some(function (k) { return k !== 'shoes' && F[k] != null && F[k] >= 3; });
    if (L.shoes && K.shoes.id === 'chunky' && smart) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.35, slots: ['shoes'], text: 'Chunky or technical trainers fail with anything smart: they pull the eye to the floor, and the eye should stay at the face (Style Guide, shoes).' });
    } else if (tie && shoeF != null && shoeF <= 1) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.4, slots: ['shoes'], text: 'A ' + K.tie.name.toLowerCase() + ' with trainers: the tie says business, the shoes say weekend. Wear leather shoes, or lose the tie.' });
    } else if (suitWorn(o, L, K, C) && shoeF != null && shoeF <= 1) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.65, slots: ['shoes'], text: 'A suit with trainers is a fashion look rather than a classic one; loafers or derbies keep the suit\'s register.' });
    }
    // Neckwear with jeans (Gentleman's Gazette): a tie, bow tie or cravat formalises; jeans do not take it.
    if (tie && L.trousers && C.trousers && C.trousers.id === 'denim')
      add({ id: 'denimtie', group: 'formality', score: 0.45, slots: ['tie'],
        fixes: [{ label: 'Take off the ' + K.tie.name.toLowerCase(), slot: 'tie', on: false }, { label: 'Cotton twill trousers instead of jeans', slot: 'trousers', set: { cloth: 'cotton' } }],
        text: 'A ' + K.tie.name.toLowerCase() + ' with jeans: a clash of formalities. Neckwear dresses an outfit up and denim keeps it casual; skip the neckwear, or wear chinos or flannel.' });

    // Formality: the pieces that set the register (not scarf, socks, square, hat or an overcoat).
    const reg = Object.keys(L).filter(function (k) { return F[k] != null && k !== 'hat' && k !== 'coat' && k !== 'gloves' && !handled[k]; });
    outerwear(o, L, K, F, C, p, add, what);
    const W = ['', 'casual', 'relaxed', 'smart casual', 'smart', 'business'];
    const word = function (f) { return f <= 0 ? 'sportswear' : W[f]; };
    if (reg.length) {
      const lo = reg.reduce(function (a, k) { return F[k] < F[a] ? k : a; }), hi = reg.reduce(function (a, k) { return F[k] > F[a] ? k : a; });
      const spread = F[hi] - F[lo];
      if (spread >= PARAMS.formalMistake) add({ id: 'formal', group: 'formality', score: 0.4, slots: [lo],
        text: what(hi) + ' (' + word(F[hi]) + ') and ' + what(lo) + ' (' + word(F[lo]) + ') are too far apart in formality: one of them looks like a mistake.' });
      else if (spread === PARAMS.formalWide) add({ id: 'formal', group: 'formality', score: 0.65, slots: [lo],
        text: what(hi) + ' (' + word(F[hi]) + ') with ' + what(lo) + ' (' + word(F[lo]) + '): a wide mix. It can work as a deliberate contrast; usually one step closer looks surer.' });
      else add({ id: 'formal', group: 'formality', score: 1, slots: [],
        text: 'Formality: the pieces sit within ' + (spread ? 'two steps' : 'one register') + ' of each other, from ' + word(F[lo]) + ' to ' + word(F[hi]) + '.' });
      // against the occasion
      const r = occ.range, under = reg.filter(function (k) { return F[k] < r[0]; }), over = reg.filter(function (k) { return F[k] > r[1]; });
      if (under.length) {
        const gap = r[0] - Math.min.apply(null, under.map(function (k) { return F[k]; }));
        add({ id: 'occasion', group: 'formality', score: gap >= 2 ? 0.4 : 0.7, slots: under,
          text: 'For ' + occ.name.toLowerCase() + ', ' + under.map(what).join(' and ') + (under.length > 1 ? ' are' : ' is') + ' too casual (' + occ.note + ').' });
      } else if (over.length) {
        add({ id: 'occasion', group: 'formality', score: over.some(function (k) { return F[k] - r[1] >= 2; }) ? 0.65 : 0.85, slots: over,
          text: 'For ' + occ.name.toLowerCase() + ', ' + over.map(what).join(' and ') + (over.length > 1 ? ' are' : ' is') + ' dressier than the occasion. Fine if you mean it; the room will notice.' });
      } else add({ id: 'occasion', group: 'formality', score: 1, slots: [], text: 'Right for ' + occ.name.toLowerCase() + ': ' + occ.note + '.' });
    }
    // Season: cloth weight against the season switch, and two seasons in one outfit.
    const season = p.season === 'summer' ? 'summer' : 'winter', other = season === 'summer' ? 'winter' : 'summer';
    // the pocket square is left out: a linen or silk square is worn all year, with tweed and flannel too
    const seasonal = Object.keys(L).filter(function (k) { return k !== 'square'; });
    const wrong = seasonal.filter(function (k) { return C[k] && C[k].season === other; });
    const sum = seasonal.filter(function (k) { return C[k] && C[k].season === 'summer'; }), win = seasonal.filter(function (k) { return C[k] && C[k].season === 'winter'; });
    if (sum.length && win.length) add({ id: 'season', group: 'season', score: 0.55, slots: [sum[0]],
      text: what(sum[0]) + ' and ' + what(win[0]) + ' belong to different seasons: summer and winter cloth in one outfit look as if one of them was a mistake.' });
    else if (wrong.length) add({ id: 'season', group: 'season', score: 0.65, slots: wrong,
      text: wrong.map(what).join(' and ') + ': ' + (season === 'winter' ? 'summer cloth in winter looks cold and out of place; flannel, tweed, wool and heavier knits belong now.' : 'winter cloth in summer is too warm, and looks it; linen, fresco, cotton and lighter knits belong now.') + ' (The season switch at the top sets this.)' });
    else add({ id: 'season', group: 'season', score: 1, slots: [], text: 'Season: the cloths suit ' + season + (win.length || sum.length ? '' : ', and all of them work year round') + '.' });
  }

  /* Coats, gloves, hats and the buttonhole (B). Only the occasion register (the same scale every
     garment is judged on) and what a piece physically needs are checked. Etiquette that rests on no
     principle Valet can state (which leather gloves should match, how many accents to wear, when a
     flower is costume) is left out on purpose; see How it works, section 10. */
  function outerwear(o, L, K, F, C, p, add, what) {
    const occ = o.occasion || 'smart', formal = occ === 'business' || occ === 'evening';
    const occWord = { casual: 'casual', smart: 'smart casual', business: 'business', evening: 'evening' }[occ];
    if (L.coat) {
      // Against what it is worn over: the most formal of the jacket and the knit. The general rule
      // calls four steps apart a mistake (wholeChecks); a coat comes off indoors and lives in the
      // register of the street, so it gets one step more: five apart, a parka over a worsted suit.
      const under = ['jacket', 'mid'].filter(function (k) { return L[k] && F[k] != null; }).sort(function (a, b) { return F[b] - F[a]; })[0];
      if (F.coat != null && under && F[under] - F.coat >= PARAMS.coatSteps) add({ id: 'coat', group: 'formality', score: 0.65, slots: ['coat'],
        text: 'A ' + K.coat.name.toLowerCase() + ' over ' + what(under) + ': the coat is sportswear and what it covers is the most formal tailoring, five steps apart. An overcoat, a covert coat or a trench coat goes over tailoring like this.',
        fixes: [{ label: 'An overcoat instead', slot: 'coat', kind: 'overcoat' }, { label: 'Take off the coat', slot: 'coat', on: false }] });
      else if (formal && F.coat <= 1) add({ id: 'coat', group: 'formality', score: 0.65, slots: ['coat'],
        text: 'A ' + K.coat.name.toLowerCase() + ' is casual outerwear; over ' + occWord + ' dress it sits two steps below the rest. An overcoat, a covert coat or a trench coat is in the same register.',
        fixes: [{ label: 'An overcoat instead', slot: 'coat', kind: 'overcoat' }, { label: 'Take off the coat', slot: 'coat', on: false }] });
      else add({ id: 'coat', group: 'formality', score: 1, slots: [],
        text: 'Coat: a ' + K.coat.name.toLowerCase() + ', in the register of the occasion.' });
    }
    if (L.gloves && K.gloves.id === 'knit' && formal) add({ id: 'gloves', group: 'formality', score: 0.65, slots: ['gloves'],
      text: 'Knitted gloves are casual; with ' + occWord + ' dress they sit below the rest, where leather or suede gloves are in the same register.',
      fixes: [{ label: 'Leather gloves instead', slot: 'gloves', kind: 'leather' }] });
    // A hat by its type against the occasion, a step of grace either side: a homburg or bowler with
    // casual dress, a baseball cap or beanie with business or evening dress.
    if (L.hat && K.hat.f != null) {
      const r = (G.OCCASIONS.find(function (x) { return x.id === occ; }) || G.OCCASIONS[1]).range, hn = K.hat.name.toLowerCase();
      if (K.hat.f > r[1] + 1) add({ id: 'hatf', group: 'formality', score: 0.65, slots: ['hat'],
        text: 'A ' + hn + ' is a formal town hat; with ' + occWord + ' dress it is two steps above the rest. A flat cap, a trilby or no hat is in the same register.',
        fixes: [{ label: 'A trilby instead', slot: 'hat', kind: 'trilby' }, { label: 'Take off the hat', slot: 'hat', on: false }] });
      else if (K.hat.f < r[0] - 1) add({ id: 'hatf', group: 'formality', score: 0.55, slots: ['hat'],
        text: 'A ' + hn + ' is ' + (K.hat.f <= 0 ? 'sportswear' : 'casual') + '; with ' + occWord + ' dress it is two steps below the rest. Go bareheaded, or wear a fedora or a homburg.',
        fixes: [{ label: 'Take off the hat', slot: 'hat', on: false }, { label: 'A fedora instead', slot: 'hat', kind: 'fedora' }] });
    }
    // The buttonhole: a flower or pin is worn through the lapel's buttonhole, so it needs lapels.
    if (L.boutonniere) {
      const lapel = (L.jacket && K.jacket.frame === 'lapel') || (L.coat && K.coat.frame === 'lapel');
      if (!lapel) add({ id: 'bout', group: 'formality', score: 0.2, slots: ['boutonniere'],
        text: 'A ' + (K.boutonniere.id === 'pin' ? 'lapel pin' : 'flower in the lapel') + ' is worn through the lapel buttonhole, so it needs lapels: a tailored jacket, a blazer or a coat with lapels.',
        fixes: [{ label: 'Take it off', slot: 'boutonniere', on: false }] });
    }
  }

  E.part('whole', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, p = ctx.p, L = ctx.L, K = ctx.K, add = ctx.add, nm = ctx.nm;
    if (!o.study) wholeChecks(o, L, K, p, add, nm);
  });
})();
