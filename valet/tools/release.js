/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — set the version everywhere it is written: node tools/release.js 1.9
   The version is in four places, which must agree (tests/version.js checks it):
   - VERSION in js/ui/main.js, which goes into saved profiles and outfit files;
   - the tag in the masthead (index.html, #verTag) and the line at the foot of the page;
   - the ?v= query on every script and style tag in index.html, so a returning visitor's browser
     fetches the new files instead of mixing cached old ones with new ones. */
'use strict';
const fs = require('fs'), path = require('path');
const v = process.argv[2];
if (!/^\d+\.\d+(\.\d+)?$/.test(v || '')) { console.error('usage: node tools/release.js <version>, for example 1.9 or 1.9.1'); process.exit(1); }
const root = path.join(__dirname, '..');
const edit = function (file, fn) {
  const p = path.join(root, file), before = fs.readFileSync(p, 'utf8'), after = fn(before);
  if (after !== before) fs.writeFileSync(p, after);
  return after !== before;
};
let n = 0;
edit('js/ui/main.js', function (s) { return s.replace(/const VERSION = '[^']*';/, function () { n++; return "const VERSION = '" + v + "';"; }); });
edit('index.html', function (s) {
  s = s.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)="[^"?]+\.(?:js|css))\?v=[^"]*"/g, function (m, a) { n++; return a + '?v=' + v + '"'; });
  s = s.replace(/(id="verTag"[^>]*>)v[^<]*</, function (m, a) { n++; return a + 'v' + v + '<'; });
  s = s.replace(/Version \d+(?:\.\d+)+\./, function () { n++; return 'Version ' + v + '.'; });
  return s;
});
console.log('Valet ' + v + ': ' + n + ' places set. Run node tests/run.js, and add an entry to the revision notes.');
