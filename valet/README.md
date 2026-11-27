<!--
SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Valet

**Dressing from theory, not from cases.** Valet is a small web app that works out which colours suit you from colour science and the classic menswear rules, and checks whole outfits against them: colour, contrast, pattern, cloth, formality and season. It also turns your measurements into proportion targets and sizes. Every verdict says why it holds, and every rule is graded by its evidence: **A** for perception science, **B** for tailoring convention. Popular rules without evidence (**C**) are not used; the app explains why.

Try it: <https://flaneurs.cafe/valet/>

## Running it

There is nothing to build or install. Open `index.html` in a browser, from a web server or straight from the folder. Everything runs in the browser and nothing is uploaded: the photo stays on your computer, and your profile is kept in the browser's local storage until you save it to a file. The page makes no network requests.

## How it was made

Valet was built by one person working with an AI assistant, Claude (made by Anthropic), from the first version to this one. The idea and the framework are mine: that style advice can be split into perception science, convention and folklore, that each rule must say which it is, and that measurement beats convention where they disagree. So are the decisions about what goes in, my own Style Guide and Outfit Check card that many conventions started from, and the testing on my own wardrobe. Claude did most of the work of turning that into a working tool. It found the rules in studies, in books and on menswear sites and wrote each one into the framework with its source and evidence badge. It also wrote the code, the tests and most of the text of *How it works*. Working alone, I would not have had the time to do that.

The machine's word is not what any verdict rests on. Every rule names its source, and the sources were checked against the originals: *Dressing the Man* page by page, every website against the page itself, every study against the paper. Claims that did not survive that check were dropped, including some proposed by AI, and errors made in earlier versions of Valet itself. Every deciding number is named, with its evidence badge, in `js/rules.js`. The tests check that each rule, its threshold and its explanation agree, and that 800 recorded outfits keep their verdicts. Nothing is hidden: you can read every rule and its reasons in *How it works*, and argue with it.

So far the testing is mine alone: I check its verdicts against my own wardrobe, my own face in daylight and my own eye. That catches plain mistakes, but it is one face, one wardrobe and one judge, so it says little about whether a threshold is right for anyone else. A proper test of Valet's thresholds against what many people actually see has not been done yet (How it works, section 1, describes how it could be). Until then, treat its verdicts as reasoned advice, not measurements of beauty.

## Licence

Valet is free software.

- **Code**: the HTML, CSS and JavaScript are licensed under the [GNU General Public License, version 3 or later](LICENSES/GPL-3.0-or-later.txt) (`GPL-3.0-or-later`). You may use, study, change and share it; anything you distribute that is built on it must be released under the same licence, with its source. This includes serving it on a website, since the code is sent to every visitor.
- **Text**: the article *How it works* (in `index.html`, the element `id="howArticle"`) is licensed under [Creative Commons Attribution-ShareAlike 4.0](LICENSES/CC-BY-SA-4.0.txt) (`CC-BY-SA-4.0`). You may share and adapt it, if you credit Valet and share your version under the same licence.

Each source file names its licence in an [SPDX](https://spdx.dev/) header.

### Commercial licences

The GPL lets anyone use Valet in open-source work. To use it in a closed or commercial product, ask for a separate licence through the [contact page](https://flaneurs.cafe/contact/).

## Contributing

Issues and suggestions are welcome. Because Valet is also offered under a separate commercial licence, please get in touch before sending larger changes, so we can agree how they are licensed.

**[MAINTAINING.md](MAINTAINING.md)** is the guide for looking after Valet by hand: a map of the code, how a check becomes a verdict, the anatomy of a rule, a checklist for changing or adding one (with a worked example), the browser check and the release steps. In brief:

Every outfit rule has one entry in the `RULES` table in `js/rules.js`: its name in verdicts, its weight, the reason a suggestion gives when it mends the rule, its section, and its kind (perceptual, convention, possibility or context), which decides how it counts in a verdict. A new rule needs an entry there. Thresholds are named in `PARAMS` beside it, with their badge and the section of How it works that explains them. The checks themselves are in `js/engine.js`.

`node tests/run.js` (Node.js only, no other dependencies) runs every test:
- the version is the same everywhere it is written (`tests/version.js`), and the page loads every script, the checks after the engine and in its order (`tests/scripts.js`);
- unit tests of the colour science, the pattern visibility model, the body survey, the proportion targets and the size logic (`tests/units.js`), and of the outfit as data: making a file safe, its season, merging imports (`tests/outfit.js`);
- My garments: the list made safe, the outfits found around a garment (each judged exactly as the Dresser judges it), the colour-to-buy comparison, your marks and the marks report (`tests/closet.js`);
- every rule has a complete entry (`tests/rules.js`), and every named threshold is wired to its rule and compares in the right direction (`tests/boundaries.js`);
- combinations from the literature (`tests/canon.js`): outfits Flusser and Gentleman's Gazette endorse or call mistakes, each with its source and page, which Valet must judge as the source does;
- the rule scenarios (`tests/scenarios.js`), a stress test of thousands of random outfits (`tests/stress.js`), and a regression test that compares 800 fixed outfits with a stored record (`tests/regression.js`).
- taste (`tests/taste.js`): how often Valet agrees with a well-dressed eye, on outfits Gentleman's Gazette's presenters wear in published photos (colours only; no photos or names are kept). A number to watch, not a test to pass: it never fails the run, and it lists the looks whose verdict moved since it was recorded (`--update` to record).

`python tools/flows.py` is another, for the page: it walks the Dresser's routes in a headless browser, on a wide window and a phone-sized one, and compares what each step shows with a stored record (`tests/flows.json`; MAINTAINING.md, section 6). It needs Python and Playwright, so it is not part of `node tests/run.js` either.

`node tools/typecheck.js` is a separate check for development: TypeScript's compiler reads the plain JavaScript (every file in `js/`, `js/checks/` and `js/ui/`, which start with `// @ts-check`) against the shapes in `types/valet.d.ts` and reports a misspelt field or a wrong type. Nothing is compiled; the page runs the same files. It needs TypeScript, installed with npm or fetched once by npx, so it is not part of `node tests/run.js`.

It also runs on GitHub for every change. When you change a rule on purpose, change its scenario with it, and record the new behaviour with `node tests/regression.js --update`, so the change shows in the same commit. To release, set the version with `node tools/release.js <version>`: it writes it to every place it appears, including the `?v=` on each script, so returning visitors get the new files.

To see where your own judgement and Valet's disagree, mark outfits good, so-so or bad in the Dresser (My garments, Saved outfits), save your profile from the You tab, and run `node tools/marks.js valet-yourname.json`. Run it before and after changing a rule.

### How the code is organised

Plain scripts, loaded in order by `index.html`, with no build step, so the page also opens straight from the folder. Each file is wrapped in a function and shares one named object on `window`.

- **Logic, no page code** (`js/`), each testable in Node: `colour.js` (colorimetry), `vision.js` and `patterns.js` (what the eye can see of a pattern), `data.js` (the colour library), `garments.js` (garments, cloths, occasions), `rules.js` (the rule and threshold tables), `engine.js` (your colouring and the checks), `suggest.js` (suggestions, Choose the best colours, Keep this), `outfit.js` (the outfit as data, and your marks), `closet.js` (My garments: the outfits your clothes make), `body.js`, `proportion.js` and `fit.js` (the body survey, the targets and the sizes). `chart.js` builds the lightness chart.
- **The interface** (`js/ui/`): `core.js` (shared helpers, the profile, tabs), then one file per tab (`you.js`, `palette.js`, `dresser.js`, `shape.js` for Proportion, `fit.js` for Fit), `photos.js` (reading colour from a photo, and the Colours from photos window behind My colours), `closet.js` (the My garments view), `chart-host.js`, `main.js` (start-up), and `mobile.js` (the phone layout). The parts share `window.VAPP`. Instructions that differ on a touch screen are written both ways (`VAPP.say`, or `data-touch` in the page), and each tab announces its result with `VAPP.result`.

## Credits

- Body percentiles: ANSUR II, the 2012 US Army anthropometric survey (4,082 men), public data.
- The sources of every rule are listed in *How it works*, section *Sources*.

## Contact

Budgie Perruche, [Flâneurs' Café](https://flaneurs.cafe/): [contact page](https://flaneurs.cafe/contact/), or [@flaneurscafe@mstdn.social](https://mstdn.social/@flaneurscafe).

Source: <https://github.com/flaneurscafe/valet>

Copyright © 2026 Budgie Perruche.
