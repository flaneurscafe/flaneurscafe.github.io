const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(2500);
  // 1. demo set, printed border, scale change: length unchanged -> nothing reported
  await p.click('.fzgrp .fzgh [data-a=ed]'); await p.waitForTimeout(1500);
  let r = await p.evaluate(async () => { const t0 = performance.now(); const i = $('fzScale'); i.value = 0.7; i.dispatchEvent(new Event('input')); $('fzUpdate').click(); await new Promise(r => setTimeout(r, 300));
    return [SEL.size, $('fzStatus').textContent, $('fzStatus').style.color, Math.round(performance.now() - t0)]; });
  console.log('demo scale', JSON.stringify(r));
  // 2. a geometric strip laid edge to edge, then longer / shorter period
  for (const R of [1.6, 0.6]) {
    r = await p.evaluate(async R => { showView('frieze'); FZLINK = null; FZ.src = 'geo'; FZ.geo = 'meander'; FZ.geoR = 1; FZ.corner = 'block'; fzSync(); fzRender(); $('fzSave').click();
      const u = fzLinked().find(d => /repeat unit/.test(d.name)), s = 0.4, w = u.w * s; const ids = [];
      for (let i = 0; i < 5; i++) { const id = 'q' + R + i; PIECES.push({ id, did: u.id, cut: 'full', x: 2000 + i * w, y: 2000, rot: 0, s, flip: false }); ids.push(id); }
      const o = DESIGNS.find(d => !d.frieze && d.shape === 'square'); PIECES.push({ id: 'nb' + R, did: o.id, cut: 'full', x: 2000 + 5 * w - w / 2 + o.w * s * u.h / o.h / 2, y: 2000, rot: 0, s: s * u.h / o.h, flip: false });
      FZ.geoR = R; fzSync(); fzRender(); $('fzUpdate').click(); await new Promise(r => setTimeout(r, 300));
      return [[...SEL].join(), SEL.has('nb' + R) ? 'NEIGHBOUR SELECTED' : 'neighbour not selected', $('fzStatus').textContent, $('cStatus').textContent]; }, R);
    console.log('geo period x' + R, JSON.stringify(r));
  }
  console.log('ERR', JSON.stringify(errs)); await b.close(); })();
