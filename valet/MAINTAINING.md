<!--
SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Maintaining Valet

A guide for whoever looks after Valet by hand. It explains how the code fits together, how to change or add a rule, and how to check that nothing else changed by accident. You need a text editor, a browser and Node.js (any recent version). There is nothing to install and no build step.

Read this once from start to finish. After that, the checklists in sections 4 and 6 are what you will use.

## 1. The ten-minute tour

Valet is one page, `index.html`, plus plain JavaScript files that it loads in order. There are no modules, frameworks or packages, so the page also opens straight from the folder (`file://`). Each file is wrapped in `(function () { ... })()` and puts its public parts on one object on `window`.

| I want to change… | File | Object |
|---|---|---|
| A number that decides a verdict (a threshold) | `js/rules.js`, `PARAMS` | `VRULES` |
| A rule's name, weight, kind, section or passage | `js/rules.js`, `RULES` | `VRULES` |
| What a rule checks, its score, its text, its fixes | `js/checks/`, one file per question of the card (`skin.js`, `contrast.js`, `pattern.js`, `collar.js`…) | `VENGINE.part` |
| The order the checks run in, and what they share | `js/engine.js`, `ORDER` and `checkOutfit` | `VENGINE` |
| How your colouring is read, the tiers, the palette | `js/engine.js`, top half | `VENGINE` |
| Suggestions, Choose the best colours, Keep this | `js/suggest.js` | `VENGINE` |
| The fixes under a check; Keep this, fix the rest and Choose the best colours (copying the engine's answer into the outfit); a change of garment type and what it takes off; what can be put on | `js/dress.js` (tested by `tests/fixes.js` against the page's record, `tests/fixes.json`) | `VDRESS` |
| Garments, cloths, occasions, what each piece is | `js/garments.js` | `VGARM` |
| The named colours, the demo profile | `js/data.js` | `VDATA` |
| What a pattern looks like from a distance | `js/patterns.js`, `js/vision.js` | `VPAT` |
| Colour maths (CIELAB, CIEDE2000, OKLCH) | `js/colour.js` | `VC` |
| Body survey, proportion targets, sizes | `js/body.js`, `js/proportion.js`, `js/fit.js` | `VBODY`, `VPROP`, `VFIT` |
| The explanation and its sources | `index.html`, `<article id="howArticle">` | |
| What a tab shows | `js/ui/you.js`, `palette.js`, `shape.js` (Proportion), `fit.js`, and the Dresser in five files: `dresser.js` (helpers, verdict, rows, types, checks, whole-outfit actions), `dresser-saved.js` (Saved outfits), `dresser-editor.js` (a piece's colour, cloth, pattern, distance), `dresser-acc.js` (accessories), `dresser-card.js` (printed card, `VWARD`) | `VAPP`; the Dresser's files share `VDRCORE` (written `DR.x`) |
| The "Why" and "Sources" bubbles | `js/ui/why.js` | |
| Reading colour from a photo; Colours from photos and My colours | `js/ui/photos.js` (the window, kept photos); the strip in `dresser-editor.js` | `VPHOTOS` |
| My garments: what goes with a garment, which colour to buy | `js/closet.js` (finding and counting outfits); `js/ui/closet.js` (the view) | `VCLOSET`, `VCLOSETUI` |
| Your marks (good, so-so, bad) on saved outfits | `js/outfit.js` (`outfitSig`, `disagrees`, kept by `normWardrobe`); `dresser-saved.js` (Saved outfits) | `VOUTFIT` |
| Start-up, the welcome window, How it works' contents list | `js/ui/main.js` | |
| The phone layout | `js/ui/mobile.js`, and `@media` blocks in `css/valet.css` | |

The rule is simple: **files in `js/` never touch the page**, so the tests can run them in Node. Files in `js/ui/` draw the page and call the logic.

## 2. How a check becomes a verdict

1. **Your colouring** is measured once (`analyseProfile` in `engine.js`): contrast, depth, warmth, vividness and the band of lightness steps that suits your face. It does not change while you dress.
2. **Each piece** is reduced to what is seen of it across a room (`look` in `engine.js`): the colour it adds up to (`mean`), its pattern and whether that reads as pattern or texture at 3 m (`visible`, `texture`).
3. **Each rule**, in one of the files of `js/checks/` that `checkOutfit` runs in turn, looks at one relationship and calls `add({...})` with a **score**:
   - `score < 0.5`: **fails** (counted in the verdict, with a fix where there is one);
   - `0.5 ≤ score < 0.85`: **to note**;
   - `score ≥ 0.85`: **passes** (often added with score 1 and a short sentence, so the card can say why it passed).
4. **The verdict** (`verdict` in `engine.js`): no fails is "Good outfit" or "Works"; one fail is "One fix away"; two or more is "Start again". A failing *possibility* rule (something that cannot be worn at all) is shown first.
5. **Suggestions** compare outfits with `penalty`: the sum of `(1 − score) × weight` over all checks, leaving out *context* checks. So a rule's `weight` in `RULES` decides how much it counts when Valet chooses colours, not whether it fails.

A rule's **kind** (in `RULES`) says how it counts:

- `perceptual`: what the eye measurably does (badge A or A/B);
- `convention`: tailoring and colour convention (badge B);
- `possibility`: what cannot be worn (a pocket square with no breast pocket);
- `context`: advice about what the outfit cannot change (your frames, your build). Shown, never counted.

A check's **level** (`'A'`, `'B'`, `'A/B'`) is the badge the reader sees. If you leave it out, `add` uses `'B'`.

## 3. Anatomy of a rule

Every rule lives in **four places**. The tests fail if they disagree.

**a. The registry entry**, in `js/rules.js`:

```js
socks: { name: 'the socks', weight: 0.6, reason: 'takes the trousers\' colour family',
         section: 'feet', kind: 'convention', how: 'r-socks' },
```

- `name`: how the verdict names it ("Fails on the socks").
- `weight`: how much it counts in suggestions (see 2.5). Most rules are 1; minor ones 0.3 to 0.6.
- `reason`: the phrase a suggestion gives when a colour mends this rule ("… takes the trousers' colour family"), or `null` when no colour change can mend it.
- `section`: which question of the Outfit Check card it is listed under in the Dresser (`skin`, `temperature`, `contrast`, `frame`, `sheen`, `pattern`, `metal`, `feet`, `colour`, `proportion`, `formality`, `season`; see `SECTIONS` in the same file). Without one, the check's `group` decides.
- `kind`: see section 2.
- `how`: the `id` of the passage in How it works that explains it. The Dresser's "Why" button opens it.

**b. Its thresholds**, in `PARAMS` in the same file, each with its badge and the section of How it works that explains it:

```js
sockFamilyHue: 35, sockLoudC: 0.2,   // B §10 socks in the trousers' colour family: hue within 35°; electric or neon from OKLCH chroma 0.2
```

Never write a deciding number straight into `engine.js`. Name it here, so it can be found, argued with and tested.

**c. The check**, in the file of `js/checks/` for its question: `skin.js`, `contrast.js`, `frame.js`, `colours.js`, `feet.js`, `square.js`, `accents.js`, `pattern.js`, `hat.js`, `whole.js` (sheen, formality, season), `collar.js`, `lines.js` (proportion) or `accessories.js`. Each is a classic script that registers one function with `E.part('name', function (ctx) { … })`; `checkOutfit` in `engine.js` runs them in the order of `ORDER`, and that is the order the findings are listed in. A new file needs three things: its name in `ORDER` (`js/engine.js`), a `<script>` tag after `engine.js` in `index.html` (`tests/scripts.js` fails if it is missing or out of order), and nothing else for the tests, which load the files through `tests/load.js`. Helpers shared with the engine come from `window.VENGINE.kit` (`look`, `scoreCached`, `okc`, `PARAMS`, `G`…), taken at the top of each file. Inside the function, from `ctx`, you have:

- `L[k]`: what is seen of the piece in position `k` (`shirt`, `jacket`, `tie`, `trousers`, `socks`, `shoes`, `square`…), or `undefined` if it is not worn. `L[k].mean` is its colour from a distance, `L[k].hex` its ground colour, `L[k].visible` true if its pattern reads at 3 m.
- `K[k]`: what kind of piece it is (from `garments.js`): `K.tie.knotted`, `K.jacket.pocket`, `K.shirt.frame` and so on.
- `p`: your analysed colouring (`p.band`, `p.contrastLevel`, and `p.season`, the season switch); `o.occasion` for the outfit.
- `out`: the findings so far, and `add`, which appends one.
- Helpers: `lum(hex)` (lightness L\*, from `ctx`), `okc(hex)` (OKLCH, from the kit), `VC.deltaE2000(VC.hexToLab(a), VC.hexToLab(b))` (colour difference), `nm(k)` (a piece's name for a sentence).

A check calls `add`:

```js
add({ id: 'socks', score: 0.45, slots: ['socks'], level: 'B',
      fixes: [{ label: 'Socks in the trousers\' colour', slot: 'socks', set: { hex: L.trousers.mean } }],
      text: 'Socks that match the shoes, not the trousers: …' });
```

- `id`: the key in `RULES`.
- `slots`: the pieces it is about (the Dresser highlights them, and Keep this uses them).
- `text`: one or two plain sentences. Say what you see, then what to do.
- `fixes` (optional, at most two are shown): buttons the Dresser offers. Each has a `label` and one action: `{ slot, set: { hex: … } }` changes a piece; `{ slot, on: false }` takes it off; `{ slot, kind: 'roll' }` changes its type; `{ slot, pat: { type: 'solid' } }` makes it plain; `{ acc: 'watch', set: {...} }` changes an accessory. A fix never touches a piece the user has locked.

**d. The passage**, in `index.html`, in the section of How it works the rule belongs to, as a list item with the `id` named in `how`:

```html
<li id="r-socks"><strong>Socks</strong> take the trousers, not the shoes … <span class="cite">[<a href="#ref-50">50</a>, p. 173]</span> …</li>
```

State the rule, its numbers and its sources. A web source gets `class="web"` on its link, so it shows in a dashed box. The opening sentences are what the "Why" bubble shows, so make the first one count.

## 4. Checklist: changing or adding a rule

1. **Decide what it rests on.** A (measured), B (convention, with a source you can cite, ideally a book) or A/B. If it is C (a popular system nobody has tested), it does not go in: add it to section 16 of How it works instead, saying why. If a convention contradicts a measured effect, the measurement wins.
2. **Write the passage first**, in How it works, with its source. If you cannot write it, the rule is not ready.
3. **Name its thresholds** in `PARAMS`, with badge and section.
4. **Add the registry entry** in `RULES`.
5. **Write the check** in the file of `js/checks/` for its question, next to the rules it belongs with.
6. **Add scenarios** in `tests/scenarios.js`: at least one outfit where it should fire and one where it should not. The helpers are `base({...})` (a plain smart-casual outfit you override), `P(hex, kind, cloth)` (a piece) and `T(name, outfit, [[/^id: /, true]])` (expect a note matching the pattern, or `false` for none):

   ```js
   T('socks that match brown shoes, not grey trousers: fails', base({socks:P(col('Chocolate'),'socks')}), [[/^socks: .*match the shoes/,true]]);
   ```

7. **If it has a threshold**, add a line to `tests/boundaries.js` (`flip(...)`): it measures the quantity in an outfit, moves the threshold just past it both ways and checks that the rule flips.
8. **Run the tests**: `node tests/run.js`, and `node tools/typecheck.js` (it catches a misspelt field such as `scroe` or `p.tempLevl`; a new field on a check or on your colouring, or a new member of the page's shared `window.VAPP`, is added to `types/valet.d.ts`). The regression test will now fail, listing outfits whose verdicts changed. **Read the list**: every change should be one you meant. Then record the new behaviour with `node tests/regression.js --update`.
9. **Look at it in the browser** (section 6).
10. **Write it down**: a short entry in the revision notes, and in the commit message.

**Check it against taste.** `node tests/taste.js` (also part of `tests/run.js`) judges about forty outfits that a well-dressed eye approved or crossed, and says which verdicts moved since it was recorded, towards or away from that eye. Do not tune a rule to this set alone: it is small and from one source. A change that moves several looks away from it needs a good reason, written in its passage. Record the new numbers with `node tests/taste.js --update` in the same commit.

To **change a threshold only**: edit `PARAMS` and the number in its passage, then steps 8 to 10.

**Check a rule change against your own marks.** The regression test says what changed; your marks say whether it changed for the better. Before the change, save your profile from the You tab (the file holds your saved outfits and their marks) and run `node tools/marks.js valet-yourname.json`. Run it again after the change, on the same file. It lists every outfit where you and Valet disagree (you call it good and Valet fails it, or you call it bad and Valet passes it) and which rules caused it. A change that adds disagreements is a change for the worse on your own clothes, whatever the theory says; one that removes them, without adding others, is evidence for it. Keep the file outside the repository: it is yours.

To **remove a rule**: delete its check, its `RULES` entry, its scenarios and boundary lines, and either delete its passage or say there why it was removed (readers may remember it). `tests/rules.js` reports a `RULES` entry that nothing emits.

## 5. A worked example: the plain pocket square (built in 1.15)

Flusser gives a rule Valet did not check until 1.15: *a plain pocket square only with a patterned tie* (*Dressing the Man*, p. 216). Here is how it went in, as a gentle note. Read it beside the code: `hank` in `js/rules.js` and the pocket-square block of `checkOutfit`.

1. **What it rests on:** B, one writer, with the page. A note, never a failure: score 0.7.
2. **Passage:** a sentence in `<li id="r-square">` with the page cited, and the rule taken out of the "not checked yet" paragraph in section 18 (`id="flusser-unchecked"`).
3. **Threshold:** none needed; "patterned" is `L.tie.visible`, "plain" is `!L.square.visible`.
4. **Registry:** a new id, `hank` ("the pocket square with the tie"), kind `convention`. It could not reuse `square`, because `square` is a *possibility* rule (a square needs a breast pocket), and a failing possibility rule makes the verdict "Not possible as set".
5. **Check**, in `js/checks/square.js`, after the test for a square cut from the tie's own cloth (`sqmatch`, a failure since 1.16.1), skipped for white linen:

   ```js
   if (sqPlain && tiePlain) add({ id: 'hank', score: 0.7, slots: ['square', 'tie'],
     text: 'A plain square with a plain tie: Flusser keeps the plain square for a patterned tie. A patterned square, or white linen, sits better here.' });
   ```

6. **Scenarios:** a plain square with a plain tie notes `hank`; a white linen square never does (see "the pocket square with the tie" in `tests/scenarios.js`).
7. **Run** `node tests/run.js`. The regression test lists every outfit that changed and counts the checks by id: here only `hank` should appear as new. Then `--update`.

A warning learnt in 1.15: adding a choice to a list the regression test draws from (a pattern allowed on a tie, say) changes the random outfits themselves, so nearly every outfit "changes". To see what the rules changed, compare on the same outfits: run the test once with the old lists and the new rules, read that, then update with the new lists.

## 6. Checking in the browser

The Node tests cover the logic, not the page. After any change to `index.html`, `css/` or `js/ui/`, open `index.html` and go through this list, on a wide window and on a narrow one (or your phone):

- the welcome window opens on a first visit (clear the site's storage to see it again);
- **Load the demo profile**; each tab opens without an error in the browser console (F12);
- on the Palette, **Next: try an outfit** leads to the Dresser; in the Dresser, **Choose the best colours**, **Undo** and a fix button work, and **Why** opens its passage;
- in the Dresser, open a piece and **Save to my garments**; under **My garments**, **What goes with it?** answers within a few seconds, and an outfit marked **Good** appears in **Saved outfits** with the mark;
- Proportion & fit: each garment button in Fit, and a **Sources** button;
- How it works: the contents list jumps to each section.

If you have Python, two tools do the clicking for you (each explains itself in its header):

- `tools/smoke.py` presses every visible button on every tab and reports console errors. It finds crashes, not wrong behaviour; it also switches through the four seasons and checks a season note and its fix.
- `tools/cssusage.py` reports the rules of `css/valet.css` that matched nothing during the smoke and flows walks. A candidate list, not a verdict: in 1.21 its 208 rules were all states no walk reaches (the printed cards, Colours from photos, a warning, a marked outfit), and every class it names is still written somewhere in the code, often built from parts (`'st-' + state`). Check a rule by hand before deleting it.
- `tools/fixes.py` records every fix button the Dresser offers for 60 seeded outfits in winter, summer and autumn, presses each, and writes the outfit and note it leaves into `tests/fixes.json`; since 1.22 it also presses Choose the best colours, and Keep this, fix the rest for each piece worn (969 presses). `node tests/fixes.js` (part of `tests/run.js`) replays that record through `js/dress.js`, so the fixes and both buttons stay tested without a browser. Each press of the two buttons costs the engine about a second, so the usual run presses a sample, the first two of every kind of answer and of every kind of change to a piece (18 presses); `node tests/fixes.js --all` presses all of them (about 15 minutes) and is worth running after a change to `E.rescue`, `E.complete` or the copying in `js/dress.js`. After changing a fix on purpose, record the page again with `python tools/fixes.py --update` (about 45 minutes) and commit the record with the change.
- `tools/flows.py` is the Dresser's regression test. It walks the routes a person takes through the Dresser (a piece's colour, cloth, pattern and second colour, its type and collar, a knit and a shoe, the fixes and Undo, the accessories, saving an outfit, My garments from both ends, Saved outfits), on a wide window and on a phone-sized one, and after every step records what the page shows: the outfit as stored, the saved garments and outfits, and each line of text visible in the Dresser. It compares that with `tests/flows.json`. Run it before and after any change to `js/ui/` or `css/`. A change meant to alter nothing visible, such as moving code between files, must pass unchanged; a change made on purpose shows as differences, step by step, and once you have read each one, `python tools/flows.py --update` records the new behaviour, to commit with the change. It takes about a minute. When you add a control to the Dresser, add a step for it (`python tools/flows.py --list` shows the steps), or the record cannot see it.

The record holds what the page showed, so a step whose control was renamed or moved is reported as a missing control, not skipped. Text is compared line by line; a long line is kept as its first words and a fingerprint, so a change inside it shows as a changed line without its full text.

## 7. Releasing

1. `node tools/release.js 1.11` (your version number). It writes the version to every place it appears, including the `?v=` on each file so browsers fetch the new ones.
2. `node tests/run.js` must say **all tests pass**.
3. Add an entry to the revision notes: what changed, why, and whether any verdict changed.
4. Commit, with the same summary.
5. To give someone a copy, make a zip without the git history (which carries every commit and your email address): `git archive --format=zip --prefix=valet/ HEAD -o valet.zip`.

## 8. Things that are easy to break

- **Text that differs on a phone.** Instructions written for a mouse ("Click", "Point at") have a touch version: `V.say(mouse, touch)` in JavaScript, or `data-touch="…"` on an element in the page. Write both.
- **Ids the code looks for.** Many elements in `index.html` are found by `id` (`#ovComplete`, `#welcomeDemo`…). Search the `js/` folder for an id before renaming it.
- **The order of scripts** at the bottom of `index.html`. A file can only use the objects of files loaded before it.
- **The speed of My garments.** Each outfit is judged by the full engine (about a quarter of a millisecond each), so the number of outfits tried decides how long an answer takes: about 1,600 outfits with 50 garments for a jacket, 6,500 for a hat. If you make the search try more (a new optional position in `CORE`, or the tie pass on more outfits), time it with a real wardrobe first. The search runs in small steps so the page stays responsive, and **Stop** ends it.
- **The "Why" and "Sources" maps** in `js/ui/why.js`. A new Proportion target or Fit size row needs a line there; `tests/why.js` tells you if it is missing.
- **No network.** The page's security settings forbid any connection, on purpose (privacy). Do not add fonts, libraries or images from the web; put them in the folder.
- **A combination from the literature.** When a source settles whether a combination works ("a cardigan over a shirt and tie", "never trainers with a suit"), add it to `tests/canon.js` with the source and page: `fine` if it is endorsed, `note` if it is advised against mildly, `mistake` if it is called wrong. The test fails while Valet judges it otherwise, which is the point: fix the rule, not the case. Keep the colours safe for the profile, so only the question the source settles is tested.
- **One list, one question.** Each list of options answers one question: the type says what the garment is, the cloth what it is made of, and a setting how it is made (a knit's gauge, a shoe's broguing, a shirt's collar). An option that answers two at once ("Chunky cable knit" among the yarns, "Derby or brogue" among the shoes, both until 1.19) leaves combinations nobody can choose, such as a chunky lambswool cardigan or a brogued oxford. Before adding an option, check it is not already one of the others, or a way of making one of them; if it is, it is a setting. When one is moved, migrate saved outfits in `normOutfit` so they judge as before, and keep their identity in `outfitSig` (see the chunky knit there).
- **A new setting on a piece** (like a trouser's `rise` or a shirt's `collar`): add it once, to `PIECE_FIELDS` in `js/garments.js`. From there it is kept with a garment (`js/closet.js`), replaced when a garment is worn (`js/ui/dresser.js`), passed to the engine (`engineOutfit`) and counted in an outfit's identity for marks (`outfitSig`, both in `js/outfit.js`). Two things are still by hand: checking its values in `normOutfit` (`js/outfit.js`), and the rule that reads it. Give it `sig: 'set'` and a `dflt`, so it counts in the identity only when set away from its default, or every outfit marked before loses its mark; and give it a default no rule judges, so outfits saved before read as they did (`tests/regression.js` shows whether they do).
- **When sources disagree.** For how to dress now, keep the rule with Flusser (*Dressing the Man*, ref. 50) and state the other view beside it. For what was worn in a period, sources of the time win: government orders and the trade press (refs. 83, 84) first, then Schoeffler and Gale (ref. 82), then Flusser's history and the websites. How it works, `#h-conflicts`, says this to users. Check a printed figure against a second source before using it: Schoeffler and Gale misprint the 1942 jacket limit (23¾ for 29¾, p. 27).
- **The season switch has four values** (`winter`, `spring`, `summer`, `autumn`), listed once in `js/garments.js` (`G.SEASONS4`) with `G.normSeason` (anything unknown is winter, used when a profile is loaded), `G.offSeason` and `G.inSeason` (what is out of season: the other end in winter and summer, nothing in spring and autumn), which the season rule and the Dresser's fixes both use. The skin each season uses is `E.SKIN_OF` in `js/engine.js` (spring the winter skin, autumn halfway). The order of saved-outfit groups is `O.seasonOrder`. Tests: tests/outfit.js (the helpers, and that the rule and the fixes agree), tests/scenarios.js (skin and the rule), tools/smoke.py (the switch in the page, a season note and its fix). Code that needs the two ends of the year (the profile card's comparison, the palette card) asks `SKIN_OF`, not `season === 'summer'`. Saved outfits are still filed by their cloth (winter, summer, all year, mixed).
- **Reference numbers.** Sources in How it works, section 19, are numbered in list order and cited as `[n]`. If you insert one in the middle, every later number moves: add new sources at the end of their group, or renumber all citations together.
