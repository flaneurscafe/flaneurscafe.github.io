/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — colour maths. sRGB <-> linear <-> XYZ (D65) <-> CIELAB, OKLCH, CIEDE2000.
   Plain script: exposes window.VC so the tool also runs from file:// */
(function () {
  'use strict';

  function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(v) {
    v = Math.max(0, Math.min(1, v));
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(c * 255);
  }
  function hexToRgb(hex) {
    hex = String(hex).replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(function (x) { return x + x; }).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(function (x) {
      return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    }).join('');
  }
  function linToXyz(l) {
    const r = l[0], g = l[1], b = l[2];
    return [
      0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
      0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
      0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    ];
  }
  const WN = [0.95047, 1.0, 1.08883];
  function xyzToLab(xyz) {
    const f = function (t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; };
    const fx = f(xyz[0] / WN[0]), fy = f(xyz[1] / WN[1]), fz = f(xyz[2] / WN[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function rgbToLab(rgb) { return xyzToLab(linToXyz(rgb.map(srgbToLinear))); }
  function hexToLab(hex) { return rgbToLab(hexToRgb(hex)); }
  function xyzToLin(x) {
    return [
      3.2404542 * x[0] - 1.5371385 * x[1] - 0.4985314 * x[2],
      -0.9692660 * x[0] + 1.8760108 * x[1] + 0.0415560 * x[2],
      0.0556434 * x[0] - 0.2040259 * x[1] + 1.0572252 * x[2]
    ];
  }
  function labToXyz(lab) {
    const fy = (lab[0] + 16) / 116, fx = fy + lab[1] / 500, fz = fy - lab[2] / 200;
    const g = function (t) { return t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) * 27 / 24389; };
    return [g(fx) * WN[0], g(fy) * WN[1], g(fz) * WN[2]];
  }
  /* Out-of-gamut results are clipped per channel, which is good enough for the small
     shifts Valet uses this for (shading a skin tone, drawing lips). */
  function labToHex(lab) { return rgbToHex(xyzToLin(labToXyz(lab)).map(linearToSrgb)); }

  function labToLch(lab) {
    const C = Math.hypot(lab[1], lab[2]);
    let h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
    if (h < 0) h += 360;
    return [lab[0], C, h];
  }

  function rgbToOklch(rgb) {
    const lin = rgb.map(srgbToLinear), r = lin[0], g = lin[1], b = lin[2];
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const C = Math.hypot(A, B);
    let h = Math.atan2(B, A) * 180 / Math.PI;
    if (h < 0) h += 360;
    return [L, C, h];
  }

  /* OKLCH -> sRGB, or null when the colour cannot be shown on an sRGB screen. */
  function oklchToRgb(lch) {
    const h = lch[2] * Math.PI / 180, A = lch[1] * Math.cos(h), B = lch[1] * Math.sin(h), L = lch[0];
    const l_ = L + 0.3963377774 * A + 0.2158037573 * B, m_ = L - 0.1055613458 * A - 0.0638541728 * B, s_ = L - 0.0894841775 * A - 1.2914855480 * B;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, t = s_ * s_ * s_;
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * t,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * t,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * t];
    if (Math.min(lin[0], lin[1], lin[2]) < -0.002 || Math.max(lin[0], lin[1], lin[2]) > 1.002) return null;
    return lin.map(linearToSrgb);
  }

  /* CIEDE2000 (Sharma, Wu & Dalal 2005), kL = kC = kH = 1 */
  function deltaE2000(lab1, lab2) {
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    const L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
    const Cb7 = Math.pow(Cb, 7);
    const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const hp = function (a, b) {
      if (a === 0 && b === 0) return 0;
      let h = Math.atan2(b, a) * deg;
      return h < 0 ? h + 360 : h;
    };
    const h1p = hp(a1p, b1), h2p = hp(a2p, b2);
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
    const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp;
    if (C1p * C2p === 0) hbp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
    const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad)
      + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
    const Cbp7 = Math.pow(Cbp, 7);
    const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
    const Sl = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
    const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2)
      + Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  /* White balance: a von Kries scaling in the Bradford cone space (Lam 1985), the transform
     used for chromatic adaptation in ICC colour management. The paper sample is mapped to a
     neutral D65 white at Y = 0.88 (L* ≈ 95), which also normalises exposure.
     Scaling linear sRGB channels directly would drift for saturated samples, because
     sRGB primaries are not cone responses. */
  const WHITE_TARGET = 0.88;
  const BFD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
  const BFD_INV = [[0.9869929, -0.1470543, 0.1599627], [0.4323053, 0.5183603, 0.0492912], [-0.0085287, 0.0400428, 0.9684867]];
  function mul3(m, v) {
    return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
  }
  function whiteBalance(rgb, whiteRgb) {
    if (!whiteRgb) return rgb.slice();
    const wXyz = linToXyz(whiteRgb.map(srgbToLinear));
    if (wXyz[1] < 0.02) return rgb.slice(); // not a usable white
    const src = mul3(BFD, wXyz);
    const dst = mul3(BFD, WN.map(function (v) { return v * WHITE_TARGET; }));
    const cone = mul3(BFD, linToXyz(rgb.map(srgbToLinear)));
    const adapted = cone.map(function (v, i) { return v * dst[i] / Math.max(src[i], 1e-4); });
    return xyzToLin(mul3(BFD_INV, adapted)).map(linearToSrgb);
  }
  /* Is the white sample usable as a reference? Returns null when it is, or a short reason. */
  function whiteProblem(whiteHex) {
    if (!whiteHex) return null;
    const rgb = hexToRgb(whiteHex);
    const lch = labToLch(rgbToLab(rgb));
    if (Math.max(rgb[0], rgb[1], rgb[2]) >= 252) return 'The paper is blown out to pure white, so its colour cast is lost. Retake the photo a little darker.';
    if (lch[0] < 55) return 'The paper sample is dark. If the paper was in shadow while your face was not, the correction will be wrong.';
    if (lch[1] > 30) return 'The paper sample is strongly coloured. Check you clicked the paper; if you did, the light is too coloured to correct well.';
    return null;
  }

  /* Perceived temperature of a colour from its CIELAB hue angle, -1 (cool) .. +1 (warm).
     A convention used in colour theory: reds-oranges-yellows warm, greens-blues-violets cool,
     with blue-reds (burgundy, rose) near neutral. */
  const TEMP_TABLE = [
    [0, -0.2], [20, 0.1], [35, 0.6], [60, 1], [90, 0.9], [110, 0.5], [135, 0.1],
    [160, -0.4], [200, -0.9], [250, -1], [290, -0.8], [320, -0.5], [345, -0.35], [360, -0.2]
  ];
  function hueTemperature(h) {
    for (let i = 1; i < TEMP_TABLE.length; i++) {
      if (h <= TEMP_TABLE[i][0]) {
        const a = TEMP_TABLE[i - 1], b = TEMP_TABLE[i];
        const t = (h - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return -0.2;
  }

  window.VC = {
    srgbToLinear: srgbToLinear, linearToSrgb: linearToSrgb,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToLab: rgbToLab, hexToLab: hexToLab, labToHex: labToHex,
    labToLch: labToLch, rgbToOklch: rgbToOklch, oklchToRgb: oklchToRgb, deltaE2000: deltaE2000,
    whiteBalance: whiteBalance, whiteProblem: whiteProblem, hueTemperature: hueTemperature
  };
})();
