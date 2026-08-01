import { hexToRgb, hexToHsl, getContrastRatio, getRecommendedColor, getHarmonies, getColorName, kMeansClustering } from './utils.js';

// Security: escape HTML entities to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validation: ensure hex color format
function isValidHex(hex) {
    return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// Safe JSON parse with fallback
function safeJSONParse(str, fallback = null) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch {
        return fallback;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const initTheme = () => {
        const savedTheme = localStorage.getItem('chromaLens_theme') || 'auto';
        applyTheme(savedTheme);
        updateThemeButtons(savedTheme);
    };

    const applyTheme = (theme) => {
        const root = document.documentElement;
        if (theme === 'auto') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', theme);
        }
    };

    const updateThemeButtons = (theme) => {
        document.querySelectorAll('.theme-option').forEach(btn => {
            const isActive = btn.dataset.theme === theme;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
    };

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const themeOptions = document.querySelectorAll('.theme-option');

    settingsBtn?.addEventListener('click', () => {
        settingsModal?.classList.remove('hidden');
    });

    settingsClose?.addEventListener('click', () => {
        settingsModal?.classList.add('hidden');
    });

    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    themeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            localStorage.setItem('chromaLens_theme', theme);
            applyTheme(theme);
            updateThemeButtons(theme);
        });
    });

    // Initialize theme on load
    initTheme();

    // Tab Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');

    // Picker Elements
    const pickBtn = document.getElementById('pick-btn');
    const colorPreview = document.getElementById('color-preview');
    const hexValue = document.getElementById('hex-value');
    const rgbValue = document.getElementById('rgb-value');
    const hslValue = document.getElementById('hsl-value');
    const colorName = document.getElementById('color-name');
    const recentGrid = document.getElementById('recent-colors');
    const toast = document.getElementById('toast');
    const copyBtns = document.querySelectorAll('.copy-btn');

    // Audit Elements
    const scanBtn = document.getElementById('scan-btn');
    const auditResults = document.getElementById('audit-results');
    const auditSummary = document.getElementById('audit-summary');
    const violationCount = document.getElementById('violation-count');

    // Palette Elements
    const harmonySelect = document.getElementById('harmony-select');
    const paletteGrid = document.getElementById('palette-grid');
    const exportCssBtn = document.getElementById('export-css');
    const exportJsonBtn = document.getElementById('export-json');

    // Extract/Capture Elements
    const extractBtn = document.getElementById('extract-btn');
    const captureBtn = document.getElementById('capture-btn');
    const extractGrid = document.getElementById('extract-grid');
    const extractActions = document.getElementById('extract-actions');
    const extractCssBtn = document.getElementById('extract-css');
    const extractJsonBtn = document.getElementById('extract-json');
    const imageStatus = document.getElementById('image-status');

    // Capture sub-tab elements
    const captureModes = document.querySelectorAll('.capture-mode-btn');
    const captureContents = document.querySelectorAll('.capture-content');
    const captureResults = document.getElementById('capture-results');
    const resultsTitle = document.getElementById('results-title');
    const clearResultsBtn = document.getElementById('clear-results');
    let extractedPalette = [];

    // Favorites Elements
    const favoritesGrid = document.getElementById('favorites-grid');
    const favoritesEmpty = document.getElementById('favorites-empty');
    const exportFavoritesBtn = document.getElementById('export-favorites-btn');
    const clearFavoritesBtn = document.getElementById('clear-favorites-btn');
    const addFavoriteBtn = document.getElementById('add-favorite-btn');
    let favorites = (safeJSONParse(localStorage.getItem('chromaLens_favorites'), [])).map(c => typeof c === 'string' ? c.toLowerCase() : '');

    const getCheckSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
    const getXSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    const getClipboardSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
    const getSparklesSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    const getImageSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    const getScreenSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    const getGlobeSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;



    // Image color extraction function using k-means
    function extractColorsFromImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Use higher resolution for better accuracy
                const maxSize = 150;
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const pixels = [];

                // Collect all valid pixels
                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];

                    if (a < 128) continue; // Skip transparent

                    // Skip pure black and pure white
                    if (r < 10 && g < 10 && b < 10) continue;
                    if (r > 245 && g > 245 && b > 245) continue;

                    pixels.push([r, g, b]);
                }

                if (pixels.length === 0) {
                    resolve([]);
                    return;
                }

                // Run k-means with 12 clusters for dominant colors
                const clusters = kMeansClustering(pixels, 12);
                const totalPixels = pixels.length;

                // Convert to hex and sort by frequency
                const sorted = clusters
                    .filter(c => c.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(c => ({
                        color: '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1).toLowerCase(),
                        percentage: Math.round((c.count / totalPixels) * 100)
                    }));

                resolve(sorted);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageUrl;
        });
    }

    // Check for pending image from context menu
    chrome.runtime.sendMessage({ action: 'get_pending_image' }, (response) => {
        if (response && response.imageUrl) {
            // Switch to extract tab and Image mode
            document.querySelector('[data-tab="extract"]').click();
            document.querySelector('[data-mode="image"]')?.click();
            imageStatus.classList.remove('hidden');
            extractGrid.innerHTML = '<div class="extract-empty">Extracting colors from image...</div>';

            extractColorsFromImage(response.imageUrl)
                .then(colors => {
                    imageStatus.classList.add('hidden');
                    renderExtractedPalette(colors, `${getImageSVG()} <span>Image Extract</span>`);
                })
                .catch(() => {
                    imageStatus.classList.add('hidden');
                    extractGrid.innerHTML = '<div class="extract-empty">Could not load image. Try a same-origin image.</div>';
                });
        }
    });

    // Check for pending screen capture from area selection
    chrome.storage.local.get(['pendingCapture'], (result) => {
        if (result.pendingCapture) {
            const { screenshot, bounds } = result.pendingCapture;

            // Switch to extract tab and Screen mode
            document.querySelector('[data-tab="extract"]').click();
            document.querySelector('[data-mode="screen"]')?.click();
            extractGrid.innerHTML = '<div class="extract-empty">Processing captured area...</div>';

            // Get device pixel ratio for accurate cropping
            const scale = window.devicePixelRatio || 1;

            // Crop the captured area and extract colors
            cropImageToBounds(screenshot, bounds, scale)
                .then(croppedUrl => extractColorsFromImage(croppedUrl))
                .then(colors => {
                    renderExtractedPalette(colors, `${getScreenSVG()} <span>Screen Capture</span>`);
                    // Clear the pending capture and badge
                    chrome.storage.local.remove('pendingCapture');
                    chrome.action.setBadgeText({ text: '' });
                })
                .catch(() => {
                    extractGrid.innerHTML = '<div class="extract-empty">Failed to process capture.</div>';
                    chrome.storage.local.remove('pendingCapture');
                    chrome.action.setBadgeText({ text: '' });
                });
        }
    });

    // Listen for context menu triggers while popup is open
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'extract_image') {
            document.querySelector('[data-tab="extract"]').click();
            imageStatus.classList.remove('hidden');
            extractGrid.innerHTML = '<div class="extract-empty">Extracting colors from image...</div>';

            extractColorsFromImage(request.imageUrl)
                .then(colors => {
                    imageStatus.classList.add('hidden');
                    renderExtractedPalette(colors, `${getImageSVG()} <span>Image Extract</span>`);
                })
                .catch(() => {
                    imageStatus.classList.add('hidden');
                    extractGrid.innerHTML = '<div class="extract-empty">Could not load image.</div>';
                });
        }
    });

    // Handle file upload for image extraction
    const imageFileInput = document.getElementById('image-file-input');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target.result;

                // Switch to Image mode and show processing
                document.querySelector('[data-mode="image"]')?.click();
                extractGrid.innerHTML = '<div class="extract-empty">Extracting colors...</div>';

                extractColorsFromImage(imageUrl)
                    .then(colors => {
                        renderExtractedPalette(colors, '📁 ' + file.name);
                    })
                    .catch(() => {
                        extractGrid.innerHTML = '<div class="extract-empty">Could not process image.</div>';
                    });
            };
            reader.readAsDataURL(file);

            // Reset input so same file can be selected again
            e.target.value = '';
        });
    }

    // Crop image to bounds function
    function cropImageToBounds(imageUrl, bounds, scale) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Scale bounds to actual image dimensions
                const sx = bounds.x / scale;
                const sy = bounds.y / scale;
                const sw = bounds.width / scale;
                const sh = bounds.height / scale;
                canvas.width = sw;
                canvas.height = sh;
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Failed to load image for cropping'));
            img.src = imageUrl;
        });
    }

    // Crop Modal Elements (only initialize if elements exist)
    const cropModal = document.getElementById('crop-modal');
    const cropCanvas = document.getElementById('crop-canvas');
    const cropSelection = document.getElementById('crop-selection');
    const cropCancel = document.getElementById('crop-cancel');
    const cropConfirm = document.getElementById('crop-confirm');

    if (cropCanvas && cropModal && cropSelection && cropCancel && cropConfirm) {
        const cropContainer = cropCanvas.parentElement;
        let capturedScreenshot = null;
        let cropBounds = null;
        let isDrawing = false;
        let startX = 0, startY = 0;
        let canvasScale = 1;

        // Crop selection handlers
        cropContainer.addEventListener('mousedown', (e) => {
            const rect = cropCanvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            isDrawing = true;
            cropSelection.style.left = startX + 'px';
            cropSelection.style.top = startY + 'px';
            cropSelection.style.width = '0';
            cropSelection.style.height = '0';
            cropSelection.style.display = 'block';
        });

        cropContainer.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const rect = cropCanvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            const left = Math.max(0, Math.min(startX, currentX));
            const top = Math.max(0, Math.min(startY, currentY));
            const width = Math.min(Math.abs(currentX - startX), rect.width - left);
            const height = Math.min(Math.abs(currentY - startY), rect.height - top);

            cropSelection.style.left = left + 'px';
            cropSelection.style.top = top + 'px';
            cropSelection.style.width = width + 'px';
            cropSelection.style.height = height + 'px';

            cropBounds = { x: left, y: top, width, height };
        });

        cropContainer.addEventListener('mouseup', () => {
            isDrawing = false;
        });

        // Cancel crop
        cropCancel.addEventListener('click', () => {
            cropModal.classList.add('hidden');
            cropSelection.style.display = 'none';
            capturedScreenshot = null;
            cropBounds = null;
        });

        // Confirm crop and extract
        cropConfirm.addEventListener('click', () => {
            if (!cropBounds || cropBounds.width < 10 || cropBounds.height < 10) {
                extractGrid.innerHTML = '<div class="extract-empty">Please select a larger area.</div>';
                return;
            }

            cropModal.classList.add('hidden');
            cropSelection.style.display = 'none';
            extractGrid.innerHTML = '<div class="extract-empty">Extracting colors...</div>';

            cropImageToBounds(capturedScreenshot, cropBounds, canvasScale)
                .then(croppedImage => extractColorsFromImage(croppedImage))
                .then(colors => {
                    renderExtractedPalette(colors, `${getScreenSVG()} <span>Crop Selection</span>`);
                })
                .catch(() => {
                    extractGrid.innerHTML = '<div class="extract-empty">Failed to extract colors.</div>';
                });
        });
    }

    // Capture button handler - starts area selection on the page
    captureBtn.addEventListener('click', () => {
        // Get the active tab from the popup context (callback style for Firefox compatibility)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (tab && tab.id) {
                // Send tabId explicitly to background script
                chrome.runtime.sendMessage({
                    action: 'start_area_selection',
                    tabId: tab.id
                });
                // Close popup - user needs to select on the page
                setTimeout(() => window.close(), 50);
            }
        });
    });

    // Capture sub-tab switching
    captureModes.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state on buttons
            captureModes.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show corresponding content
            const mode = btn.dataset.mode;
            captureContents.forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`capture-mode-${mode}`).classList.remove('hidden');
        });
    });

    // Clear results button
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            captureResults.classList.add('hidden');
            extractGrid.innerHTML = '';
            extractedPalette = [];
        });
    }

    // Helper function to show results section
    function showCaptureResults(title) {
        if (captureResults) {
            captureResults.classList.remove('hidden');
            if (resultsTitle) resultsTitle.innerHTML = title || 'Captured Colors';
        }
    }

    // Check for pending capture when popup opens
    chrome.storage.local.get(['pendingCapture'], (result) => {
        if (result.pendingCapture) {
            const { screenshot, bounds } = result.pendingCapture;
            chrome.storage.local.remove('pendingCapture');
            chrome.action.setBadgeText({ text: '' }); // Clear badge

            // Switch to capture tab and screen mode
            document.querySelector('[data-tab="extract"]').click();
            document.querySelector('[data-mode="screen"]')?.click();

            showCaptureResults(`${getScreenSVG()} <span>Screen Capture</span>`);
            extractGrid.innerHTML = '<div class="extract-empty">Processing captured area...</div>';

            // Crop image to bounds and extract colors
            cropImageToBounds(screenshot, bounds, 1) // bounds already scaled by devicePixelRatio
                .then(croppedImage => extractColorsFromImage(croppedImage))
                .then(colors => {
                    renderExtractedPalette(colors, `${getScreenSVG()} <span>Screen Capture</span>`);
                })
                .catch(() => {
                    extractGrid.innerHTML = '<div class="extract-empty">Failed to process captured area.</div>';
                });
        }
    });

    // Initialize state
    let recentColors = safeJSONParse(localStorage.getItem('chromaLens_recent'), []);
    let currentColor = (recentColors[0] && isValidHex(recentColors[0])) ? recentColors[0] : '#FFFFFF';

    // About Modal
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const modalClose = document.getElementById('modal-close');

    aboutBtn.addEventListener('click', () => aboutModal.classList.remove('hidden'));
    modalClose.addEventListener('click', () => aboutModal.classList.add('hidden'));
    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) aboutModal.classList.add('hidden');
    });

    renderRecentColors();
    renderFavorites(); // Initial render
    updateDisplay(currentColor);
    updateFavoriteButton(currentColor);

    // Favorites Logic
    addFavoriteBtn.addEventListener('click', () => {
        toggleFavorite(currentColor);
        updateFavoriteButton(currentColor);
        renderFavorites();
        if (addFavoriteBtn.classList.contains('active')) {
            // Optional: visual feedback
        }
    });

    // Helper for heart icon SVG
    function getHeartSVG(isSaved) {
        const fill = isSaved ? 'currentColor' : 'none';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    }

    function toggleFavorite(hex) {
        const normalizedHex = hex.toLowerCase();
        const index = favorites.indexOf(normalizedHex);
        if (index === -1) {
            favorites.unshift(normalizedHex);
        } else {
            favorites.splice(index, 1);
        }
        localStorage.setItem('chromaLens_favorites', JSON.stringify(favorites));
        renderFavorites();

        // Update other views if they are visible
        if (!document.getElementById('view-picker').classList.contains('hidden')) {
            updateFavoriteButton(currentColor);
        }
        // Force re-render of recent/palette to update heart icons
        renderRecentColors();
        if (!document.getElementById('view-palette').classList.contains('hidden')) {
            renderPalette(currentColor);
        }
    }

    function updateFavoriteButton(hex) {
        if (!addFavoriteBtn) return;
        const normalizedHex = hex.toLowerCase();
        const isSaved = favorites.includes(normalizedHex);
        if (isSaved) {
            addFavoriteBtn.classList.add('active');
        } else {
            addFavoriteBtn.classList.remove('active');
        }
    }

    function deleteFavoriteWithUndo(hex) {
        const normalizedHex = hex.toLowerCase();
        const index = favorites.indexOf(normalizedHex);
        if (index === -1) return;

        // Remove from favorites
        favorites.splice(index, 1);
        localStorage.setItem('chromaLens_favorites', JSON.stringify(favorites));
        renderFavorites();
        updateFavoriteButton(currentColor);
        renderRecentColors();

        // Show undo toast
        showToast('Color removed', () => {
            // Restore color at same position
            favorites.splice(index, 0, normalizedHex);
            localStorage.setItem('chromaLens_favorites', JSON.stringify(favorites));
            renderFavorites();
            updateFavoriteButton(currentColor);
            renderRecentColors();
            showToast('Color restored');
        });
    }

    function getTrashSVG() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
    }

    function renderFavorites() {
        // Update favorites count badge
        const countBadge = document.getElementById('favorites-count');
        if (countBadge) {
            if (favorites.length > 0) {
                countBadge.textContent = favorites.length;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }

        if (favorites.length === 0) {
            favoritesGrid.innerHTML = '';
            favoritesEmpty.classList.remove('hidden');
            return;
        }

        favoritesEmpty.classList.add('hidden');
        favoritesGrid.innerHTML = '';

        favorites.forEach(color => {
            const card = document.createElement('div');
            card.className = 'favorite-card';

            const swatch = document.createElement('div');
            swatch.className = 'favorite-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = 'Click to copy: ' + color;

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'favorite-delete';
            deleteBtn.innerHTML = getTrashSVG();
            deleteBtn.title = 'Remove from favorites';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteFavoriteWithUndo(color);
            };

            const info = document.createElement('div');
            info.className = 'favorite-info';
            info.innerHTML = '<div class="favorite-hex">' + color.toUpperCase() + '</div>';

            card.appendChild(swatch);
            card.appendChild(deleteBtn);
            card.appendChild(info);

            card.onclick = () => {
                currentColor = color;
                updateDisplay(color);
                copyToClipboard(color);
                // Optional: Switch to picker view?
                // document.querySelector('[data-tab="picker"]').click();
            };

            favoritesGrid.appendChild(card);
        });
    }

    // Favorites Actions
    clearFavoritesBtn?.addEventListener('click', () => {
        showConfirmModal('Clear all favorites?', () => {
            favorites = [];
            localStorage.setItem('chromaLens_favorites', JSON.stringify(favorites));
            renderFavorites();
            updateFavoriteButton(currentColor);
            renderRecentColors();
        });
    });

    exportFavoritesBtn.addEventListener('click', () => {
        if (favorites.length === 0) return;
        // Show export modal with favorites data
        // Re-use existing export modal logic but populated with favorites
        const exportModal = document.getElementById('export-modal');
        const exportPreview = document.getElementById('export-colors-preview');
        const exportClose = document.getElementById('export-modal-close');

        // Populate preview
        exportPreview.innerHTML = '';
        favorites.slice(0, 10).forEach(c => {
            const el = document.createElement('div');
            el.className = 'export-color-preview';
            el.style.backgroundColor = c;
            exportPreview.appendChild(el);
        });

        // Setup format buttons for Favorites
        const formatBtns = exportModal.querySelectorAll('.export-format-btn');
        formatBtns.forEach(btn => {
            // Remove old listeners to avoid duplicates (naive approach)
            // Better: Use a shared export function
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => {
                const format = newBtn.dataset.format;
                let output = '';

                if (format === 'css-vars') {
                    output = ':root {\n';
                    favorites.forEach((c, i) => output += `  --favorite-${i + 1}: ${c};\n`);
                    output += '}';
                } else if (format === 'tailwind') {
                    const colorsObj = {};
                    favorites.forEach((c, i) => colorsObj[`favorite-${i + 1}`] = c);
                    output = JSON.stringify(colorsObj, null, 2);
                } else if (format === 'scss') {
                    favorites.forEach((c, i) => output += `$favorite-${i + 1}: ${c};\n`);
                } else if (format === 'json') {
                    output = JSON.stringify(favorites, null, 2);
                }

                copyToClipboard(output);
                exportModal.classList.add('hidden');
            });
        });

        exportClose.onclick = () => exportModal.classList.add('hidden');
        exportModal.classList.remove('hidden');
    });

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            views.forEach(view => {
                if (view.id === 'view-' + target) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                    if (target === 'palette') {
                        renderPalette(currentColor);
                    } else if (target === 'favorites') {
                        renderFavorites();
                    }
                } else {
                    view.classList.add('hidden');
                    view.classList.remove('active');
                }
            });
        });
    });

    // Check if EyeDropper is supported
    if (!window.EyeDropper) {
        pickBtn.innerText = 'Not Supported';
        pickBtn.disabled = true;
    }

    pickBtn.addEventListener('click', async () => {
        if (!window.EyeDropper) return;

        const eyeDropper = new EyeDropper();

        try {
            const result = await eyeDropper.open();
            const color = result.sRGBHex;

            currentColor = color;
            updateDisplay(color);
            updateFavoriteButton(color);
            addToHistory(color);

            if (!document.getElementById('view-palette').classList.contains('hidden')) {
                renderPalette(color);
            }
        } catch {
            // User canceled the color picker
        }
    });

    // Audit Scan
    scanBtn.addEventListener('click', () => {
        auditResults.innerHTML = '<div class="empty-state">Scanning page...</div>';
        auditSummary.classList.add('hidden');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabsList) => {
            if (!tabsList[0]) return;

            const tabId = tabsList[0].id;

            // Try sending message first
            chrome.tabs.sendMessage(tabId, { action: 'scan_page' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script not loaded - inject it programmatically
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['audit.js']
                    }).then(() => {
                        // Retry after injection with sufficient delay for script initialization
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { action: 'scan_page' }, (retryResponse) => {
                                if (chrome.runtime.lastError || !retryResponse) {
                                    auditResults.innerHTML = '<div class="empty-state">Could not scan this page. Try a different website.</div>';
                                    return;
                                }
                                if (retryResponse.results) {
                                    analyzeResults(retryResponse.results);
                                }
                            });
                        }, 300);
                    }).catch(() => {
                        auditResults.innerHTML = '<div class="empty-state">Cannot scan this page (browser internal page).</div>';
                    });
                    return;
                }

                if (response && response.results) {
                    analyzeResults(response.results);
                } else {
                    auditResults.innerHTML = '<div class="empty-state">No text elements found to analyze.</div>';
                }
            });
        });
    });

    // Palette Logic
    harmonySelect.addEventListener('change', () => {
        renderPalette(currentColor);
    });

    function renderPalette(baseColor) {
        // Update base color indicator
        const baseSwatch = document.getElementById('harmony-base-swatch');
        const baseHex = document.getElementById('harmony-base-hex');
        if (baseSwatch) baseSwatch.style.backgroundColor = baseColor;
        if (baseHex) baseHex.textContent = baseColor.toUpperCase();

        const type = harmonySelect.value;
        const harmonies = getHarmonies(baseColor);
        const colors = harmonies[type];

        paletteGrid.innerHTML = '';

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = `Click to copy: ${color}`;
            swatch.onclick = () => copyToClipboard(color);

            const whiteRatio = getContrastRatio('#FFFFFF', color);
            const textColor = whiteRatio > 3 ? 'white' : 'black';

            swatch.innerHTML = '<span class="palette-hex" style="color: ' + textColor + '; background: rgba(0,0,0,0.1)">' + color.toUpperCase() + '</span>';

            // Add heart icon
            const heart = document.createElement('button');
            const isSaved = favorites.includes(color.toLowerCase());
            heart.className = 'add-favorite-btn' + (isSaved ? ' saved' : '');
            heart.innerHTML = getHeartSVG(isSaved);
            heart.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(color);
            };
            swatch.appendChild(heart);

            paletteGrid.appendChild(swatch);
        });
    }

    // Export Logic
    exportCssBtn.addEventListener('click', () => {
        const type = harmonySelect.value;
        const colors = getHarmonies(currentColor)[type];
        let css = ':root {\n';
        colors.forEach((c, i) => {
            css += '  --color-' + type + '-' + (i + 1) + ': ' + c + ';\n';
        });
        css += '}';
        copyToClipboard(css);
    });

    exportJsonBtn.addEventListener('click', () => {
        const type = harmonySelect.value;
        const colors = getHarmonies(currentColor)[type];
        const json = JSON.stringify({ [type]: colors }, null, 2);
        copyToClipboard(json);
    });

    // Extract Site Palette Logic
    extractBtn.addEventListener('click', () => {
        extractGrid.innerHTML = '<div class="extract-empty">Scanning site colors...</div>';
        extractActions.classList.add('hidden');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabsList) => {
            if (!tabsList[0]) return;

            const tabId = tabsList[0].id;

            chrome.tabs.sendMessage(tabId, { action: 'extract_palette' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Inject script and retry
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['audit.js']
                    }).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { action: 'extract_palette' }, (retryResponse) => {
                                if (retryResponse && retryResponse.palette) {
                                    renderExtractedPalette(retryResponse.palette);
                                } else {
                                    extractGrid.innerHTML = '<div class="extract-empty">Could not extract colors from this page.</div>';
                                }
                            });
                        }, 300);
                    }).catch(() => {
                        extractGrid.innerHTML = '<div class="extract-empty">Cannot scan this page.</div>';
                    });
                    return;
                }

                if (response && response.palette && response.palette.length > 0) {
                    renderExtractedPalette(response.palette, `${getGlobeSVG()} <span>Site Colors</span>`);
                } else {
                    extractGrid.innerHTML = '<div class="extract-empty">No colors found on this page.</div>';
                }
            });
        });
    });

    function renderExtractedPalette(colors, title) {
        // Handle both new format {color, percentage} and legacy string format
        const normalizedColors = colors.map(c =>
            typeof c === 'string' ? { color: c, percentage: 0 } : c
        );

        // Store just color strings for export
        extractedPalette = normalizedColors.map(c => c.color);
        extractGrid.innerHTML = '';

        // Show results section
        if (captureResults) {
            captureResults.classList.remove('hidden');
            if (resultsTitle) resultsTitle.innerHTML = title || 'Captured Colors';
        }

        // Create tiered layout container
        const container = document.createElement('div');
        container.className = 'weighted-palette';

        normalizedColors.forEach((item, index) => {
            const swatch = document.createElement('div');

            // Determine tier based on ranking and percentage
            // For legacy strings (percentage 0), use simple index-based sizing
            let tierClass = 'tier-small';
            if (item.percentage > 0) {
                // Percentage-based tiering for image/screen captures
                if (item.percentage >= 20) {
                    tierClass = 'tier-primary';
                } else if (item.percentage >= 10) {
                    tierClass = 'tier-secondary';
                } else if (item.percentage >= 5) {
                    tierClass = 'tier-tertiary';
                }
            } else {
                // Index-based tiering for legacy site extraction
                if (index === 0) {
                    tierClass = 'tier-primary';
                } else if (index <= 2) {
                    tierClass = 'tier-secondary';
                } else if (index <= 5) {
                    tierClass = 'tier-tertiary';
                }
            }

            swatch.className = `extract-color ${tierClass}`;
            swatch.style.backgroundColor = item.color;
            swatch.title = item.percentage > 0
                ? `${item.color.toUpperCase()} (${item.percentage}%)`
                : `Click to copy: ${item.color.toUpperCase()}`;
            swatch.dataset.hex = item.color.toUpperCase();
            swatch.onclick = () => copyToClipboard(item.color);

            // Add heart icon
            const heart = document.createElement('button');
            const isSaved = favorites.includes(item.color.toLowerCase());
            heart.className = 'add-favorite-btn' + (isSaved ? ' saved' : '');
            heart.innerHTML = getHeartSVG(isSaved);
            heart.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(item.color);
            };
            swatch.appendChild(heart);

            container.appendChild(swatch);
        });

        extractGrid.appendChild(container);
        extractActions.classList.remove('hidden');
    }

    extractCssBtn.addEventListener('click', () => {
        if (extractedPalette.length === 0) return;
        let css = ':root {\n';
        extractedPalette.forEach((c, i) => {
            css += '  --site-color-' + (i + 1) + ': ' + c + ';\n';
        });
        css += '}';
        copyToClipboard(css);
    });

    extractJsonBtn.addEventListener('click', () => {
        if (extractedPalette.length === 0) return;
        const json = JSON.stringify({ sitePalette: extractedPalette }, null, 2);
        copyToClipboard(json);
    });

    function analyzeResults(elements) {
        auditResults.innerHTML = '';
        let violations = 0;

        elements.forEach(el => {
            const ratio = getContrastRatio(el.fg, el.bg);

            let threshold = 4.5;
            const size = parseFloat(el.fontSize);
            const weight = parseInt(el.fontWeight) || 400;

            if (size >= 24 || (size >= 18.5 && weight >= 700)) {
                threshold = 3.0;
            }

            if (ratio < threshold) {
                violations++;
                renderViolation(el, ratio, threshold);
            }
        });

        violationCount.innerText = violations;
        auditSummary.classList.remove('hidden');

        if (violations === 0) {
            auditResults.innerHTML = `<div class="empty-state" style="color: var(--success)">${getSparklesSVG()} No contrast violations found!</div>`;
        }
    }

    function renderViolation(el, ratio, threshold) {
        const recommended = getRecommendedColor(el.fg, el.bg);
        const card = document.createElement('div');
        card.className = 'violation-card';

        // WCAG thresholds
        // Normal text: AA = 4.5:1, AAA = 7:1
        // Large text: AA = 3:1, AAA = 4.5:1
        const size = parseFloat(el.fontSize);
        const weight = parseInt(el.fontWeight) || 400;
        const isLargeText = size >= 24 || (size >= 18.5 && weight >= 700);

        const aaThreshold = isLargeText ? 3.0 : 4.5;
        const aaaThreshold = isLargeText ? 4.5 : 7.0;

        const passAA = ratio >= aaThreshold;
        const passAAA = ratio >= aaaThreshold;

        const aaBadge = passAA
            ? `<span class="badge badge-pass">AA ${getCheckSVG()}</span>`
            : `<span class="badge badge-fail">AA ${getXSVG()}</span>`;
        const aaaBadge = passAAA
            ? `<span class="badge badge-pass">AAA ${getCheckSVG()}</span>`
            : `<span class="badge badge-fail">AAA ${getXSVG()}</span>`;
        const textType = isLargeText ? '<span class="text-type">Large Text</span>' : '<span class="text-type">Normal Text</span>';

        const safeText = escapeHTML(el.text || 'Sample Text');
        const safeFg = isValidHex(el.fg) ? el.fg : '#000000';
        const safeBg = isValidHex(el.bg) ? el.bg : '#FFFFFF';
        const safeRec = isValidHex(recommended) ? recommended : '#000000';

        card.innerHTML = '<div class="violation-header"><span>Ratio: ' + ratio.toFixed(2) + ':1</span><div class="badges">' + aaBadge + aaaBadge + '</div></div>' +
            '<div class="violation-meta">' + textType + '</div>' +
            '<div class="violation-text" title="' + safeText + '" style="color: ' + safeFg + '; background: ' + safeBg + '; padding: 8px; border-radius: 4px;">' + safeText + '</div>' +
            '<div class="recommendation"><div class="color-chip" style="background-color: ' + safeRec + '"></div>' +
            '<div class="rec-details"><div class="rec-label">Recommended</div><div class="rec-value">' + safeRec + '</div></div>' +
            '<button class="copy-btn mini" data-val="' + safeRec + '">' + getClipboardSVG() + '</button></div>';

        card.querySelector('.copy-btn')?.addEventListener('click', (e) => {
            copyToClipboard(e.target.dataset.val);
        });

        auditResults.appendChild(card);
    }

    // Copy buttons
    copyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.dataset.val) {
                copyToClipboard(e.target.dataset.val);
                return;
            }

            const row = e.target.closest('.value-row');
            if (row) {
                const value = row.querySelector('.value').innerText;
                copyToClipboard(value);
            }
        });
    });

    function updateDisplay(hex) {
        colorPreview.style.backgroundColor = hex;

        const rgb = hexToRgb(hex);
        const hsl = hexToHsl(hex);
        const name = getColorName(hex);

        colorName.innerText = name;
        hexValue.innerText = hex.toUpperCase();
        rgbValue.innerText = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
        hslValue.innerText = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
    }

    function addToHistory(hex) {
        recentColors = recentColors.filter(c => c !== hex);
        recentColors.unshift(hex);

        if (recentColors.length > 10) {
            recentColors.pop();
        }

        localStorage.setItem('chromaLens_recent', JSON.stringify(recentColors));
        renderRecentColors();
    }

    function renderRecentColors() {
        recentGrid.innerHTML = '';
        recentColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'recent-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = `Click to restore: ${color}`;

            // Add heart icon
            const heart = document.createElement('button');
            const isSaved = favorites.includes(color.toLowerCase());
            heart.className = 'add-favorite-btn' + (isSaved ? ' saved' : '');
            heart.innerHTML = getHeartSVG(isSaved);
            heart.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(color);
            };
            swatch.appendChild(heart);

            swatch.addEventListener('click', (e) => {
                if (e.target === heart) return; // Ignore heart click using logic above
                currentColor = color;
                updateDisplay(color);
                updateFavoriteButton(color);
                if (!document.getElementById('view-palette').classList.contains('hidden')) {
                    renderPalette(color);
                }
            });
            recentGrid.appendChild(swatch);
        });
    }

    let toastTimeout;
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied!'))
            .catch(() => showToast('Copy failed'));
    }

    function showToast(message, undoCallback) {
        clearTimeout(toastTimeout);

        // Update toast HTML to include undo button if callback provided
        if (undoCallback) {
            toast.innerHTML = `
                <span>${message}</span>
                <button class="toast-undo-btn">Undo</button>
            `;
            const undoBtn = toast.querySelector('.toast-undo-btn');
            undoBtn.onclick = () => {
                clearTimeout(toastTimeout);
                undoCallback();
                toast.classList.remove('visible');
                setTimeout(() => toast.classList.add('hidden'), 300);
            };
        } else {
            toast.innerHTML = `<span>${message}</span>`;
        }

        toast.classList.remove('hidden');
        void toast.offsetWidth;
        toast.classList.add('visible');

        toastTimeout = setTimeout(() => {
            toast.classList.remove('visible');
            toastTimeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, undoCallback ? 5000 : 2000); // Longer timeout for undo
    }

    // Custom confirmation modal
    function showConfirmModal(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal confirm-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 280px; text-align: center;">
                <p style="margin-bottom: 16px;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="action-btn cancel-btn">Cancel</button>
                    <button class="action-btn primary confirm-btn">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.cancel-btn').onclick = () => modal.remove();
        modal.querySelector('.confirm-btn').onclick = () => {
            onConfirm();
            modal.remove();
        };
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }
});
