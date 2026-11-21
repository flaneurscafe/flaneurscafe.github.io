/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — colours read from photos of your own clothes; window.VPHOTOS.

   Two parts.
   1. Reading a photo (loadFile, patch). Shared by the You tab (skin, hair, eyes) and the Dresser.
   2. "Colours from photos", a window opened from any piece in the Dresser. Upload photos, click white
      paper to correct the light, click the cloth, name what was read. The colours are kept, named,
      in V.state.myColours, so every piece can wear them again ("My colours" in the Dresser). They go
      into the saved file like the rest of the profile.

   The photos themselves are treated with more care than the colours, because a selfie or a mirror
   photo shows a face. A photo is kept only as a small crop around the points clicked on the cloth
   (CROP_MAX px), only in this browser (localStorage, key STORE), and never in the saved file. Each
   photo can be forgotten, or not kept at all; its colours stay either way.

   Started by the interface (js/ui/main.js) with an API, like the Dresser:
     state()    the profile (V.state), where myColours lives
     analysis() the colouring worked out from it, or null
     save()     store the profile
     changed()  something in My colours changed: redraw what shows them */
(function () {
  'use strict';
  const VC = window.VC, E = window.VENGINE, D = window.VDATA;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const isHex = function (h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); };
  const say = function (mouse, touch) { return window.VAPP && window.VAPP.say ? window.VAPP.say(mouse, touch) : mouse; };

  const STORE = 'valet.photos.v1';
  const MAX_PHOTOS = 40;      // about 40 × 30–50 KB: well inside the browser's 5 MB, beside the profile
  const MAX_COLOURS = 200;
  const CROP_MAX = 400;       // the longer side of a kept crop, in pixels
  const WORK_MAX = 1000;      // the longer side of a photo while it is being read

  /* ---------- 1. Reading a photo ---------- */

  /* An image file drawn on a canvas, scaled so its longer side is at most max pixels. */
  function loadFile(file, max, done) {
    const img = new Image();
    img.onload = function () {
      const sc = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      done(cv);
    };
    img.onerror = function () { URL.revokeObjectURL(img.src); done(null); };
    img.src = URL.createObjectURL(file);
  }
  /* The colour of a square patch of radius r around (x, y), averaged in linear light. trim drops that
     share of the darkest and of the brightest pixels first (0.1 for cloth: shadows in folds and shine;
     0 for skin, hair and eyes, where the You tab's small patch is aimed by hand). */
  function patch(ctx, x, y, r, trim) {
    const cv = ctx.canvas;
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), w = Math.min(cv.width - x0, 2 * r + 1), h = Math.min(cv.height - y0, 2 * r + 1);
    const d = ctx.getImageData(x0, y0, w, h).data, px = [];
    for (let i = 0; i < d.length; i += 4) {
      const lin = [VC.srgbToLinear(d[i]), VC.srgbToLinear(d[i + 1]), VC.srgbToLinear(d[i + 2])];
      px.push({ lin: lin, Y: 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] });
    }
    let keep = px;
    if (trim > 0) {
      px.sort(function (p1, p2) { return p1.Y - p2.Y; });
      keep = px.slice(Math.floor(px.length * trim), Math.ceil(px.length * (1 - trim)));
    }
    const acc = [0, 0, 0];
    keep.forEach(function (q) { acc[0] += q.lin[0]; acc[1] += q.lin[1]; acc[2] += q.lin[2]; });
    return VC.rgbToHex(acc.map(function (v) { return VC.linearToSrgb(v / keep.length); }));
  }
  // wide enough to cover a weave on a photo of a garment
  const clothRadius = function (cv) { return Math.max(4, Math.round(Math.max(cv.width, cv.height) / 70)); };

  /* ---------- My colours: the list, made safe ---------- */
  /* A colour: { id, name, hex, paper (read with white paper in the photo), photo (the id of its kept
     photo, or null), added (date) }. Anything else in a file is dropped. */
  function cleanColours(list) {
    if (!Array.isArray(list)) return [];
    const seen = {};
    return list.filter(function (c) {
      if (!c || typeof c !== 'object' || !isHex(c.hex) || typeof c.id !== 'string' || !/^[a-z0-9]{1,24}$/.test(c.id) || seen[c.id]) return false;
      seen[c.id] = true; return true;
    }).slice(0, MAX_COLOURS).map(function (c) {
      return { id: c.id, name: (typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'My colour').slice(0, 40), hex: c.hex.toLowerCase(),
        paper: c.paper === true, photo: typeof c.photo === 'string' && /^[a-z0-9]{1,24}$/.test(c.photo) ? c.photo : null,
        added: typeof c.added === 'string' ? c.added.slice(0, 10) : '' };
    });
  }
  const newId = function () { return (Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(-12); };
  const today = function () { return new Date().toISOString().slice(0, 10); };

  /* ---------- Kept photos (this browser only) ---------- */
  /* A photo: { id, added, crop (a JPEG data URL), white (the paper's raw colour, or null), points
     ([{ c: colour id, x, y }] in the crop's pixels) }. */
  function readPhotos() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { list = []; }
    if (!Array.isArray(list)) return [];
    return list.filter(function (p) {
      return p && typeof p.id === 'string' && /^[a-z0-9]{1,24}$/.test(p.id) && typeof p.crop === 'string' && p.crop.indexOf('data:image/jpeg;base64,') === 0 && Array.isArray(p.points);
    }).map(function (p) {
      return { id: p.id, added: String(p.added || '').slice(0, 10), crop: p.crop, white: isHex(p.white) ? p.white : null,
        points: p.points.filter(function (q) { return q && typeof q.c === 'string' && isFinite(q.x) && isFinite(q.y); }) };
    }).slice(0, MAX_PHOTOS);
  }
  let photos = [];
  function writePhotos() {
    try { localStorage.setItem(STORE, JSON.stringify(photos)); return true; } catch (e) { return false; }
  }
  const photoById = function (id) { return photos.find(function (p) { return p.id === id; }) || null; };

  /* ---------- The window ---------- */
  let api = null, opts = {}, from = null, note = '';
  /* The photo being read: its canvas, the paper (raw colour and where), what the next click reads,
     the last reading, the colours saved from it ([{ c, x, y }] in this canvas's pixels), and whether
     it is kept. stored: it was opened from a kept crop, so its canvas is the crop itself. */
  let cur = null;
  const mine = function () { const s = api.state(); if (!Array.isArray(s.myColours)) s.myColours = []; return s.myColours; };
  const colourById = function (id) { return mine().find(function (c) { return c.id === id; }) || null; };

  function build() {
    if ($('#photoOv')) return;
    const ov = document.createElement('div');
    ov.className = 'ov'; ov.id = 'photoOv'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'photoOvTitle');
    ov.innerHTML = '<div class="ovp ovp-wide"><div class="ovh"><h2 id="photoOvTitle">Colours from photos</h2><button type="button" class="btn ghost small" id="photoOvClose" aria-label="Close">Close ✕</button></div><div class="ovb" id="photoOvBody"></div></div>';
    document.body.appendChild(ov);
    $('#photoOvClose').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) {
      if (ov.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {   // keep focus inside the window
        const f = $$('#photoOv button:not([disabled]), #photoOv input, #photoOv summary, #photoOv label.btn'), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
      }
    });
  }
  /* o: { piece: what it is for ('Jacket'), patterned: true when the piece has a pattern,
     wear(hex), second(hex), fit(hex) → a line of HTML on how it works with the outfit }.
     Without a piece the window only reads and keeps colours. */
  function open(o) {
    build();
    opts = o || {}; note = ''; from = document.activeElement;
    photos = readPhotos();
    $('#photoOv').hidden = false; document.body.classList.add('ov-open');
    render();
    $('#photoOvClose').focus();
  }
  function close() {
    const ov = $('#photoOv'); if (!ov || ov.hidden) return;
    ov.hidden = true; document.body.classList.remove('ov-open');
    cur = null;   // the full photo is not kept past the window
    api.changed();
    if (from && from.focus && document.body.contains(from)) from.focus();
  }

  const tierOf = function (hex) { const a = api.analysis(); return a ? E.scoreColour(hex, a).tier : null; };
  const tt = function (t) { return t ? '<span class="tt t' + t + '" title="Tier ' + t + ': ' + E.TIER_TEXT[t].note.replace(/"/g, '') + '">T' + t + '</span>' : ''; };
  const nearest = function (hex) {
    const lab = VC.hexToLab(hex);
    return D.colours.map(function (c) { return { hex: c.hex, name: c.name, dE: VC.deltaE2000(lab, VC.hexToLab(c.hex)) }; }).sort(function (p1, p2) { return p1.dE - p2.dE; })[0];
  };
  // the last reading, with the light corrected when the paper was read
  const reading = function () { return !cur || !cur.raw ? null : cur.white ? VC.rgbToHex(VC.whiteBalance(VC.hexToRgb(cur.raw), VC.hexToRgb(cur.white))) : cur.raw; };

  const TIPS = '<details class="ph-tips"><summary>Taking the photo</summary><ul class="small">' +
    '<li>Daylight by a window, out of direct sun. Hold or lay a sheet of plain white printer paper in the same light, in the picture.</li>' +
    '<li>A mirror photo works when the paper is in the mirror too: correcting to it also takes out the mirror\'s faint green tint. If the paper is out of the mirror, the tint stays in.</li>' +
    '<li>Use the back camera (a timer or a mirror) rather than the front one, and turn off portrait and beauty modes: they smooth, brighten and warm the picture, and the paper cannot undo that fully.</li>' +
    '<li>Click a flat, evenly lit part of the cloth (chest, thigh), not a fold or a shadow.</li>' +
    '<li>Photos from a shop\'s website are retouched and have no paper: read them if you like, but they are marked as less reliable.</li>' +
    '<li>Only a small crop around the points you click is kept, in this browser and not in the saved file, so a face in the picture is usually not kept at all.</li></ul></details>';

  function render() {
    const body = $('#photoOvBody'); if (!body) return;
    const list = mine();
    body.innerHTML =
      (opts.piece ? '<p class="ph-for">For the <strong>' + esc(opts.piece.toLowerCase()) + '</strong>: read a colour and wear it, or pick one you have read before.</p>' : '') +
      TIPS +
      '<div class="pp-bar"><label class="btn small ph-add">' + (cur ? 'Add another photo' : 'Add a photo') + '<input type="file" accept="image/*" class="ph-file" hidden></label>' +
      (cur ? '<div class="seg ph-mode" role="radiogroup" aria-label="' + say('What the next click reads', 'What the next tap reads') + '"><button type="button" role="radio" data-m="white" aria-checked="' + (cur.mode === 'white') + '">White paper</button><button type="button" role="radio" data-m="cloth" aria-checked="' + (cur.mode === 'cloth') + '">Cloth</button></div>' : '') + '</div>' +
      (photos.length ? '<div class="ph-thumbs" aria-label="Kept photos">' + photos.map(function (p) {
        const n = p.points.filter(function (q) { return colourById(q.c); }).length;
        return '<span class="ph-thumb' + (cur && cur.id === p.id ? ' sel' : '') + '"><button type="button" class="ph-open" data-id="' + p.id + '" title="Open this photo to read more from it"><img src="' + p.crop + '" alt="Kept photo, ' + n + ' colour' + (n === 1 ? '' : 's') + '"></button>' +
          '<button type="button" class="ph-forget" data-id="' + p.id + '" title="Forget this photo (its colours stay)" aria-label="Forget this photo">×</button></span>';
      }).join('') + '</div>' : '') +
      (cur ? '<div class="pp-wrap"><canvas class="pp-cv ph-cv"></canvas></div>' +
        (cur.stored ? '<p class="small muted">' + say('A kept crop. Click it to read more colours from it.', 'A kept crop. Tap it to read more colours from it.') + '</p>'
          : '<label class="check small"><input type="checkbox" class="ph-keep"' + (cur.keep ? ' checked' : '') + '> Keep a small crop of this photo with its colours (in this browser only)</label>') : '') +
      '<div class="ph-out"></div>' +
      (note ? '<p class="small ph-note" role="status">' + esc(note) + '</p>' : '') +
      '<h3>My colours <span class="muted">' + list.length + '</span></h3>' +
      (list.length ? '<ul class="mc-list">' + list.map(function (c) {
        const p = c.photo && photoById(c.photo);
        return '<li class="mc-row" data-id="' + c.id + '"><span class="mc-sw" style="background:' + c.hex + '"></span>' + tt(tierOf(c.hex)) +
          '<input type="text" class="mc-name" value="' + esc(c.name) + '" maxlength="40" aria-label="Name of this colour">' +
          (c.paper ? '' : '<span class="mc-tag" title="Read without white paper, so the colour of the light is in it">no paper</span>') +
          (p ? '<button type="button" class="mc-photo ph-open" data-id="' + p.id + '" title="Open its photo"><img src="' + p.crop + '" alt="Its photo"></button>' : '') +
          (opts.wear ? '<button type="button" class="btn small mc-wear">Wear</button>' : '') +
          '<button type="button" class="btn small ghost mc-del">Delete</button></li>';
      }).join('') + '</ul>' : '<p class="small muted">' + say('None yet. Add a photo of something you own, click the paper, then the cloth, and save what was read.', 'None yet. Add a photo of something you own, tap the paper, then the cloth, and save what was read.') + '</p>');
    wire(body);
    draw(); result();
  }

  function wire(body) {
    $('.ph-file', body).addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      loadFile(f, WORK_MAX, function (cv) {
        if (!cv) { note = 'That file could not be read as a picture.'; render(); return; }
        cur = { cv: cv, id: null, stored: false, white: null, whiteAt: null, mode: 'white', raw: null, at: null, points: [], keep: true };
        note = ''; render();
      });
    });
    $$('.ph-mode button', body).forEach(function (b) { b.addEventListener('click', function () { cur.mode = b.dataset.m; $$('.ph-mode button', body).forEach(function (q) { q.setAttribute('aria-checked', String(q === b)); }); result(); }); });
    $$('.ph-open', body).forEach(function (b) { b.addEventListener('click', function () { openKept(b.dataset.id); }); });
    $$('.ph-forget', body).forEach(function (b) { b.addEventListener('click', function () { forget(b.dataset.id); note = 'Photo forgotten; its colours are kept.'; render(); }); });
    const keep = $('.ph-keep', body);
    if (keep) keep.addEventListener('change', function () {
      cur.keep = keep.checked;
      if (!cur.keep && cur.id) { forget(cur.id); cur.id = null; note = 'This photo will not be kept; its colours are.'; }
      else if (cur.keep && cur.points.length) { note = storeCurrent() ? 'A small crop of this photo is kept.' : note; }
      render();
    });
    const cv = $('.ph-cv', body);
    if (cv) cv.addEventListener('click', function (e) {
      const rc = cv.getBoundingClientRect(), pt = { x: Math.round((e.clientX - rc.left) * cv.width / rc.width), y: Math.round((e.clientY - rc.top) * cv.height / rc.height) };
      const hex = patch(cur.cv.getContext('2d', { willReadFrequently: true }), pt.x, pt.y, clothRadius(cur.cv), 0.1);
      if (cur.mode === 'white') {
        cur.white = hex; cur.whiteAt = pt; cur.mode = 'cloth';
        $$('.ph-mode button', body).forEach(function (q) { q.setAttribute('aria-checked', String(q.dataset.m === 'cloth')); });
        if (cur.stored) { const p = photoById(cur.id); if (p) { p.white = hex; writePhotos(); } }
      } else { cur.raw = hex; cur.at = pt; }
      draw(); result();
    });
    $$('.mc-row', body).forEach(function (row) {
      const c = colourById(row.dataset.id); if (!c) return;
      $('.mc-name', row).addEventListener('change', function (e) { c.name = (e.target.value.trim() || 'My colour').slice(0, 40); api.save(); });
      const w = $('.mc-wear', row);
      if (w) w.addEventListener('click', function () { const h = c.hex; close(); opts.wear(h); });
      const del = $('.mc-del', row);
      del.addEventListener('click', function () {
        if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = say('Delete? Click again', 'Delete? Tap again'); setTimeout(function () { if (document.body.contains(del)) { delete del.dataset.armed; del.textContent = 'Delete'; } }, 4000); return; }
        removeColour(c.id); render();
      });
    });
  }

  function draw() {
    const cv = $('.ph-cv'); if (!cv || !cur) return;
    cv.width = cur.cv.width; cv.height = cur.cv.height;
    const c = cv.getContext('2d'); c.drawImage(cur.cv, 0, 0);
    const r = clothRadius(cur.cv), lw = Math.max(2, r / 3);
    const ring = function (pt, col, rad) { c.lineWidth = lw; c.strokeStyle = '#fff'; c.beginPath(); c.arc(pt.x, pt.y, rad + lw, 0, Math.PI * 2); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(pt.x, pt.y, rad, 0, Math.PI * 2); c.stroke(); };
    cur.points.forEach(function (q) { const col = colourById(q.c); if (col) { ring(q, '#333', r * 0.7); c.fillStyle = col.hex; c.beginPath(); c.arc(q.x, q.y, r * 0.55, 0, Math.PI * 2); c.fill(); } });
    if (cur.whiteAt) ring(cur.whiteAt, '#2e5480', r);
    if (cur.at) ring(cur.at, '#7a2433', r);
  }

  function result() {
    const out = $('.ph-out'); if (!out) return;
    if (!cur) { out.innerHTML = ''; return; }
    const hex = reading();
    if (!hex) {
      out.innerHTML = '<p class="small muted">' + (cur.mode === 'white' ? say('Click the white paper first, or switch to Cloth to skip it.', 'Tap the white paper first, or switch to Cloth to skip it.')
        : cur.white ? say('Light corrected from the paper. Now click the cloth.', 'Light corrected from the paper. Now tap the cloth.') : say('Click the cloth.', 'Tap the cloth.')) + '</p>';
      return;
    }
    const lab = VC.hexToLab(hex), near = nearest(hex), warn = [];
    if (!cur.white) warn.push('No white paper read, so the colour of the light is in this reading: indoor bulbs make cloth look warmer and yellower than it is.');
    if (lab[0] < 10) warn.push('Very dark: the photo may be underexposed, and dark cloth often reads darker in photos than in hand.');
    if (lab[0] > 96) warn.push('Nearly white: the photo may be overexposed here.');
    out.innerHTML = '<div class="pp-res"><span class="d" style="background:' + hex + '"></span><span><strong>Read: ' + hex.toUpperCase() + '</strong> ' + tt(tierOf(hex)) +
      '<br><span class="small">Nearest named colour: ' + esc(near.name) + ' ' + tt(tierOf(near.hex)) + ' (ΔE ' + (Math.round(near.dE * 10) / 10) + (near.dE < 3 ? ', hard to tell apart' : near.dE < 7 ? ', close' : ', not a close match') + ')</span></span></div>' +
      (opts.fit ? '<p class="pp-fit">' + opts.fit(hex) + '</p>' : '') +
      (warn.length ? '<p class="small muted">' + warn.join(' ') + '</p>' : '') +
      '<div class="ph-save"><label class="small">Name <input type="text" class="ph-name" maxlength="40" placeholder="' + esc(opts.piece ? 'My ' + opts.piece.toLowerCase() : 'Navy jacket') + '"></label>' +
      '<div class="pp-acts">' +
      (opts.wear ? '<button type="button" class="btn small ph-do" data-do="wear">Save and wear</button>' : '') +
      '<button type="button" class="btn small' + (opts.wear ? ' ghost' : '') + ' ph-do" data-do="save">Save to my colours</button>' +
      (opts.wear && opts.patterned ? '<button type="button" class="btn small ghost ph-do" data-do="second">Save as the pattern\'s second colour</button>' : '') +
      (opts.wear ? '<button type="button" class="btn small ghost ph-near" data-hex="' + hex + '">Wear without saving</button>' : '') +
      (opts.wear ? '<button type="button" class="btn small ghost ph-near" data-hex="' + near.hex + '">Wear ' + esc(near.name) + ' instead</button>' : '') + '</div></div>';
    $$('.ph-do', out).forEach(function (b) {
      b.addEventListener('click', function () {
        const c = saveColour(hex, $('.ph-name', out).value);
        if (b.dataset.do === 'wear') { close(); opts.wear(c.hex); return; }
        if (b.dataset.do === 'second') { close(); opts.second(c.hex); return; }
        cur.raw = null; cur.at = null; render();
      });
    });
    $$('.ph-near', out).forEach(function (nb) { nb.addEventListener('click', function () { const h = nb.dataset.hex; close(); opts.wear(h); }); });
  }

  /* ---------- Saving, keeping, forgetting ---------- */
  function saveColour(hex, name) {
    const list = mine();
    const c = { id: newId(), name: (String(name || '').trim() || (opts.piece ? 'My ' + opts.piece.toLowerCase() : 'My colour')).slice(0, 40),
      hex: hex.toLowerCase(), paper: !!(cur && cur.white), photo: null, added: today() };
    list.unshift(c);
    if (list.length > MAX_COLOURS) list.length = MAX_COLOURS;
    note = 'Saved “' + c.name + '”.';
    if (cur && cur.at) {
      cur.points.push({ c: c.id, x: cur.at.x, y: cur.at.y });
      if (cur.keep && storeCurrent()) c.photo = cur.id;
    }
    api.save();
    return c;
  }
  /* Keep the photo being read: a crop around the cloth points (the paper is left out: it is often
     held by the face), scaled so its longer side is CROP_MAX. A photo opened from a kept crop only
     has its points updated. False when the browser has no room. */
  function storeCurrent() {
    if (!cur || !cur.points.length) return false;
    if (cur.stored) {
      const p = photoById(cur.id); if (!p) return false;
      p.points = cur.points.slice(); p.white = cur.white;
      return writePhotos();
    }
    const W = cur.cv.width, H = cur.cv.height, r = clothRadius(cur.cv);
    let x0 = Math.min.apply(null, cur.points.map(function (q) { return q.x; })), x1 = Math.max.apply(null, cur.points.map(function (q) { return q.x; }));
    let y0 = Math.min.apply(null, cur.points.map(function (q) { return q.y; })), y1 = Math.max.apply(null, cur.points.map(function (q) { return q.y; }));
    const m = Math.max(4 * r, 0.12 * Math.max(W, H)), minSide = Math.min(W, H, Math.round(0.25 * Math.max(W, H)));
    x0 -= m; x1 += m; y0 -= m; y1 += m;
    if (x1 - x0 < minSide) { const cx = (x0 + x1) / 2; x0 = cx - minSide / 2; x1 = cx + minSide / 2; }
    if (y1 - y0 < minSide) { const cy = (y0 + y1) / 2; y0 = cy - minSide / 2; y1 = cy + minSide / 2; }
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(W, Math.round(x1)); y1 = Math.min(H, Math.round(y1));
    const s = Math.min(1, CROP_MAX / Math.max(x1 - x0, y1 - y0)), out = document.createElement('canvas');
    out.width = Math.max(1, Math.round((x1 - x0) * s)); out.height = Math.max(1, Math.round((y1 - y0) * s));
    out.getContext('2d').drawImage(cur.cv, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
    const rec = { id: cur.id || newId(), added: today(), crop: out.toDataURL('image/jpeg', 0.8), white: cur.white,
      points: cur.points.map(function (q) { return { c: q.c, x: Math.round((q.x - x0) * s), y: Math.round((q.y - y0) * s) }; }) };
    const was = photos.slice();
    photos = photos.filter(function (p) { return p.id !== rec.id; });
    photos.unshift(rec);
    const dropped = photos.slice(MAX_PHOTOS); photos = photos.slice(0, MAX_PHOTOS);
    if (!writePhotos()) { photos = was; note = 'The browser has no room left to keep this photo. Its colours are saved; forget an older photo to make room.'; return false; }
    dropped.forEach(function (p) { unlink(p.id); });
    if (!cur.id) { cur.id = rec.id; mine().forEach(function (c) { if (cur.points.some(function (q) { return q.c === c.id; })) c.photo = rec.id; }); }
    return true;
  }
  function unlink(photoId) { mine().forEach(function (c) { if (c.photo === photoId) c.photo = null; }); api.save(); }
  function forget(id) {
    photos = photos.filter(function (p) { return p.id !== id; }); writePhotos(); unlink(id);
    if (cur && cur.id === id) { if (cur.stored) cur = null; else cur.id = null; }
  }
  function removeColour(id) {
    const s = api.state(); s.myColours = mine().filter(function (c) { return c.id !== id; });
    photos.forEach(function (p) { p.points = p.points.filter(function (q) { return q.c !== id; }); });
    writePhotos();
    if (cur) cur.points = cur.points.filter(function (q) { return q.c !== id; });
    note = 'Colour deleted.'; api.save();
  }
  function openKept(id) {
    const p = photoById(id); if (!p) return;
    const img = new Image();
    img.onload = function () {
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
      cur = { cv: cv, id: p.id, stored: true, white: p.white, whiteAt: null, mode: 'cloth', raw: null, at: null, points: p.points.slice(), keep: true };
      note = ''; render();
    };
    img.src = p.crop;
  }

  /* The name of one of my colours, for a hex that is one; otherwise null. */
  function nameOf(hex, state) {
    const list = state && Array.isArray(state.myColours) ? state.myColours : [];
    const h = String(hex || '').toLowerCase(), c = list.find(function (x) { return x.hex === h; });
    return c ? c.name : null;
  }

  function init(theApi) { api = theApi; }
  window.VPHOTOS = { init: init, open: open, close: close, loadFile: loadFile, patch: patch, cleanColours: cleanColours, nameOf: nameOf, STORE: STORE };
})();
