/* Tessera · start-up: runs last, once every other file has loaded */
'use strict';

new ResizeObserver(() => zRender()).observe(zb);
new ResizeObserver(() => cRender()).observe(board);
(async () => {
  showView('compose');                         // Compose is the first view
  await TDB.ready;
  let ds = TDB.db ? await tdbGet('designs') : undefined;
  if (!Array.isArray(ds)) { try { ds = JSON.parse(LS.get('mt.designs') || '[]'); } catch (e) { ds = []; } }   // old location: moved on the next save
  for (const d of ds) if (d && d.src && CUTS[d.shape]) addDesign(d);
  TDB.loaded = true; if (ds.length) saveDesigns();
  try { const bd = JSON.parse(LS.get('mt.board') || 'null');
    if (bd) { const ids = new Set(DESIGNS.map(d => d.id)); PIECES = (bd.pieces || []).filter(p => ids.has(p.did));
      for (const k of Object.keys(CB)) if (bd.cb && k in bd.cb && typeof bd.cb[k] === typeof CB[k]) CB[k] = bd.cb[k]; }
  } catch (e) {}
  for (const p of PIECES) { const n = +String(p.id).slice(1); if (n >= uid) uid = n + 1; }
  lastSnap = snapState(); renderPalette(); syncBoardCtl(); renderLegend();
  refreshDemoTiles();
  const first = !LS.get('mt.demo') && !DESIGNS.length && !PIECES.length;
  await zInit();
  if (first) { LS.set('mt.demo', '1'); loadDemo(); } else { workBar(); cRender(); }
})();

let framed = true; try { framed = window.top !== window; } catch (e) {}
if (framed) $('export').hidden = true;

renderSlots(); syncControls();
/* ---------- opening composition: two ornaments from plates 57 and 58, hinged at 30° (D6) ---------- */
const OPENING = {"mode": "hinge", "alpha": 30, "beta": -90, "zoom": 1.1, "orn": [{"id": "p57_03", "x": 500, "y": 150, "s": 0.27, "rot": 180}, {"id": "p58_05", "x": 500, "y": 330, "s": 0.07, "rot": 0}]};
async function opening(cfg) {
  try {
    const imgs = await Promise.all(cfg.orn.map(o => loadLib(o.id)));
    S.orn = cfg.orn.map((o, i) => ({ n: +o.id.slice(1, 3), img: imgs[i], cx: 0, cy: 0, cw: imgs[i].width, ch: imgs[i].height,
      x: o.x, y: o.y, s: o.s, rot: o.rot || 0, flip: !!o.flip, lib: o.id }));
    S.sel = S.orn.length - 1;
  } catch (e) { S.orn = []; S.sel = -1; }
  Object.assign(S, { method: 'verneuil', vmode: cfg.mode, mode: cfg.mode, alpha: cfg.alpha, beta: cfg.beta, zoom: cfg.zoom, O: { x: SW / 2, y: SH / 2 } });
  if (cfg.theta !== undefined) S.theta = cfg.theta;
  if (cfg.d !== undefined) S.d = cfg.d;
  renderSlots(); redraw(true);
}
opening(OPENING);
