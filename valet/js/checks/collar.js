/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: the shirt's collar with what is worn with it: a tie, a jacket, the occasion.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const G = X.G, suitWorn = X.suitWorn;

  /* The shirt's collar with what is worn with it (B), for a woven shirt, which records its collar (1.17).
     Each rule is the source's, and nothing is judged for a collar a source does not speak of:
     - Open under a jacket (Flusser, Dressing the Man, p. 273): a button-down's fastened points make it
       stand up round the neck and frame the face; a collar with no band (camp) slides down the neck,
       leaves the throat bare and looks dishevelled. A cravat or neckerchief fills the open neck, so then
       nothing is said.
     - A tab collar is made for a tie (Gentleman's Gazette, ref. 78: it "can only really be worn with a
       necktie"); a camp collar has no band to button under a knot.
     - Formality (Gentleman's Gazette): a button-down is a casual dress shirt, for a blazer, a sports
       jacket or a knit, not a suit (ref. 79; the formality ceiling in garments.js does the rest);
       a contrast (Winchester) collar is business dress, less suited to casual wear (ref. 80). */
  function collarChecks(o, L, K, LC, add, nm, out) {
    if (!L.shirt || !K.shirt.collars) return;
    // a tie or bow tie closes the collar; a cravat (ascot) is worn inside an open one
    const cs = G.collarOf(o.shirt), knotted = !!(L.tie && K.tie.knotted && K.tie.id !== 'cravat');
    const ad = function (c) { c.group = 'collar'; c.slots = c.slots || ['shirt']; return add(c); };
    if (cs.noBand && knotted) ad({ id: 'collartie', score: 0.3, slots: ['shirt', 'tie'],
      text: 'A ' + K.tie.name.toLowerCase() + ' with a camp collar: the collar has no band to button under a knot, and is cut to lie open (Flusser; Gentleman\'s Gazette keeps it for casual shirts). Take off the ' + K.tie.name.toLowerCase() + ', or wear a shirt with a standing collar.',
      fixes: [{ label: 'Take off the ' + K.tie.name.toLowerCase(), slot: 'tie', on: false }, { label: 'A semi-spread collar', slot: 'shirt', set: { collar: 'semispread' } }] });
    if (cs.tieOnly && !knotted) ad({ id: 'collartie', score: 0.45,
      text: 'A tab collar worn open: it is made to be worn with a tie, its tab joining the points under the knot, and not open at the neck (Gentleman\'s Gazette).',
      fixes: [{ label: 'A semi-spread collar', slot: 'shirt', set: { collar: 'semispread' } }, { label: 'Add a tie', slot: 'tie', kind: 'tie', set: { on: true } }] });
    // open under a tailored jacket, with nothing filling the neck
    if (!L.tie && L.jacket && K.jacket.frame === 'lapel') {
      if (cs.open === 'stands') ad({ id: 'collaropen', score: 1,
        text: 'A button-down worn open under a jacket: its fastened points stand up round the neck and frame the face (Flusser).' });
      else if (cs.open === 'falls') ad({ id: 'collaropen', score: 0.65,
        text: 'A camp collar worn open under a jacket: with no collar band it slides down the neck and leaves the throat bare, which looks dishevelled (Flusser). A button-down stands up instead; a neckerchief fills the space.',
        fixes: [{ label: 'A button-down collar', slot: 'shirt', set: { collar: 'buttondown' } }] });
    }
    // formality: the ceiling in garments.js already lowers the shirt; say why where the general rules do not
    const C = { jacket: L.jacket ? G.cloth('jacket', o.jacket) : null, trousers: L.trousers ? G.cloth('trousers', o.trousers) : null };
    const occSaid = out.some(function (c) { return (c.id === 'occasion' || c.id === 'formal') && c.score < 0.85 && (c.slots || []).indexOf('shirt') >= 0; });
    if (cs.id === 'buttondown' && suitWorn(o, L, K, C) && !occSaid) ad({ id: 'collarformal', score: 0.65,
      text: 'A button-down with a suit: Gentleman\'s Gazette calls it a very informal dress shirt, worn with a blazer, a sports jacket or a knit and nothing more formal (it allows a summer suit). A point or semi-spread collar suits the suit.',
      fixes: [{ label: 'A semi-spread collar', slot: 'shirt', set: { collar: 'semispread' } }, { label: 'A point collar', slot: 'shirt', set: { collar: 'point' } }] });
    if (LC && o.occasion === 'casual') ad({ id: 'collarformal', score: 0.7,
      text: 'A contrast collar (' + LC.name.toLowerCase() + ') for a casual outfit: Gentleman\'s Gazette finds a Winchester shirt slightly more formal than one with a self collar, well suited to business wear and less so to casual wear.',
      fixes: [{ label: 'A collar in the shirt\'s own colour', slot: 'shirt', set: { collarHex: null } }] });
    else if (LC && knotted) ad({ id: 'collarformal', score: 1,
      text: 'A contrast collar (' + LC.name.toLowerCase() + ') with a ' + K.tie.name.toLowerCase() + ': the plain collar is a neutral background for the knot (Gentleman\'s Gazette).' });

    /* What Valet cannot see, said as advice (collarhint: information, never counted). Where a source gives
       a test, the advice is that test to do in a mirror; where no source speaks, the text says so. Only for
       a collar that has been chosen: a shirt saved without one is read as before. */
    if (!o.shirt.collar || !G.collarBy[o.shirt.collar]) return;
    const hint = function (text) { ad({ id: 'collarhint', score: 1, text: text }); };
    const cn = cs.name.toLowerCase(), tall = o.shirt.collarBand === 'tall';
    // open under a jacket: only the button-down and the bandless collar have a source (above)
    if (!L.tie && L.jacket && K.jacket.frame === 'lapel' && !cs.open && !cs.tieOnly)
      hint('Not judged: no source says how a ' + cn + ' collar behaves worn open. Flusser\'s test for any open collar is that it still frames the face: in a mirror, see whether the points stand up round the neck or fall flat onto the lapels. ' +
        (tall ? 'A tall band helps them stand.' : 'If they fall, a button-down or a taller band holds better.'));
    // the knot is not recorded; its tests are in How it works, not repeated on every outfit with a tie (1.18)
    // a contrast collar: Permanent Style on the tie, and on the jacket; nothing on wearing it open
    if (LC && knotted) hint('Valet cannot judge the tie for a contrast collar. Permanent Style: a tie dark or colourful enough draws the eye from the white collar; a pale or plain one is not strong enough, and the collar dominates.');
    else if (LC) hint('Not judged: no source covers a contrast collar worn ' + (L.tie ? 'with a cravat' : 'without a tie') + '; Gentleman\'s Gazette shows it only with a tie.' + (L.jacket ? '' : ' Permanent Style finds it looks a lot better with the jacket kept on.'));
  }

  E.part('collar', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, L = ctx.L, K = ctx.K, LC = ctx.LC, out = ctx.out, add = ctx.add, nm = ctx.nm;
    if (!o.study) collarChecks(o, L, K, LC, add, nm, out);
  });
})();
