/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — unit tests for the pure modules below the rule engine: colour.js (colorimetry),
   vision.js and patterns.js (what the eye can see of a pattern), body.js (the survey percentiles),
   proportion.js (the targets) and the logic of fit.js (sizes and the garment check).
   Reference values are published ones where they exist (CIEDE2000: Sharma, Wu and Dalal 2005,
   table 1), otherwise invariants that must hold whatever the working values are. */
'use strict';
const path = require('path');
global.window = {};
require('./load')(['colour', 'vision', 'patterns', 'body', 'proportion', 'fit']);
const C = window.VC, VP = window.VPAT, B = window.VBODY, P = window.VPROP, F = window.VFIT;

let n = 0, failed = 0;
function check(name, ok, info) { n++; if (!ok) { failed++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------- colour.js ---------- */
const white = C.hexToLab('#ffffff'), black = C.hexToLab('#000000');
check('white is L* 100, a* b* 0 (D65)', near(white[0], 100, 0.01) && near(white[1], 0, 0.01) && near(white[2], 0, 0.01), white);
check('black is L* 0', near(black[0], 0, 0.01), black);
check('mid grey #777777 is L* 50 within 0.5', near(C.hexToLab('#777777')[0], 50, 0.5), C.hexToLab('#777777'));
for (const h of ['#1f2a44', '#c9ccd1', '#7a1f2b', '#ecc9bd', '#2e5e3a', '#f2efe6'])
  check('hex → Lab → hex round trip ' + h, C.labToHex(C.hexToLab(h)).toLowerCase() === h, C.labToHex(C.hexToLab(h)));
for (const h of ['#1f2a44', '#7a1f2b', '#2e5e3a', '#d9b44a']) {
  const back = C.oklchToRgb(C.rgbToOklch(C.hexToRgb(h))).map(Math.round), want = C.hexToRgb(h);
  check('OKLCH round trip ' + h, back.every((v, i) => Math.abs(v - want[i]) <= 1), [back, want]);
}
check('OKLCH of white has no chroma', C.rgbToOklch([255, 255, 255])[1] < 1e-3, C.rgbToOklch([255, 255, 255]));
// Sharma, Wu and Dalal (2005), table 1: pairs and their ΔE00, to four decimals
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412], [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
  [[50, 0, 0], [50, -1, 2], 2.3669], [[50, -1, 2], [50, 0, 0], 2.3669], [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.5, 0], [73, 25, -18], 27.1492], [[50, 2.5, 0], [61, -5, 29], 22.8977], [[50, 2.5, 0], [56, -27, -3], 31.9030],
  [[50, 2.5, 0], [58, 24, 15], 19.4535], [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630], [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441], [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082]
];
SHARMA.forEach(([a, b, d], i) => check('CIEDE2000, Sharma pair ' + (i + 1), near(C.deltaE2000(a, b), d, 1e-4), [C.deltaE2000(a, b), d]));
check('ΔE00 of a colour with itself is 0', C.deltaE2000([40, 10, -20], [40, 10, -20]) === 0);
check('white balance under neutral white changes nothing', C.whiteBalance([120, 80, 60], [235, 235, 235]).every((v, i) => Math.abs(v - [120, 80, 60][i]) < 12));
const warm = C.whiteBalance([200, 180, 160], [240, 220, 190]);
check('white balance removes a warm cast (blue gains on red)', warm[2] - warm[0] > 160 - 200, warm);
check('a blown-out white is refused', !!C.whiteProblem('#ffffff'));
check('an off-white is accepted', C.whiteProblem('#e6e2da') === null, C.whiteProblem('#e6e2da'));
check('hue temperature: orange warm, blue cool', C.hueTemperature(60) > 0.9 && C.hueTemperature(250) < -0.9);

/* ---------- vision.js and patterns.js ---------- */
const V = window.VVIS;
if (V && V.DISTANCES) check('three viewing distances, 1, 3 and 10 m', V.DISTANCES.map(d => d.m).join() === '1,3,10');
const fine = VP.reads('#1f2a44', { type: 'birdseye', scale: 0.15, hex2: '#c9ccd1' }, 3);
const bold = VP.reads('#1f2a44', { type: 'windowpane', scale: 6, hex2: '#c9ccd1' }, 3);
check('a fine birdseye does not read as a pattern at 3 m', fine.state !== 'pattern', fine.state);
check('a large windowpane reads as a pattern at 3 m', bold.state === 'pattern', bold.state);
const near1 = VP.reads('#1f2a44', { type: 'birdseye', scale: 0.15, hex2: '#c9ccd1' }, 1), far10 = VP.reads('#1f2a44', { type: 'windowpane', scale: 6, hex2: '#c9ccd1' }, 10);
const rank = s => ({ pattern: 2 }[s] || (s === 'solid' ? 0 : 1));
check('farther never shows more: birdseye at 1 m ≥ at 3 m', rank(near1.state) >= rank(fine.state), [near1.state, fine.state]);
check('farther never shows more: windowpane at 3 m ≥ at 10 m', rank(bold.state) >= rank(far10.state), [bold.state, far10.state]);
const tonal = VP.reads('#3a3d42', { type: 'glen', scale: 2, hex2: '#3e4146' }, 3);
check('a glen check in two near-identical greys does not read at 3 m', tonal.state !== 'pattern', tonal.state);

/* ---------- body.js ---------- */
check('percentile of the median height is about 50', near(B.percentile('height', B.median('height')), 50, 1), B.percentile('height', B.median('height')));
check('percentile clamps at 1 and 99', B.percentile('height', 100) === 1 && B.percentile('height', 250) === 99);
check('percentile rises with height', B.percentile('height', 170) < B.percentile('height', 180) && B.percentile('height', 180) < B.percentile('height', 190));
check('percentile of a missing value is null', B.percentile('height', null) === null && B.percentile('nosuch', 10) === null);
const d1 = B.derive({ height: 185 }, {});
check('derive estimates the lengths from height and marks them', d1.v.inseam > 0 && d1.est.inseam && d1.est.backNeckFloor, Object.keys(d1.est));
const d2 = B.derive({ height: 185, chest: 103 }, {});
check('a measured value is used as given, not estimated', d2.v.chest === 103 && !d2.est.chest);

/* ---------- proportion.js ---------- */
const M = { height: 185, chest: 103, waist: 88, seat: 102, neck: 40, shoulder: 47 };
const T = P.targets(M, {}, 'classic', {});
const ids = T.list.map(t => t.id);
check('targets include the jacket length, lapel and tie width', ['jacketLength', 'lapel', 'tieWidth'].every(k => ids.indexOf(k) >= 0), ids);
check('every target has a label and a grade', T.list.every(t => t.label && t.grade), T.list.filter(t => !(t.label && t.grade)).map(t => t.id));
check('every numeric target has lo ≤ hi', T.list.every(t => t.lo == null || t.hi == null || t.lo <= t.hi), T.list.filter(t => t.lo > t.hi).map(t => t.id));
const len = h => P.targets(Object.assign({}, M, { height: h }), {}, 'classic', {}).list.find(t => t.id === 'jacketLength');
check('a taller man gets a longer jacket', len(195).lo > len(170).lo, [len(170).lo, len(195).lo]);
check('every period gives targets', Object.keys(P.PERIODS).every(id => P.targets(M, {}, id, {}).list.length > 5));
/* The period openings against their sources (How it works, #p-period-sources). Trade figures are
   inches around the bottom; flat is half. A man of average size: foot 26 cm, so a shoe of 29. */
const avg = { height: 173, shoulder: 45, neck: 39, foot: 26, chest: 98, waist: 84, seat: 96 };
const openAt = id => P.targets(avg, {}, id, {}).list.find(t => t.id === 'opening');
const flat = inches => inches * 2.54 / 2;
const covers = (t, lo, hi) => t.lo <= flat(lo) + 0.5 && t.hi >= flat(hi) - 0.5;
check('1930s opening covers 17½–18½ in around (Progressive Tailor 1930–37)', covers(openAt('1930s'), 17.5, 18.5), openAt('1930s'));
check('1940s opening stays within the 1942 order, 18½ in around', openAt('1940s').hi <= flat(18.5) + 0.51, openAt('1940s'));
check('1950s opening reaches 17½ in around (mid-1950s, Schoeffler p. 95)', openAt('1950s').hi >= flat(17.5) - 0.5, openAt('1950s'));
check('1960s opening covers 15–16 in around (Men\'s Wear 1963)', covers(openAt('1960s'), 15, 16), openAt('1960s'));
check('1960s opening no narrower than the 1963 super slims, 13 in around', openAt('1960s').lo >= flat(13), openAt('1960s'));
const jk = id => P.targets(Object.assign({ backNeckFloor: 149 }, avg), {}, id, {}).list.find(t => t.id === 'jacketLength');
check('1940s jacket can be as short as the 1942 cap allows (29¾ in for a size 37)', jk('1940s').lo <= 29.75 * 2.54, jk('1940s'));
// the opening's Why names the period's source, or says there is none
const whyOpen = id => P.targets(avg, {}, id, {}).list.find(t => t.id === 'opening').why;
check('opening Why: today\'s classic cites Flusser only', /Flusser/.test(whyOpen('classic')) && !/trade figure/.test(whyOpen('classic')));
check('opening Why: each sourced period names its source', ['1930s', '1940s', '1950s', '1960s'].every(id => /trade figure/.test(whyOpen(id)) && /\(.*(Tailor|War Production|Schoeffler|Men's Wear).*\)/.test(whyOpen(id))), ['1930s', '1940s', '1950s', '1960s'].map(whyOpen));
check('opening Why: the 1970s says no figure was found', /no figure found/.test(whyOpen('1970s')), whyOpen('1970s'));
check('every period but the 1970s carries its opening source', Object.keys(P.PERIODS).every(id => id === 'classic' || id === '1970s' ? !P.PERIODS[id].openingSrc : !!P.PERIODS[id].openingSrc));
check('frame size: big, medium, small', P.frameSize({ height: 190 }) === 'big' && P.frameSize({ height: 178, shoulder: 45 }) === 'medium' && P.frameSize({ height: 165 }) === 'small' && P.frameSize({}) === null);

/* ---------- fit.js (the logic, not the drawing) ---------- */
// How it works (#f-periods): a 1930s-cut, high-rise pair of trousers checked under today's classic
// reads as rising too high, and the line under it says it suits the 1930s and the 1940s
{
  const Mp = Object.assign({}, avg, { waistHeight: 104, inseam: 79, backNeckFloor: 149 });
  const all = {}; Object.keys(P.PERIODS).forEach(id => { const pp = {}; P.targets(Mp, {}, id, {}).list.forEach(t => { pp[t.id] = t; }); all[id] = pp; });
  const r30 = all['1930s'].rise, r40 = all['1940s'].rise, rc = all.classic.rise;
  const high = Math.min(r30.hi, r40.hi);   // the top of the rise both periods share
  const res = F.checkGarment('trousers', { rise: high }, {}, Mp, 'modern', { prop: all.classic, periods: all });   // as js/ui/fit.js passes it
  const row = res.find(r => r && r.key === 'rise'), pf = F.periodFit('trousers', res, all);
  check('a 1930s high rise is above today\'s classic range', high > rc.hi + 1, [high, rc]);
  check('under today\'s classic it reads as a matter of period, not of size', row && row.style === true && /in the range for/.test(row.text), row);
  check('the line under it: suits the 1930s and the 1940s, not today\'s classic', pf && pf.all.indexOf('1930s') >= 0 && pf.all.indexOf('1940s') >= 0 && pf.all.indexOf('classic') < 0, pf);
}
check('collar: neck 40 takes a 41 cm (16 in) collar', F.collar(40).cm === 41 && F.collar(40).in === 16, F.collar(40));
check('collar never smaller than neck plus ease', [36, 38, 40, 42, 44].every(nk => F.collar(nk).cm >= nk + 1.25 - 0.4));
check('jacket length letter by height', F.lengthLetter(170).id === 'S' && F.lengthLetter(180).id === 'R' && F.lengthLetter(188).id === 'L' && F.lengthLetter(195).id === 'XL');
check('watch range widens with the wrist', F.watchRange(15)[0] < F.watchRange(19)[0] && F.watchRange(null).join() === '36,40');
const S = F.sizes(M), labels = S.filter(s => s.value).map(s => s.group + ': ' + s.label);
check('sizes give a European jacket size of half the chest', S.some(s => /European size/.test(s.label) && s.group === 'Jackets and suits' && /^52/.test(s.value)), labels);
check('sizes give a European trouser size from the waist', S.some(s => /European size/.test(s.label) && s.group === 'Trousers' && /^50/.test(s.value)), S.filter(s => s.group === 'Trousers').map(s => s.value));
const few = F.sizes({ height: 185 });
check('with only a height, the missing measurements are named', few.some(s => s.needs && s.needs.indexOf('chest') >= 0));
require(path.join(__dirname, '..', 'js', 'patterns.js')); require(path.join(__dirname, '..', 'js', 'garments.js'));
const unsized = [];
window.VGARM.POSITIONS.forEach(p => p.kinds.forEach(k => { if (!F.forDresser(p.key, k.id)) unsized.push(p.key + ':' + k.id); }));
check('every Dresser garment is sized on Fit, or says why not', !unsized.length, unsized);
check('every Fit check names the Dresser garments it covers', Object.keys(F.CHECKS).every(k => F.CHECKS[k].covers), Object.keys(F.CHECKS).filter(k => !F.CHECKS[k].covers));
const M2 = Object.assign({}, M, { arm: 64, backNeckFloor: 159, waistHeight: 111 });
check('the new checks judge: a waistcoat, a polo, a casual jacket, a short coat and a tie', ['waistcoat', 'polo', 'casual', 'shortcoat', 'tie'].every(k => F.CHECKS[k]) &&
  F.checkGarment('casual', { chest: 120, sleeve: 65, length: 70 }, {}, M2, 'modern', {}).every(r => r && r.state) &&
  F.checkGarment('shortcoat', { length: 90 }, {}, M2, 'modern', {})[0].state === 'right' &&
  F.checkGarment('tie', { width: 8 }, {}, M, 'modern', { prop: { tieWidth: { lo: 7.5, hi: 9 } } })[0].state === 'right' &&
  F.checkGarment('tie', { width: 5 }, {}, M, 'modern', { prop: { tieWidth: { lo: 7.5, hi: 9 } } })[0].style === true);
check('every Fit check but the tie has a try-on list, and the shape adds its faults',
  Object.keys(F.CHECKS).every(k => k === 'tie' ? !F.tryonFor(k) : !!F.tryonFor(k)) &&
  F.tryonFor('jacket', { posture: 'forward', shoulders: 'sloping' }).mine.length === 2 && F.tryonFor('trousers', { posture: 'forward' }).mine.length === 0,
  Object.keys(F.CHECKS).filter(k => k !== 'tie' && !F.tryonFor(k)));
check('clean() repairs an empty fit-check state', !!F.clean(null) && typeof F.clean(null) === 'object');

/* ---------- js/ui/photos.js: reading a patch, and My colours made safe ---------- */
require(path.join(__dirname, '..', 'js', 'ui', 'photos.js'));
const PH = window.VPHOTOS;
// a fake canvas: a 9×9 grey patch with one black and one white pixel (a shadow and a glint)
const fakeCtx = (function () {
  const w = 9, h = 9, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; }
  d.fill(0, 0, 3); d.fill(255, 4, 7);
  return { canvas: { width: w, height: h }, getImageData: function () { return { data: d }; } };
})();
check('patch: trimmed for cloth, the shadow and the glint are left out', PH.patch(fakeCtx, 4, 4, 4, 0.1) === '#808080', PH.patch(fakeCtx, 4, 4, 4, 0.1));
check('patch: untrimmed (the You tab), every pixel counts', PH.patch(fakeCtx, 4, 4, 4, 0) !== '#808080');
const cleaned = PH.cleanColours([
  { id: 'a1', name: '  Albrecht navy ', hex: '#1C2B4C', paper: true, photo: 'p1', added: '2026-11-21T10:00' },
  { id: 'a1', name: 'duplicate id', hex: '#000000' },
  { id: 'bad id!', name: 'x', hex: '#000000' },
  { id: 'b2', name: '<b>', hex: 'navy' },
  { id: 'c3', hex: '#ffffff', photo: '../x' }, null, 'text']);
check('cleanColours keeps only safe entries', cleaned.length === 2, cleaned);
check('cleanColours trims the name, lowers the hex, cuts the date', cleaned[0].name === 'Albrecht navy' && cleaned[0].hex === '#1c2b4c' && cleaned[0].added === '2026-11-21');
check('cleanColours names an unnamed colour and drops a bad photo link', cleaned[1].name === 'My colour' && cleaned[1].photo === null && cleaned[1].paper === false);
check('cleanColours of anything but a list is empty', PH.cleanColours({}).length === 0 && PH.cleanColours(null).length === 0);
check('cleanColours keeps at most 200', PH.cleanColours(Array.from({ length: 250 }, (x, i) => ({ id: 'k' + i, hex: '#123456' }))).length === 200);
check('nameOf finds one of my colours by its hex, in any case', PH.nameOf('#1C2B4C', { myColours: cleaned }) === 'Albrecht navy' && PH.nameOf('#abcdef', { myColours: cleaned }) === null && PH.nameOf('#1c2b4c', {}) === null);

console.log(failed ? failed + ' of ' + n + ' unit checks failed' : 'units: ' + n + ' checks pass (colour, vision, patterns, body, proportion, fit, photos)');
process.exit(failed ? 1 : 0);
