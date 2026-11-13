/* Tessera · Basics: constants, small helpers, the Tile maker state (S) and plate loading */
'use strict';

const FIRST_PLATE = 3; // plates 1–2 are the title page and the preface: not offered as ornaments
const SW = 1000, SH = 750, RES = 900, NPLATES = 60;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const wrap180 = a => ((a + 180) % 360 + 360) % 360 - 180;
const dir = a => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) });
const $ = id => document.getElementById(id);
const plateLabel = n => n === 1 ? 'Title page' : n === 2 ? 'Preface figures' : 'Plate ' + n;
const pad = n => String(n).padStart(2, '0');

const sheet = $('sheet'), sctx = sheet.getContext('2d');
const result = $('result'), rctx = result.getContext('2d');
const clean = document.createElement('canvas'); clean.width = clean.height = 900; const cctx = clean.getContext('2d');
const tilesC = $('tiles'), tctx = tilesC.getContext('2d');
const src = document.createElement('canvas'); src.width = SW; src.height = SH;
const g = src.getContext('2d');

const S = {
  orn: [], sel: -1,
  mode: 'hinge', O: { x: 500, y: 375 }, beta: -90, alpha: 120, theta: 0, d: 160,
  zoom: 1, snap: true, showLines: true, showSeam: true, clean: 0,
  method: 'verneuil', vmode: 'hinge', bcell: 't60', group: 'p4g', cell: 220, lt: 0, aspect: 0.62
};

const imgCache = {};
function loadPlate(n) {
  if (!imgCache[n]) imgCache[n] = new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = e => { delete imgCache[n]; rej(e); };   // a failed load can be tried again
    im.src = 'plates/plate_' + pad(n) + '.jpg';
  });
  return imgCache[n];
}
