/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — loads the app's classic scripts into Node the way index.html loads them into the page:
   each name is a file in js/, and 'engine' also brings the files of js/checks/, in the engine's
   ORDER. Every test and tool loads the scripts through this, so a new file is added in one place. */
'use strict';
const path = require('path');
module.exports = function load(names) {
  if (!global.window) global.window = {};
  names.forEach(function (n) {
    require(path.join(__dirname, '..', 'js', n + '.js'));
    if (n === 'engine') window.VENGINE.ORDER.forEach(function (c) { require(path.join(__dirname, '..', 'js', 'checks', c + '.js')); });
  });
};
