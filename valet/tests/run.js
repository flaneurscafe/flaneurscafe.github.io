/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — all tests: node tests/run.js. Node.js only, no other dependencies. Exits 1 if any fails. */
'use strict';
const { execFileSync } = require('child_process'), path = require('path');
let failed = 0;
['version.js', 'units.js', 'outfit.js', 'rules.js', 'why.js', 'boundaries.js', 'scenarios.js', 'stress.js', 'regression.js'].forEach(function (f) {
  try { process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' })); }
  catch (e) { failed++; process.stdout.write((e.stdout || '') + (e.stderr || '')); console.log('FAILED: ' + f); }
});
console.log(failed ? failed + ' test file(s) failed' : 'all tests pass');
process.exit(failed ? 1 : 0);
