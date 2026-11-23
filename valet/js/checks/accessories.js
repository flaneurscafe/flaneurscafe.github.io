/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: question 6, metal and accessories: one metal, sizes, stones, and the glasses beside the colours.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const framesOf = X.framesOf, frameWeight = X.frameWeight, frameTemp = X.frameTemp, scoreCached = X.scoreCached, G = X.G, okc = X.okc, hueDist = X.hueDist, watchRange = X.watchRange, PARAMS = X.PARAMS;

  function accessoryChecks(acc, L, K, p, add, nm, occasion, o) {
    const A = G.ACCESSORIES, M = G.metalBy, worn = A.filter(function (a) { return acc[a.key] && acc[a.key].on && !a.plain; });   // braces have no metal
    const ad = function (c) { c.group = 'accessory'; c.slots = c.slots || []; return add(c); };
    const glf = framesOf(o), glassMetal = glf && (glf.frame === 'gold' || glf.frame === 'silver') ? glf.frame : null;
    const cool = p.tempLevel === 'cool', warm = p.tempLevel === 'warm';   // the profile's own bands (cool under -0.35, warm over 0.35)
    worn.forEach(function (a) {
      if (a.needs === 'cuffs' && !(L.shirt && K.shirt.tieable)) ad({ id: 'acc', score: 0.2, acc: a.key,
        text: 'Cufflinks need a shirt with double cuffs; a ' + K.shirt.name.toLowerCase() + ' has none.' });
      if (a.needs === 'tie' && !(L.tie && K.tie.id === 'tie')) ad({ id: 'acc', score: 0.2, acc: a.key, text: 'A tie bar needs a tie to hold.' });
    });
    /* The belt and what holds the trousers (B). A waistcoat asks for braces: it must cover the waistband, and
       a belt beneath it makes a bulge at the waist and drags the trousers down until shirt shows (Gentleman's
       Gazette; No Man Walks Alone; Flusser, Dressing the Man, pp. 60, 222). A belt and braces together are one
       too many, and a failure in every source. */
    const belt = acc.buckle && acc.buckle.on, braces = acc.braces && acc.braces.on, vest = L.mid && K.mid.vest;
    if (belt && braces) ad({ id: 'beltbraces', score: 0.3, acc: 'buckle',
      text: 'A belt and braces together: either holds the trousers, and wearing both says neither was trusted. Take off the belt.',
      fixes: [{ label: 'Take off the belt', acc: 'buckle', set: { on: false } }] });
    else if (belt && vest) ad({ id: 'beltvest', score: 0.3, acc: 'buckle',
      text: 'A belt with a waistcoat: the waistcoat should cover the waistband, and a belt beneath it bulges at the waist and lets the trousers slip until shirt shows. A waistcoat is worn with braces, or with trousers that have side adjusters.',
      fixes: [{ label: 'Braces instead of the belt', acc: 'buckle', set: { on: false }, and: [{ acc: 'braces', set: { on: true } }] }] });
    // matching: everything but the ring and the face pieces
    const match = worn.filter(function (a) { return a.key !== 'ring' && !a.face && acc[a.key].metal !== 'twotone' && acc[a.key].metal !== 'black'; });
    // metal blazer buttons are worn metal too
    const btn = o && o.jacket && K.jacket && K.jacket.buttons ? G.BUTTONS.find(function (b) { return b[0] === (o.jacket.buttons || 'silver'); }) : null;
    if (btn && btn[2]) match.push({ key: 'buttons', name: 'Blazer buttons', btn: btn[2], slot: 'jacket' });   // checked even with no watch or belt
    if (o && o.boutonniere && K.boutonniere && K.boutonniere.id === 'pin') match.push({ key: 'pin', name: 'Lapel pin', btn: o.boutonniere.metal || 'silver', slot: 'boutonniere' });
    const metalOf = function (a) { return a.btn || acc[a.key].metal; };
    const fam = function (m) { return M[m] && M[m].warm ? 'warm' : 'cool'; };
    const fams = match.map(function (a) { return fam(metalOf(a)); }).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    const desc = function (list) { return list.map(function (a) { return a.name.toLowerCase() + ' in ' + M[metalOf(a)].name.toLowerCase(); }).join(', '); };
    if (fams.length > 1) {
      // match the odd one out to the majority
      const nWarm = match.filter(function (a) { return fam(metalOf(a)) === 'warm'; }).length, keepWarm = nWarm > match.length - nWarm;
      const odd = match.filter(function (a) { return (fam(metalOf(a)) === 'warm') !== keepWarm; });
      const to = keepWarm ? 'gold' : 'silver';
      ad({ id: 'metal', score: 0.5, text: 'Mixed metals: ' + desc(match) + '. Keep one metal through the outfit; a two-tone watch is the one exception.',
        fixes: odd.map(function (a) {
          const label = 'Make the ' + a.name.toLowerCase() + ' ' + to;
          // a worn accessory, the blazer's buttons or the lapel pin: each is set where it lives
          if (a.key === 'buttons') return { label: label, slot: 'jacket', set: { buttons: to } };
          if (a.key === 'pin') return { label: label, slot: 'boutonniere', set: { metal: to, hex: M[to].hex } };
          return a.metals.indexOf(to) >= 0 ? { label: label, acc: a.key, set: { metal: to } } : null;
        }).filter(Boolean).concat(odd.some(function (a) { return a.key === 'buttons'; }) ? [{ label: 'Horn buttons, which are not metal', slot: 'jacket', set: { buttons: 'horn' } }] : []).slice(0, 2) });
    }
    else if (match.length) {
      const f = fams[0];
      if (f === 'warm' && cool) ad({ id: 'metal', score: 0.45, text: 'Warm metal (' + desc(match) + ') against cool colouring: a stray warm note. Silver, steel or gunmetal agree with you.' });
      else if (f === 'cool' && warm) ad({ id: 'metal', score: 0.7, text: 'Cool metal (' + desc(match) + ') against warm colouring. Gold agrees with you better.' });
      else ad({ id: 'metal', score: 1, text: 'Metal: ' + desc(match) + ', one metal through the outfit' + (glassMetal && fam(glassMetal) !== f ? '. Your ' + glassMetal + ' frames are judged with your face, so the rest can stay as it is.' : '.') });
    }
    if (acc.ring && acc.ring.on && match.length && fam(acc.ring.metal) !== fams[0]) ad({ id: 'metal', score: 0.95,
      text: 'The ' + M[acc.ring.metal].name.toLowerCase() + ' ring differs from the other metal. A ring worn every day is usually let stand outside the matching rule.' });
    sizeChecks(acc, L, K, p, ad, worn, occasion, o);

    // stones: a small accent that reads best echoing a colour already worn
    const colours = [];
    Object.keys(L).forEach(function (k) { L[k].colours.forEach(function (h) { colours.push(h); }); });
    worn.filter(function (a) { return a.stone && acc[a.key].stone && acc[a.key].stone !== 'none'; }).forEach(function (a) {
      const st = G.stoneBy[acc[a.key].stone]; if (!st || !st.hex) return;
      const c = okc(st.hex);
      if (c[1] < 0.06) return;                           // onyx, pearl, diamond: neutral
      const echo = colours.some(function (h) { const q = okc(h); return q[1] >= 0.04 && hueDist(q[2], c[2]) <= 35; });
      ad({ id: 'stone', score: echo ? 1 : 0.9, text: st.name + ' ' + a.name.toLowerCase() + (echo ? ': echoes a colour in the outfit, so the accent looks chosen.' : ': a small accent of its own. It looks more deliberate when it echoes a colour you wear (lapis with navy, garnet with a burgundy tie).') });
    });
  }

  /* Sizes of accessories. Each has a classic range with its reason. Over the range, the check
     lists what elsewhere in the outfit carries the piece (each one done lifts the score), with a
     button for each that can be done here. Far over the range nothing compensates, and the check
     says to take it off for this outfit. Ties are taken as 8 cm wide, the width of every tie in
     the Style Guide. */
  const TIE_MM = 80;

  function sizeChecks(acc, L, K, p, ad, worn, occasion, o) {
    const has = function (k) { return acc[k] && acc[k].on; };
    const tie = !!(L.tie && K.tie.id === 'tie');
    // A check over the range: comps are { done, text, fix } and lift the score from base to at most 0.85.
    const carry = function (key, base, head, comps) {
      const done = comps.filter(function (c) { return c.done; }), todo = comps.filter(function (c) { return !c.done; });
      const score = Math.min(0.85, base + 0.3 * done.length / Math.max(1, comps.length));
      ad({ id: 'asize', score: score, acc: key,
        text: head + (done.length ? ' Already helping: ' + done.map(function (c) { return c.text; }).join('; ') + '.' : '') +
          (todo.length ? ' To carry it: ' + todo.map(function (c) { return c.text; }).join('; ') + '.' : ''),
        fixes: todo.filter(function (c) { return c.fix; }).map(function (c) { return c.fix; }) });
    };
    const out = function (key, text, fix) { ad({ id: 'asize', score: 0.3, acc: key, text: text, fixes: [fix || { label: 'Take it off', acc: key, set: { on: false } }] }); };
    const ok = function (key, text) { ad({ id: 'asize', score: 1, acc: key, text: text }); };

    if (has('watch')) {
      const mm = +acc.watch.size || 38, r = watchRange(acc.wrist), over = mm - r[1];
      const why = (acc.wrist ? 'For a ' + acc.wrist + ' cm wrist the case suits ' + r[0] + '–' + r[1] + ' mm' : 'The classic dress range is 36–40 mm') + '.';
      if (over <= 0 && mm >= r[0] - 4) ok('watch', 'Watch, ' + mm + ' mm: ' + why + ' The lugs stay inside the wrist and the case slips under a shirt cuff, which is the classic aim with tailoring.');
      else if (over <= 0) ok('watch', 'Watch, ' + mm + ' mm: small for the wrist, the size of a vintage dress watch. Quiet and correct.');
      else if (over <= PARAMS.watchOver) carry('watch', 0.55, 'Watch, ' + mm + ' mm: large. ' + why + ' A bigger case overhangs the wrist and will not go under a shirt cuff, so it shows at every gesture.', [
        { done: !has('cufflinks'), text: 'no cufflinks, so the cuff does not have to close over it', fix: { label: 'Take off the cufflinks', acc: 'cufflinks', set: { on: false } } },
        { done: !tie, text: 'an open collar: a big watch belongs to casual dress', fix: { label: 'Take off the tie', slot: 'tie', on: false } },
        { done: !!(L.jacket && !K.jacket.suit) || !!L.mid || !!L.coat, text: 'a heavier layer (overshirt, coat or knit) to match its weight' }
      ]);
      else if (tie || has('cufflinks')) out('watch', 'Watch, ' + mm + ' mm: far over ' + r[1] + ' mm. ' + why + ' With a tie or cufflinks nothing makes up for it. For this outfit, take it off or wear a smaller watch; keep this one for casual days.');
      else carry('watch', 0.45, 'Watch, ' + mm + ' mm: far over ' + r[1] + ' mm. ' + why + ' It reads as sports equipment.', [
        { done: !L.jacket || !K.jacket.suit, text: 'no tailored jacket' },
        { done: !!(L.jacket && !K.jacket.suit) || !!L.mid, text: 'a heavy casual layer beside it' }
      ]);
    }
    // The watch against the occasion: a digital display and a rubber strap are sportswear, so with
    // business or evening dress they sit below the register, as a baseball cap or a parka would.
    // Strap colour, dial colour and case finish are a matter of taste and are not judged.
    if (has('watch')) {
      const w = acc.watch, strap = G.STRAPS.find(function (x) { return x.id === (w.strap || 'leather'); }) || G.STRAPS[1];
      const formal = occasion === 'business' || occasion === 'evening', occWord = occasion === 'evening' ? 'evening' : 'business';
      const notes = [];
      if (w.display === 'digital' && formal) notes.push([0.55, 'A digital display is sportswear; with ' + occWord + ' dress it sits below the rest, where an analogue watch is in the same register.', [{ label: 'An analogue watch', acc: 'watch', set: { display: 'analogue' } }]]);
      if (strap.id === 'rubber' && formal) notes.push([0.55, 'A rubber strap is sportswear; with ' + occWord + ' dress it sits below the rest, where leather or a bracelet is in the same register.', [{ label: 'A leather strap', acc: 'watch', set: { strap: 'leather' } }]]);
      notes.forEach(function (n) { ad({ id: 'wstyle', score: n[0], acc: 'watch', text: n[1], fixes: n[2] || [] }); });
    }
    if (has('cufflinks')) {
      const mm = +acc.cufflinks.size || 15, stone = acc.cufflinks.stone || 'none';
      if (mm <= PARAMS.cufflinksMax) ok('cufflinks', 'Cufflinks, ' + mm + ' mm: the classic size (about 12–18 mm). A link this size shows a little below the jacket sleeve and does not catch every light.');
      else if (mm <= PARAMS.cufflinksFar) carry('cufflinks', 0.55, 'Cufflinks, ' + mm + ' mm: large. Past about 18 mm a link stands out from the cuff and flashes at each gesture.', [
        { done: stone === 'none' || stone === 'onyx', text: 'plain metal or a dark stone, so it does not sparkle', fix: stone !== 'none' && stone !== 'onyx' ? { label: 'Use onyx links', acc: 'cufflinks', set: { stone: 'onyx' } } : null },
        { done: !has('tiebar'), text: 'no tie bar: one piece of metal at a time on the front', fix: { label: 'Take off the tie bar', acc: 'tiebar', set: { on: false } } },
        { done: !has('watch') || (+acc.watch.size || 38) <= watchRange(acc.wrist)[1], text: 'a watch within its range, so the wrists do not compete' }
      ]);
      else out('cufflinks', 'Cufflinks, ' + mm + ' mm: costume size. Nothing else in a classic outfit balances links this large. Take them off; plain 15 mm links or silk knots are the classic pair.');
    }
    if (has('tiebar') && tie) {
      const mm = +acc.tiebar.size || 45, f = mm / TIE_MM;
      if (f <= 0.78) ok('tiebar', 'Tie bar, ' + mm + ' mm: about ' + Math.round(f * 100) + '% of an 8 cm tie. The classic proportion is about three quarters of the tie\'s width, so the bar sits inside its edges.');
      else if (f <= 1) carry('tiebar', 0.55, 'Tie bar, ' + mm + ' mm: nearly the width of an 8 cm tie, so it reads as a line drawn across it.', [
        { done: false, text: 'a wider tie (9 cm) to bring it inside the edges, if you own one' },
        { done: acc.tiebar.metal === 'gunmetal', text: 'a matte metal that keeps it quiet' }
      ]);
      else out('tiebar', 'Tie bar, ' + mm + ' mm: longer than the tie is wide, so its ends stick out past the edges. Nothing else can hide that. Not for this tie: take it off, or keep it for a wider tie.');
    }
    if (has('ring')) {
      const mm = +acc.ring.size || 12;
      if (mm <= PARAMS.ringMax) ok('ring', 'Ring, ' + mm + ' mm: a classic signet or band size (up to about 15 mm across the face).');
      else if (mm <= PARAMS.ringFar) carry('ring', 0.6, 'Ring, ' + mm + ' mm: a large face. It draws the eye to the hand.', [
        { done: !has('cufflinks'), text: 'no cufflinks, so the hand carries one piece', fix: { label: 'Take off the cufflinks', acc: 'cufflinks', set: { on: false } } },
        { done: !has('watch') || (+acc.watch.size || 38) <= watchRange(acc.wrist)[1], text: 'a watch within its range' }
      ]);
      else out('ring', 'Ring, ' + mm + ' mm: a statement ring. In a classic outfit nothing balances it; take it off for this one.');
    }
  }

  E.part('accessories', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, p = ctx.p, L = ctx.L, K = ctx.K, near = ctx.near, add = ctx.add, nm = ctx.nm;
    accessoryChecks(o.acc || {}, L, K, p, add, nm, o.occasion, o);
    const gl = framesOf(o), fw = frameWeight(p, gl);
    if (fw) add({ id: 'gweight', group: 'accessory', level: 'A/B', score: fw.score, slots: [], acc: 'glasses', text: fw.text });
    // Frames and the colours beside them (B): a metal or coloured frame is a second temperature at the
    // face, against you only when the pair pulls away from your colouring: warm frames with a warm
    // colour on a face that is not warm, cool frames with a cool colour on a warm face.
    const ft = frameTemp(gl);
    if (ft) {
      const fName = gl.frame === 'acetate' ? 'your ' + ft + '-coloured frames' : gl.frame + ' frames';
      const pull = ft === 'warm' ? p.tempLevel !== 'warm' : p.tempLevel === 'warm';
      const second = pull ? near.filter(function (k) { const t = scoreCached(L[k].mean, p).temperature; return ft === 'warm' ? t > 0.4 : t < -0.4; }) : [];
      if (second.length) add({ id: 'glasses', group: 'colour', score: 0.8, slots: second,
        text: 'With ' + fName + ', ' + second.map(nm).join(' and ') + (second.length > 1 ? ' are' : ' is') + ' a second ' + ft + ' note at the face, beside the frames. Let the frames be the one ' + ft + ' note: a ' + (ft === 'warm' ? 'cool or neutral' : 'warm or neutral') + ' colour there instead.' });
    }
  });
})();
