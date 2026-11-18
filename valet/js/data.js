/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — reference data. Colour names follow common menswear usage; hex values are
   representative cloth colours, not brand-specific. */
(function () {
  'use strict';
  window.VDATA = {
    colours: [
      // Neutrals
      { name: 'White', hex: '#f7f6f2', family: 'Neutral' },
      { name: 'Écru', hex: '#ece4d2', family: 'Neutral' },
      { name: 'Cream', hex: '#efe3c4', family: 'Neutral' },
      { name: 'Stone', hex: '#c9bfa8', family: 'Neutral' },
      { name: 'Oatmeal', hex: '#cdbfa3', family: 'Neutral' },
      { name: 'Beige', hex: '#d3c1a0', family: 'Neutral' },
      { name: 'Khaki', hex: '#b39b6d', family: 'Neutral' },
      { name: 'Camel', hex: '#c19a6b', family: 'Neutral' },
      { name: 'Tan', hex: '#a7774a', family: 'Neutral' },
      { name: 'Taupe', hex: '#8f8172', family: 'Neutral' },
      { name: 'Mid brown', hex: '#7a5537', family: 'Neutral' },
      { name: 'Chocolate', hex: '#4a3326', family: 'Neutral' },
      { name: 'Light grey', hex: '#c9cbcd', family: 'Neutral' },
      { name: 'Mid grey', hex: '#8e9196', family: 'Neutral' },
      { name: 'Charcoal', hex: '#3d4045', family: 'Neutral' },
      { name: 'Black', hex: '#161616', family: 'Neutral' },
      { name: 'Navy', hex: '#1d2a44', family: 'Neutral' },
      { name: 'Ivory', hex: '#f2ecdc', family: 'Neutral' },
      { name: 'Sand', hex: '#d8c49c', family: 'Neutral' },
      { name: 'Greige', hex: '#b6ad9f', family: 'Neutral' },
      { name: 'Mushroom', hex: '#a99d8c', family: 'Neutral' },
      { name: 'Tobacco', hex: '#6e4a2a', family: 'Neutral' },
      { name: 'Cognac', hex: '#8e4a22', family: 'Neutral' },
      { name: 'Graphite', hex: '#55585d', family: 'Neutral' },
      { name: 'Anthracite', hex: '#2f3236', family: 'Neutral' },
      { name: 'Ink', hex: '#1a2233', family: 'Neutral' },
      { name: 'Midnight', hex: '#141c2e', family: 'Neutral' },
      // Blues
      { name: 'Powder blue', hex: '#d6e2ee', family: 'Blue' },
      { name: 'Light blue', hex: '#c3d7ee', family: 'Blue' },
      { name: 'Sky blue', hex: '#a6c6e8', family: 'Blue' },
      { name: 'Cornflower', hex: '#6a8fd0', family: 'Blue' },
      { name: 'French blue', hex: '#5b7fbf', family: 'Blue' },
      { name: 'Royal blue', hex: '#2f4fb3', family: 'Blue' },
      { name: 'Slate blue', hex: '#5a6f8c', family: 'Blue' },
      { name: 'Petrol', hex: '#24535e', family: 'Blue' },
      { name: 'Teal', hex: '#1f6f73', family: 'Blue' },
      { name: 'Ice blue', hex: '#dde9f3', family: 'Blue' },
      { name: 'Duck egg', hex: '#c4ddd8', family: 'Blue' },
      { name: 'Steel blue', hex: '#4a6a8a', family: 'Blue' },
      { name: 'Cobalt', hex: '#2a52be', family: 'Blue' },
      { name: 'Marine', hex: '#22355e', family: 'Blue' },
      // Greens
      { name: 'Mint', hex: '#bfe3cf', family: 'Green' },
      { name: 'Sage', hex: '#9aa58a', family: 'Green' },
      { name: 'Olive', hex: '#6b6a3a', family: 'Green' },
      { name: 'Loden', hex: '#59614a', family: 'Green' },
      { name: 'Emerald', hex: '#1f7a52', family: 'Green' },
      { name: 'Forest', hex: '#2d4a32', family: 'Green' },
      { name: 'Bottle green', hex: '#1f4635', family: 'Green' },
      { name: 'Moss', hex: '#6b7350', family: 'Green' },
      { name: 'Hunter', hex: '#2f4f3a', family: 'Green' },
      { name: 'Pine', hex: '#234238', family: 'Green' },
      // Reds and pinks
      { name: 'Pale pink', hex: '#efd3d8', family: 'Red' },
      { name: 'Dusty pink', hex: '#c99a9e', family: 'Red' },
      { name: 'Rose', hex: '#d89aa7', family: 'Red' },
      { name: 'Salmon', hex: '#f0a68f', family: 'Red' },
      { name: 'Coral', hex: '#ee7f62', family: 'Red' },
      { name: 'Tomato', hex: '#d9472b', family: 'Red' },
      { name: 'Crimson', hex: '#a51e34', family: 'Red' },
      { name: 'Burgundy', hex: '#5e1f2c', family: 'Red' },
      { name: 'Wine', hex: '#6e2236', family: 'Red' },
      { name: 'Oxblood', hex: '#4e1c1f', family: 'Red' },
      { name: 'Brick', hex: '#9a3b28', family: 'Red' },
      { name: 'Rust', hex: '#a4532c', family: 'Red' },
      { name: 'Raspberry', hex: '#b3285c', family: 'Red' },
      { name: 'Claret', hex: '#6a1a2a', family: 'Red' },
      { name: 'Terracotta', hex: '#b5583a', family: 'Red' },
      // Yellows and oranges
      { name: 'Butter', hex: '#f2e3a1', family: 'Yellow' },
      { name: 'Mustard', hex: '#c69a2b', family: 'Yellow' },
      { name: 'Gold', hex: '#c8a24a', family: 'Yellow' },
      { name: 'Ochre', hex: '#b5832e', family: 'Yellow' },
      { name: 'Orange', hex: '#e07a2a', family: 'Yellow' },
      { name: 'Pumpkin', hex: '#c0612a', family: 'Yellow' },
      { name: 'Peach', hex: '#f3c3a0', family: 'Yellow' },
      { name: 'Apricot', hex: '#f0b27a', family: 'Yellow' },
      { name: 'Saffron', hex: '#e3a21a', family: 'Yellow' },
      // Purples
      { name: 'Lavender', hex: '#c8c0e0', family: 'Purple' },
      { name: 'Lilac', hex: '#b9a6cf', family: 'Purple' },
      { name: 'Purple', hex: '#5b3d8c', family: 'Purple' },
      { name: 'Plum', hex: '#5a2d4f', family: 'Purple' },
      { name: 'Aubergine', hex: '#3b2238', family: 'Purple' },
      { name: 'Mauve', hex: '#a87b9a', family: 'Purple' },
      { name: 'Heather', hex: '#8f8aa3', family: 'Purple' }
    ],

    /* Named classes for your own colouring. Each name maps to a representative colour so nobody has
       to mix a skin tone on sliders. Values are CIELAB lightness, chroma and hue as the feature
       reads in a daylight photo corrected against white paper; they are typical, not standards.
       - Skin: a ten-step depth ladder. Hue comes from the undertone: the engine reads 57° as
         neutral, so pink is 57 - 7 and golden 57 + 7.
       - Hair: the hairdresser's ten depth levels (1 black to 10 lightest blond) and three natural
         reds, with the tone words used on every colour chart (ash, natural, golden).
       - Eyes: the everyday names, in the order of the Martin-Schultz chart (light to dark). */
    features: {
      whiteHair: '#dcdad3',
      skin: {
        depths: [
          { id: 'veryfair', name: 'Very fair', L: 91.5, C: 9 }, { id: 'fair', name: 'Fair', L: 86.5, C: 14 },
          { id: 'light', name: 'Light', L: 81, C: 18 }, { id: 'lightmedium', name: 'Light medium', L: 74.5, C: 23 },
          { id: 'medium', name: 'Medium', L: 67, C: 28 }, { id: 'tan', name: 'Tan', L: 58, C: 31 },
          { id: 'brown', name: 'Brown', L: 47.5, C: 31 }, { id: 'deepbrown', name: 'Deep brown', L: 37, C: 27 },
          { id: 'deep', name: 'Deep', L: 28, C: 21 }, { id: 'verydeep', name: 'Very deep', L: 18, C: 16 }
        ],
        tones: [
          { id: 'pink', name: 'Pink', word: 'cool', dh: -7 },
          { id: 'neutral', name: 'Neutral or not sure', word: 'neutral', dh: 0 },
          { id: 'golden', name: 'Golden', word: 'warm', dh: 7 }
        ]
      },
      hair: {
        bases: [
          { id: 'l1', name: 'Black', level: 1, L: 6, C: 2, h: 50 },
          { id: 'l2', name: 'Darkest brown', level: 2, L: 13, C: 7, h: 52 },
          { id: 'l3', name: 'Dark brown', level: 3, L: 22, C: 14, h: 57 },
          { id: 'l4', name: 'Medium brown', level: 4, L: 32, C: 20, h: 60 },
          { id: 'l5', name: 'Light brown', level: 5, L: 43, C: 25, h: 66 },
          { id: 'l6', name: 'Dark blond', level: 6, L: 53, C: 28, h: 72 },
          { id: 'l7', name: 'Blond', level: 7, L: 63, C: 31, h: 78 },
          { id: 'l8', name: 'Light blond', level: 8, L: 72, C: 31, h: 82 },
          { id: 'l9', name: 'Very light blond', level: 9, L: 80, C: 26, h: 87 },
          { id: 'l10', name: 'Platinum blond', level: 10, L: 87, C: 16, h: 92 },
          { id: 'auburn', name: 'Auburn', red: true, L: 28, C: 28, h: 44 },
          { id: 'red', name: 'Red (copper)', red: true, L: 42, C: 44, h: 50 },
          { id: 'strawberry', name: 'Strawberry blond', red: true, L: 66, C: 34, h: 64 }
        ],
        tones: [
          { id: 'ash', name: 'Ash', kC: 0.5, dh: 12 },
          { id: 'natural', name: 'Natural', kC: 1, dh: 0 },
          { id: 'golden', name: 'Golden', kC: 1.3, dh: 5 }
        ]
      },
      eyes: [
        { id: 'blue', name: 'Blue', hex: '#7fa3c7' }, { id: 'greyblue', name: 'Grey-blue', hex: '#8a9aa6' },
        { id: 'grey', name: 'Grey', hex: '#8c9692' }, { id: 'green', name: 'Green', hex: '#7d8f66' },
        { id: 'hazel', name: 'Hazel', hex: '#8a7f4f' }, { id: 'amber', name: 'Amber', hex: '#a67c3e' },
        { id: 'lightbrown', name: 'Light brown', hex: '#8a6a45' }, { id: 'brown', name: 'Brown', hex: '#6b4a2e' },
        { id: 'darkbrown', name: 'Dark brown', hex: '#3b2618' }
      ]
    },

    /* KP's test profile, no longer offered as a button: the tests load it, and the interface (js/ui) uses its name
       to upgrade profiles saved from it (they were bald). Colours are estimates transcribed from the
       Style Guide's photo analysis (fair, cool-neutral skin; bald, so the medium-brown brows stand
       in for hair; muted hazel eyes with a green-grey cast), not a calibrated photo. */
    kp: {
      name: 'KP (test)',
      note: 'Estimated from earlier photo analysis, not a calibrated photo. Replace with a daylight photo and white reference for a real reading.',
      samples: {
        white: null,
        skin: '#ecc9bd',
        hair: '#775a47',
        eyes: '#74765f'
      },
      manual: { skin: true, hair: true, eyes: true },
      useWhite: true,
      hairStyle: 'none', grey: 0,
      measurements: { height: 185, chest: 103 },
      glasses: 'gold', underEye: 'deep', redness: 'none'
    },

    /* Demo profile: fair, cool-leaning skin, light-brown brows, grey-blue eyes. */
    demo: {
      samples: {
        white: '#f4f1ec',
        skin: '#e7c3b6',
        hair: '#7b5c48',
        eyes: '#6f8290'
      },
      useWhite: true,
      measurements: {
        height: 188, chest: 103, waist: 86, seat: 100, neck: 40,
        shoulder: 47, arm: 66, inseam: 89, backNeckFloor: 160, faceWidth: 14,
        wrist: 17.5, foot: 27.5, head: 58, waistHeight: 112, faceLength: 12
      },
      shape: { shoulders: 'average', stomach: 'average', posture: 'average' },
      hairStyle: 'short',
      glasses: 'gold'
    }
  };
})();
