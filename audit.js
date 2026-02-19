// WCAG Audit Content Script

// Cache regex for performance
const colorRegex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/;

function parseColor(color) {
    const match = color.match(colorRegex);
    if (!match) return null;
    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
    };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getLuminance(r, g, b) {
    const sRGB = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return sRGB[0] * 0.2126 + sRGB[1] * 0.7152 + sRGB[2] * 0.0722;
}

function getContrastRatio(fg, bg) {
    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function scanPage() {
    const violations = [];
    // Optimized selector - exclude non-text elements
    const elements = document.querySelectorAll('body *:not(script):not(style):not(svg):not(path):not(img):not(video):not(canvas):not(iframe):not(noscript):not(br):not(hr)');

    let count = 0;
    const maxViolations = 100; // Limit violations for performance

    for (let el of elements) {
        if (count >= maxViolations) break;

        // Quick visibility check
        if (!el.offsetWidth || !el.offsetHeight) continue;

        // Check for direct text content only (not inherited from children)
        let hasDirectText = false;
        for (let node of el.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim()) {
                hasDirectText = true;
                break;
            }
        }
        if (!hasDirectText) continue;

        const style = window.getComputedStyle(el);

        // Skip hidden elements
        if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') continue;

        // Skip elements with no text color or font size
        if (!style.color || !style.fontSize) continue;

        const fg = style.color;

        // Get background - collect from all ancestors
        let bgParsed = null;
        let currentEl = el;

        while (currentEl) {
            const currentStyle = window.getComputedStyle(currentEl);

            // Skip if background image (we can't determine color reliably)
            if (currentStyle.backgroundImage && currentStyle.backgroundImage !== 'none') {
                break; // Will skip this element below
            }

            const currentBg = parseColor(currentStyle.backgroundColor);
            if (currentBg && currentBg.a > 0) {
                bgParsed = currentBg;
                break;
            }

            currentEl = currentEl.parentElement;
        }

        // If still no background found, check body and html specifically
        if (!bgParsed) {
            const bodyBg = parseColor(window.getComputedStyle(document.body).backgroundColor);
            if (bodyBg && bodyBg.a > 0) {
                bgParsed = bodyBg;
            } else {
                const htmlBg = parseColor(window.getComputedStyle(document.documentElement).backgroundColor);
                if (htmlBg && htmlBg.a > 0) {
                    bgParsed = htmlBg;
                } else {
                    // Assume white background as fallback
                    bgParsed = { r: 255, g: 255, b: 255, a: 1 };
                }
            }
        }

        const fgParsed = parseColor(fg);
        if (!fgParsed || !bgParsed) continue;

        const ratio = getContrastRatio(fgParsed, bgParsed);

        // WCAG AA thresholds
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight) || 400;
        const isLargeText = (fontSize >= 18) || (fontSize >= 14 && fontWeight >= 700);
        const threshold = isLargeText ? 3 : 4.5;

        if (ratio < threshold) {
            // Get truncated text content
            let text = '';
            for (let node of el.childNodes) {
                if (node.nodeType === 3) {
                    text += node.textContent.trim() + ' ';
                }
            }
            text = text.trim().slice(0, 50);
            if (!text) continue;

            violations.push({
                element: el.tagName.toLowerCase(),
                text: text + (el.textContent.trim().length > 50 ? '...' : ''),
                fg: rgbToHex(fgParsed.r, fgParsed.g, fgParsed.b),
                bg: rgbToHex(bgParsed.r, bgParsed.g, bgParsed.b),
                ratio: ratio.toFixed(2),
                required: threshold.toFixed(1),
                fontSize: fontSize,
                fontWeight: fontWeight,
                isLargeText: isLargeText,
                threshold: threshold
            });
            count++;
        }
    }

    return violations;
}

// K-means clustering for accurate color palette (Weighted)
function kMeansClustering(pixels, k, maxIterations = 20) {
    if (pixels.length === 0) return [];

    // Standardize input to {r,g,b, count}
    // If input is [r,g,b], count is 1. If {r,g,b,count}, use it.
    const points = Array.isArray(pixels[0])
        ? pixels.map(p => ({ r: p[0], g: p[1], b: p[2], count: 1 }))
        : pixels.map(p => ({ r: p.r, g: p.g, b: p.b, count: p.count || 1 }));

    // Initialize centroids using k-means++ (weighted)
    const centroids = [];
    // First centroid based on random pick (weighted probability would be better but simple random is ok for start)
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
                const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
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
    const counts = new Float64Array(k); // Total weight per cluster

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;
        sums.fill(0);
        counts.fill(0);

        // Assign points to clusters
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            let minDist = Infinity;
            let clusterIdx = 0;

            for (let j = 0; j < k; j++) {
                const c = centroids[j];
                const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
                if (d < minDist) {
                    minDist = d;
                    clusterIdx = j;
                }
            }

            if (assignments[i] !== clusterIdx) {
                assignments[i] = clusterIdx;
                changed = true;
            }

            // Accumulate weighted sums
            sums[clusterIdx * 3] += p.r * p.count;
            sums[clusterIdx * 3 + 1] += p.g * p.count;
            sums[clusterIdx * 3 + 2] += p.b * p.count;
            counts[clusterIdx] += p.count;
        }

        if (!changed) break;

        // Update centroids
        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                centroids[j] = {
                    r: sums[j * 3] / counts[j],
                    g: sums[j * 3 + 1] / counts[j],
                    b: sums[j * 3 + 2] / counts[j]
                };
            }
        }
    }

    // Return centroids with their total weight (count)
    return centroids.map((c, i) => ({
        r: Math.round(c.r),
        g: Math.round(c.g),
        b: Math.round(c.b),
        count: Math.round(counts[i])
    })).filter(c => c.count > 0);
}


function extractSitePalette() {
    // --- Configuration ---
    const MAX_ELEMENTS = 500;           // Max DOM elements to scan
    const MAX_AREA = 500000;            // Area cap to prevent outlier weighting (px²)
    const AREA_DIVISOR = 1000;          // Divide area by this for weight calculation
    const QUANT_STEP = 2;              // Color quantization step (lower = finer)
    const NEAR_BLACK_THRESHOLD = 2;     // RGB values ≤ this are treated as black
    const NEAR_WHITE_THRESHOLD = 253;   // RGB values ≥ this are treated as white
    const K_CLUSTERS = 12;             // Number of k-means clusters
    const CUSTOM_PROP_WEIGHT = 5;      // Weight for CSS custom property colors

    const colorMap = new Map(); // Track colors with weighted frequency
    const elements = document.querySelectorAll('body *:not(script):not(style):not(svg):not(path):not(noscript):not(link):not(meta):not(head):not(br):not(hr)');

    // CSS properties to extract colors from
    const colorProperties = [
        'color', 'backgroundColor', 'borderColor', 'borderTopColor',
        'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'textDecorationColor', 'caretColor', 'boxShadow'
    ];

    const rgbRegex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/;
    const rgbRegexGlobal = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;

    // Regex to extract color stops from CSS gradients
    const gradientRegex = /(?:linear|radial|conic)-gradient\(([^)]+)\)/gi;

    // Helper: add a parsed RGB color to the map with a given weight
    function addColor(r, g, b, a, weight) {
        // Skip transparent
        if (a < 0.1) return;

        // Skip near-black and near-white
        if (r <= NEAR_BLACK_THRESHOLD && g <= NEAR_BLACK_THRESHOLD && b <= NEAR_BLACK_THRESHOLD) return;
        if (r >= NEAR_WHITE_THRESHOLD && g >= NEAR_WHITE_THRESHOLD && b >= NEAR_WHITE_THRESHOLD) return;

        // Quantize colors for grouping
        const qr = Math.round(r / QUANT_STEP) * QUANT_STEP;
        const qg = Math.round(g / QUANT_STEP) * QUANT_STEP;
        const qb = Math.round(b / QUANT_STEP) * QUANT_STEP;

        const key = `${qr},${qg},${qb}`;
        const existing = colorMap.get(key);
        if (existing) {
            existing.count += weight;
        } else {
            colorMap.set(key, { r: qr, g: qg, b: qb, count: weight });
        }
    }

    // Helper: extract all rgba matches from a CSS value string
    function extractColorsFromValue(value, weight) {
        if (!value) return;
        let match;
        // Reset lastIndex for global regex
        rgbRegexGlobal.lastIndex = 0;
        while ((match = rgbRegexGlobal.exec(value)) !== null) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            const a = match[4] ? parseFloat(match[4]) : 1;
            addColor(r, g, b, a, weight);
        }
    }

    // Helper: extract colors from a computed style object
    function extractFromStyle(style, weight) {
        for (const prop of colorProperties) {
            const value = style[prop];
            if (!value || value === 'none') continue;

            // boxShadow and multi-value properties can have multiple colors
            if (prop === 'boxShadow') {
                extractColorsFromValue(value, weight);
            } else {
                const match = value.match(rgbRegex);
                if (match) {
                    const r = parseInt(match[1]);
                    const g = parseInt(match[2]);
                    const b = parseInt(match[3]);
                    const a = match[4] ? parseFloat(match[4]) : 1;
                    addColor(r, g, b, a, weight);
                }
            }
        }

        // Extract colors from CSS gradients in backgroundImage
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
            let gradientMatch;
            gradientRegex.lastIndex = 0;
            while ((gradientMatch = gradientRegex.exec(bgImage)) !== null) {
                extractColorsFromValue(gradientMatch[1], weight);
            }
        }
    }

    // Process elements
    let count = 0;

    for (let el of elements) {
        if (count >= MAX_ELEMENTS) break;

        // Skip invisible elements
        if (!el.offsetWidth && !el.offsetHeight) continue;

        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') continue;

        // Weight by approximate visible area (clamped to avoid huge outliers)
        const area = Math.min(el.offsetWidth * el.offsetHeight, MAX_AREA);
        const weight = Math.max(1, Math.round(area / AREA_DIVISOR));

        // Extract from the element itself
        extractFromStyle(style, weight);

        // Also scan pseudo-elements (::before, ::after)
        for (const pseudo of ['::before', '::after']) {
            const pseudoStyle = window.getComputedStyle(el, pseudo);
            // Only process if pseudo-element has content (i.e., is rendered)
            const content = pseudoStyle.getPropertyValue('content');
            if (content && content !== 'none' && content !== 'normal') {
                extractFromStyle(pseudoStyle, weight);
            }
        }

        count++;
    }

    // Extract colors from CSS custom properties on stylesheets
    try {
        for (const sheet of document.styleSheets) {
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                for (const rule of rules) {
                    if (rule.style) {
                        const cssText = rule.cssText;
                        // Look for custom property declarations with color values
                        const varMatches = cssText.match(/--[\w-]+\s*:\s*#[0-9a-fA-F]{3,8}/g);
                        if (varMatches) {
                            for (const vm of varMatches) {
                                const hexMatch = vm.match(/#([0-9a-fA-F]{3,8})$/);
                                if (hexMatch) {
                                    let hex = hexMatch[1];
                                    // Normalize 3-char hex to 6-char
                                    if (hex.length === 3) {
                                        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
                                    }
                                    if (hex.length >= 6) {
                                        const r = parseInt(hex.substring(0, 2), 16);
                                        const g = parseInt(hex.substring(2, 4), 16);
                                        const b = parseInt(hex.substring(4, 6), 16);
                                        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                                            addColor(r, g, b, 1, CUSTOM_PROP_WEIGHT);
                                        }
                                    }
                                }
                            }
                        }
                        // Also look for rgb/rgba custom properties
                        const varRgbMatches = cssText.match(/--[\w-]+\s*:\s*rgba?\([^)]+\)/g);
                        if (varRgbMatches) {
                            for (const vm of varRgbMatches) {
                                extractColorsFromValue(vm, CUSTOM_PROP_WEIGHT);
                            }
                        }
                    }
                }
            } catch (e) {
                // CORS: skip cross-origin stylesheets silently
            }
        }
    } catch (e) {
        // Skip stylesheet scanning if any top-level error
    }

    if (colorMap.size === 0) return [];

    // Convert to array and apply k-means clustering
    const colors = Array.from(colorMap.values());
    const k = Math.min(K_CLUSTERS, colors.length);
    const clusteredColors = kMeansClustering(colors, k);

    // Sort by frequency and convert to hex
    const totalCount = clusteredColors.reduce((sum, c) => sum + c.count, 0);
    const sorted = clusteredColors
        .sort((a, b) => b.count - a.count)
        .map(c => ({
            color: rgbToHex(c.r, c.g, c.b).toLowerCase(),
            percentage: Math.round((c.count / totalCount) * 100)
        }));

    return sorted.slice(0, K_CLUSTERS);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scan_page') {
        const results = scanPage();
        sendResponse({ results: results });
    } else if (request.action === 'extract_palette') {
        const palette = extractSitePalette();
        sendResponse({ palette: palette });
    }
    return true; // Keep channel open
});
