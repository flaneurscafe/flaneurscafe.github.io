/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the development type check: TypeScript's compiler reads the plain JavaScript files that start
   with // @ts-check (every file in js/ and js/checks/; the page's own code in js/ui/ is not yet) against
   the shapes in types/valet.d.ts, and reports a misspelt field, a wrong type or an unknown name. Nothing
   is compiled or shipped: the page runs the same files from file://.
   Run: node tools/typecheck.js. It uses a TypeScript installed with npm if there is one, and otherwise
   fetches it once with npx (which needs the network). It is not part of node tests/run.js, which needs
   nothing but Node. */
'use strict';
const path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), cfg = path.join(root, 'tsconfig.json');
let tsc = null;
try { tsc = require.resolve('typescript/bin/tsc', { paths: [root, process.cwd()] }); } catch (e) { /* not installed: use npx */ }
const r = tsc
  ? cp.spawnSync(process.execPath, [tsc, '-p', cfg], { stdio: 'inherit' })
  : cp.spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', '-p', 'typescript@5', 'tsc', '-p', cfg], { stdio: 'inherit' });
if (r.error) { console.error('typecheck: could not run TypeScript (' + r.error.message + '). Install it with: npm install --no-save typescript@5'); process.exit(1); }
if (r.status === 0) console.log('typecheck: no type errors in the files marked // @ts-check');
process.exit(r.status);
