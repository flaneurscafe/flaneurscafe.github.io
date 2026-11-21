/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — every "Sources" and "Why" points at a passage that exists. Run: node tests/why.js.
   Every Proportion target (in every period), every Fit size row, every kind of Fit result and each
   field rule must be mapped in js/ui/why.js to an id in How it works (index.html). The Dresser's rules
   are checked by tests/rules.js. Exits 1 on failure. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['colour', 'data', 'body', 'proportion', 'fit']) require(path.join(__dirname, '..', 'js', f + '.js'));
require(path.join(__dirname, '..', 'js', 'ui', 'why.js'));
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const uifit = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'fit.js'), 'utf8');
const W = window.VWHY, P = window.VPROP, F = window.VFIT;
const exists = id => page.indexOf('id="' + id + '"') >= 0;
const problems = []; let count = 0;
const need = (what, id) => { count++; if (!id) problems.push(what + ': not mapped in js/ui/why.js'); else if (!exists(id)) problems.push(what + ': passage "' + id + '" is not in How it works'); };
// a full set of measurements, so every target and size row is produced
const m = { height: 180, chest: 100, waist: 86, seat: 100, neck: 40, shoulder: 46, arm: 63, inseam: 84, backNeckFloor: 155, head: 58, foot: 27, wrist: 17.5,
  waistHeight: 108, faceWidth: 14, faceLength: 12, sleeve: 63, thigh: 58, calf: 38, hand: 21 };
const ids = new Set();
Object.keys(P.PERIODS).forEach(function (pid) { P.targets(m, {}, pid).list.forEach(function (t) { ids.add(t.id); }); });
ids.forEach(function (id) { need('Proportion target "' + id + '"', W.MAP.target[id]); });
F.sizes(m, {}).forEach(function (x) { need('Fit size row "' + x.label + '"', W.MAP.size[x.label]); });
// the kinds of result, as the Fit tab names them
const AG = Object.keys(eval('(' + uifit.match(/const AGAINST = (\{[^}]*\})/)[1] + ')'));
AG.forEach(function (k) { need('Fit result against "' + k + '"', k === 'rule' ? 'f-lengths' : (W.MAP.against[k] || [])[0]); });
Object.keys(W.MAP.rule).forEach(function (k) { need('Fit field rule "' + k + '"', W.MAP.rule[k]); });
// every field that is judged by a rule of its own (not against yours, a target or the body) must be mapped:
// otherwise its Sources button falls back to the lengths passage and has nothing to say
Object.keys(F.CHECKS).forEach(function (kind) {
  const vals = {}; F.CHECKS[kind].fields.forEach(function (f) { vals[f.key] = 30; });
  F.checkGarment(kind, vals, {}, m, 'modern', {}).filter(function (r) { return r.against === 'rule'; }).forEach(function (r) {
    if (!W.MAP.rule[r.key]) { count++; problems.push('Fit "' + kind + '", field "' + r.key + '": judged by a rule, but not in MAP.rule (js/ui/why.js)'); }
  });
});
need('Fit size label', W.MAP.label); need('Fit periods', W.MAP.periods);
// and nothing mapped that no longer exists
Object.keys(W.MAP.target).forEach(function (id) { if (!ids.has(id)) problems.push('mapped target "' + id + '" is no longer a Proportion target'); });
// every item says what it rests on: references that exist in section 19, or what it is instead
const keys = [...ids].map(id => 'target:' + id).concat(F.sizes(m, {}).map(x => 'size:' + x.label), AG.filter(k => k !== 'rule').map(k => 'against:' + k),
  Object.keys(W.MAP.rule).map(k => 'rule:' + k), ['label', 'periods']);
keys.forEach(function (k) {
  count++; const e = W.SOURCES[k];
  if (!e) { problems.push(k + ': no entry in SOURCES (js/ui/why.js)'); return; }
  (e.refs || []).forEach(function (n) { if (page.indexOf('<li id="ref-' + n + '"') < 0) problems.push(k + ': reference ' + n + ' is not in section 19'); });
  if (!(e.refs && e.refs.length) && !W.KIND[e.kind]) problems.push(k + ': no reference, and no kind saying what it is instead');
});
Object.keys(W.SOURCES).forEach(function (k) { if (keys.indexOf(k) < 0) problems.push(k + ': an entry for an item that no longer exists'); });
if (problems.length) { console.log('why: ' + problems.length + ' problem(s)\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('why: every Sources and Why points at a passage, and every item says what it rests on (' + count + ' checked)');
