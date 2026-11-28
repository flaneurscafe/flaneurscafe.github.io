/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — types for the development check only (tools/typecheck.js runs tsc over the files that start
   with // @ts-check). The page never loads this file and nothing is compiled: the scripts stay plain
   JavaScript that runs from file://. These describe the three shapes the engine passes around: a piece
   of the outfit, a check (one finding), and your analysed colouring; and what each check file is given.
   A field missing here that the code uses is reported, which is the point: add it here when it is real. */

/** A pattern on a piece: its type (VPAT.byId), its repeat in cm, its second colour, how much it covers. */
interface ValetPattern { type: string; scale?: number; hex2?: string; cover?: number; [more: string]: any }

/** One piece of an outfit, as the engine receives it (engineOutfit in outfit.js); settings listed in
    G.PIECE_FIELDS (garments.js), plus the names the engine is given ready. */
interface ValetPiece {
  hex: string; name?: string; kind?: string; cloth?: string; pat?: ValetPattern;
  rise?: string; length?: string; hex2?: string; buttons?: string; metal?: string; band?: string; brim?: string;
  collar?: string | null; collarBand?: string; collarHex?: string | null; collarName?: string;
  knit?: string; brogue?: string;
  on?: boolean; gid?: string;
}

/** A fix offered with a check: a label, and what it changes (a slot's settings, or an accessory). */
interface ValetFix { label?: string; slot?: string; acc?: string; kind?: string; on?: boolean; set?: { [k: string]: unknown } }

/** One finding. score below 0.5 fails, 0.5 to 0.85 is a note, from 0.85 it passes (MAINTAINING.md). */
interface ValetCheck {
  id: string; score: number; text: string;
  slots?: string[]; group?: string; level?: string; acc?: string;
  fixes?: ValetFix[]; fix?: ValetFix; n?: number; hint?: boolean; cloth?: boolean;
}

/** Your colouring, as analyseProfile (engine.js) returns it and the checks read it. */
interface ValetAnalysis {
  hex: { [feature: string]: string }; lab: { [feature: string]: number[] };
  grey: number; hairBase: string | null; noGrey: { [k: string]: number | string } | null; season: string; tanFrom: string | null;
  contrast: number; contrastPair: string; contrastLevel: string; edges: object[]; contrastEdge: object | null;
  band: number[]; depth: number; depthLevel: string;
  skinHue: number; lean: number; tempLevel: string; confidence: string; skinMeasured: boolean;
  chroma: number; chromaLevel: string; hairStyle: string; hairLabel: string; redness: string; underEye: string;
}

/** What is seen of a piece across a room (look in engine.js). */
interface ValetLook { hex: string; name: string; mean: string; pat: ValetPattern; visible: boolean; texture?: boolean; [more: string]: any }

/** What checkOutfit gives each file of js/checks/. */
interface ValetCtx {
  o: { [slot: string]: any }; p: ValetAnalysis;
  L: { [slot: string]: ValetLook }; K: { [slot: string]: any }; LC: ValetLook | null; collarHex: string | null;
  face: string[]; near: string[]; worn: string[]; out: ValetCheck[];
  add: (c: ValetCheck) => ValetCheck; nm: (k: string) => string; lum: (hex: string) => number; lo: number; hi: number;
}

/** The page's shared state and functions, window.VAPP (js/ui/core.js and the other files of js/ui/).
    Each member is listed (the names the page holds once loaded) so that a misspelt one is reported;
    their types are left open for now. */
interface ValetApp {
  $: any;
  $$: any;
  CHART: any;
  D: any;
  E: any;
  F: any;
  HELPER_TEXT: any;
  MEASURES: any;
  PLACEHOLDER: any;
  PLACES: any;
  SAMPLERS: any;
  VC: any;
  activeSampler: any;
  activeTab: any;
  analysis: any;
  byId: any;
  cleanProfile: any;
  coreRows: any;
  esc: any;
  fillSelects: any;
  glassesToOutfit: any;
  infoBtn: any;
  load: any;
  marks: any;
  mountChart: any;
  nameOf: any;
  newSummer: any;
  normOutfit: any;
  normWardrobe: any;
  openMeasures: any;
  previewTimer: any;
  previewing: any;
  refreshEffects: any;
  renderColour: any;
  renderFit: any;
  renderHair: any;
  renderMeasures: any;
  renderProfileCard: any;
  renderProportion: any;
  renderSamplers: any;
  renderSeason: any;
  result: any;
  results: any;
  save: any;
  say: any;
  showGuide: any;
  showPalPane: any;
  showTab: any;
  showYouPane: any;
  state: any;
  study: any;
  summerOn: any;
  syncChart: any;
  syncChartSoon: any;
  touch: any;
  tt: any;
  update: any;
  upgrade: any;
  warmPairs: any;
  palPane?: string;   // set when a pane of the Palette tab is chosen
  shapeSub?: string;  // set when Proportion or Fit is chosen
}

interface Window { VAPP: ValetApp; [global: string]: any }
/** Globals some page files name without window. (the page's globals are window's properties). */
declare var VWARD: any;
/** The Dresser's helpers and shared state, set up by js/ui/dresser.js for its other files (dresser-*.js). */
declare var VDRCORE: any;
/** Dressing decisions (js/dress.js): garment types, what can be put on, the fixes. */
declare var VDRESS: any;
declare var VPHOTOS: any;
