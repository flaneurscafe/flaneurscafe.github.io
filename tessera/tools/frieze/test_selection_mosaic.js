const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const E = (f, a) => p.evaluate(f, a);
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(2500);
  const n0 = await E(() => PIECES.length);
  await E(() => { SEL.clear(); PIECES.filter(q => String(q.did).startsWith('demo_fz')).forEach(q => SEL.add(q.id)); syncSel(); cRender(); });
  await p.click('#cSelMos'); await p.waitForTimeout(500);
  let r = await E(() => [!$('mosaicView').hidden, ZSRC && ZSRC.mask, ZSRC && ZSRC.from.ids.length, $('zStatus').textContent.slice(0, 80)]);
  ok(r[0] && r[1] && r[2] === 42, 'selection sent to the Mosaic maker ' + JSON.stringify(r));
  for (const style of ['roman', 'verm']) {
    await E(st => { ZO.style = st; Object.assign(ZO, ZSTYLE[st]); ZO.n = 90; zSyncOpts(); }, style);
    if (style === 'verm') await E(() => { Z.from = null; });
    await p.click('#zCut'); if (await E(() => $('zCut').dataset.armed === '1')) await p.click('#zCut');
    await p.waitForFunction(() => Z.m && Z.from !== undefined && /Cut:/.test($('zStatus').textContent), null, { timeout: 60000 });
    r = await E(() => [Z.m.cells.length, !!Z.m.cutout, !$('zBackRow').hidden, $('zPutBack').textContent]);
    ok(r[0] > 100 && r[1] && r[2], style + ' cut, cut-out, put-back offered ' + JSON.stringify(r));
    await p.screenshot({ path: `/home/claude/t/selmos_${style}.png` });
  }
  await p.click('#zPutBack'); await p.waitForTimeout(800);
  r = await E(() => { const m = PIECES[PIECES.length - 1], d = dById(m.did); return [PIECES.length, PIECES.filter(q => String(q.did).startsWith('demo_fz')).length, !!(d.mosaic && d.mosaic.cutout), [...SEL].join() === m.id, $('cStatus').textContent.slice(0, 90)]; });
  ok(r[0] === n0 - 42 + 1 && r[1] === 0 && r[2] && r[3], 'put back in place of the 42 pieces ' + JSON.stringify(r));
  // a click in the open middle reaches the panel underneath; a click on the band hits the mosaic
  r = await E(() => { const m = PIECES[PIECES.length - 1], d = dById(m.did), cx = m.x, cy = m.y, bw = d.w * m.s, bh = d.h * m.s;
    const hitAt = (x, y) => { for (let i = PIECES.length - 1; i >= 0; i--) if (pieceHit({ x, y }, PIECES[i])) return PIECES[i].did; return null; };
    return [hitAt(cx, cy), hitAt(cx, cy - bh / 2 + 0.03 * bh), d.id]; });
  ok(r[0] !== r[2] && r[1] === r[2], 'middle clicks through, band is the mosaic ' + JSON.stringify(r));
  await p.waitForTimeout(500); await p.screenshot({ path: '/home/claude/t/selmos_board.png' });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
  r = await E(() => PIECES.filter(q => String(q.did).startsWith('demo_fz')).length); ok(r === 42, 'undo brings the frieze back ' + r);
  // frame from the Frieze maker: open middle
  r = await E(async () => { showView('frieze'); FZ.src = 'geo'; FZ.geo = 'meander'; FZ.corner = 'alike'; fzSync(); $('fzMosaic').click(); await new Promise(r => setTimeout(r, 300));
    const c = ZSRC.img, a = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data[3]; return [ZSRC.mask, a, $('zBackRow').hidden]; });
  ok(r[0] && r[1] === 0, 'frame source has an open middle ' + JSON.stringify(r));
  // Place: one click, ready
  r = await E(async () => { showView('mosaic'); document.querySelector('#zTools button[data-t=place]').click(); await new Promise(r => setTimeout(r, 200));
    return [Z.tool, !!Z.place, document.querySelector('#zTools button[data-t=place]').classList.contains('on'), !!document.querySelector('#zBaskets canvas.on')]; });
  ok(r.every(Boolean), 'Place is on at once with a piece chosen ' + JSON.stringify(r));
  console.log('ERR', JSON.stringify(errs)); await b.close(); })();
