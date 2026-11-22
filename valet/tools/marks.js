/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — your marks against Valet's verdicts: node tools/marks.js valet-yourname.json

   Reads a profile file saved from Valet (Save in the You tab), whose Saved outfits carry your marks
   (good, so-so, bad; set in My garments or in Saved outfits). Judges every marked outfit again with
   the rules as they are now, and prints:
   - how often you and Valet agree;
   - every outfit where you disagree: you call it good and Valet fails it, or you call it bad and
     Valet passes it, with the rules that decided it;
   - which rules cause the disagreements, most often first.
   Run it before and after changing a rule: a change that adds disagreements is a change for the
   worse on your own clothes. The file stays yours: keep it outside the repository. */
'use strict';
const path = require('path');
global.window = global.window || {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest', 'outfit', 'body', 'proportion']) require(path.join(__dirname, '..', 'js', f + '.js'));
const E = window.VENGINE, O = window.VOUTFIT, D = window.VDATA;

const nameOf = function (h) { const c = D.colours.find(function (x) { return x.hex.toLowerCase() === String(h).toLowerCase(); }); return c ? c.name : String(h).toUpperCase(); };
/* state: the profile as saved (V.state with its extra fields). Returns { rows, agree, disagree, so, byRule }. */
function report(state) {
  const profile = Object.assign({}, state, { outfit: O.normOutfit(state.outfit) });
  const now = state.season === 'summer' ? 'summer' : 'winter';
  const aFor = {};
  const analysis = function (season) {
    const se = season === 'summer' || season === 'winter' ? season : now;
    if (!(se in aFor)) aFor[se] = E.analyseProfile(E.seasonProfile(Object.assign({}, profile, { season: se }), se));
    return aFor[se];
  };
  const list = O.normWardrobe(state.wardrobe).filter(function (w) { return w.mark; });
  const rows = list.map(function (w) {
    const a = analysis(O.seasonOf(w.outfit));
    const ch = E.checkOutfit(O.engineOutfit(w.outfit, profile, nameOf), a), v = E.verdict(ch);
    const fails = ch.filter(function (c) { return c.score < 0.5 && E.kindOf(c) !== 'context'; }).map(function (c) { return c.id; });
    const passing = ch.filter(function (c) { return c.score >= 0.5 && c.score < 0.85 && E.kindOf(c) !== 'context'; }).map(function (c) { return c.id; });
    return { name: w.name, mark: w.mark, level: v.level, title: v.title, then: w.markVerdict || '', fails: fails, notes: passing, disagree: O.disagrees(w.mark, v.level) };
  });
  const byRule = {};
  rows.filter(function (r) { return r.disagree && r.mark === 'good'; }).forEach(function (r) {
    r.fails.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).forEach(function (id) { byRule[id] = (byRule[id] || 0) + 1; });
  });
  return { rows: rows, agree: rows.filter(function (r) { return r.mark !== 'mid' && !r.disagree; }).length,
    disagree: rows.filter(function (r) { return r.disagree; }).length, so: rows.filter(function (r) { return r.mark === 'mid'; }).length, byRule: byRule };
}

function print(r) {
  const out = [];
  const name = function (id) { return (E.RULES[id] && E.RULES[id].name) || id; };
  out.push(r.rows.length + ' marked outfit' + (r.rows.length === 1 ? '' : 's') + ': ' + r.agree + ' agree with Valet, ' + r.disagree + ' disagree, ' + r.so + ' so-so.');
  if (!r.rows.length) out.push('Mark outfits good, so-so or bad in the Dresser (My garments or Saved outfits), then save the profile again.');
  const dis = r.rows.filter(function (x) { return x.disagree; });
  if (dis.length) {
    out.push('', 'Where you and Valet disagree:');
    dis.forEach(function (x) {
      out.push('- ' + x.name + ': you ' + x.mark + ', Valet "' + x.title + '"' + (x.then && x.then !== x.title ? ' (was "' + x.then + '" when you marked it)' : '') +
        (x.fails.length ? '. Fails: ' + x.fails.map(name).join(', ') : x.notes.length ? '. Notes only: ' + x.notes.map(name).join(', ') : ''));
    });
  }
  const ids = Object.keys(r.byRule).sort(function (a, b) { return r.byRule[b] - r.byRule[a]; });
  if (ids.length) {
    out.push('', 'Rules that fail outfits you call good, most often first:');
    ids.forEach(function (id) { out.push('- ' + name(id) + ' (' + id + '): ' + r.byRule[id]); });
  }
  return out.join('\n');
}

module.exports = { report: report, print: print };
if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/marks.js valet-yourname.json'); process.exit(1); }
  let data;
  try { data = JSON.parse(require('fs').readFileSync(file, 'utf8')); } catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
  if (!data || data.app !== 'valet' || !data.samples) { console.error(file + ' is not a Valet profile file (Save in the You tab).'); process.exit(1); }
  console.log(print(report(data)));
}
