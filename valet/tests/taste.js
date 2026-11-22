/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — taste: how often Valet agrees with a well-dressed eye. Run: node tests/taste.js (--update to record).
   tests/taste.json holds outfits that Gentleman's Gazette's presenters wear in published photos: some marked
   by GG with a tick or a cross, most shown as good examples. They were read from the photos (the photos are not
   kept), entered piece by piece, and are judged here with each presenter's colouring twice: as estimated by eye
   and typed in, and as measured from photos with a white reference.
   This is a number to watch, not a test to pass. It never fails the run. GG is not the truth (its crosses are
   mostly convention), and tuning a rule only to agree with these few looks would be overfitting. What it shows
   is whether a change moves Valet towards a good eye or away from it: run it before and after changing a rule,
   and read which looks changed. It also lists every look still failed, with the rule that fails it. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = global.window || {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'outfit', 'body', 'proportion']) require(path.join(__dirname, '..', 'js', f + '.js'));
const E = window.VENGINE, O = window.VOUTFIT, D = window.VDATA;
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'taste.json'), 'utf8'));
const RECORD = path.join(__dirname, 'taste-record.json');
const names = {}; D.colours.forEach(function (c) { names[c.hex.toLowerCase()] = c.name; });
const nameOf = function (h) { return names[String(h).toLowerCase()] || String(h).toUpperCase(); };
const pass = function (t) { return t === 'Good outfit' || t === 'Works'; };
const approved = function (g) { return g === 'tick' || g === 'better' || g === 'shown'; };

const rows = [];
T.looks.forEach(function (l) {
  const season = O.seasonOf(l.outfit) === 'summer' ? 'summer' : 'winter';
  ['estimated', 'measured'].forEach(function (pk) {
    const prof = Object.assign({}, T.people[l.who][pk], { season: season });
    const a = E.analyseProfile(E.seasonProfile(prof, season));
    // the measured colourings were read against a white reference in each photo, as Valet reads a photo with white paper
    if (pk === 'measured') { a.confidence = 'medium'; a.skinMeasured = true; }
    const ch = E.checkOutfit(O.engineOutfit(l.outfit, prof, nameOf), a), v = E.verdict(ch);
    rows.push({ id: l.id, gg: l.gg, name: l.name, profile: pk, verdict: v.title, fails: ch.filter(function (c) { return c.score < 0.5 && E.kindOf(c) !== 'context'; }).map(function (c) { return c.id; }) });
  });
});
const summary = {};
['estimated', 'measured'].forEach(function (pk) {
  const r = rows.filter(function (x) { return x.profile === pk; });
  const ap = r.filter(function (x) { return approved(x.gg); }), cr = r.filter(function (x) { return !approved(x.gg); });
  summary[pk] = { approved: ap.length, passed: ap.filter(function (x) { return pass(x.verdict); }).length, crossed: cr.length, flagged: cr.filter(function (x) { return !pass(x.verdict); }).length };
});
const line = function (pk) { const s = summary[pk]; return pk + ' colouring: passes ' + s.passed + ' of ' + s.approved + ' looks GG approves, flags ' + s.flagged + ' of ' + s.crossed + ' it crosses'; };
if (process.argv.includes('--update')) {
  fs.writeFileSync(RECORD, JSON.stringify({ summary: summary, verdicts: rows.map(function (r) { return [r.id, r.profile, r.verdict]; }) }, null, 1));
  console.log('taste: recorded. ' + line('estimated') + '; ' + line('measured') + '.');
  process.exit(0);
}
const out = ['taste: ' + line('estimated') + '; ' + line('measured') + '.'];
if (fs.existsSync(RECORD)) {
  const rec = JSON.parse(fs.readFileSync(RECORD, 'utf8')), was = {};
  rec.verdicts.forEach(function (v) { was[v[0] + '|' + v[1]] = v[2]; });
  const moved = rows.filter(function (r) { const w = was[r.id + '|' + r.profile]; return w && w !== r.verdict; });
  ['estimated', 'measured'].forEach(function (pk) {
    const a = rec.summary[pk], b = summary[pk];
    if (a.passed !== b.passed || a.flagged !== b.flagged) out.push('  ' + pk + ': was ' + a.passed + ' of ' + a.approved + ' passed and ' + a.flagged + ' of ' + a.crossed + ' flagged when recorded');
  });
  moved.forEach(function (r) { out.push('  ' + r.id + ' (' + r.profile + ', GG ' + r.gg + '): ' + was[r.id + '|' + r.profile] + ' → ' + r.verdict + (approved(r.gg) === pass(r.verdict) ? ' (towards GG)' : ' (away from GG)')); });
  if (moved.length) out.push('  ' + moved.length + ' verdict(s) moved since the record. If that is meant, run node tests/taste.js --update.');
} else out.push('  no record yet: run node tests/taste.js --update');
if (process.env.VERBOSE) rows.filter(function (r) { return approved(r.gg) && !pass(r.verdict); }).forEach(function (r) { out.push('  still failed: ' + r.id + ' (' + r.profile + '): ' + r.fails.join(', ')); });
console.log(out.join('\n'));
