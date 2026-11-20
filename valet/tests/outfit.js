/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the outfit as data (js/outfit.js): making a stored or imported outfit safe, the season of
   an outfit, the form the engine reads, and merging imported saved outfits. */
'use strict';
const path = require('path');
global.window = {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'outfit', 'body', 'proportion']) require(path.join(__dirname, '..', 'js', f + '.js'));
const O = window.VOUTFIT, G = window.VGARM, E = window.VENGINE, D = window.VDATA;
let n = 0, failed = 0;
function check(name, ok, info) { n++; if (!ok) { failed++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } }
const nameOf = h => (D.colours.find(c => c.hex.toLowerCase() === h.toLowerCase()) || { name: h.toUpperCase() }).name;

/* ---------- normOutfit: whatever a file holds, the result is safe to draw and to check ---------- */
const d = O.normOutfit(null);
check('an empty outfit becomes the default', G.SLOTS.every(k => d[k] && O.isHex(d[k].hex)) && d.occasion === 'smart');
check('the default is not shared: changing one copy leaves the next alone', (d.shirt.hex = '#000000', O.normOutfit(null).shirt.hex !== '#000000'));
const bad = O.normOutfit({ shirt: { hex: '"><img src=x>', kind: 'nosuch', pat: { type: 'bengal', hex2: 'red' } }, trousers: '#123456',
  jacket: { buttons: 'diamond', rise: 'sky' }, occasion: 'party', name: 'x'.repeat(200), savedId: 'not ok!', acc: { watch: { strap: 'chain', display: 'sundial', dial: '#fff', strapHex: '#000' }, glasses: { frame: 'wood', hex: 'no' } } });
check('a non-colour is replaced by the default colour', bad.shirt.hex === O.DEFAULT_OUTFIT.shirt.hex);
check('an unknown garment type falls back to the default', bad.shirt.kind === O.DEFAULT_OUTFIT.shirt.kind);
check('a bad second pattern colour is dropped', bad.shirt.pat.hex2 === undefined);
check('a flat colour string (v0.2) is read as a colour', bad.trousers.hex === '#123456');
check('unknown buttons and rise are dropped', bad.jacket.buttons === undefined && bad.jacket.rise === undefined);
check('an unknown occasion becomes smart casual', bad.occasion === 'smart');
check('the name is cut to 80 characters', bad.name.length === 80);
check('an unsafe saved id is dropped', bad.savedId === undefined);
check('the watch: unknown strap and display reset, 1.6 colours dropped', bad.acc.watch.strap === 'leather' && bad.acc.watch.display === 'analogue' && !('dial' in bad.acc.watch) && !('strapHex' in bad.acc.watch));
check('glasses: unknown frame and colour reset', bad.acc.glasses.frame === 'gold' && bad.acc.glasses.hex === '#161616');
const coat = O.normOutfit({ jacket: { hex: '#3d4045', kind: 'coat', cloth: 'gabardine' }, locks: { jacket: true } });
check('a pre-1.5 coat moves to its own place, its type from its cloth', coat.coat.kind === 'trench' && coat.jacket.on === false && coat.locks.coat === true);
const scarf = O.normOutfit({ tie: { hex: '#5e1f2c', kind: 'scarf', cloth: 'cashmere' } });
check('a pre-1.3 scarf moves from the tie to its own place', scarf.scarf.hex === '#5e1f2c' && scarf.tie.on === false);
const linen = O.normOutfit({ shirt: { kind: 'shirt', cloth: 'linen', pat: { type: 'birdseye', scale: 0.2 } } });
check('a pattern the cloth cannot carry is worn plain', linen.shirt.pat.type === 'solid' || G.patOK('linen', 'birdseye'));

/* ---------- normWardrobe ---------- */
const w = O.normWardrobe([null, 'x', { id: 'bad id!', outfit: {} }, { id: 'ok1', outfit: {}, name: '', season: 'spring', saved: 'yesterday' }, { id: 'ok2', outfit: { savedId: 'ok2', locks: { shirt: true } }, name: 'Mine', season: 'mixed', saved: '2026-11-20' }]);
check('only entries with a safe id and an outfit are kept', w.map(x => x.id).join() === 'ok1,ok2', w.map(x => x.id));
check('a missing name and season get defaults, a bad date is dropped', w[0].name === 'Untitled outfit' && w[0].season === 'all' && w[0].saved === '');
check('a saved outfit carries no locks and no link to itself', !w[1].outfit.savedId && Object.keys(w[1].outfit.locks).length === 0);
check('a non-list is an empty list', O.normWardrobe({}).length === 0);
check('at most 500 outfits are read', O.normWardrobe(Array.from({ length: 600 }, (_, i) => ({ id: 'a' + i, outfit: {} }))).length === 500);

/* ---------- seasonOf ---------- */
const base = () => O.normOutfit({ shirt: { cloth: 'oxford' }, jacket: { cloth: 'hopsack' }, trousers: { cloth: 'cotton' } });
check('no seasonal cloth: all year', O.seasonOf(base()) === 'all', O.seasonOf(base()));
const win = base(); win.jacket.cloth = 'tweed'; check('tweed: winter', O.seasonOf(win) === 'winter');
const sum = base(); sum.jacket.cloth = 'linen'; check('linen: summer', O.seasonOf(sum) === 'summer');
const mix = base(); mix.jacket.cloth = 'tweed'; mix.trousers.cloth = 'linen'; check('tweed with linen: mixed', O.seasonOf(mix) === 'mixed');
const off = base(); off.jacket.cloth = 'tweed'; off.jacket.on = false; check('a piece not worn does not count', O.seasonOf(off) === 'all');
check('every season has a heading', ['winter', 'summer', 'all', 'mixed'].every(s => O.SEASONS.some(x => x[0] === s)));

/* ---------- engineOutfit ---------- */
const o = O.normOutfit(null), prof = { measurements: { height: 185, chest: 103, wrist: 17 }, shape: {}, hairStyle: 'none' };
const eo = O.engineOutfit(o, prof, nameOf);
check('a piece not worn is null; a worn one has its colour name', eo.hat === null && eo.shirt.name === nameOf(o.shirt.hex));
check('measurements reach the engine: body percentiles, frame, wrist', eo.body && eo.body.height > 0 && eo.frame === 'big' && eo.acc.wrist === 17, [eo.frame, eo.acc.wrist]);
check('without measurements the body is empty and nothing breaks', Object.keys(O.engineOutfit(o, {}, nameOf).body).length === 0);
check('the engine outfit is a copy: changing it leaves the outfit alone', (eo.acc.watch.metal = 'gold', o.acc.watch.metal === 'silver'));
const a = E.analyseProfile(D.kp);
check('the engine can check it', E.checkOutfit(O.engineOutfit(o, prof, nameOf), a).length > 10);

/* ---------- fitPatterns ---------- */
const fp = O.normOutfit(null); fp.shirt.cloth = 'linen'; fp.shirt.pat = { type: 'pinstripe', scale: 1 };
const note = O.fitPatterns(fp);
check('fitPatterns makes an impossible pattern plain and says so', G.patOK('linen', 'pinstripe') || (fp.shirt.pat.type === 'solid' && /now plain/.test(note)), note);

/* ---------- names and merging ---------- */
check('an unnamed outfit is named by its first two pieces', O.autoName(o, nameOf) === nameOf(o.jacket.hex) + ' jacket, ' + nameOf(o.shirt.hex) + ' shirt', O.autoName(o, nameOf));
const snap = O.snapshotOutfit(Object.assign({}, o, { savedId: 'x', locks: { shirt: true } }));
check('the kept copy has no link and no locks', !snap.savedId && Object.keys(snap.locks).length === 0);
check('new ids are safe and differ', /^[a-z0-9]{1,40}$/i.test(O.newId()) && O.newId() !== O.newId());
const list = [{ id: 'a1', name: 'A', outfit: o }];
const r = O.mergeWardrobe(list, [{ id: 'a1', name: 'A', outfit: o }, { id: 'a1', name: 'B', outfit: o }, { id: 'c3', name: 'C', outfit: o }]);
check('merge: a duplicate is skipped, a clashing id is renamed', r.added === 2 && r.same === 1 && new Set(list.map(x => x.id)).size === 3, [r, list.map(x => x.id)]);

console.log(failed ? failed + ' of ' + n + ' outfit checks failed' : 'outfit: ' + n + ' checks pass (normalising, season, engine form, merge)');
process.exit(failed ? 1 : 0);
