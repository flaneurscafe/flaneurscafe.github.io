/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — index.html loads every script the app needs, in an order that works: each file of js/checks/
   once, after engine.js and in the engine's ORDER, and no check file that ORDER does not name. The
   tests load the same files through tests/load.js, so a file missing from the page would pass the
   tests and break only in the browser; this catches it. */
'use strict';
const fs = require('fs'), path = require('path');
require('./load')(['colour', 'vision', 'patterns', 'data', 'garments', 'rules', 'engine']);
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
const problems = [];
const at = f => srcs.indexOf(f), eng = at('js/engine.js');
let prev = eng;
window.VENGINE.ORDER.forEach(n => {
  const f = 'js/checks/' + n + '.js', i = at(f);
  if (i < 0) problems.push(f + ' is not loaded by index.html');
  else if (i < prev) problems.push(f + ' is loaded out of order (after engine.js, in ORDER)');
  else prev = i;
  if (srcs.filter(s => s === f).length > 1) problems.push(f + ' is loaded twice');
});
const files = fs.readdirSync(path.join(__dirname, '..', 'js', 'checks')).filter(f => f.endsWith('.js'));
files.forEach(f => { if (window.VENGINE.ORDER.indexOf(f.replace(/\.js$/, '')) < 0) problems.push('js/checks/' + f + ' is not in the engine\'s ORDER, so it never runs'); });
srcs.forEach(s => { if (!fs.existsSync(path.join(__dirname, '..', s))) problems.push(s + ' is in index.html but does not exist'); });
if (problems.length) { console.log('scripts: ' + problems.length + ' problem(s)'); problems.forEach(p => console.log('  ' + p)); process.exit(1); }
console.log('scripts: index.html loads all ' + srcs.length + ' scripts, the ' + files.length + ' checks in order');
