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
| What a rule checks, its score, its text, its fixes | `js/engine.js`, `checkOutfit` | `VENGINE` |
| How your colouring is read, the tiers, the palette | `js/engine.js`, top half | `VENGINE` |
| Suggestions, Choose the best colours, Keep this | `js/suggest.js` | `VENGINE` |
| Garments, cloths, occasions, what each piece is | `js/garments.js` | `VGARM` |
| The named colours, the demo profile | `js/data.js` | `VDATA` |
| What a pattern looks like from a distance | `js/patterns.js`, `js/vision.js` | `VPAT` |
| Colour maths (CIELAB, CIEDE2000, OKLCH) | `js/colour.js` | `VC` |
| Body survey, proportion targets, sizes | `js/body.js`, `js/proportion.js`, `js/fit.js` | `VBODY`, `VPROP`, `VFIT` |
| The explanation and its sources | `index.html`, `<article id="howArticle">` | |
| What a tab shows | `js/ui/you.js`, `palette.js`, `shape.js` (Proportion), `fit.js`, `dresser.js` | `VAPP` |
| The "Why" and "Sources" bubbles | `js/ui/why.js` | |
| Start-up, the welcome window, How it works' contents list | `js/ui/main.js` | |
| The phone layout | `js/ui/mobile.js`, and `@media` blocks in `css/valet.css` | |

The rule is simple: **files in `js/` never touch the page**, so the tests can run them in Node. Files in `js/ui/` draw the page and call the logic.

## 2. How a check becomes a verdict

1. **Your colouring** is measured once (`analyseProfile` in `engine.js`): contrast, depth, warmth, vividness and the band of lightness steps that suits your face. It does not change while you dress.
2. **Each piece** is reduced to what is seen of it across a room (`look` in `engine.js`): the colour it adds up to (`mean`), its pattern and whether that reads as pattern or texture at 3 m (`visible`, `texture`).
3. **Each rule** inside `checkOutfit` looks at one relationship and calls `add({...})` with a **score**:
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

**c. The check**, in `checkOutfit` in `js/engine.js`. The function is long but flat: one block per rule, grouped under comments (`/* --- colour --- */`, `/* --- pattern --- */`, `/* --- accessories --- */` and so on). Inside it you have:

- `L[k]`: what is seen of the piece in position `k` (`shirt`, `jacket`, `tie`, `trousers`, `socks`, `shoes`, `square`…), or `undefined` if it is not worn. `L[k].mean` is its colour from a distance, `L[k].hex` its ground colour, `L[k].visible` true if its pattern reads at 3 m.
- `K[k]`: what kind of piece it is (from `garments.js`): `K.tie.knotted`, `K.jacket.pocket`, `K.shirt.frame` and so on.
- `p`: your analysed colouring (`p.band`, `p.contrastLevel`, and `p.season`, the season switch); `o.occasion` for the outfit.
- Helpers: `lum(hex)` (lightness L\*), `okc(hex)` (OKLCH), `VC.deltaE2000(VC.hexToLab(a), VC.hexToLab(b))` (colour difference), `nm(k)` (a piece's name for a sentence).

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
5. **Write the check** in `checkOutfit`, next to the rules it belongs with.
6. **Add scenarios** in `tests/scenarios.js`: at least one outfit where it should fire and one where it should not. The helpers are `base({...})` (a plain smart-casual outfit you override), `P(hex, kind, cloth)` (a piece) and `T(name, outfit, [[/^id: /, true]])` (expect a note matching the pattern, or `false` for none):

   ```js
   T('socks that match brown shoes, not grey trousers: fails', base({socks:P(col('Chocolate'),'socks')}), [[/^socks: .*match the shoes/,true]]);
   ```

7. **If it has a threshold**, add a line to `tests/boundaries.js` (`flip(...)`): it measures the quantity in an outfit, moves the threshold just past it both ways and checks that the rule flips.
8. **Run the tests**: `node tests/run.js`. The regression test will now fail, listing outfits whose verdicts changed. **Read the list**: every change should be one you meant. Then record the new behaviour with `node tests/regression.js --update`.
9. **Look at it in the browser** (section 6).
10. **Write it down**: a short entry in the revision notes, and in the commit message.

To **change a threshold only**: edit `PARAMS` and the number in its passage, then steps 8 to 10.

To **remove a rule**: delete its check, its `RULES` entry, its scenarios and boundary lines, and either delete its passage or say there why it was removed (readers may remember it). `tests/rules.js` reports a `RULES` entry that nothing emits.

## 5. A worked example, not yet built

Flusser gives a rule Valet does not check (How it works, section 18): *a plain pocket square only with a patterned tie* (*Dressing the Man*, p. 216). Here is how it would go in, as a gentle note.

1. **What it rests on:** B, one writer. A note, never a failure: score 0.7.
2. **Passage:** add a sentence to `<li id="r-square">`, and take it out of the "not checked yet" paragraph in section 18.
3. **Threshold:** none needed; "patterned" is `L.tie.visible`, "plain" is `!L.square.visible`.
4. **Registry:** none new; it is part of the `square` rule, so it reuses `id: 'square'`.
5. **Check**, in the pocket-square block of `checkOutfit`, after the "bought as a set" test:

   ```js
   else if (L.tie && K.tie.knotted && !L.square.visible && !L.tie.visible && !white)
     add({ id: 'square', score: 0.7, slots: ['square', 'tie'],
           text: 'A plain square with a plain tie: Flusser keeps the plain square for a patterned tie. A patterned square, or white linen, sits better here.' });
   ```

6. **Scenarios:** a plain burgundy square with a plain navy tie should note `square`; the same square with a striped tie should not; a white square never should.
7. **Run** `node tests/run.js`, read which regression outfits changed (only ones with a plain square and a plain tie should), then `--update`.

## 6. Checking in the browser

The Node tests cover the logic, not the page. After any change to `index.html`, `css/` or `js/ui/`, open `index.html` and go through this list, on a wide window and on a narrow one (or your phone):

- the welcome window opens on a first visit (clear the site's storage to see it again);
- **Load the demo profile**; each tab opens without an error in the browser console (F12);
- on the Palette, **Next: try an outfit** leads to the Dresser; in the Dresser, **Choose the best colours**, **Undo** and a fix button work, and **Why** opens its passage;
- Proportion & fit: each garment button in Fit, and a **Sources** button;
- How it works: the contents list jumps to each section.

If you have Python, `tools/smoke.py` does the clicking for you and reports console errors (see its header).

## 7. Releasing

1. `node tools/release.js 1.11` (your version number). It writes the version to every place it appears, including the `?v=` on each file so browsers fetch the new ones.
2. `node tests/run.js` must say **all tests pass**.
3. Add an entry to the revision notes: what changed, why, and whether any verdict changed.
4. Commit, with the same summary.

## 8. Things that are easy to break

- **Text that differs on a phone.** Instructions written for a mouse ("Click", "Point at") have a touch version: `V.say(mouse, touch)` in JavaScript, or `data-touch="…"` on an element in the page. Write both.
- **Ids the code looks for.** Many elements in `index.html` are found by `id` (`#ovComplete`, `#welcomeDemo`…). Search the `js/` folder for an id before renaming it.
- **The order of scripts** at the bottom of `index.html`. A file can only use the objects of files loaded before it.
- **The "Why" and "Sources" maps** in `js/ui/why.js`. A new Proportion target or Fit size row needs a line there; `tests/why.js` tells you if it is missing.
- **No network.** The page's security settings forbid any connection, on purpose (privacy). Do not add fonts, libraries or images from the web; put them in the folder.
- **Reference numbers.** Sources in How it works, section 19, are numbered in list order and cited as `[n]`. If you insert one in the middle, every later number moves: add new sources at the end of their group, or renumber all citations together.
