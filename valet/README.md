<!--
SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Valet

**Dressing from theory, not from cases.** Valet is a small web app that works out which colours suit you from colour science and the classic menswear rules, and checks whole outfits against them: colour, contrast, pattern, cloth, formality and season. It also turns your measurements into proportion targets and sizes. Every verdict says why it holds, and every rule is graded by its evidence: **A** for perception science, **B** for tailoring convention. Popular rules without evidence (**C**) are not used; the app explains why.

Try it: <https://flaneurs.cafe/valet/>

## Running it

There is nothing to build or install. Open `index.html` in a browser, from a web server or straight from the folder. Everything runs in the browser and nothing is uploaded: the photo stays on your computer, and your profile is kept in the browser's local storage until you save it to a file. The page makes no network requests.

## Licence

Valet is free software.

- **Code**: the HTML, CSS and JavaScript are licensed under the [GNU General Public License, version 3 or later](LICENSES/GPL-3.0-or-later.txt) (`GPL-3.0-or-later`). You may use, study, change and share it; anything you distribute that is built on it must be released under the same licence, with its source. This includes serving it on a website, since the code is sent to every visitor.
- **Text**: the article *How it works* (in `index.html`, the element `id="howArticle"`) is licensed under [Creative Commons Attribution-ShareAlike 4.0](LICENSES/CC-BY-SA-4.0.txt) (`CC-BY-SA-4.0`). You may share and adapt it, if you credit Valet and share your version under the same licence.

Each source file names its licence in an [SPDX](https://spdx.dev/) header.

### Commercial licences

The GPL lets anyone use Valet in open-source work. To use it in a closed or commercial product, ask for a separate licence through the [contact page](https://flaneurs.cafe/contact/).

## Contributing

Issues and suggestions are welcome. Because Valet is also offered under a separate commercial licence, please get in touch before sending larger changes, so we can agree how they are licensed.

Every outfit rule has one entry in the `RULES` table in `js/rules.js`: its name in verdicts, its weight, the reason a suggestion gives when it mends the rule, its section, and its kind (perceptual, convention, possibility or context), which decides how it counts in a verdict. A new rule needs an entry there. Thresholds are named in `PARAMS` beside it, with their badge and the section of How it works that explains them. The checks themselves are in `js/engine.js`.

`node tests/run.js` (Node.js only, no other dependencies) runs every test:
- the version is the same everywhere it is written (`tests/version.js`);
- unit tests of the colour science, the pattern visibility model, the body survey, the proportion targets and the size logic (`tests/units.js`), and of the outfit as data: making a file safe, its season, merging imports (`tests/outfit.js`);
- every rule has a complete entry (`tests/rules.js`), and every named threshold is wired to its rule and compares in the right direction (`tests/boundaries.js`);
- the rule scenarios (`tests/scenarios.js`), a stress test of thousands of random outfits (`tests/stress.js`), and a regression test that compares 800 fixed outfits with a stored record (`tests/regression.js`).

It also runs on GitHub for every change. When you change a rule on purpose, change its scenario with it, and record the new behaviour with `node tests/regression.js --update`, so the change shows in the same commit. To release, set the version with `node tools/release.js 1.9.1`: it writes it to every place it appears, including the `?v=` on each script, so returning visitors get the new files.

### How the code is organised

Plain scripts, loaded in order by `index.html`, with no build step, so the page also opens straight from the folder. Each file is wrapped in a function and shares one named object on `window`.

- **Logic, no page code** (`js/`), each testable in Node: `colour.js` (colorimetry), `vision.js` and `patterns.js` (what the eye can see of a pattern), `data.js` (the colour library), `garments.js` (garments, cloths, occasions), `rules.js` (the rule and threshold tables), `engine.js` (your colouring and the checks), `suggest.js` (suggestions, Choose the best colours, Keep this), `outfit.js` (the outfit as data), `body.js`, `proportion.js` and `fit.js` (the body survey, the targets and the sizes). `chart.js` builds the lightness chart.
- **The interface** (`js/ui/`): `core.js` (shared helpers, the profile, tabs), then one file per tab (`you.js`, `palette.js`, `dresser.js`, `shape.js` for Proportion, `fit.js` for Fit), `chart-host.js`, `main.js` (start-up), and `mobile.js` (the phone layout). The parts share `window.VAPP`. Instructions that differ on a touch screen are written both ways (`VAPP.say`, or `data-touch` in the page), and each tab announces its result with `VAPP.result`.

## Credits

- Body percentiles: ANSUR II, the 2012 US Army anthropometric survey (4,082 men), public data.
- The sources of every rule are listed in *How it works*, section *Sources*.

## Contact

Budgie Perruche, [Flâneurs' Café](https://flaneurs.cafe/): [contact page](https://flaneurs.cafe/contact/), or [@flaneurscafe@mstdn.social](https://mstdn.social/@flaneurscafe).

Source: <https://github.com/flaneurscafe/valet>

Copyright © 2026 Budgie Perruche.
