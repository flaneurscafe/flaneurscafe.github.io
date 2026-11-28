/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser's fixes in Node: tests/fixes.json, recorded from the page by tools/fixes.py,
   replayed through js/dress.js, with the two buttons that change several pieces at once
   (Choose the best colours; Keep this, fix the rest). For 60 seeded outfits in winter, summer and autumn, every check must
   offer the same fix buttons as the page (label, colour, disabled), and pressing each must change the
   same pieces in the same way and show the same note. A difference means the page and the module
   disagree: if the change was meant, record the page again with python tools/fixes.py --update. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = {};
require('./load')(['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'outfit', 'body', 'proportion', 'dress']);
const E = window.VENGINE, O = window.VOUTFIT, D = window.VDATA, X = window.VDRESS;
const rec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixes.json'), 'utf8'));
// the page's names: a library colour by name, anything else by its code (the demo has no colours of its own)
const nameOf = h => { const c = D.colours.find(x => x.hex.toLowerCase() === String(h).toLowerCase()); return c ? c.name : String(h).toUpperCase(); };
// the page shows a fix's colour as a swatch, which the browser reports as rgb()
const rgb = h => { const n = parseInt(h.slice(1), 16); return 'rgb(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')'; };
const clone = x => JSON.parse(JSON.stringify(x));

let cases = 0, fixes = 0, applied = 0; const diffs = [];
const analyses = {};
rec.cases.forEach(cs => {
  cases++;
  const state = Object.assign(clone(rec.state), { season: cs.season });
  const a = analyses[cs.season] || (analyses[cs.season] = E.analyseProfile(E.seasonProfile(state)));
  const src = rec.outfits[cs.i], o = O.normOutfit(clone(src));
  const checks = E.checkOutfit(O.engineOutfit(o, state, nameOf), a);
  const rows = checks.map((c, ci) => ({ ci, fixes: X.fixesFor(c, { o, a, nameOf, profile: state }) })).filter(r => r.fixes.length);
  const where = 'outfit ' + cs.i + ' ' + cs.season;
  if (rows.map(r => r.ci).join() !== cs.rows.map(r => r.ci).join()) { diffs.push(where + ': fixes under checks ' + rows.map(r => r.ci) + ', the page ' + cs.rows.map(r => r.ci)); return; }
  rows.forEach((r, ri) => {
    const pr = cs.rows[ri];
    if (r.fixes.length !== pr.fixes.length) { diffs.push(where + ' check ' + r.ci + ': ' + r.fixes.map(f => f.label) + ' | page: ' + pr.fixes.map(f => f.label)); return; }
    r.fixes.forEach((f, j) => {
      fixes++;
      const pf = pr.fixes[j], tag = where + ' check ' + r.ci + ' fix ' + j + ' ';
      if (f.label !== pf.label) diffs.push(tag + 'label "' + f.label + '" | page "' + pf.label + '"');
      if ((f.hex ? rgb(f.hex) : null) !== (pf.hex || null)) diffs.push(tag + 'colour ' + f.hex + ' | page ' + pf.hex);
      if (!!f.disabled !== !!pf.disabled) diffs.push(tag + 'disabled ' + !!f.disabled + ' | page ' + !!pf.disabled);
      if (f.disabled || pf.disabled) return;
      // pressing it: a fresh copy, the fix, then what the page's commit does (a pattern the cloth cannot carry becomes plain)
      applied++;
      const o2 = O.normOutfit(clone(src)), before = clone(o2);
      const note = [f.apply(o2), O.fitPatterns(o2)].filter(Boolean).join(' '), now = clone(o2), changed = {};
      Object.keys(Object.assign({}, now, before)).forEach(k => { if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) changed[k] = now[k] === undefined ? null : now[k]; });
      if (note !== pf.note) diffs.push(tag + 'note "' + note + '" | page "' + pf.note + '"');
      if (JSON.stringify(changed) !== JSON.stringify(pf.changed)) diffs.push(tag + 'changed ' + JSON.stringify(changed).slice(0, 160) + ' | page ' + JSON.stringify(pf.changed).slice(0, 160));
    });
  });
});
// the two buttons that change several pieces at once
let presses = 0;
const pressCheck = (where, act, pw) => {
  const src = rec.outfits[where.i], o2 = O.normOutfit(clone(src)), before = clone(o2);
  const r = act(o2), note = [r.note, O.fitPatterns(o2)].filter(Boolean).join(' '), now = clone(o2), changed = {};
  Object.keys(Object.assign({}, now, before)).forEach(k => { if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) changed[k] = now[k] === undefined ? null : now[k]; });
  presses++;
  const tag = 'outfit ' + where.i + ' ' + where.season + ' ' + where.what + ': ';
  if (note !== pw.note) diffs.push(tag + 'note "' + note + '" | page "' + pw.note + '"');
  if (JSON.stringify(changed) !== JSON.stringify(pw.changed)) diffs.push(tag + 'changed ' + JSON.stringify(changed).slice(0, 160) + ' | page ' + JSON.stringify(pw.changed).slice(0, 160));
  return { r, changed };
};
/* Each press costs the engine about a second (it searches the colours), so the usual run presses a
   sample: the first two of every kind of answer the page gave (kept with changes, kept as it was,
   still failing with and without changes, a clash with the skin; Choose the best colours with
   changes), and of every kind of change to a piece (put on, put on in another pattern, taken off, a
   new pattern, a new type, a new colour). node tests/fixes.js --all presses all 969 (about 15 minutes). */
const ALL = process.argv.indexOf('--all') >= 0;
const kindOfNote = (what, n) => what === 'complete' ? (/^Nothing to change/.test(n) ? 'complete, nothing' : 'complete, changed')
  : /still fails/.test(n) ? (/improved anyway/.test(n) ? 'keep, still fails, rest improved' : 'keep, still fails')
  : /clash with your skin/.test(n) ? (/improved anyway/.test(n) ? 'keep, skin clash, rest improved' : 'keep, skin clash')
  : /already works/.test(n) ? 'keep, already works' : 'keep, rest changed';
const todo = [], perKind = {};
let nPress = 0;
rec.cases.forEach(cs => {
  if (!cs.whole) { diffs.push('outfit ' + cs.i + ' ' + cs.season + ': the record has no presses of the outfit buttons (record it again)'); return; }
  [['complete', null, cs.whole.complete]].concat(Object.keys(cs.whole.keep).map(k => ['keep', k, cs.whole.keep[k]])).forEach(([what, k, pw]) => {
    nPress++;
    // and by what it did to the pieces: one put on, one taken off, a new pattern, a new type, a colour
    const src = rec.outfits[cs.i], did = Object.keys(pw.changed).filter(p => p !== 'locks' && src[p]).map(p => {
      const was = src[p], now = pw.changed[p];
      const pat = JSON.stringify(now.pat) !== JSON.stringify(was.pat);
      return was.on === false && now.on ? (pat ? 'put on in another pattern' : 'put on') : was.on !== false && now.on === false ? 'taken off' : pat ? 'pattern' : now.kind !== was.kind ? 'type' : 'colour';
    });
    let take = ALL;
    [kindOfNote(what, pw.note)].concat(did.map(d => what + ': ' + d)).forEach(kind => { perKind[kind] = (perKind[kind] || 0) + 1; if (perKind[kind] <= 2) take = true; });
    if (take) todo.push({ cs, what, k, pw });
  });
});
todo.forEach(({ cs, what, k, pw }) => {
  const state = Object.assign(clone(rec.state), { season: cs.season }), a = analyses[cs.season], ctx = { a, nameOf, profile: state };
  if (what === 'complete') {
    const c = pressCheck({ i: cs.i, season: cs.season, what: 'Choose the best colours' }, o2 => X.completeOutfit(o2, Object.assign({ o: o2 }, ctx)), pw);
    // Undo keeps a copy only when something changed
    if (c.r.undoable !== Object.keys(c.changed).length > 0) diffs.push('outfit ' + cs.i + ' ' + cs.season + ': Choose the best colours says undoable ' + c.r.undoable + ' with changes ' + Object.keys(c.changed));
    return;
  }
  const kp = pressCheck({ i: cs.i, season: cs.season, what: 'Keep the ' + k }, o2 => X.keepAndFix(o2, k, Object.assign({ o: o2 }, ctx)), pw);
  // the kept piece is locked and never changed itself
  const kept = (kp.changed.locks || rec.outfits[cs.i].locks || {})[k] === true, own = !(k in kp.changed);
  if (!kept || !own) diffs.push('outfit ' + cs.i + ' ' + cs.season + ' keep ' + k + ': locked ' + kept + ', the piece itself unchanged ' + own);
  // nothing to undo only when it failed and nothing else changed (the new lock alone is still undoable)
  const others = Object.keys(kp.changed).filter(x => x !== 'locks').length;
  if (kp.r.undoable !== (/still fails|clash with your skin/.test(pw.note) ? others > 0 : true)) diffs.push('outfit ' + cs.i + ' ' + cs.season + ' keep ' + k + ': undoable ' + kp.r.undoable + ' with ' + others + ' other piece(s) changed');
});
// the page's record never had nothing better to choose: pressed twice, the second finds nothing and leaves nothing to undo
{
  const state = Object.assign(clone(rec.state), { season: 'winter' }), a = analyses.winter, ctx = { a, nameOf, profile: state };
  const o2 = O.normOutfit(clone(rec.outfits[0])); X.completeOutfit(o2, ctx); const again = clone(o2), r2 = X.completeOutfit(o2, ctx);
  presses += 2;
  if (r2.undoable !== false || !/^Nothing to change/.test(r2.note) || JSON.stringify(o2) !== JSON.stringify(again)) diffs.push('outfit 0 winter: Choose the best colours twice: the second ' + JSON.stringify(r2));
}
diffs.slice(0, 12).forEach(d => console.log('  ' + d));
if (diffs.length) { console.log('fixes: ' + diffs.length + ' difference(s) from the page'); process.exit(1); }
console.log('fixes: every fix as the page offers and applies it (' + cases + ' cases, ' + fixes + ' fixes, ' + applied + ' pressed); Choose the best colours and Keep this, fix the rest as the page does them (' + presses + ' presses' + (ALL ? '' : ', a sample of every kind of answer and change; --all for all ' + nPress) + ')');
