// SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
/* Combinations from the literature, judged by Valet: a test of the formality rules against what the
   writers actually say. Each case is an outfit a source endorses or calls a mistake, with the source
   and its page or address. The colours are kept safe for the profile, so only formality is at stake.

   expect:
     'fine'     the source endorses it: no formality check may fail (score below 0.5);
     'note'     the source advises against it, mildly: at least one formality check flags it (below 0.85),
                none fails;
     'mistake'  the source calls it wrong: at least one formality check fails.
   (The formality checks are those in the group 'formality': mixed registers, the occasion, neckwear
   with jeans, the collar, the hat, the shoes for the occasion.)

   Started November 2026 from an outfit Valet got wrong: a shawl cardigan over a shirt and tie, which
   Drake's, Permanent Style and Gentleman's Gazette all endorse, failed as "pieces of different
   formality". Add a case whenever a source settles a combination; MAINTAINING.md says how. */
global.window = global.window || {};
require('./load')(['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'body', 'proportion', 'outfit']);
const E = window.VENGINE, D = window.VDATA, O = window.VOUTFIT;

const FLUSSER = 'Flusser, Dressing the Man';
const GG = 'Gentleman\'s Gazette';
const C = {   // colours safe for the profile
  white: '#f7f6f2', lblue: '#c3d7ee', navy: '#1d2a44', charcoal: '#3d4045', grey: '#8e9196', lgrey: '#c9cbcd',
  stone: '#c9bfa8', black: '#161616', dbrown: '#4a3326', mbrown: '#7a5537', oxblood: '#4e1c1f', burgundy: '#5e1f2c',
  forest: '#2d4a32', indigo: '#2b3a55', tweed: '#6b5a45', seer: '#b9c9dc'
};
const P = (kind, hex, cloth, more) => Object.assign({ kind, hex, cloth, pat: { type: 'solid' } }, more || {});
const suit = (hex, cloth) => ({ jacket: P('jacket', hex, cloth), trousers: P('trousers', hex, cloth) });
const shirt = (hex, cloth, more) => ({ shirt: P('shirt', hex, cloth || 'poplin', more) });
const tie = (hex, cloth) => ({ tie: P('tie', hex, cloth || 'silktwill') });

const CASES = [
  // ---- endorsed ----
  { name: 'shawl cardigan, chunky, over a white shirt and silk tie, flannels, brogues (KP, November 2026)', expect: 'fine', occasion: 'smart',
    src: 'Drake\'s, "Perennials: Shawl Collar Cardigans" (a stand-in for a tweed jacket, over shirt and tie); Simon Crompton, Drake\'s editorial (with a shirt, tie and flannels); ' + GG + ', cardigan guide (a dress shirt and tie underneath; a thick knit when it replaces a jacket)',
    o: Object.assign(shirt(C.white), tie(C.forest), { mid: P('shawl', C.charcoal, 'lambswool', { knit: 'chunky' }), trousers: P('trousers', C.stone, 'flannel'), shoes: P('derby', C.mbrown, 'calf', { brogue: 'brogue' }) }) },
  { name: 'the same with a knitted silk tie', expect: 'fine', occasion: 'smart',
    src: 'Drake\'s, "Perennials: Shawl Collar Cardigans" (throw on a knitted silk tie)',
    o: Object.assign(shirt(C.white, 'oxford'), tie(C.forest, 'knitsilk'), { mid: P('shawl', C.charcoal, 'lambswool', { knit: 'chunky' }), trousers: P('trousers', C.grey, 'flannel'), shoes: P('loafer', C.dbrown, 'suede') }) },
  { name: 'V-neck over a shirt and tie, for work', expect: 'fine', occasion: 'business',
    src: GG + ', "10 Stylish Ways to Wear a Sweater" (a V-neck over a shirt and tie is a great option for work)',
    o: Object.assign(shirt(C.white), tie(C.burgundy), { mid: P('vneck', C.navy, 'merino'), trousers: P('trousers', C.grey, 'worsted'), shoes: P('derby', C.dbrown, 'calf') }) },
  { name: 'charcoal suit with a black roll neck', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 93 (a black turtleneck or T-shirt for downtown); ' + GG + ', turtleneck guide (a great way to dress down suits)',
    o: Object.assign(suit(C.charcoal, 'worsted'), { shirt: P('rollneck', C.black, 'merino'), shoes: P('oxford', C.black, 'calf') }) },
  { name: 'charcoal suit with a T-shirt', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 93 (a black turtleneck or T-shirt for downtown)',
    o: Object.assign(suit(C.charcoal, 'worsted'), { shirt: P('tee', C.black, 'jersey'), shoes: P('loafer', C.black, 'calf') }) },
  { name: 'grey suit, no tie, open button-down collar', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 273 (dressing down the grey business suit: the button-down collar frames the face without a tie)',
    o: Object.assign(suit(C.grey, 'worsted'), shirt(C.white, 'oxford', { collar: 'buttondown' }), { shoes: P('loafer', C.dbrown, 'calf') }) },
  { name: 'seersucker suit with a polo shirt', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 99 (worn with a necktie or a polo shirt)',
    o: Object.assign(suit(C.seer, 'seersucker'), { shirt: P('polo', C.navy, 'pique'), shoes: P('loafer', C.dbrown, 'suede') }) },
  { name: 'seersucker suit with a tie', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 99 (worn with a necktie or a polo shirt)',
    o: Object.assign(suit(C.seer, 'seersucker'), shirt(C.white), tie(C.navy), { shoes: P('loafer', C.dbrown, 'suede') }) },
  { name: 'navy blazer with jeans', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 111 (the navy blazer with flannels or jeans); ' + GG + ', "Jackets & Jeans" (blazer or sport coat with your dressiest jeans)',
    o: Object.assign(shirt(C.white, 'oxford'), { jacket: P('blazer', C.navy, 'hopsack'), trousers: P('trousers', C.indigo, 'denim'), shoes: P('chukka', C.dbrown, 'suede') }) },
  { name: 'navy blazer, grey flannels and a tie', expect: 'fine', occasion: 'business',
    src: FLUSSER + ', p. 111 (with flannels, with neckties)',
    o: Object.assign(shirt(C.white), tie(C.burgundy, 'repsilk'), { jacket: P('blazer', C.navy, 'hopsack'), trousers: P('trousers', C.grey, 'flannel'), shoes: P('loafer', C.oxblood, 'calf') }) },
  { name: 'navy blazer with a cravat', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', p. 111 (ascots or neckties)',
    o: Object.assign(shirt(C.white), { tie: P('cravat', C.burgundy, 'silktwill'), jacket: P('blazer', C.navy, 'hopsack'), trousers: P('trousers', C.grey, 'flannel'), shoes: P('loafer', C.dbrown, 'suede') }) },
  { name: 'tweed jacket with jeans and brogues', expect: 'fine', occasion: 'smart',
    src: GG + ', "Should You Wear Jeans with a Jacket?" (brogues are casual enough with jeans and tie the outfit to the sport coat)',
    o: Object.assign(shirt(C.lblue, 'oxford'), { jacket: P('jacket', C.tweed, 'tweed'), trousers: P('trousers', C.indigo, 'denim'), shoes: P('derby', C.dbrown, 'calf', { brogue: 'brogue' }) }) },
  { name: 'tweed jacket, roll neck and jeans', expect: 'fine', occasion: 'smart',
    src: GG + ', turtleneck guide (turtlenecks with sport coats and jeans)',
    o: { shirt: P('rollneck', C.charcoal, 'merino'), jacket: P('jacket', C.tweed, 'tweed'), trousers: P('trousers', C.indigo, 'denim'), shoes: P('chelsea', C.dbrown, 'suede') } },
  { name: 'tweed jacket, button-down and repp tie', expect: 'fine', occasion: 'smart',
    src: FLUSSER + ', pp. 20 and 64 (Astaire\'s button-down under a tweed jacket; a button-down with a repp tie)',
    o: Object.assign(shirt(C.lblue, 'oxford', { collar: 'buttondown' }), tie(C.navy, 'repsilk'), { jacket: P('jacket', C.tweed, 'tweed'), trousers: P('trousers', C.grey, 'flannel'), shoes: P('derby', C.dbrown, 'suede') }) },
  { name: 'grey suit with brown suede shoes', expect: 'fine', occasion: 'business',
    src: FLUSSER + ', p. 278 (brown suede shoes, worn with jeans or with a suit)',
    o: Object.assign(suit(C.grey, 'worsted'), shirt(C.white), tie(C.navy), { shoes: P('derby', C.dbrown, 'suede') }) },
  { name: 'fine cardigan under a suit jacket, with a tie', expect: 'fine', occasion: 'business',
    src: FLUSSER + ', p. 277 (a V-neck or cardigan layered under the jacket); ' + GG + ', cardigan guide (a thin knit under a jacket, like a knit vest)',
    o: Object.assign(suit(C.navy, 'worsted'), shirt(C.white), tie(C.burgundy), { mid: P('cardigan', C.grey, 'merino'), shoes: P('oxford', C.black, 'calf') }) },
  // ---- advised against ----
  { name: 'sneakers with a full suit', expect: 'mistake', occasion: 'business',
    src: GG + ', "Sneakers: Should Gentlemen Wear Them?" (never with a full suit)',
    o: Object.assign(suit(C.navy, 'worsted'), shirt(C.white), tie(C.burgundy), { shoes: P('trainer', C.white, 'calf') }) },
  { name: 'chunky trainers with a full suit', expect: 'mistake', occasion: 'smart',
    src: GG + ', "Sneakers: Should Gentlemen Wear Them?" (never with a full suit)',
    o: Object.assign(suit(C.navy, 'worsted'), shirt(C.white), { shoes: P('chunky', C.white, 'canvas') }) },
  { name: 'black oxfords with a sport coat and jeans', expect: 'note', occasion: 'smart',
    src: GG + ', "Should You Wear Jeans with a Jacket?" (black oxfords are way too formal here)',
    o: Object.assign(shirt(C.lblue, 'oxford'), { jacket: P('jacket', C.tweed, 'tweed'), trousers: P('trousers', C.indigo, 'denim'), shoes: P('oxford', C.black, 'calf') }) },
  { name: 'shirt and tie with jeans', expect: 'mistake', occasion: 'smart',
    src: GG + ' (neckwear dresses an outfit up and denim keeps it casual)',
    o: Object.assign(shirt(C.white), tie(C.navy), { trousers: P('trousers', C.indigo, 'denim'), shoes: P('derby', C.dbrown, 'suede') }) },
  { name: 'shirt and tie with nothing over them', expect: 'note', occasion: 'smart',
    src: GG + ', "Should You Wear a Tie Without a Jacket?" (not recommended for most men; it looks incomplete)',
    o: Object.assign(shirt(C.white), tie(C.burgundy), { trousers: P('trousers', C.grey, 'flannel'), shoes: P('derby', C.dbrown, 'calf') }) },
  { name: 'camp collar under a suit jacket', expect: 'note', occasion: 'smart',
    src: FLUSSER + ', p. 273 (camp-style collars should be avoided when the shirt collar is to frame the face inside the jacket\'s open neck)',
    o: Object.assign(suit(C.grey, 'worsted'), shirt(C.white, 'linen', { collar: 'camp' }), { shoes: P('loafer', C.dbrown, 'suede') }) }
];

const nameOf = h => { const c = D.colours.find(x => x.hex.toLowerCase() === String(h).toLowerCase()); return c ? c.name.toLowerCase() : h; };
const profile = Object.assign({}, D.demo, { season: 'winter' });
const a = E.analyseProfile(profile);
const OFF = ['hat', 'tie', 'scarf', 'mid', 'jacket', 'coat', 'square', 'boutonniere', 'socks', 'gloves'];
function judge(c) {
  const raw = { occasion: c.occasion, acc: {} };
  OFF.forEach(k => { raw[k] = { on: false }; });
  Object.keys(c.o).forEach(k => { raw[k] = Object.assign({ on: true }, c.o[k]); });
  const o = O.normOutfit(raw);
  // a piece normOutfit had to change is a case written wrongly, not a judgement
  Object.keys(c.o).forEach(k => ['kind', 'cloth', 'collar', 'knit', 'brogue'].forEach(f => {
    if (c.o[k][f] != null && o[k][f] !== c.o[k][f]) throw new Error(c.name + ': ' + k + '.' + f + ' "' + c.o[k][f] + '" is not a valid choice (became "' + o[k][f] + '")');
  }));
  const ch = E.checkOutfit(O.engineOutfit(o, profile, nameOf), a);
  const f = ch.filter(x => x.group === 'formality');
  return { fails: f.filter(x => x.score < 0.5), notes: f.filter(x => x.score >= 0.5 && x.score < 0.85), all: ch };
}

let fails = 0;
CASES.forEach(c => {
  const r = judge(c);
  const ok = c.expect === 'fine' ? r.fails.length === 0
    : c.expect === 'note' ? r.fails.length === 0 && r.notes.length > 0
    : r.fails.length > 0;
  if (!ok) {
    fails++;
    console.log('✗ ' + c.name + ' — expected ' + c.expect + '\n    source: ' + c.src);
    r.fails.concat(r.notes).forEach(x => console.log('    ' + (x.score < 0.5 ? 'fails' : 'notes') + ' ' + x.id + ': ' + x.text.slice(0, 190)));
    if (!r.fails.length && !r.notes.length) console.log('    no formality check flags it');
  }
});
console.log((fails ? fails + ' of ' : 'all ') + CASES.length + ' combinations from the literature ' + (fails ? 'judged against their source' : 'judged as their sources say'));
if (require.main === module) process.exitCode = fails ? 1 : 0;
module.exports = { CASES, judge, fails };
