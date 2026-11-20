/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the rules table is complete. Run with Node from the project folder: node tests/rules.js
   Every rule id the checks can emit (an `id: '…'` in engine.js) must have one entry in RULES, with a
   name, a numeric weight, a reason (a phrase, or null where a colour cannot change the rule), a kind
   (perceptual, convention, possibility or context) and, if it names a section, one that exists. Entries no check emits are reported too. Exits 1 on failure. */
'use strict';
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine', 'suggest']) require(path.join(__dirname, '..', 'js', f + '.js'));
const E = window.VENGINE, src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const from = src.indexOf('  function checkOutfit('), to = src.indexOf('  function penalty(');
const sections = new Set(E.SECTIONS.map(function (s) { return s.id; }));
const body = src.slice(from, to);   // the RULES table itself is in js/rules.js
const emitted = [...new Set([...body.matchAll(/id: '([a-z0-9]+)'/g)].map(function (m) { return m[1]; }))].sort();
const problems = [];
emitted.forEach(function (id) {
  const r = E.RULES[id];
  if (!r) { problems.push(id + ': emitted but has no entry in RULES'); return; }
  if (typeof r.name !== 'string' || !r.name) problems.push(id + ': no name');
  if (typeof r.weight !== 'number' || !(r.weight > 0)) problems.push(id + ': weight must be a positive number');
  if (!('reason' in r)) problems.push(id + ': reason missing (use null where a colour cannot change the rule)');
  if (r.section && !sections.has(r.section)) problems.push(id + ': unknown section "' + r.section + '"');
  if (!r.how) problems.push(id + ': how missing (the id of the passage in How it works that explains it)');
  else if (page.indexOf('id="' + r.how + '"') < 0) problems.push(id + ': its passage "' + r.how + '" is not in index.html');
  if (['perceptual', 'convention', 'possibility', 'context'].indexOf(r.kind) < 0) problems.push(id + ': kind must be perceptual, convention, possibility or context');
});
Object.keys(E.RULES).forEach(function (id) { if (emitted.indexOf(id) < 0) problems.push(id + ': entry for a rule no check emits'); });
if (problems.length) { console.error('RULES table: ' + problems.length + ' problem(s)\n  ' + problems.join('\n  ')); process.exit(1); }
const kinds = {}; emitted.forEach(function (id) { kinds[E.RULES[id].kind] = (kinds[E.RULES[id].kind] || 0) + 1; });
console.log('RULES table complete: ' + emitted.length + ' rules, each with a name, weight, reason, section, kind and a passage in How it works (' + Object.keys(kinds).map(function (k) { return kinds[k] + ' ' + k; }).join(', ') + ').');
