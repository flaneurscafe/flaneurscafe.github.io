/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the suggestion solver: colours ranked for one piece (suggest), how a colour would sit in a
   piece (fitFor), Choose the best colours (complete), Keep this, fix the rest (rescue) and the theme
   palettes. It changes outfits and asks js/engine.js what the rules say about each; the rules
   themselves are not here. Adds its functions to window.VENGINE. */
(function () {
  'use strict';
  const E = window.VENGINE, VC = window.VC, G = E.G, R = window.VRULES;
  const PARAMS = R.PARAMS, RULES = R.RULES, FACE = E.FACE, SLOTS = E.SLOTS;
  const checkOutfit = E.checkOutfit, verdict = E.verdict, penalty = E.penalty, wardrobeNeutral = E.wardrobeNeutral;
  const okc = E.okc, hueDist = E.hueDist, scoreCached = E.scoreCached, round = E.round;

  const SHOE_COLOURS = ['Black', 'Chocolate', 'Mid brown', 'Tobacco', 'Cognac', 'Tan', 'Oxblood', 'Burgundy', 'Navy', 'Charcoal', 'White'];
  function slotFit(slot, hex, p, name, kindId) {
    const t = scoreCached(hex, p).tier, l = VC.hexToLab(hex)[0], neutral = wardrobeNeutral(hex);   // camel or tan trousers are neutrals in menswear
    let c = 0;
    if (FACE.indexOf(slot) >= 0) c += [0, 0.15, 0.9, 1.5][t - 1];
    if (slot === 'shirt' && (!kindId || kindId === 'shirt' || kindId === 'polo' || kindId === 'tee') && l < 70) c += 0.3;
    if (slot === 'mid' && l > 85) c += 0.2;
    if (slot === 'jacket' && l > 70) c += 0.4;
    if (slot === 'jacket' && !neutral) c += 0.15;
    if (slot === 'trousers') c += (t === 4 ? 0.35 : 0) + (neutral ? 0 : 0.2) + (l > 85 ? 0.25 : 0);
    if (slot === 'shoes') c += (name && SHOE_COLOURS.indexOf(name) < 0 ? 2 : 0) + (l > 55 && name !== 'White' ? 0.6 : 0);
    // coats, gloves and hats (B): a coat is a neutral and not pale; gloves are leather colours, like
    // shoes; a hat is a neutral, a straw hat may be light
    if (slot === 'coat') c += (neutral ? 0 : 0.45) + (l > 75 ? 0.4 : 0);
    if (slot === 'gloves') c += (name && SHOE_COLOURS.concat(['Mid grey', 'Grey', 'Camel', 'Tan']).indexOf(name) < 0 ? 1.2 : 0);
    if (slot === 'hat') c += (neutral ? 0 : 0.3) + (l > 75 && kindId !== 'panama' && kindId !== 'boater' ? 0.4 : 0);
    return c;
  }

  function withPiece(o, slot, hex, name) {
    const n = Object.assign({}, o);           // keeps the occasion, accessories and study flag too
    n[slot] = Object.assign({}, o[slot], { hex: hex, name: name || hex });
    return n;
  }

  /* Colours from the library ranked for one slot, given everything else that is worn. */
  function suggest(o, p, slot, n) {
    if (!o[slot]) return [];
    const base = checkOutfit(o, p), baseBy = {};
    base.forEach(function (c) { baseBy[c.id] = Math.min(baseBy[c.id] == null ? 1 : baseBy[c.id], c.score); });
    const res = window.VDATA.colours.map(function (c) {
      const chk = checkOutfit(withPiece(o, slot, c.hex, c.name), p), by = {};
      chk.forEach(function (x) { by[x.id] = Math.min(by[x.id] == null ? 1 : by[x.id], x.score); });
      let bestGain = 0, why = null;
      Object.keys(baseBy).forEach(function (id) { const g = (by[id] == null ? 1 : by[id]) - baseBy[id]; if (g > bestGain + 0.05 && (RULES[id] && RULES[id].reason)) { bestGain = g; why = (RULES[id] && RULES[id].reason); } });
      const t = scoreCached(c.hex, p).tier;
      // the tier is shown by its tag beside the name, so the reason only says why it helps here
      const left = chk.filter(function (x) { return x.score < 0.5; }).length;
      if (!why && left) why = (wardrobeNeutral(c.hex) ? 'a neutral; ' : '') + 'as good as any here; ' + left + ' rule' + (left > 1 ? 's fail' : ' fails') + ' elsewhere in the outfit';
      else if (!why) why = wardrobeNeutral(c.hex) ? 'a neutral; keeps every rule' : 'keeps every rule';
      return { hex: c.hex, name: c.name, tier: t, cost: penalty(chk) + slotFit(slot, c.hex, p, c.name, o[slot].kind), fails: chk.filter(function (x) { return x.score < 0.5; }).length, why: why };
    });
    res.sort(function (a, b) { return a.cost - b.cost; });
    // keep the list varied: no two suggestions closer than ΔE 6
    const pick = [];
    for (let i = 0; i < res.length && pick.length < (n || 8); i++) {
      if (o[slot].hex.toLowerCase() === res[i].hex.toLowerCase()) continue;
      if (pick.every(function (q) { return VC.deltaE2000(VC.hexToLab(q.hex), VC.hexToLab(res[i].hex)) > 6; })) pick.push(res[i]);
    }
    return pick;
  }

  /* What still works in one slot, given everything else that is worn. Every library colour is
     tried in the slot and the whole outfit is checked. A colour is blamed only for what it causes:
       - a problem that every colour gets, word for word, lies between other pieces ("stuck");
       - a problem is held against a colour only if another colour would have done better on that
         rule. Doing better is measured per rule as the summed shortfall, so a second near match
         or a second weak colour at the face still counts when one is already there.
     out:  it would make a rule fail (score under 0.5)
     care: it would bend a rule (under 0.7)
     ok:   it keeps every rule as well as any colour can. */
  function fitFor(o, p, slot) {
    const problems = function (hex, name) { return checkOutfit(withPiece(o, slot, hex, name), p).filter(function (c) { return c.score < 0.7; }); };
    const key = function (c) { return c.id + '|' + c.text; };
    const sev = function (probs) { const by = {}; probs.forEach(function (c) { by[c.id] = (by[c.id] || 0) + (1 - c.score) * (c.n || 1); }); return by; };
    const cands = window.VDATA.colours.map(function (c) { const pr = problems(c.hex, c.name); return { hex: c.hex.toLowerCase(), probs: pr, sev: sev(pr) }; });
    const seen = {}, best = {};
    cands.forEach(function (c) { c.probs.forEach(function (x) { seen[key(x)] = (seen[key(x)] || 0) + 1; best[x.id] = Infinity; }); });
    Object.keys(best).forEach(function (id) { cands.forEach(function (c) { best[id] = Math.min(best[id], c.sev[id] || 0); }); });
    const common = function (x) { return seen[key(x)] === cands.length; };
    const judge = function (probs, sv) {
      const issues = probs.filter(function (c) { return !common(c) && sv[c.id] > (best[c.id] || 0) + 0.05; }).sort(function (a, b) { return a.score - b.score; });
      return { state: !issues.length ? 'ok' : issues[0].score < 0.5 ? 'out' : 'care', why: issues.length ? issues[0].text : '', id: issues.length ? issues[0].id : null };
    };
    const byHex = {}, n = { ok: 0, care: 0, out: 0 };
    cands.forEach(function (c) { const j = judge(c.probs, c.sev); byHex[c.hex] = j; n[j.state]++; });
    // What no choice here can mend: the failures left on a colour that is itself blameless
    // (or, when none is, on the colour with the least against it).
    const clean = cands.filter(function (c) { return byHex[c.hex].state === 'ok'; });
    const ref = (clean.length ? clean : cands).slice().sort(function (a, b) { return penalty(a.probs) - penalty(b.probs); })[0];
    const stuck = ref.probs.filter(function (x) { return x.score < 0.5; }).map(function (x) { return x.text; });
    return { byHex: byHex, n: n, stuck: stuck,
      judge: function (hex, name) { if (byHex[hex.toLowerCase()]) return byHex[hex.toLowerCase()]; const pr = problems(hex, name); return judge(pr, sev(pr)); } };
  }

  /* Fill the open slots, keeping the locked ones. Best improvement first: at each step, make the
     single change (any open slot, any colour) that most lowers the total cost, until none helps. */
  function totalCost(o, p) {
    return penalty(checkOutfit(o, p)) + SLOTS.reduce(function (s, k) { return s + (o[k] ? slotFit(k, o[k].hex, p, o[k].name, o[k].kind) : 0); }, 0);
  }
  function complete(o, p, locked) {
    let cur = Object.assign({}, o);
    const open = SLOTS.filter(function (k) { return cur[k] && !locked[k]; });
    for (let step = 0; step < 6; step++) {
      const now = totalCost(cur, p), nowFails = verdict(checkOutfit(cur, p)).fails;
      let best = null;
      open.forEach(function (k) {
        suggest(cur, p, k, 3).forEach(function (c) {
          const next = withPiece(cur, k, c.hex, c.name), cost = totalCost(next, p);
          // a change that adds a failing rule is never better, whatever it saves elsewhere
          if (verdict(checkOutfit(next, p)).fails > nowFails) return;
          if (cost < now - 0.05 && (!best || cost < best.cost)) best = { next: next, cost: cost };
        });
      });
      if (!best) break;
      cur = best.next;
    }
    return cur;
  }

  /* Build around one colour: the old tailors' season colour, turned to one person. Where the colour
     itself can go on you, its nearest versions that suit you at the face when it does not, the
     neutrals and colours that go with it and suit you, and what to keep apart from it. */
  function themePalette(hex, p) {
    const sc = scoreCached(hex, p), lab = VC.hexToLab(hex), ok = okc(hex), lib = window.VDATA.colours;
    const neutralTheme = ok[1] < 0.04;
    const reason = sc.rules.filter(function (r) { return r.score < 0.85; }).sort(function (a, b) { return a.score - b.score; })[0];
    const scored = lib.filter(function (c) { return c.hex.toLowerCase() !== hex.toLowerCase(); }).map(function (c) {
      const s2 = scoreCached(c.hex, p), l2 = VC.hexToLab(c.hex), o2 = okc(c.hex);
      return { name: c.name, hex: c.hex, family: c.family, tier: s2.tier, score: s2.score, dE: VC.deltaE2000(lab, l2), dL: Math.abs(lab[0] - l2[0]), C: o2[1], h: o2[2] };
    });
    // the colour's own versions that work at the face, when it does not
    const versions = sc.tier > 2 ? scored.filter(function (c) { return c.tier <= 2 && c.dE < 30 && (neutralTheme || c.C >= 0.03) && (neutralTheme || hueDist(c.h, ok[2]) <= 40); })
      .sort(function (a, b) { return a.dE - b.dE; }).slice(0, 5) : [];
    const sep = function (c) { return c.dL >= 12 && c.dE >= 7; };
    const neutrals = scored.filter(function (c) { return c.family === 'Neutral' && c.tier <= 2 && sep(c); })
      .sort(function (a, b) { return a.tier - b.tier || b.score - a.score; }).slice(0, 6);
    const partners = [];
    scored.forEach(function (c) {
      if (c.family === 'Neutral' || c.tier > 2 || !sep(c) || c.C < 0.04) return;
      if (neutralTheme) { partners.push(Object.assign({ rel: 'any colour goes with a neutral' }, c)); return; }
      const d = hueDist(c.h, ok[2]);
      if (d <= 35) partners.push(Object.assign({ rel: 'neighbour: calm' }, c));
      else if (Math.abs(d - 180) <= 30) partners.push(Object.assign({ rel: 'opposite: lively, best dark or muted' }, c));
    });
    partners.sort(function (a, b) { return a.tier - b.tier || b.score - a.score; });
    const avoid = [];
    scored.forEach(function (c) {
      if (c.dE >= PARAMS.nearFrom && c.dE < PARAMS.nearTo) avoid.push(Object.assign({ why: 'almost the same colour: reads as a failed match' }, c));
      else if (!neutralTheme && c.C >= 0.08 && ok[1] >= 0.08 && hueDist(c.h, ok[2]) >= 60 && hueDist(c.h, ok[2]) <= 150) avoid.push(Object.assign({ why: 'competes: neither neighbour nor opposite' }, c));
    });
    avoid.sort(function (a, b) { return a.dE - b.dE; });
    const where = sc.tier === 1 ? { place: 'face', title: 'Suits you anywhere, at the face too', text: 'Build the outfit around it: a shirt, knit, tie or jacket in this colour, with the neutrals below.' }
      : sc.tier === 2 ? { place: 'face', title: 'Works at the face as the one deliberate colour', text: 'Wear it near the face as the outfit\'s single colour, and keep everything else neutral.' }
        : sc.tier === 3 ? { place: 'below', title: 'Not at your face: wear it below the belt', text: 'Trousers, shoes, a belt or a bag, with your neutrals and colours near the face.' + (versions.length ? ' Near the face, choose one of its versions that suit you.' : '') }
          : { place: 'below', title: 'Does not work for you near the face, and is loud anywhere', text: 'At most a small accent far from the face (socks, a bag), and only if you love it.' + (versions.length ? ' Better: one of its versions that does suit you.' : ' Choose another theme colour.') };
    return { hex: hex, tier: sc.tier, score: sc.score, neutral: neutralTheme, reason: reason ? reason.text : null, where: where,
      versions: versions, neutrals: neutrals, partners: partners.slice(0, 8), avoid: avoid.slice(0, 6) };
  }

  /* The study set up around a theme colour: the theme where it can go, and the neutral for the
     other place (and, with the theme below the belt, an accent) chosen together so that the three
     break as few rules as possible. Taking the first neutral and the first accent on their own can
     pair two colours that fail together (taupe beside moss: too close in lightness). */
  function themeStudy(hex, p, t) {
    t = t || themePalette(hex, p);
    const face = t.where.place === 'face';
    const piece = function (h, kind) { return h ? { hex: h, name: h, kind: kind, pat: { type: 'solid' } } : null; };
    const others = t.neutrals.length ? t.neutrals : [null];
    const accents = face ? [null] : [null].concat(t.partners.slice(0, 8));
    let best = null;
    others.forEach(function (n) {
      accents.forEach(function (acc) {
        const o = { study: true, shirt: piece(face ? hex : n && n.hex, 'shirt'), scarf: piece(acc && acc.hex, 'scarf'), trousers: piece(face ? n && n.hex : hex, 'trousers') };
        const checks = checkOutfit(o, p), v = verdict(checks);
        // fewest failures first, then the lowest penalty; an accent is worth a little, as the point
        // of a theme below the belt is to show what to wear with it
        const cost = v.fails * 10 + penalty(checks) - (acc ? 0.15 : 0);
        if (!best || cost < best.cost) best = { cost: cost, fails: v.fails, other: n, accent: acc };
      });
    });
    return { place: t.where.place, theme: hex, other: best && best.other ? best.other.hex : null, accent: best && best.accent ? best.accent.hex : null, fails: best ? best.fails : 0 };
  }

  /* Keep one piece and make the rest work around it. First every other open piece gets its best
     colour (complete); then layers are tried: putting on an outer layer, a knit or a collared
     shirt, or taking off an optional piece, kept only when it lowers the cost. What still fails
     on the kept piece afterwards is something no change elsewhere can mend: the piece is not for
     this outfit, or, when the failure is its colour at the face, not for you at the face. */
  function rescue(o, p, keep, locked) {
    const lock = Object.assign({}, locked || {}); lock[keep] = true;
    const copy = function (x) { const n = {}; Object.keys(x).forEach(function (k) { n[k] = x[k]; }); return n; };
    let cur = complete(copy(o), p, lock);
    const tries = [];
    const addLayer = function (slot, kind) {
      if (cur[slot] || lock[slot]) return;
      const seed = copy(cur); seed[slot] = { hex: '#1d2a44', name: 'Navy', kind: kind, pat: { type: 'solid' } };
      suggest(seed, p, slot, 3).concat([{ hex: '#1d2a44', name: 'Navy' }, { hex: '#f7f6f2', name: 'White' }]).forEach(function (c) {
        const t = copy(seed); t[slot] = Object.assign({}, seed[slot], { hex: c.hex, name: c.name }); tries.push(t);
      });
    };
    for (let round = 0; round < 2; round++) {
      tries.length = 0;
      addLayer('jacket', 'jacket'); addLayer('mid', 'crew');
      if (cur.shirt && !lock.shirt && !(G.kind('shirt', cur.shirt).collar)) {
        suggest(cur, p, 'shirt', 3).forEach(function (c) { const t = copy(cur); t.shirt = Object.assign({}, cur.shirt, { kind: 'shirt', hex: c.hex, name: c.name, pat: { type: 'solid' } }); tries.push(t); });
      }
      G.POSITIONS.forEach(function (pos) { if (pos.optional && cur[pos.key] && !lock[pos.key]) { const t = copy(cur); t[pos.key] = null; tries.push(t); } });
      const now = totalCost(cur, p);
      let best = null;
      tries.forEach(function (t) { const c = totalCost(t, p); if (c < now - 0.1 && (!best || c < best.c)) best = { t: t, c: c }; });
      if (!best) break;
      cur = complete(best.t, p, lock);
    }
    const checks = checkOutfit(cur, p);
    const left = checks.filter(function (c) { return c.score < 0.5 && (c.slots || []).indexOf(keep) >= 0; });
    const atFace = left.some(function (c) { return c.id === 'face'; });
    return { outfit: cur, left: left, atFace: atFace, ok: !left.length, verdict: verdict(checks) };
  }

  Object.assign(E, { suggest: suggest, complete: complete, rescue: rescue, themePalette: themePalette, themeStudy: themeStudy, fitFor: fitFor });
})();
