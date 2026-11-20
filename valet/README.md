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

Every outfit rule has one entry in the `RULES` table in `js/engine.js`: its name in verdicts, its weight, the reason a suggestion gives when it mends the rule, and its section. A new rule needs an entry there; Each entry also gives the rule's kind (perceptual, convention, possibility or context), which decides how it counts in a verdict; thresholds are named in `PARAMS` beside it, with their badge and the section of How it works that explains them. `node tests/run.js` (Node.js only, no other dependencies) checks that every rule has a complete entry; that every named threshold is wired to its rule and compares in the right direction (`tests/boundaries.js`); runs the rule scenarios in `tests/scenarios.js`, a stress test of thousands of random outfits, and a regression test that compares 800 fixed outfits with a stored record (`tests/regression.js`). It also runs on GitHub for every change. When you change a rule on purpose, change its scenario with it, and record the new behaviour with `node tests/regression.js --update`, so the change shows in the same commit.

## Credits

- Body percentiles: ANSUR II, the 2012 US Army anthropometric survey (4,082 men), public data.
- The sources of every rule are listed in *How it works*, section *Sources*.

## Contact

Budgie Perruche, [Flâneurs' Café](https://flaneurs.cafe/): [contact page](https://flaneurs.cafe/contact/), or [@flaneurscafe@mstdn.social](https://mstdn.social/@flaneurscafe).

Source: <https://github.com/flaneurscafe/valet>

Copyright © 2026 Budgie Perruche.
