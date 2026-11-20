/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — how fine detail survives distance. The eye's contrast sensitivity (Barten 1999), the
   size of a pattern in degrees, and the colour channels' lower limit (Mullen 1985).
   Plain script: exposes window.VVIS; loads without a DOM (for tests). */
(function () {
  'use strict';

  /* Barten (1999) contrast sensitivity function, with the parameters of ITU-R BT.2246 as
     implemented in the colour-science library (checked: S(4 c/deg) = 360.869 with its defaults).
     u: spatial frequency in cycles per degree. L: mean luminance in cd/m². X0: field size in
     degrees. Returns sensitivity: the reciprocal of the smallest visible modulation. */
  function pupil(L, X0) { return 5 - 3 * Math.tanh(0.4 * Math.log10(L * X0 * X0 / 1600)); }
  function csf(u, L, X0) {
    const k = 3.0, T = 0.1, Xmax = 12, Nmax = 15, n = 0.03, p = 1.2274e6, phi0 = 3e-8, u0 = 7;
    const d = pupil(L, X0);
    const sigma = Math.hypot(0.5 / 60, 0.08 / 60 * d);
    const E = Math.PI * d * d / 4 * L * (1 - Math.pow(d / 9.7, 2) + Math.pow(d / 12.4, 4));
    return csfRaw(u, sigma, k, T, X0, Xmax, Nmax, n, p, E, phi0, u0);
  }
  function csfRaw(u, sigma, k, T, X0, Xmax, Nmax, n, p, E, phi0, u0) {
    const Mopt = Math.exp(-2 * Math.PI * Math.PI * sigma * sigma * u * u);
    const X = Math.pow(1 / (X0 * X0) + 1 / (Xmax * Xmax) + u * u / (Nmax * Nmax), -0.5);
    const Mas = 1 / (X * X);
    return (Mopt / k) / Math.sqrt(2 / T * Mas * (1 / (n * p * E) + phi0 / (1 - Math.exp(-Math.pow(u / u0, 2)))));
  }

  /* Viewing conditions (working values, badge B). A well-lit room of about 300 lux: a matte
     surface of luminance factor Y reaches Y × 300 / π cd/m². The field is the front of a
     jacket or shirt, about 40 cm across. Across a street (10 m) is outdoors: overcast daylight,
     about 5,000 lux (dull overcast is near 1,000, bright overcast near 10,000). */
  const LUX = 300, DAYLIGHT_LUX = 5000, FIELD_CM = 40;
  const DISTANCES = [{ m: 1, label: 'at 1 m', note: 'talking' }, { m: 3, label: 'at 3 m', note: 'across a room' }, { m: 10, label: 'at 10 m', note: 'across a street, in daylight' }];
  function luxAt(m) { return m >= 10 ? DAYLIGHT_LUX : LUX; }
  function luminance(Y, m) { return Math.max(1e-3, Y * (m == null ? LUX : luxAt(m)) / Math.PI); }
  function degrees(cm, m) { return 2 * Math.atan(cm / 200 / m) * 180 / Math.PI; }
  /* Spatial frequency, in cycles per degree, of something that repeats `cycles` times per `cm`. */
  function cpd(cycles, cm, m) { return cycles / degrees(cm, m); }
  /* Smallest visible modulation (contrast) at a frequency, for cloth of luminance factor Y. */
  function threshold(f, Y, m) {
    const X0 = Math.max(0.5, Math.min(60, degrees(FIELD_CM, m)));
    const u = Math.max(0.2, f);
    return 1 / csf(u, luminance(Y, m), X0);
  }

  /* Colour without lightness difference. Mullen (1985): red-green and blue-yellow sensitivity is
     low-pass and reaches its limit at 11–12 c/deg. Modelled as a smooth factor on a colour
     difference: half at 5 c/deg, under 2% by 12 (an approximation, badge B). */
  const CHROMA_HALF = 5;
  function chromaPass(f) { return Math.exp(-Math.LN2 * Math.pow(f / CHROMA_HALF, 2)); }

  /* The frequency at which a grating of modulation c stops being visible: where the threshold
     rises to c. Above the peak the threshold only rises, so bisection on [peak, 80] is safe. */
  function limitFor(c, Y, m) {
    if (c <= threshold(2, Y, m)) return 0;
    let lo = 2, hi = 80;
    if (threshold(hi, Y, m) <= c) return hi;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (threshold(mid, Y, m) < c) lo = mid; else hi = mid; }
    return lo;
  }

  window.VVIS = { csf: csf, threshold: threshold, chromaPass: chromaPass, limitFor: limitFor, degrees: degrees, cpd: cpd, luminance: luminance,
    DISTANCES: DISTANCES, LUX: LUX, DAYLIGHT_LUX: DAYLIGHT_LUX, FIELD_CM: FIELD_CM, CHROMA_HALF: CHROMA_HALF };
})();
