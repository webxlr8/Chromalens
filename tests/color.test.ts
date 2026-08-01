import { describe, expect, it } from 'vitest';
import {
  deltaE76,
  deltaE2000,
  getColorName,
  getHarmonies,
  hexToHsl,
  hexToRgb,
  kMeansClustering,
  labToRgb,
  rgbToLab,
} from '../utils/color';

// --- Ported from test_utils.mjs (31 assertions) ---

describe('RGB → LAB → RGB roundtrip', () => {
  const roundtripColors = [
    { r: 255, g: 0, b: 0, name: 'Red' },
    { r: 0, g: 255, b: 0, name: 'Green' },
    { r: 0, g: 0, b: 255, name: 'Blue' },
    { r: 255, g: 255, b: 255, name: 'White' },
    { r: 0, g: 0, b: 0, name: 'Black' },
    { r: 128, g: 128, b: 128, name: 'Gray' },
    { r: 255, g: 165, b: 0, name: 'Orange' },
  ];

  it.each(roundtripColors)('roundtrips $name ($r,$g,$b)', ({ r, g, b }) => {
    const lab = rgbToLab(r, g, b);
    const rgb = labToRgb(lab.L, lab.a, lab.b);
    expect(Math.abs(rgb.r - r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - b)).toBeLessThanOrEqual(1);
  });
});

describe('DeltaE76 & DeltaE2000', () => {
  const black = rgbToLab(0, 0, 0);
  const white = rgbToLab(255, 255, 255);
  const red = rgbToLab(255, 0, 0);
  const nearRed = rgbToLab(250, 5, 5);

  it('Black vs White ΔE76 > 100', () => {
    expect(deltaE76(black, white)).toBeGreaterThan(100);
  });
  it('Red vs NearRed ΔE76 < 10', () => {
    expect(deltaE76(red, nearRed)).toBeLessThan(10);
  });
  it('Black vs White ΔE00 > 50', () => {
    expect(deltaE2000(black, white)).toBeGreaterThan(50);
  });
  it('Red vs NearRed ΔE00 < 5', () => {
    expect(deltaE2000(red, nearRed)).toBeLessThan(5);
  });
  it('Red vs Red ΔE00 = 0', () => {
    expect(deltaE2000(red, red)).toBe(0);
  });
});

describe('Color Name Search (CIEDE2000 VP-Tree)', () => {
  const nameTests = [
    { hex: '#ff0000', expected: 'Red' },
    { hex: '#fe0000', expected: 'Red' },
    { hex: '#00ff00', expected: 'Lime' },
    { hex: '#0000ff', expected: 'Blue' },
    { hex: '#ffffff', expected: 'White' },
    { hex: '#000000', expected: 'Black' },
    { hex: '#ff8c00', expected: 'DarkOrange' },
    { hex: '#4b0083', expected: 'Indigo' },
    { hex: '#808081', expected: 'Gray' },
  ];

  it.each(nameTests)('$hex → "$expected"', ({ hex, expected }) => {
    const name = getColorName(hex);
    expect(name.includes(expected) || expected.includes(name)).toBe(true);
  });
});

describe('K-Means Clustering (CIELAB space)', () => {
  const rawPixels: [number, number, number][] = [
    [255, 0, 0], [255, 5, 5], [250, 0, 0],
    [0, 255, 0], [0, 250, 0],
    [0, 0, 255],
  ];

  it('finds 3 clusters', () => {
    expect(kMeansClustering(rawPixels, 3)).toHaveLength(3);
  });

  it('outputs valid RGB values in [0-255]', () => {
    const clusters = kMeansClustering(rawPixels, 3);
    for (const c of clusters) {
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(255);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(255);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(255);
    }
  });

  it('counts sum to total pixels', () => {
    const clusters = kMeansClustering(rawPixels, 3);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(rawPixels.length);
  });
});

describe('K-Means performance (1000 pixels, k=5)', () => {
  it('completes under 2000ms', () => {
    const randomPixels: [number, number, number][] = Array.from({ length: 1000 }, () => [
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
    ]);
    const start = performance.now();
    kMeansClustering(randomPixels, 5);
    const time = performance.now() - start;
    expect(time).toBeLessThan(2000);
  });
});

describe('Advanced Harmonies', () => {
  const harmonies = getHarmonies('#ff0000');

  it('includes split-complementary, tetradic, square', () => {
    expect(Object.keys(harmonies)).toEqual(
      expect.arrayContaining(['split-complementary', 'tetradic', 'square']),
    );
  });
  it('split-complementary has 3 colors', () => {
    expect(harmonies['split-complementary']).toHaveLength(3);
  });
  it('tetradic has 4 colors', () => {
    expect(harmonies.tetradic).toHaveLength(4);
  });
  it('square has 4 colors', () => {
    expect(harmonies.square).toHaveLength(4);
  });
});

// --- Ported from test_node.js (15 assertions) ---

describe('hexToRgb', () => {
  it.each([
    ['#000000', { r: 0, g: 0, b: 0 }],
    ['#FFFFFF', { r: 255, g: 255, b: 255 }],
    ['#FF0000', { r: 255, g: 0, b: 0 }],
    ['#00FF00', { r: 0, g: 255, b: 0 }],
    ['#0000FF', { r: 0, g: 0, b: 255 }],
  ])('parses %s', (hex, expected) => {
    expect(hexToRgb(hex)).toEqual(expected);
  });
});

describe('hexToHsl', () => {
  it.each([
    ['#000000', { h: 0, s: 0, l: 0 }],
    ['#FFFFFF', { h: 0, s: 0, l: 100 }],
    ['#FF0000', { h: 0, s: 100, l: 50 }],
    ['#00FF00', { h: 120, s: 100, l: 50 }],
    ['#0000FF', { h: 240, s: 100, l: 50 }],
  ])('converts %s', (hex, expected) => {
    expect(hexToHsl(hex)).toEqual(expected);
  });
});

describe('Harmonies (Red #FF0000)', () => {
  const redHarmonies = getHarmonies('#FF0000');

  it('complementary is cyan', () => {
    expect(redHarmonies.complementary[1]).toBe('#00ffff');
  });
  it('triadic colors are green and blue', () => {
    expect(redHarmonies.triadic[1]).toBe('#00ff00');
    expect(redHarmonies.triadic[2]).toBe('#0000ff');
  });
  it('analogous colors are rose and orange', () => {
    expect(redHarmonies.analogous[0]).toBe('#ff0080');
    expect(redHarmonies.analogous[2]).toBe('#ff8000');
  });
});
