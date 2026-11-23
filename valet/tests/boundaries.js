/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — every named threshold is wired to its rule, and compares in the right direction.
   For each: a precise outfit, the quantity the threshold applies to is measured, then the threshold is
   set just past that value on either side and the rule must flip. Run: node tests/boundaries.js. */
'use strict';
const path = require('path');
global.window = {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'body']) require(path.join(__dirname, '..', 'js', f + '.js'));
const E = window.VENGINE, D = window.VDATA, VC = window.VC, PARAMS = E.PARAMS;
const col = n => D.colours.find(c => c.name === n).hex;
const P = (hex, kind, cloth, extra) => Object.assign({ hex, name: hex, kind, cloth, pat: { type: 'solid' } }, extra || {});
const base = o => Object.assign({ shirt: P(col('Light blue'), 'shirt', 'poplin'), jacket: P(col('Navy'), 'jacket', 'hopsack'), trousers: P(col('Mid grey'), 'trousers', 'flannel'),
  socks: P(col('Navy'), 'socks'), shoes: P(col('Chocolate'), 'loafer', 'calf'), occasion: 'smart', propOn: false, body: {}, shape: {}, m: {}, acc: {} }, o || {});
const a = E.analyseProfile(D.demo);
const L = h => VC.hexToLab(h)[0], dE = (x, y) => VC.deltaE2000(VC.hexToLab(x), VC.hexToLab(y));
const okc = h => VC.rgbToOklch(VC.hexToRgb(h));
let fails = 0, count = 0;
const eps = 1e-6;
/* t: name; key: the PARAMS key; value: the measured quantity; o: the outfit; fires(checks): whether the
   rule is triggered; below: true if the rule fires when the value is below the threshold */
function flip(name, key, value, o, fires, below, prof) {
  count++;
  const keep = PARAMS[key];
  PARAMS[key] = below ? value + eps + 1e-3 : value - eps - 1e-3; const on = fires(E.checkOutfit(o, prof || a));
  PARAMS[key] = below ? value - eps - 1e-3 : value + eps + 1e-3; const off = fires(E.checkOutfit(o, prof || a));
  PARAMS[key] = keep;
  if (!(on && !off)) { fails++; console.log('✗ ' + name + ' (' + key + ' around ' + value.toFixed(3) + '): fires ' + on + ' on the firing side, ' + off + ' on the other'); }
  else if (process.env.VERBOSE) console.log('✓ ' + name);
}
const has = (id, re) => cs => cs.some(c => c.id === id && c.score < 0.85 && (!re || re.test(c.text)));

// top and trousers close in lightness under halvesL: a note about the wearer without a height (halves),
// a note for a tall frame with one (phalves)
{ const o = base({ jacket: P(col('Charcoal'), 'jacket', 'flannel'), trousers: P(col('Mid grey'), 'trousers', 'flannel') });
  const d = Math.abs(L(o.jacket.hex) - L(o.trousers.hex));
  flip('top and trousers, no height', 'halvesL', d, o, cs => cs.some(c => c.id === 'halves'), true);
  flip('top and trousers, tall', 'halvesL', d, Object.assign({}, o, { propOn: true, m: { height: 190 }, body: {} }), cs => cs.some(c => c.id === 'phalves' && c.score < 0.85), true); }
// a strong step between top and trousers on a short frame, from halvesStrong
{ const o = Object.assign(base({ jacket: P(col('Navy'), 'blazer', 'hopsack'), trousers: P('#e8e0d0', 'trousers', 'cotton') }), { propOn: true, m: { height: 165 }, body: {} });
  flip('strong step on a short frame', 'halvesStrong', Math.abs(L(E.look(o.jacket).mean) - L(o.trousers.hex)), o, cs => cs.some(c => c.id === 'phalves' && c.score < 0.85), false); }
// a pattern's second colour counts as a main colour from patternMajor
{ const o = base({ tie: P('#fbe6d6', 'cravat', 'silktwill', { pat: { type: 'gingham', scale: 1.2, hex2: '#7a4a32', cover: 0.42 } }) });
  flip('a main colour of a pattern', 'patternMajor', 0.42, o, () => E.seenColours(E.look(o.tie)).length === 2, false); }
// echo: within echoL of the hair's lightness
{ const pr = E.analyseProfile({ samples: { white: null, skin: '#f0cdb8', hair: '#7a3a22', eyes: '#3a3a3a' }, manual: { skin: true, hair: true, eyes: true }, useWhite: true, hairStyle: 'short', season: 'winter' });
  const hairHex = VC.labToHex(pr.lab.hair), hl = VC.hexToLab(hairHex), tie = VC.labToHex([hl[0] + 22, hl[1], hl[2]]);
  const o = base({ shirt: P('#f7f6f2', 'shirt', 'poplin'), jacket: P('#3d4045', 'jacket', 'flannel'), trousers: P('#8e9196', 'trousers', 'flannel'), tie: P(tie, 'tie', 'grenadine') });
  flip('echo of the hair', 'echoL', Math.abs(L(tie) - hl[0]), o, cs => cs.some(c => c.id === 'echo' && c.score === 1), true, pr); }
// tie against shirt: lightness step under tieL
{ const o = base({ tie: P(col('Sky blue'), 'tie', 'grenadine') });   // close to the light blue shirt in colour (ΔE 6), so lightness decides
  flip('tie against shirt', 'tieL', Math.abs(L(o.tie.hex) - L(o.shirt.hex)), o, has('tie'), true); }
// near match: ΔE between nearFrom and nearTo
{ const o = base({ trousers: P(col('Navy'), 'trousers', 'flannel'), jacket: P(col('Midnight') || col('Ink'), 'jacket', 'hopsack') });
  const d = dE(o.jacket.hex, o.trousers.hex);
  flip('near match, upper edge', 'nearTo', d, o, has('near'), true);
  flip('near match, lower edge', 'nearFrom', d, o, has('near'), false); }
// light-dark step at the face: a failure only below stepNear of the face's lower bound (a note above it)
{ const lo = a.band[0], sh = VC.labToHex([92, 0, 0]), o = base({ shirt: P(sh, 'shirt', 'poplin'), jacket: P(VC.labToHex([92 - lo * 0.7, 0, 0]), 'jacket', 'hopsack') });
  flip('light-dark step, failure', 'stepNear', Math.abs(L(o.shirt.hex) - L(o.jacket.hex)) / lo, o, cs => cs.some(c => c.id === 'step' && c.score < 0.5), true); }
// deep socks: lightness and chroma limits (a muted dark colour passes as deep)
{ const o = base({ socks: P(col('Burgundy'), 'socks'), trousers: P(col('Charcoal'), 'trousers', 'flannel'), occasion: 'business' });   // the deep allowance matters in business dress
  flip('deep socks, lightness', 'sockDeepL', L(o.socks.hex), o, cs => !cs.some(c => c.id === 'socks' && c.score < 0.85), true);
  flip('deep socks, chroma', 'sockDeepC', okc(o.socks.hex)[1], o, cs => !cs.some(c => c.id === 'socks' && c.score < 0.85), true); }
// tonal column: spread of the main pieces' lightness within columnL
{ const o = base({ shirt: P(col('Mid grey'), 'shirt', 'poplin'), jacket: P(col('Mid grey'), 'jacket', 'flannel'), trousers: P(col('Mid grey'), 'trousers', 'flannel'), shoes: P(col('Taupe'), 'loafer', 'suede'), propOn: true });
  const looks = ['shirt', 'jacket', 'trousers', 'shoes'].map(k => E.look(o[k]).mean).map(L), spread = Math.max(...looks) - Math.min(...looks);
  flip('tonal column', 'columnL', spread, o, cs => cs.some(c => c.id === 'pcolumn'), true); }
// formality: steps between pieces (integers, so the threshold is moved by whole steps)
{ const o = base({ shirt: P(col('White'), 'shirt', 'poplin'), tie: P(col('Burgundy'), 'tie', 'grenadine'), jacket: null, trousers: P(col('Khaki'), 'trousers', 'cotton'), shoes: P(col('White'), 'trainer', 'canvas'), socks: null });
  count++; const keep = PARAMS.formalMistake;
  PARAMS.formalMistake = 99; const off = E.checkOutfit(o, a).some(c => c.id === 'formal' && c.score < 0.5);
  PARAMS.formalMistake = 1; const on = E.checkOutfit(o, a).some(c => c.id === 'formal' && c.score < 0.5);
  PARAMS.formalMistake = keep;
  if (!(on && !off)) { fails++; console.log('✗ formality: formalMistake is not wired'); } }
// colours in one family: hue distance within familyHue
{ const o = base({ shirt: P(col('Light blue'), 'shirt', 'poplin'), mid: P(col('Emerald'), 'crew', 'lambswool'), jacket: P(col('Navy'), 'jacket', 'hopsack'), tie: P(col('Burgundy'), 'tie', 'grenadine') });   // two real colours, far apart in hue
  count++; const keep = PARAMS.familyHue;
  PARAMS.familyHue = 0.01; const many = E.checkOutfit(o, a).filter(c => c.id === 'harmony').map(c => c.text).join(' ');
  PARAMS.familyHue = 179; const one = E.checkOutfit(o, a).filter(c => c.id === 'harmony').map(c => c.text).join(' ');
  PARAMS.familyHue = keep;
  if (many === one) { fails++; console.log('✗ colour families: familyHue is not wired'); } }
// skin: separation (merge) and the contrast band, on the palette scores
{ const hex = col('Camel'), sk = a.lab.skin, d = VC.deltaE2000(VC.hexToLab(hex), sk);
  count++; const k1 = PARAMS.mergeFrom, k2 = PARAMS.mergeTo;
  PARAMS.mergeFrom = d + 1; PARAMS.mergeTo = d + 2; const sc = function () { const r = E.scoreColour(hex, a).rules.find(r => r.id === 'merge'); return r ? r.score : 1; };   // a rule that passes fully is not listed
  const low = sc();
  PARAMS.mergeFrom = d - 2; PARAMS.mergeTo = d - 1; const high = sc();
  PARAMS.mergeFrom = k1; PARAMS.mergeTo = k2;
  if (!(low === 0 && high === 1)) { fails++; console.log('✗ separation from the skin: mergeFrom/mergeTo not wired (' + low + ', ' + high + ')'); } }
// accessory sizes: the mm limits
// over the classic range the check says so (other pieces may carry it, so the score is not the test);
// far over it, nothing carries it and the check fails
// each at a size between its two limits
for (const [acc, maxKey, farKey, extra, mm] of [['cufflinks', 'cufflinksMax', 'cufflinksFar', { stone: 'none' }, 10], ['ring', 'ringMax', 'ringFar', {}, 10]]) {
  const o = base({ acc: { [acc]: Object.assign({ on: true, metal: 'silver', size: mm }, extra) } });
  const keepMax = PARAMS[maxKey];
  flip(acc + ' over its classic size', maxKey, mm, o, cs => cs.some(c => c.acc === acc && /mm: (large|a large face)/.test(c.text)), false);
  PARAMS[maxKey] = 1;    // so that only the far limit decides
  flip(acc + ' far over', farKey, mm, o, cs => cs.some(c => c.acc === acc && c.score < 0.5), false);
  PARAMS[maxKey] = keepMax;
}
// coat far below what it covers: steps (integers)
{ const o = base({ occasion: 'casual', jacket: P(col('Navy'), 'jacket', 'worsted'), tie: P(col('Burgundy'), 'tie', 'grenadine'), coat: P(col('Olive'), 'parka', 'nylonmatte') });
  count++; const keep = PARAMS.coatSteps;
  PARAMS.coatSteps = 99; const off = E.checkOutfit(o, a).some(c => c.id === 'coat' && c.score < 0.85);
  PARAMS.coatSteps = 1; const on = E.checkOutfit(o, a).some(c => c.id === 'coat' && c.score < 0.85);
  PARAMS.coatSteps = keep;
  if (!(on && !off)) { fails++; console.log('✗ coat far below: coatSteps is not wired'); } }
// neutrals: a colour near a library neutral counts as that neutral within neutralSnapDE
{ const camel = col('Camel'), lab = VC.hexToLab(camel), drift = VC.labToHex([lab[0] + 3, lab[1] + 2, lab[2] - 2]), d = VC.deltaE2000(VC.hexToLab(drift), lab);
  count++; const keep = PARAMS.neutralSnapDE;
  PARAMS.neutralSnapDE = d + 0.01; const on = E.wardrobeNeutral(drift);
  PARAMS.neutralSnapDE = d - 0.01; const off = E.wardrobeNeutral(drift);
  PARAMS.neutralSnapDE = keep;
  if (!(on && !off)) { fails++; console.log('✗ neutral radius: neutralSnapDE not wired (' + on + ', ' + off + ', ΔE ' + d.toFixed(2) + ')'); } }
console.log((fails ? fails + ' boundary test(s) failed' : 'boundaries: every threshold wired and directed') + ' (' + count + ' run)');
if (fails) process.exit(1);
