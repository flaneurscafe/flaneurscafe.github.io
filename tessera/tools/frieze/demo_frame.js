const { chromium } = require('playwright'); const fs = require('fs');
const IDS = process.argv[2].split(','), SAVE = process.argv[3] === 'save';
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(2000);
  for (const id of IDS) {
    const r = await p.evaluate(async (id) => {
      loadDemo(); await new Promise(r => setTimeout(r, 600));
      const base = PIECES.filter(q => !String(q.did).startsWith('demo_fz'));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of base) for (const v of worldPoly(q)) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
      const b = FZ_BORDERS.find(r => r[0] === id); await fzPick(b);
      Object.assign(FZ, { corner: 'block', block: 'mirror' });
      const U = fzUnit(), S = fzSet(U), blk = S.find(t => t.name === 'corner block').c, h = U.height, P = U.width;
      // no gap: the frieze's inner edge runs along the panel; whole repeats on each side, the count chosen so both sides fit best
      const W = x1 - x0, H = y1 - y0; let best = null;
      for (let nW = 4; nW <= 60; nW++) { const step = W / nW, T = step * h / P; if (T < 0.09 * H || T > 0.17 * H) continue;
        const nH = Math.round(H / step), err = nH * step - H; if (!best || Math.abs(err) < Math.abs(best.err)) best = { nW, nH, step, T, err }; }
      const { nW, nH, step, T } = best, s = T / h;
      const iw = W, ih = H, vstep = H / nH, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;   // inner edge = the panel's edge; vertical repeats spaced H/nH (a hair under one repeat)
      const X0 = cx - iw / 2 - T, Y0 = cy - ih / 2 - T, X1 = cx + iw / 2 + T, Y1 = cy + ih / 2 + T;
      const enc = c => c.toDataURL('image/webp', 0.9);
      const mi = fzMethod(), st = fzState();
      const dU = { id: 'demo_fz_u', name: `Border ${id} · repeat unit`, shape: 'rect', w: P, h, src: enc(U), edge: h, method: mi, bg: FZ.bg, frieze: st, demo: true };
      const dK = { id: 'demo_fz_k', name: `Border ${id} · corner block`, shape: 'square', w: h, h, src: enc(blk), edge: h, method: mi, bg: FZ.bg, frieze: st, demo: true };
      const ps = []; let k = 0; const add = (did, x, y, rot) => ps.push({ id: 'fz' + (k++), did, cut: 'full', x, y, rot, s, flip: false });
      for (let i = 0; i < nW; i++) { const x = cx - iw / 2 + (i + 0.5) * step; add('demo_fz_u', x, Y0 + T / 2, 0); add('demo_fz_u', cx + iw / 2 - (i + 0.5) * step, Y1 - T / 2, 180); }
      for (let i = 0; i < nH; i++) { const y = cy - ih / 2 + (i + 0.5) * vstep; add('demo_fz_u', X1 - T / 2, y, 90); add('demo_fz_u', X0 + T / 2, cy + ih / 2 - (i + 0.5) * vstep, 270); }
      add('demo_fz_k', X0 + T / 2, Y0 + T / 2, 0); add('demo_fz_k', X1 - T / 2, Y0 + T / 2, 90); add('demo_fz_k', X1 - T / 2, Y1 - T / 2, 180); add('demo_fz_k', X0 + T / 2, Y1 - T / 2, 270);
      return { dU, dK, ps, info: [nW, nH, P, h, T, best.err, W, H] };
    }, id);
    const data = JSON.parse(fs.readFileSync('/tmp/demo_base.json', 'utf8'));
    data.designs = data.designs.filter(d => !d.id.startsWith('demo_fz')).concat([r.dU, r.dK]);
    data.pieces = data.pieces.filter(q => !String(q.id).startsWith('fz')).concat(r.ps);
    await p.evaluate(d => { window.TESSERA_DEMO = d; }, data);
    await p.evaluate(async () => { loadDemo(); await new Promise(r => setTimeout(r, 1500)); showView('compose'); });
    await p.waitForTimeout(1500); await p.screenshot({ path: `/home/claude/t/demo_${id}.png` });
    console.log(id, JSON.stringify(r.info));
    if (SAVE) fs.writeFileSync('/tmp/demo_new.json', JSON.stringify(data));
  }
  console.log('ERR', JSON.stringify(errs)); await b.close(); })();
