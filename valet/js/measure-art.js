/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — illustrations for the measurement guide. Line drawings in SVG: a figure (front, back,
   face) or a garment laid flat, with the tape drawn where it goes. Colours come from CSS. */
(function () {
  'use strict';

  /* Smooth outline through points (Catmull-Rom as cubic Béziers). */
  function smooth(pts, closed) {
    const n = pts.length, P = function (i) { return closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]; };
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d + (closed ? ' Z' : '');
  }

  /* Left half of the body outline, from the side of the neck down to the crotch; mirrored for the right. */
  const HALF = [[110, 64], [110, 78], [96, 84], [80, 90], [72, 98], [69, 110], [67, 140], [64, 178], [61, 212], [59, 242], [57, 256], [58, 270], [63, 277],
    [68, 270], [69, 256], [68, 242], [72, 212], [75, 180], [79, 145], [84, 124], [86, 150], [89, 176], [90, 190], [87, 214], [83, 240], [85, 280],
    [90, 330], [91, 362], [96, 402], [86, 413], [89, 420], [112, 420], [114, 410], [110, 400], [112, 362], [113, 330], [116, 292], [120, 262]];
  const OUTLINE = HALF.concat(HALF.slice(0, -1).reverse().map(function (p) { return [240 - p[0], p[1]]; }));

  function body(view) {
    let s = '<path class="ma-body" d="' + smooth(OUTLINE, true) + '"/>' +
      '<ellipse class="ma-body" cx="120" cy="40" rx="19" ry="25"/>';
    if (view === 'front') {
      s += '<path class="ma-detail" d="M112 36 q4 -2 7 0 M121 36 q4 -2 7 0 M120 42 l-2 9 h4 M114 56 q6 3 12 0"/>' +
        '<path class="ma-detail" d="M104 92 q16 6 32 0 M120 262 v-40"/>';
    } else {
      s += '<path class="ma-detail" d="M120 80 V200 M98 120 q-6 20 -4 40 M142 120 q6 20 4 40"/>';
    }
    return s + '<line class="ma-floor" x1="30" y1="421" x2="210" y2="421"/>';
  }

  /* A tape round the body at height y: the front half solid, the back half dashed. */
  function girth(y, rx, ry) {
    return '<path class="ma-tape back" d="M' + (120 - rx) + ' ' + y + ' A' + rx + ' ' + ry + ' 0 0 1 ' + (120 + rx) + ' ' + y + '"/>' +
      '<path class="ma-tape" d="M' + (120 - rx) + ' ' + y + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (120 + rx) + ' ' + y + '"/>';
  }
  function dot(x, y, label, anchor, dx, dy) {
    return '<circle class="ma-mark" cx="' + x + '" cy="' + y + '" r="3.2"/>' +
      (label ? '<text class="ma-label" x="' + (x + (dx || 0)) + '" y="' + (y + (dy || 0)) + '" text-anchor="' + (anchor || 'start') + '">' + label + '</text>' : '');
  }
  function label(x, y, t, anchor) { return '<text class="ma-label" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'start') + '">' + t + '</text>'; }
  function arrow(x1, y1, x2, y2) {
    return '<line class="ma-tape" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-start="url(#ma-arr)" marker-end="url(#ma-arr)"/>';
  }
  const DEFS = '<defs><marker id="ma-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ma-arrowhead"/></marker></defs>';
  function svg(vb, inner, title) {
    return '<svg class="ma" viewBox="' + vb + '" role="img" aria-label="' + title + '">' + DEFS + inner + '</svg>';
  }

  /* ---------- Garments laid flat ---------- */
  function jacket() {
    return '<path class="ma-body" d="M70 40 L100 28 L120 40 L140 28 L170 40 L196 52 L214 190 L192 194 L178 92 L176 230 L64 230 L62 92 L48 194 L26 190 L44 52 Z"/>' +
      '<path class="ma-detail" d="M100 28 L112 70 L120 130 L128 70 L140 28 M120 130 V230 M86 170 h24 M130 170 h24"/>' +
      '<circle class="ma-detail" cx="123" cy="150" r="2.5"/><circle class="ma-detail" cx="123" cy="185" r="2.5"/>';
  }
  function trousers() {
    return '<path class="ma-body" d="M70 30 L170 30 L176 70 L190 240 L136 240 L122 102 L118 102 L104 240 L50 240 L64 70 Z"/>' +
      '<path class="ma-detail" d="M70 42 H170 M120 42 V102 M96 30 v12 M144 30 v12"/>';
  }
  function collar() {
    return '<rect class="ma-body" x="20" y="80" width="200" height="34" rx="6"/>' +
      '<path class="ma-detail" d="M20 97 h200"/>' +
      '<circle class="ma-detail" cx="36" cy="97" r="6"/><circle class="ma-detail" cx="36" cy="97" r="1.2"/>' +
      '<rect class="ma-detail" x="192" y="94" width="20" height="6" rx="3"/>';
  }
  function glasses() {
    return '<rect class="ma-body" x="38" y="70" width="70" height="52" rx="22"/><rect class="ma-body" x="132" y="70" width="70" height="52" rx="22"/>' +
      '<path class="ma-detail" d="M108 90 q12 -10 24 0 M38 84 L18 80 M202 84 L222 80"/>' +
      '<path class="ma-body" d="M40 168 H200 L220 182"/>' + label(80, 162, '52 □ 18 145') +
      '<text class="ma-label small" x="56" y="196">lens</text><text class="ma-label small" x="96" y="196">bridge</text><text class="ma-label small" x="130" y="196">temple length</text>';
  }

  /* ---------- One drawing per measurement and method ---------- */
  const ART = {
    height: {
      body: function () {
        return body('front') + '<line class="ma-wall" x1="214" y1="0" x2="214" y2="421"/>' +
          '<rect class="ma-prop" x="96" y="9" width="118" height="6"/>' + label(150, 7, 'book, flat', 'middle') +
          arrow(200, 17, 200, 419) + label(222, 222, 'height');
      }
    },
    chest: {
      body: function () { return body('front') + girth(130, 37, 9) + label(166, 126, 'fullest part,') + label(166, 137, 'under the arms') + label(166, 148, 'tape level'); },
      garment: function () { return jacket() + arrow(62, 100, 178, 100) + label(120, 94, 'armpit to armpit, × 2', 'middle'); }
    },
    waist: {
      body: function () { return body('front') + girth(188, 31, 7) + dot(120, 196, '') + label(162, 186, 'at the navel,') + label(162, 197, 'relaxed'); },
      garment: function () { return trousers() + arrow(70, 36, 170, 36) + label(120, 22, 'waistband, closed, × 2', 'middle'); }
    },
    seat: {
      body: function () { return body('front') + girth(238, 38, 8) + label(166, 236, 'fullest part') + label(166, 247, 'of the seat'); },
      garment: function () { return trousers() + arrow(62, 100, 178, 100) + label(120, 120, 'fullest point,', 'middle') + label(120, 131, 'across × 2', 'middle'); }
    },
    neck: {
      body: function () { return body('front') + girth(74, 11, 4) + label(140, 70, 'base of the neck,') + label(140, 81, 'one finger under the tape'); },
      garment: function () { return collar() + arrow(36, 132, 212, 132) + label(124, 150, 'button centre to far end of the buttonhole', 'middle') + label(124, 70, 'collar laid open and flat', 'middle'); }
    },
    shoulder: {
      body: function () {
        return body('back') + '<path class="ma-tape" d="M72 98 Q120 88 168 98"/>' + dot(72, 98, 'shoulder bone', 'end', -6, -6) + dot(168, 98, '') +
          label(120, 82, 'seen from behind', 'middle');
      },
      garment: function () { return jacket() + arrow(44, 52, 196, 52) + label(120, 20, 'seam to seam, across the back', 'middle'); }
    },
    arm: {
      body: function () {
        return body('front') + '<path class="ma-tape" d="' + smooth([[69, 98], [64, 140], [60, 178], [57, 212], [55, 242]], false) + '"/>' +
          dot(69, 98, 'shoulder bone', 'end', -6, -4) + dot(60, 178, 'over the elbow', 'end', -8, 4) + dot(55, 242, 'wrist bone', 'end', -8, 4);
      },
      garment: function () { return jacket() + '<line class="ma-tape" x1="196" y1="52" x2="213" y2="190" marker-start="url(#ma-arr)" marker-end="url(#ma-arr)"/>' + label(214, 120, 'seam', 'end') + label(214, 131, 'to cuff', 'end'); }
    },
    inseam: {
      body: function () {
        return body('front') + '<rect class="ma-prop" x="104" y="258" width="32" height="6"/>' + label(140, 256, 'book, spine up') +
          arrow(112, 266, 112, 419) + label(128, 350, 'crotch') + label(128, 361, 'to floor');
      },
      garment: function () { return trousers() + '<line class="ma-tape" x1="122" y1="106" x2="136" y2="238" marker-start="url(#ma-arr)" marker-end="url(#ma-arr)"/>' + label(140, 170, 'inside leg seam,') + label(140, 181, 'crotch to hem'); }
    },
    backNeckFloor: {
      body: function () {
        return body('back') + dot(120, 79, 'C7: the bump at', 'start', 8, -6) + label(128, 84, 'the base of the neck') +
          '<line class="ma-tape back" x1="120" y1="82" x2="120" y2="262"/>' + arrow(120, 82, 120, 419);
      }
    },
    waistHeight: {
      body: function () {
        return body('front') + girth(196, 31, 7) + dot(120, 200, '') + label(158, 190, 'string at the navel') +
          arrow(176, 200, 176, 419) + label(182, 320, 'to the floor');
      }
    },
    faceLength: {
      body: function () {
        return '<ellipse class="ma-body" cx="120" cy="190" rx="64" ry="88"/><ellipse class="ma-body" cx="54" cy="190" rx="9" ry="20"/><ellipse class="ma-body" cx="186" cy="190" rx="9" ry="20"/>' +
          '<path class="ma-detail" d="M86 160 q14 -8 26 0 M128 160 q14 -8 26 0 M120 180 l-6 30 h12 M102 240 q18 8 36 0"/>' +
          '<ellipse class="ma-detail" cx="99" cy="176" rx="9" ry="5"/><ellipse class="ma-detail" cx="141" cy="176" rx="9" ry="5"/>' +
          dot(120, 170, 'bridge of the nose', 'start', 10, -4) + dot(120, 277, 'chin', 'start', 10, 4) +
          arrow(232, 170, 232, 277) + label(226, 228, 'chin to bridge', 'end');
      }
    },
    faceWidth: {
      body: function () {
        return '<ellipse class="ma-body" cx="120" cy="190" rx="64" ry="88"/><ellipse class="ma-body" cx="54" cy="190" rx="9" ry="20"/><ellipse class="ma-body" cx="186" cy="190" rx="9" ry="20"/>' +
          '<path class="ma-detail" d="M86 160 q14 -8 26 0 M128 160 q14 -8 26 0 M120 180 l-6 30 h12 M102 240 q18 8 36 0"/>' +
          '<ellipse class="ma-detail" cx="99" cy="176" rx="9" ry="5"/><ellipse class="ma-detail" cx="141" cy="176" rx="9" ry="5"/>' +
          '<rect class="ma-prop" x="40" y="198" width="160" height="12"/>' +
          (function () { let t = ''; for (let i = 0; i <= 16; i++) t += '<line class="ma-detail" x1="' + (40 + i * 10) + '" y1="198" x2="' + (40 + i * 10) + '" y2="' + (i % 5 ? 203 : 206) + '"/>'; return t; })() +
          arrow(57, 222, 183, 222) + label(120, 240, 'cheekbone to cheekbone, ruler level', 'middle');
      },
      garment: function () { return glasses() + arrow(18, 140, 222, 140) + label(120, 134, 'whole frame front', 'middle'); }
    }
  };

  /* The front outline with its heights remapped (map: drawing y to new y), for the Proportion
     figure drawn to the person's own proportions. */
  function figure(map) {
    const pts = OUTLINE.map(function (p) { return [p[0], +map(p[1]).toFixed(1)]; });
    const t = map(15), b = map(65);
    return '<path class="ma-body" d="' + smooth(pts, true) + '"/>' +
      '<ellipse class="ma-body" cx="120" cy="' + ((t + b) / 2).toFixed(1) + '" rx="19" ry="' + ((b - t) / 2).toFixed(1) + '"/>' +
      '<line class="ma-floor" x1="30" y1="' + map(421).toFixed(1) + '" x2="210" y2="' + map(421).toFixed(1) + '"/>';
  }

  function draw(key, method) {
    const a = ART[key];
    if (!a) return '';
    if (method === 'garment') {
      if (!a.garment) return '';
      return svg('0 0 240 260', a.garment(), 'How to measure this from a garment');
    }
    return svg(key === 'faceWidth' ? '0 60 240 220' : key === 'faceLength' ? '0 80 260 220' : '-34 0 300 430', a.body(), 'How to measure this on the body');
  }
  function hasGarment(key) { return !!(ART[key] && ART[key].garment); }

  window.VMEASURE = { draw: draw, hasGarment: hasGarment, figure: figure };
})();
