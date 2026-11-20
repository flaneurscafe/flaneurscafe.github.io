/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — regression: 800 fixed random outfits through the engine, compared with the stored record in
   tests/regression.json: every check (id, score, badge, section, and a fingerprint of its text), the verdict, the penalty, the
   suggestions and Choose the best colours. Any difference fails, listing the first ones. After a change
   made on purpose, record the new behaviour with: node tests/regression.js --update
   (the changed record then shows in the same commit as the change). */
'use strict';
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'engine', 'body', 'proportion']) require(path.join(__dirname, '..', 'js', f + '.js'));
const E = window.VENGINE, G = window.VGARM, VP = window.VPAT, D = window.VDATA;
const FILE = path.join(__dirname, 'regression.json');
let seed = 20261120; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; const pick = a => a[Math.floor(rnd() * a.length)];
const hexes = D.colours.map(c => c.hex);
const A = [D.demo, Object.assign({}, D.demo, { season: 'summer', redness: 'marked', underEye: 'deep' }),
  { samples: { skin: '#5b3a29', hair: '#1c1614', eyes: '#2a1c14' }, manual: { skin: true, hair: true, eyes: true }, named: {}, hairStyle: 'none' }].map(p => E.analyseProfile(p));
function outfit() {
  const o = {};
  G.POSITIONS.forEach(pos => {
    if (pos.optional && rnd() < 0.5) { o[pos.key] = null; return; }
    const kd = pick(pos.kinds), cloth = kd.cloths && kd.cloths.length ? pick(kd.cloths) : undefined;
    let pat = { type: 'solid' }; const t = pick(kd.pats.filter(t => t === 'solid' || !cloth || G.patOK(cloth, t)));
    if (t !== 'solid') { const ty = VP.byId[t]; pat = { type: t, scale: +(ty.min + (ty.max - ty.min) * rnd()).toFixed(2), hex2: pick(hexes) }; }
    o[pos.key] = { hex: pick(hexes), name: 'X', kind: kd.id, cloth, pat, rise: pick(['high', 'mid', 'low']), length: pick(['short', 'regular', 'long']),
      hex2: kd.twoTone ? '#f2efe6' : undefined, buttons: kd.buttons ? pick(G.BUTTONS.map(b => b[0])) : undefined, metal: kd.metal ? 'gold' : undefined };
  });
  o.occasion = pick(G.OCCASIONS.map(x => x.id)); o.propOn = rnd() < 0.5;
  o.body = { legRatio: Math.floor(rnd() * 100), faceClass: pick(['broad', 'long', 'middle']), stomach: pick(['flat', 'full']) }; o.shape = {}; o.hairStyle = pick(['short', 'none']); o.m = {};
  o.acc = {}; G.ACCESSORIES.forEach(d => { o.acc[d.key] = { on: rnd() < 0.4, metal: d.metals && d.metals.length ? pick(d.metals) : undefined, frame: pick(['gold', 'silver', 'acetate']), hex: '#5b3a24',
    size: d.size ? Math.round(d.size.min + (d.size.max - d.size.min) * rnd() * 1.4) : undefined, strap: 'leather', display: pick(['analogue', 'digital']) }; });
  return o;
}
const r4 = x => Math.round(x * 1e4) / 1e4;
// a short fingerprint of a text (FNV-1a), so the record stays small; any change of wording still shows
const fp = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const record = [];
for (let i = 0; i < 800; i++) {
  const o = outfit(), a = A[i % A.length], ch = E.checkOutfit(o, a), v = E.verdict(ch);
  const rec = { checks: ch.map(c => [c.id, r4(c.score), c.level || '', E.sectionOf(c), fp(c.text)]), verdict: [v.title, v.fails, v.warns], penalty: r4(E.penalty(ch)) };
  if (i < 40) {
    const slot = ['shirt', 'trousers', 'jacket', 'shoes'].find(k => o[k]);
    rec.suggest = E.suggest(o, a, slot, 5).map(s => [s.name, fp(s.why)]);
    const c = E.complete(o, a, {}); rec.complete = Object.keys(c).filter(k => c[k] && c[k].hex).map(k => k + ':' + c[k].hex).join(' ');
  }
  record.push(rec);
}
if (process.argv.includes('--update')) {
  fs.writeFileSync(FILE, JSON.stringify(record));
  console.log('regression: record written (' + record.length + ' outfits, ' + record.reduce((s, r) => s + r.checks.length, 0) + ' checks)');
  process.exit(0);
}
if (!fs.existsSync(FILE)) { console.log('regression: no record yet; run node tests/regression.js --update'); process.exit(1); }
const old = JSON.parse(fs.readFileSync(FILE, 'utf8')), diffs = [];
for (let i = 0; i < record.length && diffs.length < 8; i++) {
  const x = old[i], y = record[i];
  if (!x) { diffs.push('outfit ' + i + ': not in the record'); continue; }
  ['verdict', 'penalty', 'suggest', 'complete'].forEach(k => { if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) diffs.push('outfit ' + i + ', ' + k + ': ' + JSON.stringify(x[k]).slice(0, 90) + ' → ' + JSON.stringify(y[k]).slice(0, 90)); });
  const a = x.checks.map(c => JSON.stringify(c)), b = y.checks.map(c => JSON.stringify(c));
  a.filter(c => b.indexOf(c) < 0).slice(0, 2).forEach(c => diffs.push('outfit ' + i + ', check gone or changed: ' + c.slice(0, 140)));
  b.filter(c => a.indexOf(c) < 0).slice(0, 2).forEach(c => diffs.push('outfit ' + i + ', check new or changed: ' + c.slice(0, 140)));
}
if (diffs.length) { console.log('regression: behaviour differs from the record:\n  ' + diffs.slice(0, 8).join('\n  ') + '\n  If this is intended, run node tests/regression.js --update'); process.exit(1); }
console.log('regression: ' + record.length + ' outfits behave exactly as recorded');
