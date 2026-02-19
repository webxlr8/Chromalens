import { hexToRgb, hexToHsl, getHarmonies } from './utils.js';

let passed = 0;
let failed = 0;

function assert(message, actual, expected) {
    const match = JSON.stringify(actual) === JSON.stringify(expected);
    if (match) {
        console.log(`✓ ${message}`);
        passed++;
    } else {
        console.error(`✗ ${message}`);
        console.error(`  Expected: ${JSON.stringify(expected)}`);
        console.error(`  Got:      ${JSON.stringify(actual)}`);
        failed++;
    }
}

console.log('Running Color Picker Tests...\n');

try {
    // Hex to RGB
    assert('hexToRgb #000000', hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
    assert('hexToRgb #FFFFFF', hexToRgb('#FFFFFF'), { r: 255, g: 255, b: 255 });
    assert('hexToRgb #FF0000', hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
    assert('hexToRgb #00FF00', hexToRgb('#00FF00'), { r: 0, g: 255, b: 0 });
    assert('hexToRgb #0000FF', hexToRgb('#0000FF'), { r: 0, g: 0, b: 255 });

    // Hex to HSL
    assert('hexToHsl #000000', hexToHsl('#000000'), { h: 0, s: 0, l: 0 });
    assert('hexToHsl #FFFFFF', hexToHsl('#FFFFFF'), { h: 0, s: 0, l: 100 });
    assert('hexToHsl #FF0000', hexToHsl('#FF0000'), { h: 0, s: 100, l: 50 });
    assert('hexToHsl #00FF00', hexToHsl('#00FF00'), { h: 120, s: 100, l: 50 });
    assert('hexToHsl #0000FF', hexToHsl('#0000FF'), { h: 240, s: 100, l: 50 });

    // Harmonies
    // Red #FF0000 -> H:0, S:100, L:50
    // Complementary: H:180 (Cyan #00FFFF)
    const redHarmonies = getHarmonies('#FF0000');
    assert('Red Complementary', redHarmonies.complementary[1], '#00ffff');

    // Triadic: +120 (Green #00FF00), +240 (Blue #0000FF)
    assert('Red Triadic 1', redHarmonies.triadic[1], '#00ff00');
    assert('Red Triadic 2', redHarmonies.triadic[2], '#0000ff');

    // Analogous: -30 (Rose #FF0080), +30 (Orange #FF8000)
    assert('Red Analogous 1', redHarmonies.analogous[0], '#ff0080');
    assert('Red Analogous 2', redHarmonies.analogous[2], '#ff8000');

} catch (e) {
    console.error(`FATAL ERROR: ${e.message}`);
    failed++;
}

console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);

if (failed > 0) process.exit(1);
