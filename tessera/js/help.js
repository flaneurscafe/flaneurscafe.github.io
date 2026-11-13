/* Tessera · How it works, About (version) and the original text */
'use strict';

/* ---------- explanation overlay ---------- */
const helpOv = $('helpOv');
function openHelp(anchor) {
  helpOv.hidden = false; document.body.style.overflow = 'hidden'; $('helpClose').focus();
  const t = anchor && document.getElementById(anchor); $('helpBody').scrollTop = t ? t.offsetTop - 10 : 0;
}
function closeHelp() { helpOv.hidden = true; document.body.style.overflow = ''; $('openHelp').focus(); }
$('openHelp').onclick = () => openHelp(); $('helpClose').onclick = closeHelp;
$('helpBody').addEventListener('click', e => { const a = e.target.closest('a[data-go]'); if (a) { e.preventDefault(); const t = document.getElementById(a.dataset.go); if (t) $('helpBody').scrollTop = t.offsetTop - 10; } });
/* ---------- version and information ---------- */
const TESSERA_VERSION = '1.0';
(() => { const ov = $('infoOv'), open = () => { ov.hidden = false; $('infoClose').focus(); }, close = () => { ov.hidden = true; $('verTag').focus(); };
  $('verTag').onclick = open; $('infoClose').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('infoHelp').onclick = e => { e.preventDefault(); ov.hidden = true; openHelp(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) close(); }); })();

helpOv.addEventListener('click', e => { if (e.target === helpOv) closeHelp(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !helpOv.hidden && $('prefOv').hidden) closeHelp(); });
$('tileNote').addEventListener('click', e => { if (e.target.closest('a[data-help]')) { e.preventDefault(); openHelp(e.target.closest('a').dataset.help); } });
$('status').addEventListener('click', e => { if (e.target.closest('a[data-help]')) { e.preventDefault(); openHelp(e.target.closest('a').dataset.help); } });
/* ---------- the original text (cover, title page, preface) ---------- */
(() => {
  const S_ = (w, n) => `<span class="sic">${w}</span> <span class="sicnote">[sic]</span><sup class="n"><a href="#pn${n}">${n}</a></sup>`;
  const N = n => `<sup class="n"><a href="#pn${n}">${n}</a></sup>`;
  const rows = [
    ['sec', 'Couverture', 'Cover'],
    ['p', `Librairie / Centrale des Beaux-Arts / 13, Rue La Fayette / Paris / <i>Combinaisons ornementales</i> / par ${S_('M.M.', 1)} / M.P. Verneuil / G. Auriol / et / Mucha`,
          `Librairie Centrale des Beaux-Arts, 13 rue La Fayette, Paris. <i>Ornamental Combinations</i>, by Messrs M. P. Verneuil, G. Auriol and Mucha.`],
    ['sec', 'Page de titre (planche 1)', 'Title page (plate 1)'],
    ['p', `<i>Combinaisons ornementales</i> / se multipliant à l'infini${N(2)} à l'aide du miroir / Dessins de / ${S_('M.M.', 1)} P. Verneuil – G. Auriol et A. Mucha. / Paris / Librairie Centrale des Beaux Arts / 13. ${S_('Rue de Lafayette', 3)}`,
          `<i>Ornamental Combinations</i>, multiplying to infinity${N(2)} with the help of the mirror. Designs by Messrs P. Verneuil, G. Auriol and A. Mucha. Paris, Librairie Centrale des Beaux-Arts, 13 rue La Fayette.`],
    ['sec', 'Préface (planche 2 et page suivante) : <i>De l’emploi du miroir</i>', 'Preface (plate 2 and the following page): <i>On the use of the mirror</i>'],
    ['p', `La nécessité où se trouve le décorateur de varier à l'infini les motifs des ornementations qui lui sont demandées, a conduit les esprits curieux à rechercher un moyen pratique, simple et rapide d'arriver à ce résultat.`,
          `The decorator constantly has to vary, without end, the motifs of the ornament he is asked for. This need has led curious minds to look for a practical, simple and quick way of doing it.`],
    ['p', `Les jeux de glaces${N(4)} sont en ce cas d'un secours inappréciable, ${S_("soit que l'on veuille se rendre compte de l'effet d'un motif redoublé, soit pour trouver", 5)} rapidement des coins de bordures, soit enfin pour chercher des motifs d'ornementation plus ou moins compliqués.`,
          `For this, arrangements of mirrors${N(4)} are an invaluable help: to judge the effect of a repeated motif, to find the corners of borders quickly, or to search for ornamental motifs, simple or complicated.`],
    ['p', `Chacun verra du reste rapidement tout ce que l'on peut tirer de ce procédé ingénieux, que nous n'avons certes pas la prétention d'avoir inventé.`,
          `Everyone will soon see how much can be drawn from this ingenious process, which we certainly do not claim to have invented.`],
    ['p', `Le kaléidoscope, dont s'émerveillent les enfants, ne repose pas sur un autre principe. Nous avons encore simplifié celui-ci.${N(6)}`,
          `The kaleidoscope, which children marvel at, works on exactly the same principle, and we have simplified it further.${N(6)}`],
    ['p', `Alors que le kaléidoscope est composé de trois glaces fixes réunies en triangle, nous nous servons simplement de deux glaces réunies par une charnière nous permettant de faire varier l'angle formé par les deux surfaces réfléchissantes.`,
          `A kaleidoscope has three fixed mirrors joined in a triangle. We simply use two mirrors joined by a hinge, which lets us change the angle between the two reflecting surfaces.`],
    ['p', `Suivant le cas et le résultat à obtenir, nous promenons${N(7)} nos glaces à la surface des dessins dont les éléments doivent nous servir à en reconstituer d'autres différents.`,
          `Depending on the case and the result we want, we move${N(7)} our mirrors over the surface of drawings, whose elements then serve to build up new and different ones.`],
    ['fig', `[Figure 1 : le cadran — cercle, lignes B A B, charnière O, rayons numérotés 1, 3, 4, 5, 6, 7, 8.] <button class="tryfig" data-fig="dial">Essayer dans l'outil</button>`,
            `[Figure 1: the dial — circle, lines B A B, hinge O, rays numbered 1, 3, 4, 5, 6, 7, 8.] <button class="tryfig" data-fig="dial">Try it in the tool</button>`],
    ['p', `Quelques exemples, mieux que tout, nous fixeront sur les résultats obtenus. Voyons la circonférence ci-contre, dans laquelle deux lignes B A B ont été tracées. Plaçons notre charnière en O. ${S_("Nous voyons qu'alors nos glaces prennent", 8)} les positions 1.O.1, 3.O.3, 4.O.4, etc., nous obtenons des figures basées sur le triangle, le carré, le pentagone, l'hexagone, etc.${N(9)} Remplaçons les simples lignes par des motifs ornementaux, et les rosaces les plus inattendues vont nous apparaître.${N(10)}`,
          `A few examples will show the results better than any explanation. Take the circle shown opposite, in which two lines B A B have been drawn, and place the hinge at O. When the mirrors are set to the positions 1.O.1, 3.O.3, 4.O.4 and so on, we get figures based on the triangle, the square, the pentagon, the hexagon, etc.${N(9)} Replace the plain lines with ornamental motifs, and the most unexpected rosettes appear.${N(10)}`],
    ['fig', `[Figure 2 : une bordure de rinceaux et de grappes, traversée de lignes de miroir lettrées AA, BB, CC, DED, GHG, IKI.]`,
            `[Figure 2: a border of scrolls and berry clusters, crossed by lettered mirror lines AA, BB, CC, DED, GHG, IKI.]`],
    ['p', `La seconde figure nous montrera quelques combinaisons simples. Plaçons deux glaces en AA et BB, et nous aurons une bordure indéfinie, pour laquelle nous obtenons un coin à angle droit en plaçant une glace en CC.${N(11)}`,
          `The second figure shows some simple combinations. Place two mirrors at AA and BB, and we get an endless border. A mirror placed at CC gives it a right-angled corner.${N(11)}`],
    ['p', `De même DED, GHG, IKI, nous donnent quelques figures, prises entre mille.`,
          `In the same way, DED, GHG and IKI give us a few figures, chosen from a thousand.`],
    ['p', `Les lignes les plus baroques${N(12)} et les moins décoratives, par l'effet de la réflexion et de la répétition prennent ainsi une valeur ornementale inattendue.`,
          `Through reflection and repetition, the most bizarre${N(12)} and least decorative lines take on an unexpected ornamental value.`],
    ['p', `Tout peut nous servir d'éléments : lignes, formes, végétaux, animaux. Avouons cependant que les ornementations linéaires ou conventionnelles${N(13)} sont les plus riches et les plus variées. Et cela est facilement compréhensible, les végétaux et surtout les animaux devant suivre la loi qui préside à leur constitution même. On voit peu le parti que l'on pourrait tirer d'un oiseau à trois têtes ou d'un chien à huit pattes?${N(14)}`,
          `Anything can serve as an element: lines, shapes, plants, animals. We must admit, though, that linear or stylized${N(13)} ornament gives the richest and most varied results. That is easy to understand: plants, and animals even more, must obey the law that governs their own structure. It is hard to see what use one could make of a three-headed bird or an eight-legged dog!${N(14)}`],
    ['p', `Mais lorsque le décorateur se servira avec tact de ce procédé, il y découvrira une facilité incomparable dans la composition et le groupement des motifs ornementaux les plus variés.`,
          `But a decorator who uses this process with tact will find it makes composing and grouping the most varied ornamental motifs incomparably easy.`],
    ['sign', `M.-P. V.`, `M.-P. V. [Maurice Pillard Verneuil]`],
  ];
  const notes = [
    `<b>M.M.</b> The standard French abbreviation of <i>Messieurs</i> is <i>MM.</i>; both the cover and the title page letter it <i>M.M.</i>, a variant common in display lettering of the period.`,
    `<b>à l'infini.</b> Only true of borders (two parallel mirrors). Hinged mirrors give finite rosettes; filling the plane needs at least three mirrors — the very kaleidoscope the preface sets aside.`,
    `<b>Rue de Lafayette.</b> The cover gives the street's official name, <i>Rue La Fayette</i>; the title page letters <i>Rue de Lafayette</i>. (The title page also writes <i>Beaux Arts</i> without the hyphen, and its capitals carry no accents: <i>A L'INFINI A L'AIDE</i>, normal for capitals.)`,
    `<b>glaces.</b> Plate-glass looking-glasses, i.e. flat mirrors; <i>jeux de glaces</i> = arrangements of mirrors.`,
    `<b>soit que … soit pour … soit enfin pour.</b> The coordinated clauses are not parallel: <i>soit que</i> + subjunctive is followed by <i>soit pour</i> + infinitive (expected <i>soit que l'on veuille…, soit que l'on cherche…</i>, or <i>pour</i> throughout). The translation smooths this.`,
    `<b>"We have simplified it."</b> Historically the order is reversed: Brewster's basic kaleidoscope (patented 1817) already used two mirrors, and hinged mirrors at a variable angle were described long before, e.g. by Kircher (<i>Ars magna lucis et umbrae</i>, 1646).`,
    `<b>nous promenons.</b> Compare Grasset, <i>Méthode de composition ornementale</i> (1905), who rejects composition left to chance, such as ink blots folded in a sheet of paper or "ces miroirs que l'on promène sur des paquets de ficelle jetés à terre".`,
    `<b>Nous voyons qu'alors nos glaces prennent …, nous obtenons …</b> The sentence has two main clauses joined without a conjunction; <i>qu'alors</i> is printed as such (not a transcription error). The sense is clearly "we see that when our mirrors take … we obtain …" (i.e. <i>que lorsque</i>).`,
    `<b>Positions 1, 3, 4 … and "triangle, square, pentagon, hexagon".</b> Measured on this edition, the rays sit at mirror angles of about 118°, 88°, 71°, 57°, 51°, 44° — i.e. 360°/k for k = 3…8 (ray 1 is the flat, 180° position). With the apex A on the bisector, 360°/k does yield a k-gon, so the dial is right for this figure. Position 1 (mirrors opened flat, 180°) gives no polygon: the list of positions starts at 1, the list of figures at the triangle (3).`,
    `<b>"Replace the lines by ornamental motifs."</b> This generalisation fails: at 360°/k with k odd, the two chains of images meet behind the hinge showing opposite edges of the wedge, so a general motif shows a seam. It works only for motifs symmetric about the bisector. The correct rule for arbitrary motifs is α = 180°/n (Brewster's "even aliquot part").`,
    `<b>Corner at CC.</b> A single mirror turns a straight border through a right angle only if it crosses the border at 45°.`,
    `<b>baroques.</b> In the period sense: odd, irregular, bizarre — not the art-historical style.`,
    `<b>conventionnelles.</b> In 1900 design vocabulary, <i>conventionnel</i> means stylized (as opposed to naturalistic), not "conventional".`,
    `<b>pattes?</b> The question mark closes what is grammatically a statement (<i>On voit peu le parti…</i>); it reads as an exclamation. The print sets no space before "?" here, although it does before ":" a few lines earlier.`,
  ];
  let html = `<div class="ptab both" id="ptab"><div class="h fr">Texte original (français)</div><div class="h en">English translation</div>`;
  for (const [k, fr, en] of rows) {
    if (k === 'sec') html += `<div class="sec fr">${fr}</div><div class="sec en">${en}</div>`;
    else html += `<div class="fr"><p class="${k}">${fr}</p></div><div class="en"><p class="${k}">${en}</p></div>`;
  }
  html += `</div>`;
  $('prefText').innerHTML = html;
  $('prefNotes').innerHTML = notes.map((t, i) => `<li id="pn${i + 1}">${t}</li>`).join('');
  const ov = $('prefOv');
  let back = null;                          // the button that opened it, inside How it works
  const open = e => { back = e && e.currentTarget; ov.hidden = false; document.body.style.overflow = 'hidden'; $('prefClose').focus(); };
  const close = () => { ov.hidden = true; if ($('helpOv').hidden) document.body.style.overflow = ''; if (back) back.focus(); };
  $('openPreface').onclick = open; $('openPreface2').onclick = open; $('prefClose').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) close(); });
  document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#langSeg button').forEach(x => x.classList.toggle('on', x === b));
    $('ptab').className = 'ptab ' + b.dataset.l;
  });
  ov.addEventListener('click', e => { const t = e.target.closest('.tryfig'); if (t) { close(); demo(); } });
})();
