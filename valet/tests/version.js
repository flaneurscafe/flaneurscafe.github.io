/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the version is the same everywhere it is written (set it with node tools/release.js). */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), main = fs.readFileSync(path.join(root, 'js/ui/main.js'), 'utf8');
const found = {};
const note = function (where, v) { (found[v] = found[v] || []).push(where); };
note('VERSION in js/ui/main.js', (main.match(/const VERSION = '([^']*)';/) || [])[1]);
note('masthead tag', (html.match(/id="verTag"[^>]*>v([^<]*)</) || [])[1]);
note('foot of the page', (html.match(/Version (\d+(?:\.\d+)+)\./) || [])[1]);
const tags = html.match(/<(?:script|link)\b[^>]*\b(?:src|href)="[^"]+\.(?:js|css)[^"]*"/g) || [];
tags.forEach(function (t) { const f = t.match(/(?:src|href)="([^"?]+)(?:\?v=([^"]*))?"/); note(f[1], f[2]); });
// every local script in js/ is loaded by the page, and every loaded script exists
const loaded = tags.map(function (t) { return t.match(/(?:src|href)="([^"?]+)/)[1]; });
const missing = loaded.filter(function (f) { return !fs.existsSync(path.join(root, f)); });
const vs = Object.keys(found);
if (vs.length !== 1 || vs[0] === 'undefined' || missing.length) {
  console.log('FAIL version: ' + (missing.length ? 'missing files ' + missing.join(', ') + '; ' : '') + vs.map(function (v) { return v + ' in ' + found[v].slice(0, 4).join(', ') + (found[v].length > 4 ? ' …' : ''); }).join(' | '));
  process.exit(1);
}
console.log('version: ' + vs[0] + ' in all ' + found[vs[0]].length + ' places');
