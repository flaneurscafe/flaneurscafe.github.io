/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — dressing decisions: what changing a garment type takes with it, what can be put on and
   why not, and every fix the Dresser offers under a check. Moved out of the page code (js/ui/dresser.js)
   in 1.21, so that the Node tests reach them: tests/fixes.js replays tests/fixes.json, which
   tools/fixes.py records from the page; since 1.22 also Keep this, fix the rest and Choose the best
   colours. Nothing here draws or stores anything.

   o is a stored outfit (js/outfit.js, normOutfit); it is changed in place by applyKind, putOn and a
   fix's apply(o), which returns the note to show. ctx for the fixes: { o, a: the colouring
   (engine.js, analyseProfile), nameOf: hex → colour name, profile: the state the engine's form of
   the outfit needs (measurements, shape) }. */
// @ts-check
(function () {
  'use strict';
  const G = window.VGARM, E = window.VENGINE, O = window.VOUTFIT, VP = window.VPAT, VC = window.VC;

  const kindOf = function (o, k) { return G.kind(k, o[k]); };
  const lname = function (o, k) { return kindOf(o, k).name.toLowerCase(); };
  const worn = function (o, k) { return o[k].on !== false; };

  /* ---------- Putting pieces on, and changing their type ---------- */
  const hasLapel = function (o) { return (worn(o, 'jacket') && kindOf(o, 'jacket').frame === 'lapel') || (worn(o, 'coat') && kindOf(o, 'coat').frame === 'lapel'); };
  const hasPocket = function (o) { return (worn(o, 'jacket') && kindOf(o, 'jacket').pocket) || (worn(o, 'coat') && kindOf(o, 'coat').pocket); };
  // Why a type of this piece cannot be chosen now.
  function kindBlocked(o, k, t) {
    if (k === 'tie' && t.needsCollar && !kindOf(o, 'shirt').tieable) return 'A ' + t.name.toLowerCase() + ' needs a shirt\'s collar and button front: choose a shirt as the layer next to the neck first.';
    return '';
  }
  // Why a position cannot be put on now.
  function blockedWhy(o, k) {
    if (k === 'square' && !hasPocket(o)) return 'A pocket square needs a breast pocket: a tailored jacket, a blazer or an overcoat.';
    if (k === 'boutonniere' && !hasLapel(o)) return 'A buttonhole flower or pin needs a jacket, blazer or coat with lapels.';
    if (k === 'tie' && !kindOf(o, 'shirt').tieable) return 'Neckwear (a tie, bow tie or cravat) needs a shirt\'s collar and button front. With a ' + lname(o, 'shirt') + ', add a scarf instead.';
    return '';
  }
  // Putting a piece on. Neckwear needs a collar; the Add button is disabled without one.
  function putOn(o, k) {
    o[k].on = true;
    if (k === 'tie' && !kindOf(o, 'shirt').tieable) { o.tie.on = false; return 'A ' + lname(o, 'shirt') + ' is not cut for neckwear; add a scarf instead.'; }
    return '';
  }
  /* A change of garment type with what follows from it: the cloth and pattern brought in line, and the
     pieces that depend on it. Used by the type buttons and by fixes that change a type. Returns the notes. */
  function applyKind(o, k, id) {
    const x = o[k], t = G.byKey[k].kinds.find(function (q) { return q.id === id; }), notes = [t.name + ' chosen.'], was = kindOf(o, k);
    x.kind = id;
    if (x.cloth && (!t.cloths || t.cloths.indexOf(x.cloth) < 0)) { x.cloth = t.cloths ? t.cloths[0] : undefined; }
    const pat = VP.norm(x.pat);
    if (pat.type !== 'solid' && t.pats.indexOf(pat.type) < 0) { x.pat = { type: 'solid' }; notes.push('Made it plain: ' + VP.byId[pat.type].name.toLowerCase() + ' is not used on a ' + t.name.toLowerCase() + '.'); }
    // what depends on this piece
    if (k === 'shirt' && !t.tieable && worn(o, 'tie') && kindOf(o, 'tie').needsCollar) { notes.push('Took off the ' + lname(o, 'tie') + ': it needs a shirt\'s collar and button front. Add a scarf instead if you want one.'); o.tie.on = false; }
    if (k === 'shirt' && !t.tieable && o.acc.cufflinks.on) { o.acc.cufflinks.on = false; notes.push('Took off the cufflinks: they need shirt cuffs.'); }
    if ((k === 'jacket' || k === 'coat') && worn(o, 'square') && !hasPocket(o)) { o.square.on = false; notes.push('Took off the pocket square: it needs a breast pocket.'); }
    if ((k === 'jacket' || k === 'coat') && worn(o, 'boutonniere') && !hasLapel(o)) { o.boutonniere.on = false; notes.push('Took off the buttonhole: it needs a lapel.'); }
    if (t.metal) { x.metal = x.metal || 'silver'; x.hex = G.metalBy[x.metal].hex; }   // a lapel pin is its metal
    else if (was.metal) x.hex = '#f7f6f2';                           // from a pin back to a flower: a white carnation
    if (t.twoTone && !x.hex2) x.hex2 = '#f2efe6';                     // spectators start brown and white
    if (t.buttons && !x.buttons) x.buttons = 'silver';                // silver, so a new blazer agrees with the default steel watch
    if (!t.collars) { delete x.collar; delete x.collarBand; delete x.collarHex; }   // only a woven shirt records its collar
    if (!t.knit) delete x.knit;                                       // only a knit records how it is knitted
    if (!t.brogue) delete x.brogue;                                   // only an oxford or a derby is brogued
    return notes;
  }

  /* ---------- Fixes: what a button under a check offers, and what pressing it does ----------
     Each fix is { label, hex (a colour to show), slot, disabled, apply(o) → the note }. At most two
     per check; a fix never touches a piece you have locked (one you own). */
  const LOCKED = { label: 'Locked: unlock to get a fix', disabled: true };
  const colourNote = function (o, k, hex, nameOf) { return kindOf(o, k).name + ' set to ' + nameOf(hex) + '.'; };

  function fixesFor(c, ctx) {
    const o = ctx.o;
    if (c.score >= 0.85 && !(c.id === 'pecho' && c.score < 1)) return [];   // a passing check needs no fix; an echo hint offers its pick-up
    const locks = o.locks, out = [];
    // a fix the check itself carries (js/checks/*.js)
    if (c.fixes) return c.fixes.filter(function (f) { return !(f.slot && locks[f.slot]); }).slice(0, 2).map(function (f) {
      return { label: f.label, apply: function (o) {
        if (f.acc) Object.assign(o.acc[f.acc], f.set);
        (f.and || []).forEach(function (g) { if (g.acc) Object.assign(o.acc[g.acc], g.set); });   // a fix that changes two accessories
        if (f.slot && f.kind) applyKind(o, f.slot, f.kind);
        if (f.slot && f.on === false) o[f.slot].on = false;
        if (f.slot && f.pat) o[f.slot].pat = f.pat;
        if (f.slot && f.set) Object.assign(o[f.slot], f.set);
        return f.label + '.';
      } };
    });
    if (c.id === 'band' && !locks.hat) return [{ label: 'Navy band', hex: '#1d2a44', apply: function (o) { o.hat.band = '#1d2a44'; return 'Hat band: navy.'; } }];
    if (c.id === 'brim' && !locks.hat) return [{ label: 'Medium brim', apply: function (o) { o.hat.brim = 'medium'; return 'Brim: medium.'; } }];
    if (c.group === 'accessory') return [];
    if (c.group === 'sheen' || c.group === 'formality' || c.group === 'season' || c.id === 'shoe') return wholeFixes(c, ctx);
    if (c.group === 'pattern') return patternFixes(c, ctx);
    if (c.fix && c.fix.kind === 'solid' && !locks[c.fix.slot]) out.push({ label: 'Make the ' + lname(o, c.fix.slot) + ' plain', apply: function (o) { o[c.fix.slot].pat = { type: 'solid' }; return 'Made the ' + lname(o, c.fix.slot) + ' plain.'; } });
    if (['neck', 'square', 'layer', 'frame'].indexOf(c.id) >= 0) {
      const k0 = (c.slots || [])[0];
      if (c.id === 'neck' && worn(o, 'tie') && !worn(o, 'scarf')) out.push({ label: 'A scarf instead', apply: function (o) { o.scarf.on = true; o.scarf.hex = o.tie.hex; o.tie.on = false; return 'A scarf instead of the ' + lname(o, 'tie') + '.'; } });
      if ((c.id === 'neck' || c.id === 'square') && k0 && worn(o, k0)) out.push({ label: 'Take off the ' + lname(o, k0), apply: function (o) { o[k0].on = false; return 'Took off the ' + lname(o, k0) + '.'; } });
      if ((c.id === 'layer' || c.id === 'frame') && !locks.shirt) out.push({ label: 'Wear a shirt next to the neck', apply: function (o) { o.shirt.kind = 'shirt'; if (VP.norm(o.shirt.pat).type === 'breton') o.shirt.pat = { type: 'solid' }; return 'A shirt is next to the neck now; its collar frames the face.'; } });
      if (out.length) return out.slice(0, 2);
    }
    // a colour that passes where this piece is, from the suggestions (js/suggest.js)
    const eo = O.engineOutfit(o, ctx.profile, ctx.nameOf);
    (c.slots || []).forEach(function (k) {
      if (out.length >= 2 || !o[k] || locks[k] || !worn(o, k)) return;
      const fitK = E.fitFor(eo, ctx.a, k);
      const best = E.suggest(eo, ctx.a, k, 6).find(function (q) { return fitK.judge(q.hex, q.name).state === 'ok'; });
      if (best) out.push({ label: 'Try ' + best.name + ' ' + lname(o, k), hex: best.hex, slot: k, apply: function (o) { o[k].hex = best.hex; return colourNote(o, k, best.hex, ctx.nameOf); } });
    });
    if (!out.length && (c.slots || []).some(function (k) { return locks[k]; })) out.push(LOCKED);
    return out;
  }

  // Patterns: a larger or smaller scale, a second colour the outfit already has, or plain.
  function patternFixes(c, ctx) {
    const o = ctx.o, out = [], k = (c.slots || [])[0], locks = o.locks;
    if (!k || !o[k] || locks[k]) return k && locks[k] ? [LOCKED] : [];
    const x = o[k], pat = VP.norm(x.pat), lbl = lname(o, k);
    const setPat = function (np, note) { return function (o) { o[k].pat = np; return note; }; };
    if (pat.type === 'solid') return out;
    if (c.id === 'pscale') {
      const up = Math.min(9, Math.round(pat.scale * 2.2 * 10) / 10);
      out.push({ label: 'Scale the ' + lbl + ' to ' + up + ' cm', apply: setPat({ type: pat.type, scale: up, hex2: pat.hex2 }, 'The ' + lbl + ' pattern is now ' + up + ' cm.') });
    }
    if (c.id === 'psize' || c.id === 'pmed') {
      const down = { small: 1.5, medium: 4, large: 9 }[G.kind(k, x).maxScale] || 1.5;
      out.push({ label: 'Scale the ' + lbl + ' down to ' + down + ' cm', apply: setPat({ type: pat.type, scale: down, hex2: pat.hex2 }, 'The ' + lbl + ' pattern is now ' + down + ' cm.') });
    }
    if (c.id === 'pecho' || c.id === 'pcontrast') {
      // a second colour that is shared with the rest of the outfit and sits closer to the ground
      const others = O.engineOutfit(o, ctx.profile, ctx.nameOf), L0 = VC.hexToLab(x.hex)[0], hi = ctx.a.contrast * 1.5 + 15, cand = [];
      Object.keys(others).forEach(function (p) { if (p !== k && others[p] && typeof others[p] === 'object' && others[p].hex) { cand.push(others[p].hex); const op = VP.norm(others[p].pat); if (op.type !== 'solid') cand.push(op.hex2); } });
      const ok = cand.filter(function (h) { const d = Math.abs(VC.hexToLab(h)[0] - L0); return d >= 12 && d < hi * 0.85; })
        .sort(function (h1, h2) { return Math.abs(VC.hexToLab(h1)[0] - L0) - Math.abs(VC.hexToLab(h2)[0] - L0); });
      if (ok[0]) out.push({ label: 'Second colour: ' + ctx.nameOf(ok[0]), hex: ok[0], apply: setPat({ type: pat.type, scale: pat.scale, hex2: ok[0] }, 'The ' + lbl + ' pattern now uses ' + ctx.nameOf(ok[0]) + '.') });
    }
    if (c.id === 'pecho') return out.slice(0, 1);   // a hint offers the echo, not a plain piece
    out.push({ label: 'Make the ' + lbl + ' plain', apply: setPat({ type: 'solid' }, 'Made the ' + lbl + ' plain.') });
    return out.slice(0, 2);
  }

  // Cloth, formality and season: another cloth of the same garment, or another shoe.
  function wholeFixes(c, ctx) {
    const o = ctx.o, a = ctx.a, locks = o.locks, out = [], k = (c.slots || [])[0];
    if (!k || !o[k] || !worn(o, k)) return out;
    if (locks[k]) return [LOCKED];
    const kd = kindOf(o, k), cur = G.cloth(k, o[k]), occ = G.OCCASIONS.find(function (x) { return x.id === (o.occasion || 'smart'); });
    const season = G.normSeason(a && a.season);
    // a cloth as this piece would be in it: its knit and broguing kept (G.cloth, G.formality)
    const as = function (id) { return Object.assign({}, o[k], { cloth: id }); };
    const setCloth = function (id) { const nm = G.cloth(k, as(id)).name.toLowerCase().replace(/ \(shiny\)$/, ''); return { label: kd.name + ' in ' + nm + ' instead', apply: function (o) { o[k].cloth = id; return kindOf(o, k).name + ' in ' + nm + '.'; } }; };
    // a chunky knit is casual and winter whatever its yarn: the fix is a finer knit of the same yarn
    const fineKnit = { label: 'A fine-gauge ' + kd.name.toLowerCase() + ' instead', apply: function (o) { delete o[k].knit; return kindOf(o, k).name + ': fine or medium gauge.'; } };
    const chunky = kd.knit && o[k].knit === 'chunky';
    const setKind = function (id) { const t = G.byKey[k].kinds.find(function (q) { return q.id === id; }); return { label: 'Wear ' + t.name.toLowerCase() + (/s$/.test(t.name) ? '' : 's') + ' instead', apply: function (o) { o[k].kind = id; if (o[k].cloth && t.cloths.indexOf(o[k].cloth) < 0) o[k].cloth = t.cloths[0]; return t.name + ' instead.'; } }; };
    const fOf = function (id) { return kd.f == null ? null : G.formality(k, as(id)); };
    const okCloth = function (id) { const cl = G.cloth(k, as(id)); return cl.sheen < 2 && G.inSeason(cl, season); };   // spring and autumn rule out neither end (garments.js)
    const inRange = function (f) { return f != null && f >= occ.range[0] && f <= occ.range[1]; };
    if (c.id === 'sheen') { const id = (kd.cloths || []).find(function (q) { return G.CLOTHS[q].sheen < 2 && okCloth(q); }); if (id) out.push(setCloth(id)); }
    else if (c.id === 'season' && chunky && season === 'summer') out.push(fineKnit);
    else if (c.id === 'season') { const id = (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q) && Math.abs((fOf(q) || 0) - (fOf(cur.id) || 0)) <= 1; }) || (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q); }); if (id) out.push(setCloth(id)); }
    else if ((c.id === 'occasion' || c.id === 'formal') && chunky && inRange(G.formality(k, Object.assign({}, o[k], { knit: undefined })))) out.push(fineKnit);
    else if (c.id === 'occasion' || c.id === 'formal') {
      const id = (kd.cloths || []).find(function (q) { return q !== cur.id && okCloth(q) && inRange(fOf(q)); });
      if (id) out.push(setCloth(id));
      else if (k === 'shoes') { const t = G.byKey.shoes.kinds.find(function (q) { return inRange(q.f) && q.id !== kd.id; }); if (t) out.push(setKind(t.id)); }
    } else if (c.id === 'shoe') {
      if (k === 'shoes') out.push(setKind(occ.id === 'business' ? 'oxford' : 'loafer'));
      if (k === 'tie' || (worn(o, 'tie') && kindOf(o, 'tie').knotted)) out.push({ label: 'Take off the ' + lname(o, 'tie'), apply: function (o) { o.tie.on = false; return 'Took off the ' + lname(o, 'tie') + '.'; } });
    } else if (c.id === 'orphan') {
      const jc = G.cloth('jacket', o.jacket);
      if (kindOf(o, 'trousers').cloths.indexOf(jc.id) >= 0 && !locks.trousers) out.push({ label: 'Trousers in ' + jc.name.toLowerCase() + ', as a suit', apply: function (o) { o.trousers.cloth = jc.id; return 'Trousers in ' + jc.name.toLowerCase() + ': now a suit.'; } });
    }
    return out.slice(0, 2);
  }

  /* ---------- The two buttons that change several pieces at once ----------
     Each changes o in place and returns { note, undoable }: undoable false means nothing changed
     and the page drops the copy it kept for Undo. The engine chooses (js/suggest.js, E.rescue and
     E.complete); this copies its answer into the stored outfit. */
  // Keep this, fix the rest: the rest is rebuilt around a piece that does not fit, which is then locked.
  function keepAndFix(o, k, ctx) {
    const nameOf = ctx.nameOf, before = O.engineOutfit(o, ctx.profile, nameOf), r = E.rescue(before, ctx.a, k, o.locks), changed = [];
    G.POSITIONS.forEach(function (p) {
      const b = before[p.key], n = r.outfit[p.key], x = o[p.key];
      if (p.key === k) return;
      if (b && !n) { x.on = false; changed.push('took off the ' + lname(o, p.key)); }
      else if (n && !b) { x.on = true; x.hex = n.hex; if (n.kind) x.kind = n.kind; x.pat = n.pat || { type: 'solid' }; changed.push('added a ' + nameOf(n.hex) + ' ' + lname(o, p.key)); }
      else if (n && b && (n.hex !== b.hex || n.kind !== b.kind)) { x.hex = n.hex; if (n.kind) x.kind = n.kind; if (n.pat) x.pat = n.pat; changed.push(lname(o, p.key) + ' to ' + nameOf(n.hex)); }
    });
    o.locks[k] = true;
    const what = nameOf(o[k].hex) + ' ' + lname(o, k);
    let note;
    if (r.ok) note = 'Kept the ' + what + ' (now locked)' + (changed.length ? ': ' + changed.join(', ') + '.' : '; it already works with the rest.') + ' Undo to go back.';
    else {
      note = r.atFace
        ? 'Kept the ' + what + ' (now locked). Its clash with your skin is shown above; the colour can still be worn ' + (k === 'shirt' || k === 'mid' ? 'as a layer under a closed jacket, or ' : '') + 'as trousers, socks or a bag.'
        : 'Even with the rest changed, the ' + what + ' still fails: ' + r.left.map(function (c) { return c.text; }).join(' ') + ' Take it off for this outfit.';
      if (changed.length) note += ' The rest was improved anyway: ' + changed.join(', ') + '. Undo to go back.';
    }
    // kept and fine as it was: the lock is new, so Undo still has something to undo
    return { note: note, undoable: r.ok || changed.length > 0 };
  }
  // Choose the best colours: each unlocked piece's colour, nothing added or taken off.
  function completeOutfit(o, ctx) {
    const before = O.engineOutfit(o, ctx.profile, ctx.nameOf), after = E.complete(before, ctx.a, o.locks), changed = [];
    G.POSITIONS.forEach(function (p) {
      if (after[p.key] && before[p.key] && after[p.key].hex !== before[p.key].hex) { o[p.key].hex = after[p.key].hex; changed.push(lname(o, p.key) + ' to ' + after[p.key].name); }
    });
    if (!changed.length) return { note: 'Nothing to change: no unlocked piece has a better colour for this outfit.', undoable: false };
    return { note: 'Changed ' + changed.join(', ') + '. Undo to go back.', undoable: true };
  }

  window.VDRESS = { keepAndFix: keepAndFix, completeOutfit: completeOutfit, kindBlocked: kindBlocked, blockedWhy: blockedWhy, putOn: putOn, applyKind: applyKind, hasLapel: hasLapel,
    fixesFor: fixesFor, patternFixes: patternFixes, wholeFixes: wholeFixes, LOCKED: LOCKED };
})();
