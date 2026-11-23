/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — My garments (js/closet.js), marks on saved outfits (js/outfit.js) and the marks report
   (tools/marks.js). */
'use strict';
const path = require('path');
global.window = {};
require('./load')(['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'outfit', 'body', 'proportion', 'closet']);
const C = window.VCLOSET, O = window.VOUTFIT, G = window.VGARM, E = window.VENGINE, D = window.VDATA;
const marks = require(path.join(__dirname, '..', 'tools', 'marks.js'));
let n = 0, failed = 0;
function check(name, ok, info) { n++; if (!ok) { failed++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } }
const nameOf = h => (D.colours.find(c => c.hex.toLowerCase() === String(h).toLowerCase()) || { name: String(h).toUpperCase() }).name;
const hex = name => D.colours.find(c => c.name === name).hex;

/* A small wardrobe: enough positions to make outfits, and one of each constraint. */
let k = 0;
const g = (slot, kind, cloth, col, extra) => Object.assign({ id: 't' + (++k), name: col + ' ' + kind, slot: slot, own: true, piece: Object.assign({ hex: hex(col), kind: kind, cloth: cloth, pat: { type: 'solid' } }, (extra && extra.piece) || {}) }, extra && extra.g);
const W = C.normGarments([
  g('shirt', 'shirt', 'poplin', 'White'), g('shirt', 'shirt', 'oxford', 'Light blue'), g('shirt', 'rollneck', 'merino', 'Charcoal'), g('shirt', 'tee', 'jersey', 'Navy'),
  g('trousers', 'trousers', 'flannel', 'Mid grey'), g('trousers', 'trousers', 'cotton', 'Khaki'), g('trousers', 'trousers', 'linen', 'Écru'),
  g('shoes', 'loafer', 'calf', 'Oxblood'), g('shoes', 'derby', 'suede', 'Chocolate'),
  g('mid', 'vneck', 'merino', 'Burgundy'), g('mid', 'crew', 'lambswool', 'Slate blue'),
  g('jacket', 'jacket', 'flannel', 'Navy'), g('jacket', 'overshirt', 'corduroy', 'Navy'),
  g('tie', 'tie', 'knitsilk', 'Bottle green'), g('tie', 'cravat', 'silktwill', 'Burgundy', { piece: { pat: { type: 'foulard', hex2: hex('French blue') } } }),
  g('square', 'square', 'linen', 'White'), g('socks', 'socks', undefined, 'Navy'),
  g('trousers', 'trousers', 'flannel', 'Charcoal', { g: { own: false } })
]);
const byName = name => W.find(x => x.name === name);
const prof = Object.assign({}, D.kp);
const opts = { base: O.normOutfit(null), occasion: 'smart', profile: prof, nameOf: nameOf,
  analysisFor: se => E.analyseProfile(E.seasonProfile(Object.assign({}, prof, { season: se || 'winter' }), se || 'winter')) };

/* ---------- The list is made safe, like every other part of a profile ---------- */
check('a well-formed list survives', W.length === 18, W.length);
const bad = C.normGarments([
  { id: 'ok1', name: '<b>x</b>'.repeat(30), slot: 'shirt', piece: { hex: 'red', kind: 'nosuch', pat: { type: 'paisley' } } },
  { id: 'bad id!', slot: 'shirt', piece: {} }, { id: 'ok2', slot: 'nowhere', piece: {} }, { id: 'ok1', slot: 'shirt', piece: {} },
  { id: 'ok3', slot: 'hat', name: 'cap\u0000', piece: { hex: '#123456', kind: 'fedora', band: 'url(x)', brim: 'huge' }, note: 'n'.repeat(500) }, null, 'text'
]);
check('bad ids, unknown positions, duplicates and non-objects are dropped', bad.length === 2 && bad[0].id === 'ok1' && bad[1].id === 'ok3', bad.map(x => x.id));
check('a non-colour becomes the default colour', O.isHex(bad[0].piece.hex) && bad[0].piece.hex === O.DEFAULT_OUTFIT.shirt.hex);
check('an unknown type falls back to the default', bad[0].piece.kind === 'shirt');
check('a pattern the garment does not take is worn plain', bad[0].piece.pat.type === 'solid');
check('the name is cut to 80 characters', bad[0].name.length === 80);
check('control characters leave the name', bad[1].name === 'cap');
check('a hat band that is not a colour and an unknown brim are dropped', !('band' in bad[1].piece) && !('brim' in bad[1].piece), bad[1].piece);
check('a note is cut to 200 characters', bad[1].note.length === 200);
check('own defaults to true; false is kept', bad[0].own === true && byName('Charcoal trousers').own === false);
check('not a list: empty', C.normGarments('x').length === 0 && C.normGarments(null).length === 0);
check('at most ' + C.MAX + ' garments', C.normGarments(Array.from({ length: C.MAX + 20 }, (x, i) => ({ id: 'a' + i, slot: 'socks', piece: {} }))).length === C.MAX);
const fp = C.fromPiece('jacket', Object.assign({}, O.normOutfit(null).jacket, { on: true, gid: 'zz', locks: 1 }), '', true);
check('a garment from a piece keeps only the piece fields, not on or gid', !('on' in fp.piece) && !('gid' in fp.piece) && fp.name === 'Untitled' && /^g/.test(fp.id), fp);
check('an automatic name: colour and type', C.autoName('jacket', { hex: hex('Navy'), kind: 'blazer' }, nameOf) === 'Navy blazer');
check('a description: type, cloth and pattern', C.describe(byName('Burgundy cravat')) === 'Cravat (ascot), silk twill, foulard', C.describe(byName('Burgundy cravat')));
const list = C.normGarments(W.slice(0, 3)), inc = C.normGarments([W[0], Object.assign({}, W[5], { id: W[1].id })]);
const mr = C.merge(list, inc);
check('merging: the same garment is skipped, a different one with a used id gets a new id', mr.added === 1 && mr.same === 1 && list.length === 4 && list[3].id !== W[1].id, mr);

/* ---------- Outfits around one garment ---------- */
const jacket = byName('Navy jacket'), job = C.around(W, jacket, opts);
check('a job is not done until run', job.done === false && job.results.length === 0);
job.step(0);
check('a step of no time still makes progress', job.results.length >= 1);
job.run();
check('run finishes the job', job.done && job.progress === 1);
// cores: 4 shirts × 3 owned trousers × 2 shoes × (2 knits + none) × the jacket = 72
check('every combination of the core is tried once', job.cores === 72 && job.results.length === 72, [job.cores, job.results.length]);
check('the garment asked about is in every outfit', job.results.every(r => r.pick.jacket === jacket));
check('a garment you are only thinking of buying is not tried', job.results.every(r => r.pick.trousers !== byName('Charcoal trousers')));
check('neckwear only on a shirt cut for it', job.results.every(r => !r.pick.tie || G.kind('shirt', r.pick.shirt.piece).tieable));
check('a pocket square only with a breast pocket', job.results.every(r => !r.pick.square || G.kind('jacket', r.pick.jacket.piece).pocket));
check('no stand-ins when every needed position has a garment', job.missing.length === 0);
// the verdict is the engine's own: rebuild a few outfits and judge them directly
const same = job.results.filter((r, i) => i % 9 === 0).every(r => {
  const o = C.outfitOf(r, opts), se = O.seasonOf(o), a = opts.analysisFor(se === 'summer' || se === 'winter' ? se : null);
  const ch = E.checkOutfit(O.engineOutfit(o, prof, nameOf), a);
  return E.verdict(ch).level === r.level && Math.abs(E.penalty(ch) - r.penalty) < 1e-9;
});
check('each verdict is exactly what the Dresser would give the same outfit', same);
// neckwear, a square and socks are added only where they lower the penalty
const judge = (pick, op) => { const o = C.outfitOf({ pick: pick }, op), se = O.seasonOf(o), ch = E.checkOutfit(O.engineOutfit(o, prof, nameOf), op.analysisFor(se === 'summer' || se === 'winter' ? se : null)); return { level: E.verdict(ch).level, penalty: E.penalty(ch) }; };
const LV = { good: 0, ok: 1, fix: 2, bad: 3 };
const bopts = Object.assign({}, opts, { occasion: 'business' }), bjob = C.around(W, jacket, bopts).run();
let added = 0, helps = true;
bjob.results.concat(job.results).forEach(r => C.EXTRA.forEach(slot => {
  if (!r.pick[slot]) return; added++;
  const without = Object.assign({}, r.pick); delete without[slot];
  const w = judge(without, r === bjob.results.find(x => x === r) ? bopts : opts);
  if (!(LV[w.level] > LV[r.level] || w.penalty > r.penalty + 1e-9)) helps = false;
}));
check('an added tie, square or socks always lowers the penalty or lifts the verdict', helps, added);
let missed = 0;
job.results.filter(r => r.level !== 'good' && r.failIds.length <= 1 && !r.pick.tie && !r.pick.square && !r.pick.socks).forEach(r => {
  W.filter(x => x.slot === 'tie' && x.own).forEach(t => {
    if (!G.neckwearAllowed(G.kind('tie', t.piece), G.kind('shirt', r.pick.shirt.piece))) return;
    const j = judge(Object.assign({}, r.pick, { tie: t }), opts);
    if (LV[j.level] < LV[r.level] || (j.level === r.level && j.penalty < r.penalty - 1e-9)) missed++;
  });
});
check('where no neckwear was added, none would have helped', missed === 0, missed);
// a business outfit worn with a tie, for the checks below
const r0 = Object.assign({}, bjob.results.find(r => r.pick.shirt.piece.kind === 'shirt' && r.level === 'good'));
r0.pick = Object.assign({}, r0.pick, { tie: byName('Bottle green tie') });
const o0 = C.outfitOf(r0, bopts);
check('the outfit of a result wears its garments and nothing else', G.SLOTS.every(s => (o0[s].on !== false) === !!r0.pick[s]) && o0.jacket.hex === jacket.piece.hex);
check('each worn piece remembers its garment', o0.jacket.gid === jacket.id && o0.shirt.gid === r0.pick.shirt.id);
check('the accessories come from the outfit being edited', JSON.stringify(o0.acc) === JSON.stringify(O.normOutfit(opts.base).acc));
check('the ids of a result', JSON.stringify(C.idsOf(r0)) === JSON.stringify(Object.fromEntries(Object.entries(r0.pick).filter(([s, x]) => x).map(([s, x]) => [s, x.id]))));
const again = C.around(W, jacket, opts).run();
check('the same question gives the same answer', JSON.stringify(again.results.map(r => [r.level, r.penalty])) === JSON.stringify(job.results.map(r => [r.level, r.penalty])));
const tie = byName('Bottle green tie'), tj = C.around(W, tie, opts).run();
check('asked about a tie: only shirts with a collar band are tried', tj.results.length > 0 && tj.results.every(r => r.pick.tie === tie && G.kind('shirt', r.pick.shirt.piece).tieable));
const sq = byName('White square'), sj = C.around(W, sq, opts).run();
check('asked about a pocket square: always with a jacket that has a pocket', sj.results.length > 0 && sj.results.every(r => r.pick.square === sq && r.pick.jacket && G.kind('jacket', r.pick.jacket.piece).pocket));
const noPocket = W.filter(x => x.slot !== 'jacket'), npj = C.around(noPocket, sq, opts).run();
check('a pocket square with no jacket to put it in: nothing tried, and it says what is missing', npj.results.length === 0 && npj.needs === 'a jacket with a breast pocket');
const maybe = byName('Charcoal trousers'), mj = C.around(W, maybe, opts).run();
check('a garment you might buy is tried when asked about', mj.results.length > 0 && mj.results.every(r => r.pick.trousers === maybe));
const noShoes = W.filter(x => x.slot !== 'shoes'), nj = C.around(noShoes, jacket, opts).run();
check('no shoes among the garments: the current outfit\'s stand in, and it says so', nj.missing.join() === 'shoes' && nj.results.every(r => r.pick.shoes && r.pick.shoes.standIn && !C.idsOf(r).shoes));
const summerTee = C.normGarments([g('trousers', 'trousers', 'seersucker', 'Light blue')])[0];
let asked = [];
const spyOpts = Object.assign({}, opts, { analysisFor: se => { asked.push(se); return opts.analysisFor(se); } });
C.around(W.concat([summerTee]), summerTee, spyOpts).run();
check('a summer outfit is judged with the summer colouring', asked.indexOf('summer') >= 0, asked);
check('the occasion asked about is the occasion judged', o0.occasion === 'business');

/* ---------- Reading the results ---------- */
const s = C.summarise(job);
check('the counts add up to the outfits tried', s.count.good + s.count.ok + s.count.fix + s.count.bad === s.tried && s.tried === 72, s.count);
check('joins: good outfits and those that work', s.joins === s.count.good + s.count.ok);
check('the best list holds only outfits that pass, best first', s.best.every(r => C.isGood(r.level)) && s.best.every((r, i) => !i || r.level !== 'good' || s.best[i - 1].level === 'good'));
const key = r => ['shirt', 'mid', 'jacket', 'trousers'].map(x => r.pick[x] ? r.pick[x].id : '-').join('|');
check('one outfit per combination of the main layers', new Set(s.best.map(key)).size === s.best.length && new Set(s.nearly.map(key)).size === s.nearly.length);
check('the best list shows more than one pair of trousers when more than one passes',
  new Set(s.best.map(r => r.pick.trousers.id)).size === new Set(job.results.filter(r => C.isGood(r.level)).map(r => r.pick.trousers.id)).size || new Set(s.best.map(r => r.pick.trousers.id)).size >= 2);
check('turned down: one fix away, then start again', s.nearly.every(r => r.level === 'fix') && s.no.every(r => r.level === 'bad') && s.nearly.length <= 6 && s.no.length <= 3);

/* ---------- Which colour to buy ---------- */
const spec = { slot: 'mid', kind: 'vneck', cloth: 'merino', pat: { type: 'solid' } };
const cols = D.colours.filter(c => ['Navy', 'Burgundy', 'Mustard', 'Charcoal'].indexOf(c.name) >= 0);
const sc = C.screen(W, spec, cols, opts).run();
check('every colour and every knit you own is tried', sc.rows.length === cols.length + 2 && sc.rows.filter(r => r.garment).length === 2);
check('shares between 0 and 1, best first', sc.rows.every(r => r.share >= 0 && r.share <= 1) && sc.rows.every((r, i) => !i || sc.rows[i - 1].share >= r.share));
check('the sample is at most ' + C.SAMPLE + ' outfits, the same for each colour', sc.sample <= C.SAMPLE && sc.rows.every(r => r.tried === sc.rows[0].tried), sc.rows.map(r => r.tried));
// one owned knit's share, worked out directly on the same sample
const own = sc.rows.find(r => r.garment), probe = C.around(W, { id: 'probe', slot: 'mid', own: false, piece: C.cleanPiece('mid', spec) }, opts);
const step = Math.max(1, Math.ceil(probe.coreList.length / C.SAMPLE)), sample = probe.coreList.filter((c, i) => i % step === 0);
let good = 0;
sample.forEach(core => {
  const pick = Object.assign({}, core, { mid: own.garment }), o = C.outfitOf({ pick: pick }, opts), se = O.seasonOf(o);
  if (C.isGood(E.verdict(E.checkOutfit(O.engineOutfit(o, prof, nameOf), opts.analysisFor(se === 'summer' || se === 'winter' ? se : null))).level)) good++;
});
check('a share is the engine\'s verdicts on the sample', Math.abs(own.share - good / sample.length) < 1e-9, [own.share, good / sample.length]);

/* ---------- Marks on saved outfits ---------- */
const o1 = C.outfitOf(r0, bopts), o2 = JSON.parse(JSON.stringify(o1));
o2.name = 'other'; o2.locks = { shirt: true }; o2.acc.watch.metal = 'gold'; o2.shirt.gid = 'zz';
check('the same pieces and occasion: the same outfit for a mark, whatever the name, locks, gid or accessories', O.outfitSig(o1) === O.outfitSig(o2));
const o3 = JSON.parse(JSON.stringify(o1)); o3.shirt.hex = '#000000';
const o4 = JSON.parse(JSON.stringify(o1)); o4.occasion = 'casual';
check('another colour or occasion: another outfit', O.outfitSig(o3) !== O.outfitSig(o1) && O.outfitSig(o4) !== O.outfitSig(o1));
const o5 = JSON.parse(JSON.stringify(o1)); o5.shirt.cloth = G.kind('shirt', o5.shirt).cloths[0];
const o6 = JSON.parse(JSON.stringify(o1)); delete o6.shirt.cloth;
check('a cloth left at its default is the same cloth', O.outfitSig(o5) === O.outfitSig(o6));
const ward = O.normWardrobe([
  { id: 'a1', name: 'A', outfit: o1, mark: 'good', marked: '2026-11-22', markVerdict: 'One fix away', from: { shirt: 't1', jacket: 'bad id!', nowhere: 't2' }, fromMarks: true },
  { id: 'a2', name: 'B', outfit: o1, mark: 'great', marked: 'yesterday', fromMarks: 'yes' }
]);
check('a mark, its day and Valet\'s verdict then are kept', ward[0].mark === 'good' && ward[0].marked === '2026-11-22' && ward[0].markVerdict === 'One fix away' && ward[0].fromMarks === true);
check('only safe garment ids in known positions are kept', JSON.stringify(ward[0].from) === '{"shirt":"t1"}', ward[0].from);
check('an unknown mark is dropped, with its day', !('mark' in ward[1]) && !('marked' in ward[1]) && !('fromMarks' in ward[1]));
check('disagreement: good against a fail, bad against a pass, never so-so',
  O.disagrees('good', 'fix') && O.disagrees('good', 'bad') && O.disagrees('bad', 'ok') && O.disagrees('bad', 'good') &&
  !O.disagrees('good', 'ok') && !O.disagrees('bad', 'fix') && !O.disagrees('mid', 'bad') && !O.disagrees('mid', 'good'));
check('a piece\'s garment id is kept when safe and dropped when not', O.normOutfit({ shirt: { gid: 'g12' } }).shirt.gid === 'g12' && !('gid' in O.normOutfit({ shirt: { gid: '"><x' } }).shirt));

/* ---------- The marks report (tools/marks.js) ---------- */
const passing = s.best[0], failing = s.nearly[0] || s.no[0];
const file = Object.assign({}, prof, { app: 'valet', wardrobe: [
  { id: 'm1', name: 'Passes, you like it', outfit: C.outfitOf(passing, opts), mark: 'good' },
  { id: 'm2', name: 'Passes, you do not', outfit: C.outfitOf(passing, opts), mark: 'bad' },
  { id: 'm3', name: 'Fails, you like it', outfit: C.outfitOf(failing, opts), mark: 'good', markVerdict: 'Good outfit' },
  { id: 'm4', name: 'So-so', outfit: C.outfitOf(failing, opts), mark: 'mid' },
  { id: 'm5', name: 'Not marked', outfit: C.outfitOf(failing, opts) }
] });
const rep = marks.report(file);
check('the report reads only marked outfits', rep.rows.length === 4);
check('the report counts agreement, disagreement and so-so', rep.agree === 1 && rep.disagree === 2 && rep.so === 1, [rep.agree, rep.disagree, rep.so]);
check('the report names the rules that fail an outfit you call good', failing.failIds.every(id => rep.byRule[id] === 1), [failing.failIds, rep.byRule]);
const txt = marks.print(rep);
check('the printed report lists each disagreement and the verdict when it was marked', /Fails, you like it: you good/.test(txt) && /was "Good outfit" when you marked it/.test(txt) && /Passes, you do not: you bad/.test(txt), txt);

console.log(failed ? failed + ' of ' + n + ' closet checks FAILED' : 'closet: ' + n + ' checks pass (garments, outfits around one, colour to buy, marks, report)');
process.exit(failed ? 1 : 0);
