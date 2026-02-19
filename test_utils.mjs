import { getColorName, kMeansClustering, rgbToLab, labToRgb, deltaE76, deltaE2000, getHarmonies } from './utils.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}`);
        failed++;
    }
}

// --- Test 1: RGB → LAB → RGB roundtrip ---
console.log('--- Test 1: RGB → LAB → RGB Roundtrip ---');
const roundtripColors = [
    { r: 255, g: 0, b: 0, name: 'Red' },
    { r: 0, g: 255, b: 0, name: 'Green' },
    { r: 0, g: 0, b: 255, name: 'Blue' },
    { r: 255, g: 255, b: 255, name: 'White' },
    { r: 0, g: 0, b: 0, name: 'Black' },
    { r: 128, g: 128, b: 128, name: 'Gray' },
    { r: 255, g: 165, b: 0, name: 'Orange' }
];

roundtripColors.forEach(c => {
    const lab = rgbToLab(c.r, c.g, c.b);
    const rgb = labToRgb(lab.L, lab.a, lab.b);
    const closeEnough = Math.abs(rgb.r - c.r) <= 1 && Math.abs(rgb.g - c.g) <= 1 && Math.abs(rgb.b - c.b) <= 1;
    assert(closeEnough, `${c.name}: (${c.r},${c.g},${c.b}) → LAB(${lab.L.toFixed(1)},${lab.a.toFixed(1)},${lab.b.toFixed(1)}) → (${rgb.r},${rgb.g},${rgb.b})`);
});

// --- Test 2: Delta E values ---
console.log('\n--- Test 2: DeltaE76 & DeltaE2000 ---');
const black = rgbToLab(0, 0, 0);
const white = rgbToLab(255, 255, 255);
const red = rgbToLab(255, 0, 0);
const nearRed = rgbToLab(250, 5, 5);

assert(deltaE76(black, white) > 100, `Black vs White ΔE76 = ${deltaE76(black, white).toFixed(2)} (should be >100)`);
assert(deltaE76(red, nearRed) < 10, `Red vs NearRed ΔE76 = ${deltaE76(red, nearRed).toFixed(2)} (should be <10)`);
assert(deltaE2000(black, white) > 50, `Black vs White ΔE00 = ${deltaE2000(black, white).toFixed(2)} (should be >50)`);
assert(deltaE2000(red, nearRed) < 5, `Red vs NearRed ΔE00 = ${deltaE2000(red, nearRed).toFixed(2)} (should be <5)`);
assert(deltaE2000(red, red) === 0, `Red vs Red ΔE00 = ${deltaE2000(red, red).toFixed(4)} (should be 0)`);

// --- Test 3: Color Name Search (CIEDE2000 VP-Tree) ---
console.log('\n--- Test 3: Color Name Search (CIEDE2000 VP-Tree) ---');
const nameTests = [
    { hex: '#ff0000', expected: 'Red' },
    { hex: '#fe0000', expected: 'Red' },
    { hex: '#00ff00', expected: 'Lime' },
    { hex: '#0000ff', expected: 'Blue' },
    { hex: '#ffffff', expected: 'White' },
    { hex: '#000000', expected: 'Black' },
    { hex: '#ff8c00', expected: 'DarkOrange' },     // DarkOrange → exact match
    { hex: '#4b0083', expected: 'Indigo' },     // Near-Indigo
    { hex: '#808081', expected: 'Gray' },        // Near-Gray
];

nameTests.forEach(test => {
    const name = getColorName(test.hex);
    const pass = name.includes(test.expected) || test.expected.includes(name);
    assert(pass, `${test.hex} → "${name}" (expected: "${test.expected}")`);
});

// --- Test 4: K-Means Clustering (CIELAB) ---
console.log('\n--- Test 4: K-Means Clustering (CIELAB space) ---');

const rawPixels = [
    [255, 0, 0], [255, 5, 5], [250, 0, 0],
    [0, 255, 0], [0, 250, 0],
    [0, 0, 255]
];
const clusters1 = kMeansClustering(rawPixels, 3);
assert(clusters1.length === 3, `3 clusters found: ${clusters1.length}`);

// Check that output RGB values are valid (0–255)
const allValid = clusters1.every(c => c.r >= 0 && c.r <= 255 && c.g >= 0 && c.g <= 255 && c.b >= 0 && c.b <= 255);
assert(allValid, `All cluster RGB values in valid range [0–255]`);

// Check counts sum to total
const totalCount = clusters1.reduce((s, c) => s + c.count, 0);
assert(totalCount === rawPixels.length, `Total count: ${totalCount} === ${rawPixels.length}`);

// --- Test 5: Performance ---
console.log('\n--- Test 5: Performance (1000 pixels, k=5) ---');
const randomPixels = Array.from({ length: 1000 }, () => [
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255)
]);
const start = performance.now();
kMeansClustering(randomPixels, 5);
const end = performance.now();
const time = (end - start).toFixed(2);
assert(parseFloat(time) < 2000, `Completed in ${time}ms (threshold: 2000ms)`);

// --- Test 6: Advanced Harmonies ---
console.log('\n--- Test 6: Advanced Harmonies ---');
const harmonies = getHarmonies('#ff0000'); // Red
const keys = Object.keys(harmonies);
assert(keys.includes('split-complementary'), 'Has split-complementary');
assert(keys.includes('tetradic'), 'Has tetradic');
assert(keys.includes('square'), 'Has square');

// Check Split-Complementary for Red (0deg): should be 150deg (Green-ish) and 210deg (Blue-ish)
// Red #ff0000 -> H=0
// +150 = #00ff80 (approx)
// +210 = #0080ff (approx)
// We just check they exist and are not null for now
assert(harmonies['split-complementary'].length === 3, 'Split-complementary has 3 colors');
assert(harmonies['tetradic'].length === 4, 'Tetradic has 4 colors');
assert(harmonies['square'].length === 4, 'Square has 4 colors');

// --- Summary ---
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
