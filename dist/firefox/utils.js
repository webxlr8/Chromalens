// Utility functions for ChromaLens

// --- Color Conversion ---

import COLOR_NAMES from './color_data.js';

export function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function hexToHsl(hex) {
    let { r, g, b } = hexToRgb(hex);
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

export function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// --- CIELAB Color Space ---

// D65 illuminant reference values
const D65 = { x: 95.047, y: 100.000, z: 108.883 };

export function rgbToLab(r, g, b) {
    // 1. RGB -> linear RGB (sRGB gamma decode)
    let lr = r / 255;
    let lg = g / 255;
    let lb = b / 255;

    lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
    lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
    lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

    // 2. Linear RGB -> XYZ (sRGB D65 matrix)
    let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100;
    let y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750) * 100;
    let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) * 100;

    // 3. XYZ -> Lab
    x /= D65.x;
    y /= D65.y;
    z /= D65.z;

    const epsilon = 0.008856; // (6/29)^3
    const kappa = 903.3;     // (29/3)^3

    x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
    y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
    z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

    const L = 116 * y - 16;
    const A = 500 * (x - y);
    const B = 200 * (y - z);

    return { L, a: A, b: B };
}

export function labToRgb(L, a, b) {
    // 1. Lab -> XYZ
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;

    const epsilon = 0.008856;
    const kappa = 903.3;

    let x = (fx * fx * fx > epsilon) ? fx * fx * fx : (116 * fx - 16) / kappa;
    let y = (L > kappa * epsilon) ? Math.pow((L + 16) / 116, 3) : L / kappa;
    let z = (fz * fz * fz > epsilon) ? fz * fz * fz : (116 * fz - 16) / kappa;

    x *= D65.x / 100;
    y *= D65.y / 100;
    z *= D65.z / 100;

    // 2. XYZ -> linear RGB
    let lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    let lg = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    let lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // 3. Linear RGB -> sRGB (gamma encode)
    lr = lr > 0.0031308 ? 1.055 * Math.pow(lr, 1 / 2.4) - 0.055 : 12.92 * lr;
    lg = lg > 0.0031308 ? 1.055 * Math.pow(lg, 1 / 2.4) - 0.055 : 12.92 * lg;
    lb = lb > 0.0031308 ? 1.055 * Math.pow(lb, 1 / 2.4) - 0.055 : 12.92 * lb;

    return {
        r: Math.round(Math.max(0, Math.min(1, lr)) * 255),
        g: Math.round(Math.max(0, Math.min(1, lg)) * 255),
        b: Math.round(Math.max(0, Math.min(1, lb)) * 255)
    };
}

// CIE76 Delta E — Euclidean distance in Lab (fast, good for clustering)
export function deltaE76(lab1, lab2) {
    return Math.sqrt(
        (lab1.L - lab2.L) ** 2 +
        (lab1.a - lab2.a) ** 2 +
        (lab1.b - lab2.b) ** 2
    );
}

// CIEDE2000 — perceptually accurate color difference
export function deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;

    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    // Step 1: Compute C'ab and h'ab
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cab = (C1 + C2) / 2;

    const Cab7 = Math.pow(Cab, 7);
    const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625))); // 25^7

    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);

    let h1p = Math.atan2(b1, a1p) * deg;
    if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) * deg;
    if (h2p < 0) h2p += 360;

    // Step 2: Compute ΔL', ΔC', ΔH'
    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0) {
        dhp = 0;
    } else if (Math.abs(h2p - h1p) <= 180) {
        dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
        dhp = h2p - h1p - 360;
    } else {
        dhp = h2p - h1p + 360;
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);

    // Step 3: Compute CIEDE2000 ΔE
    const Lp = (L1 + L2) / 2;
    const Cp = (C1p + C2p) / 2;

    let hp;
    if (C1p * C2p === 0) {
        hp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
        hp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
        hp = (h1p + h2p + 360) / 2;
    } else {
        hp = (h1p + h2p - 360) / 2;
    }

    const T = 1
        - 0.17 * Math.cos((hp - 30) * rad)
        + 0.24 * Math.cos(2 * hp * rad)
        + 0.32 * Math.cos((3 * hp + 6) * rad)
        - 0.20 * Math.cos((4 * hp - 63) * rad);

    const SL = 1 + 0.015 * (Lp - 50) ** 2 / Math.sqrt(20 + (Lp - 50) ** 2);
    const SC = 1 + 0.045 * Cp;
    const SH = 1 + 0.015 * Cp * T;

    const Cp7 = Math.pow(Cp, 7);
    const hpTerm = (hp - 275) / 25;
    const RT = -2 * Math.sqrt(Cp7 / (Cp7 + 6103515625))
        * Math.sin(60 * Math.exp(-(hpTerm * hpTerm)) * rad);

    return Math.sqrt(
        (dLp / SL) ** 2 +
        (dCp / SC) ** 2 +
        (dHp / SH) ** 2 +
        RT * (dCp / SC) * (dHp / SH)
    );
}

// --- Contrast & Accessibility ---

export function getLuminance(r, g, b) {
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;
    const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(fgHex, bgHex) {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

export function getRecommendedColor(fgHex, bgHex) {
    const ratio = getContrastRatio(fgHex, bgHex);
    if (ratio >= 4.5) return fgHex;

    const bg = hexToRgb(bgHex);
    const bgL = getLuminance(bg.r, bg.g, bg.b);
    const hsl = hexToHsl(fgHex);
    const direction = bgL > 0.5 ? -1 : 1;

    let currentL = hsl.l;
    const steps = [10, 5, 2];

    for (const step of steps) {
        for (let i = 0; i < 20; i++) {
            currentL += direction * step;
            if (currentL < 0 || currentL > 100) break;

            const newHex = hslToHex(hsl.h, hsl.s, currentL);
            if (getContrastRatio(newHex, bgHex) >= 4.5) {
                return newHex;
            }
        }
    }

    return bgL > 0.5 ? '#000000' : '#FFFFFF';
}

// --- Palette Generation ---

export function getHarmonies(hex) {
    const hsl = hexToHsl(hex);

    return {
        complementary: [
            hex,
            hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
        ],
        analogous: [
            hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
            hex,
            hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
        ],
        triadic: [
            hex,
            hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
        ],
        'split-complementary': [
            hex,
            hslToHex((hsl.h + 150) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 210) % 360, hsl.s, hsl.l)
        ],
        tetradic: [
            hex,
            hslToHex((hsl.h + 60) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
        ],
        square: [
            hex,
            hslToHex((hsl.h + 90) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
            hslToHex((hsl.h + 270) % 360, hsl.s, hsl.l)
        ],
        monochromatic: [
            hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 40)),
            hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 20)),
            hex,
            hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 20)),
            hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 40))
        ]
    };
}

// --- Clustering (CIELAB space) ---

export function kMeansClustering(pixels, k, maxIterations = 20) {
    if (pixels.length === 0) return [];

    // Standardize input to {r,g,b, count} then convert to LAB
    const rgbPoints = Array.isArray(pixels[0])
        ? pixels.map(p => ({ r: p[0], g: p[1], b: p[2], count: 1 }))
        : pixels.map(p => ({ r: p.r, g: p.g, b: p.b, count: p.count || 1 }));

    // Convert to LAB for perceptually uniform clustering
    const points = rgbPoints.map(p => {
        const lab = rgbToLab(p.r, p.g, p.b);
        return { L: lab.L, a: lab.a, b: lab.b, count: p.count };
    });

    // Initialize centroids using k-means++ (weighted, in LAB space)
    const centroids = [];
    centroids.push({ ...points[Math.floor(Math.random() * points.length)] });

    for (let i = 1; i < k; i++) {
        let maxDist = -1;
        let nextCentroid = points[0];

        // Sampling for speed
        const step = Math.max(1, Math.floor(points.length / 500));

        for (let j = 0; j < points.length; j += step) {
            const p = points[j];
            let minDist = Infinity;

            for (const c of centroids) {
                const d = (p.L - c.L) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
                if (d < minDist) minDist = d;
            }

            if (minDist > maxDist) {
                maxDist = minDist;
                nextCentroid = p;
            }
        }
        centroids.push({ ...nextCentroid });
    }

    const assignments = new Int16Array(points.length);
    const sums = new Float64Array(k * 3);
    const counts = new Float64Array(k);

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;
        sums.fill(0);
        counts.fill(0);

        // Assign points to nearest centroid (squared Euclidean in LAB)
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            let minDist = Infinity;
            let clusterIdx = 0;

            for (let j = 0; j < k; j++) {
                const c = centroids[j];
                const d = (p.L - c.L) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
                if (d < minDist) {
                    minDist = d;
                    clusterIdx = j;
                }
            }

            if (assignments[i] !== clusterIdx) {
                assignments[i] = clusterIdx;
                changed = true;
            }

            // Accumulate weighted sums in LAB
            sums[clusterIdx * 3] += p.L * p.count;
            sums[clusterIdx * 3 + 1] += p.a * p.count;
            sums[clusterIdx * 3 + 2] += p.b * p.count;
            counts[clusterIdx] += p.count;
        }

        if (!changed) break;

        // Update centroids in LAB
        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                centroids[j] = {
                    L: sums[j * 3] / counts[j],
                    a: sums[j * 3 + 1] / counts[j],
                    b: sums[j * 3 + 2] / counts[j]
                };
            }
        }
    }

    // Convert centroids back to RGB and return
    return centroids.map((c, i) => {
        const rgb = labToRgb(c.L, c.a, c.b);
        return {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            count: Math.round(counts[i])
        };
    }).filter(c => c.count > 0);
}

// --- Color Name Lookup (VP-Tree with CIEDE2000) ---

// VP-Tree Node
class VPNode {
    constructor(point, left = null, right = null, radius = 0) {
        this.point = point;
        this.left = left;
        this.right = right;
        this.radius = radius;
    }
}

// VP-Tree using perceptual CIEDE2000 distance
class ColorSearchTree {
    constructor(colors) {
        // colors: array of { hex, name, rgb, lab }
        this.root = this.buildTree(colors);
    }

    // Use CIEDE2000 for perceptually accurate distance
    distance(lab1, lab2) {
        return deltaE2000(lab1, lab2);
    }

    buildTree(points) {
        if (points.length === 0) return null;

        const node = new VPNode(points[0]);
        if (points.length === 1) return node;

        // Calculate CIEDE2000 distances to vantage point
        const distances = points.slice(1).map(p => ({
            point: p,
            dist: this.distance(node.point.lab, p.lab)
        }));

        distances.sort((a, b) => a.dist - b.dist);

        const medianIdx = Math.floor(distances.length / 2);

        if (distances.length > 0) {
            node.radius = distances[medianIdx] ? distances[medianIdx].dist : 0;

            const leftPoints = distances.slice(0, medianIdx).map(d => d.point);
            const rightPoints = distances.slice(medianIdx).map(d => d.point);

            node.left = this.buildTree(leftPoints);
            node.right = this.buildTree(rightPoints);
        }

        return node;
    }

    findNearest(targetLab) {
        if (!this.root) return 'Unknown';

        let best = { node: this.root, dist: Infinity };
        this.search(this.root, targetLab, best);
        return best.node.point.name;
    }

    search(node, target, best) {
        if (!node) return;

        const dist = this.distance(node.point.lab, target);

        if (dist < best.dist) {
            best.dist = dist;
            best.node = node;
        }

        if (dist < node.radius) {
            this.search(node.left, target, best);
            if (dist + best.dist >= node.radius) {
                this.search(node.right, target, best);
            }
        } else {
            this.search(node.right, target, best);
            if (dist - best.dist <= node.radius) {
                this.search(node.left, target, best);
            }
        }
    }
}


// Initialize Tree with pre-computed LAB values
const colorsList = Object.entries(COLOR_NAMES).map(([hex, name]) => {
    const rgb = hexToRgb(hex);
    return {
        hex,
        name,
        rgb,
        lab: rgbToLab(rgb.r, rgb.g, rgb.b)
    };
});
const searchTree = new ColorSearchTree(colorsList);

export function getColorName(hex) {
    const normalizedHex = hex.toLowerCase();

    // Direct match
    if (COLOR_NAMES[normalizedHex]) {
        return COLOR_NAMES[normalizedHex];
    }

    // CIEDE2000-based VP-Tree search
    const rgb = hexToRgb(hex);
    const targetLab = rgbToLab(rgb.r, rgb.g, rgb.b);
    return searchTree.findNearest(targetLab);
}
