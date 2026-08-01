import {
  getColorName,
  getContrastRatio,
  getHarmonies,
  getRecommendedColor,
  hexToHsl,
  hexToRgb,
} from '../../utils/color';
import { cropImageToBounds, extractColorsFromImage } from '../../utils/image';
import { getData, setData } from '../../utils/storage';
import {
  getCheckSVG,
  getClipboardSVG,
  getGlobeSVG,
  getHeartSVG,
  getImageSVG,
  getScreenSVG,
  getSparklesSVG,
  getTrashSVG,
  getXSVG,
} from '../../components/icons';

// Security: escape HTML entities to prevent XSS
function escapeHTML(str: string | null | undefined): string {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Validation: ensure hex color format
function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Theme Management
  const initTheme = () => {
    const savedTheme = getData<'auto' | 'light' | 'dark'>('chromaLens_theme', 'auto');
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  };

  const updateThemeButtons = (theme: string) => {
    document.querySelectorAll('.theme-option').forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.theme === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
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

  themeOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = (btn as HTMLElement).dataset.theme as 'auto' | 'light' | 'dark';
      setData('chromaLens_theme', theme);
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
  const pickBtn = document.getElementById('pick-btn') as HTMLButtonElement;
  const colorPreview = document.getElementById('color-preview')!;
  const hexValue = document.getElementById('hex-value')!;
  const rgbValue = document.getElementById('rgb-value')!;
  const hslValue = document.getElementById('hsl-value')!;
  const colorName = document.getElementById('color-name')!;
  const recentGrid = document.getElementById('recent-colors')!;
  const toast = document.getElementById('toast')!;
  const copyBtns = document.querySelectorAll('.copy-btn');

  // Audit Elements
  const scanBtn = document.getElementById('scan-btn')!;
  const auditResults = document.getElementById('audit-results')!;
  const auditSummary = document.getElementById('audit-summary')!;
  const violationCount = document.getElementById('violation-count')!;

  // Palette Elements
  const harmonySelect = document.getElementById('harmony-select') as HTMLSelectElement;
  const paletteGrid = document.getElementById('palette-grid')!;
  const exportCssBtn = document.getElementById('export-css')!;
  const exportJsonBtn = document.getElementById('export-json')!;

  // Extract/Capture Elements
  const extractBtn = document.getElementById('extract-btn')!;
  const captureBtn = document.getElementById('capture-btn')!;
  const extractGrid = document.getElementById('extract-grid')!;
  const extractActions = document.getElementById('extract-actions')!;
  const extractCssBtn = document.getElementById('extract-css')!;
  const extractJsonBtn = document.getElementById('extract-json')!;
  const imageStatus = document.getElementById('image-status')!;

  // Capture sub-tab elements
  const captureModes = document.querySelectorAll('.capture-mode-btn');
  const captureContents = document.querySelectorAll('.capture-content');
  const captureResults = document.getElementById('capture-results')!;
  const resultsTitle = document.getElementById('results-title')!;
  const clearResultsBtn = document.getElementById('clear-results')!;
  let extractedPalette: string[] = [];

  // Favorites Elements
  const favoritesGrid = document.getElementById('favorites-grid')!;
  const favoritesEmpty = document.getElementById('favorites-empty')!;
  const exportFavoritesBtn = document.getElementById('export-favorites-btn')!;
  const clearFavoritesBtn = document.getElementById('clear-favorites-btn')!;
  const addFavoriteBtn = document.getElementById('add-favorite-btn')!;
  const favorites = (
    getData<string[]>('chromaLens_favorites', [])
  ).map((c) => (typeof c === 'string' ? c.toLowerCase() : ''));

  // Check for pending image from context menu
  const checkPendingImage = async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: 'get_pending_image' });
      if (response && (response as { imageUrl?: string }).imageUrl) {
        // Switch to extract tab and Image mode
        document.querySelector('[data-tab="extract"]')!.dispatchEvent(new MouseEvent('click'));
        document.querySelector('[data-mode="image"]')?.dispatchEvent(new MouseEvent('click'));
        imageStatus.classList.remove('hidden');
        extractGrid.innerHTML = '<div class="extract-empty">Extracting colors from image...</div>';

        try {
          const colors = await extractColorsFromImage((response as { imageUrl: string }).imageUrl);
          imageStatus.classList.add('hidden');
          renderExtractedPalette(colors, `${getImageSVG()} <span>Image Extract</span>`);
        } catch {
          imageStatus.classList.add('hidden');
          extractGrid.innerHTML = '<div class="extract-empty">Could not load image. Try a same-origin image.</div>';
        }
      }
    } catch {
      // No pending image
    }
  };

  // Check for pending screen capture from area selection
  const checkPendingCapture = async () => {
    try {
      const result = await browser.storage.local.get(['pendingCapture']);
      const pending = result.pendingCapture as
        | { screenshot: string; bounds: { x: number; y: number; width: number; height: number } }
        | undefined;
      if (!pending) return;

      const { screenshot, bounds } = pending;
      await browser.storage.local.remove('pendingCapture');
      await browser.action.setBadgeText({ text: '' });

      // Switch to extract tab and Screen mode
      document.querySelector('[data-tab="extract"]')!.dispatchEvent(new MouseEvent('click'));
      document.querySelector('[data-mode="screen"]')?.dispatchEvent(new MouseEvent('click'));
      extractGrid.innerHTML = '<div class="extract-empty">Processing captured area...</div>';

      try {
        // bounds already scaled by devicePixelRatio
        const croppedUrl = await cropImageToBounds(screenshot, bounds, 1);
        const colors = await extractColorsFromImage(croppedUrl);
        renderExtractedPalette(colors, `${getScreenSVG()} <span>Screen Capture</span>`);
      } catch {
        extractGrid.innerHTML = '<div class="extract-empty">Failed to process captured area.</div>';
      }
    } catch {
      // No pending capture
    }
  };

  // Listen for context menu triggers while popup is open
  browser.runtime.onMessage.addListener((request) => {
    if ((request as { action?: string }).action === 'extract_image') {
      document.querySelector('[data-tab="extract"]')!.dispatchEvent(new MouseEvent('click'));
      imageStatus.classList.remove('hidden');
      extractGrid.innerHTML = '<div class="extract-empty">Extracting colors from image...</div>';

      extractColorsFromImage((request as { imageUrl: string }).imageUrl)
        .then((colors) => {
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
  const imageFileInput = document.getElementById('image-file-input') as HTMLInputElement;
  if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;

        // Switch to Image mode and show processing
        document.querySelector('[data-mode="image"]')?.dispatchEvent(new MouseEvent('click'));
        extractGrid.innerHTML = '<div class="extract-empty">Extracting colors...</div>';

        extractColorsFromImage(imageUrl)
          .then((colors) => {
            renderExtractedPalette(colors, '📁 ' + file.name);
          })
          .catch(() => {
            extractGrid.innerHTML = '<div class="extract-empty">Could not process image.</div>';
          });
      };
      reader.readAsDataURL(file);

      // Reset input so same file can be selected again
      input.value = '';
    });
  }

  // Crop Modal Elements (only initialize if elements exist)
  const cropModal = document.getElementById('crop-modal');
  const cropCanvas = document.getElementById('crop-canvas') as HTMLCanvasElement | null;
  const cropSelection = document.getElementById('crop-selection') as HTMLElement | null;
  const cropCancel = document.getElementById('crop-cancel');
  const cropConfirm = document.getElementById('crop-confirm');

  if (cropCanvas && cropModal && cropSelection && cropCancel && cropConfirm) {
    const cropContainer = cropCanvas.parentElement!;
    let capturedScreenshot: string | null = null;
    let cropBounds: { x: number; y: number; width: number; height: number } | null = null;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    const canvasScale = 1;

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

      cropImageToBounds(capturedScreenshot!, cropBounds, canvasScale)
        .then((croppedImage) => extractColorsFromImage(croppedImage))
        .then((colors) => {
          renderExtractedPalette(colors, `${getScreenSVG()} <span>Crop Selection</span>`);
        })
        .catch(() => {
          extractGrid.innerHTML = '<div class="extract-empty">Failed to extract colors.</div>';
        });
    });
  }

  // Capture button handler - starts area selection on the page
  captureBtn.addEventListener('click', async () => {
    // Get the active tab from the popup context
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.id !== undefined) {
      // Send tabId explicitly to background script
      await browser.runtime.sendMessage({
        action: 'start_area_selection',
        tabId: tab.id,
      });
      // Close popup - user needs to select on the page
      setTimeout(() => window.close(), 50);
    }
  });

  // Capture sub-tab switching
  captureModes.forEach((btn) => {
    btn.addEventListener('click', () => {
      captureModes.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = (btn as HTMLElement).dataset.mode;
      captureContents.forEach((content) => {
        content.classList.add('hidden');
      });
      document.getElementById(`capture-mode-${mode}`)!.classList.remove('hidden');
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

  // Initialize state
  const recentColors: string[] = getData<string[]>('chromaLens_recent', []);
  const currentColor = (recentColors[0] && isValidHex(recentColors[0])) ? recentColors[0] : '#FFFFFF';

  // About Modal
  const aboutBtn = document.getElementById('about-btn')!;
  const aboutModal = document.getElementById('about-modal')!;
  const modalClose = document.getElementById('modal-close')!;

  aboutBtn.addEventListener('click', () => aboutModal.classList.remove('hidden'));
  modalClose.addEventListener('click', () => aboutModal.classList.add('hidden'));
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
  });

  // Note: recentColors/currentColor were previously let; keep behavior identical by
  // re-reading from storage when needed (they were only mutated via addToHistory /
  // swatch clicks). We keep a mutable copy to match original semantics:
  const recentColorsMut: string[] = recentColors.slice();
  const currentColorMut: { value: string } = { value: currentColor };
  const getCurrentColor = () => currentColorMut.value;
  const setCurrentColor = (c: string) => {
    currentColorMut.value = c;
  };

  renderRecentColors();
  renderFavorites();
  updateDisplay(getCurrentColor());
  updateFavoriteButton(getCurrentColor());

  // Favorites Logic
  addFavoriteBtn.addEventListener('click', () => {
    toggleFavorite(getCurrentColor());
    updateFavoriteButton(getCurrentColor());
    renderFavorites();
  });

  function toggleFavorite(hex: string) {
    const normalizedHex = hex.toLowerCase();
    const index = favorites.indexOf(normalizedHex);
    if (index === -1) {
      favorites.unshift(normalizedHex);
    } else {
      favorites.splice(index, 1);
    }
    setData('chromaLens_favorites', favorites);
    renderFavorites();

    // Update other views if they are visible
    if (!document.getElementById('view-picker')!.classList.contains('hidden')) {
      updateFavoriteButton(getCurrentColor());
    }
    // Force re-render of recent/palette to update heart icons
    renderRecentColors();
    if (!document.getElementById('view-palette')!.classList.contains('hidden')) {
      renderPalette(getCurrentColor());
    }
  }

  function updateFavoriteButton(hex: string) {
    if (!addFavoriteBtn) return;
    const normalizedHex = hex.toLowerCase();
    const isSaved = favorites.includes(normalizedHex);
    if (isSaved) {
      addFavoriteBtn.classList.add('active');
    } else {
      addFavoriteBtn.classList.remove('active');
    }
  }

  function deleteFavoriteWithUndo(hex: string) {
    const normalizedHex = hex.toLowerCase();
    const index = favorites.indexOf(normalizedHex);
    if (index === -1) return;

    // Remove from favorites
    favorites.splice(index, 1);
    setData('chromaLens_favorites', favorites);
    renderFavorites();
    updateFavoriteButton(getCurrentColor());
    renderRecentColors();

    // Show undo toast
    showToast('Color removed', () => {
      // Restore color at same position
      favorites.splice(index, 0, normalizedHex);
      setData('chromaLens_favorites', favorites);
      renderFavorites();
      updateFavoriteButton(getCurrentColor());
      renderRecentColors();
      showToast('Color restored');
    });
  }

  function renderFavorites() {
    // Update favorites count badge
    const countBadge = document.getElementById('favorites-count');
    if (countBadge) {
      if (favorites.length > 0) {
        countBadge.textContent = String(favorites.length);
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

    favorites.forEach((color) => {
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
        setCurrentColor(color);
        updateDisplay(color);
        copyToClipboard(color);
      };

      favoritesGrid.appendChild(card);
    });
  }

  // Favorites Actions
  clearFavoritesBtn?.addEventListener('click', () => {
    showConfirmModal('Clear all favorites?', () => {
      favorites.length = 0;
      setData('chromaLens_favorites', favorites);
      renderFavorites();
      updateFavoriteButton(getCurrentColor());
      renderRecentColors();
    });
  });

  exportFavoritesBtn.addEventListener('click', () => {
    if (favorites.length === 0) return;
    // Show export modal with favorites data
    const exportModal = document.getElementById('export-modal')!;
    const exportPreview = document.getElementById('export-colors-preview')!;
    const exportClose = document.getElementById('export-modal-close')!;

    // Populate preview
    exportPreview.innerHTML = '';
    favorites.slice(0, 10).forEach((c) => {
      const el = document.createElement('div');
      el.className = 'export-color-preview';
      el.style.backgroundColor = c;
      exportPreview.appendChild(el);
    });

    // Setup format buttons for Favorites
    const formatBtns = exportModal.querySelectorAll('.export-format-btn');
    formatBtns.forEach((btn) => {
      // Remove old listeners to avoid duplicates (naive approach)
      const newBtn = btn.cloneNode(true);
      btn.parentNode!.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        const format = (newBtn as HTMLElement).dataset.format;
        let output = '';

        if (format === 'css-vars') {
          output = ':root {\n';
          favorites.forEach((c, i) => (output += `  --favorite-${i + 1}: ${c};\n`));
          output += '}';
        } else if (format === 'tailwind') {
          const colorsObj: Record<string, string> = {};
          favorites.forEach((c, i) => (colorsObj[`favorite-${i + 1}`] = c));
          output = JSON.stringify(colorsObj, null, 2);
        } else if (format === 'scss') {
          favorites.forEach((c, i) => (output += `$favorite-${i + 1}: ${c};\n`));
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
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const target = (tab as HTMLElement).dataset.tab;
      views.forEach((view) => {
        if (view.id === 'view-' + target) {
          view.classList.remove('hidden');
          view.classList.add('active');
          if (target === 'palette') {
            renderPalette(getCurrentColor());
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

    const eyeDropper = new window.EyeDropper();

    try {
      const result = await eyeDropper.open();
      const color = result.sRGBHex;

      setCurrentColor(color);
      updateDisplay(color);
      updateFavoriteButton(color);
      addToHistory(color);

      if (!document.getElementById('view-palette')!.classList.contains('hidden')) {
        renderPalette(color);
      }
    } catch {
      // User canceled the color picker
    }
  });

  // Audit Scan
  scanBtn.addEventListener('click', async () => {
    auditResults.innerHTML = '<div class="empty-state">Scanning page...</div>';
    auditSummary.classList.add('hidden');

    const tabsList = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabsList[0]) return;

    const tabId = tabsList[0].id!;

    // Try sending message first
    try {
      const response = await browser.tabs.sendMessage(tabId, { action: 'scan_page' });
      if (response && (response as { results?: unknown }).results) {
        analyzeResults((response as { results: Violation[] }).results);
      } else {
        auditResults.innerHTML = '<div class="empty-state">No text elements found to analyze.</div>';
      }
    } catch {
      // Content script not loaded - inject it programmatically
      try {
        await browser.scripting.executeScript({
          target: { tabId: tabId },
          files: ['/content-scripts/audit.js'],
        });
        // Retry after injection with sufficient delay for script initialization
        setTimeout(async () => {
          try {
            const retryResponse = await browser.tabs.sendMessage(tabId, { action: 'scan_page' });
            if (retryResponse && (retryResponse as { results?: unknown }).results) {
              analyzeResults((retryResponse as { results: Violation[] }).results);
            } else {
              auditResults.innerHTML = '<div class="empty-state">Could not scan this page. Try a different website.</div>';
            }
          } catch {
            auditResults.innerHTML = '<div class="empty-state">Could not scan this page. Try a different website.</div>';
          }
        }, 300);
      } catch {
        auditResults.innerHTML = '<div class="empty-state">Cannot scan this page (browser internal page).</div>';
      }
    }
  });

  // Palette Logic
  harmonySelect.addEventListener('change', () => {
    renderPalette(getCurrentColor());
  });

  function renderPalette(baseColor: string) {
    // Update base color indicator
    const baseSwatch = document.getElementById('harmony-base-swatch');
    const baseHex = document.getElementById('harmony-base-hex');
    if (baseSwatch) baseSwatch.style.backgroundColor = baseColor;
    if (baseHex) baseHex.textContent = baseColor.toUpperCase();

    const type = harmonySelect.value;
    const harmonies = getHarmonies(baseColor);
    const colors = harmonies[type as keyof typeof harmonies] || [];

    paletteGrid.innerHTML = '';

    colors.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = `Click to copy: ${color}`;
      swatch.onclick = () => copyToClipboard(color);

      const whiteRatio = getContrastRatio('#FFFFFF', color);
      const textColor = whiteRatio > 3 ? 'white' : 'black';

      swatch.innerHTML =
        '<span class="palette-hex" style="color: ' +
        textColor +
        '; background: rgba(0,0,0,0.1)">' +
        color.toUpperCase() +
        '</span>';

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
    const colors = getHarmonies(getCurrentColor())[type as keyof ReturnType<typeof getHarmonies>] || [];
    let css = ':root {\n';
    colors.forEach((c, i) => {
      css += '  --color-' + type + '-' + (i + 1) + ': ' + c + ';\n';
    });
    css += '}';
    copyToClipboard(css);
  });

  exportJsonBtn.addEventListener('click', () => {
    const type = harmonySelect.value;
    const colors = getHarmonies(getCurrentColor())[type as keyof ReturnType<typeof getHarmonies>] || [];
    const json = JSON.stringify({ [type]: colors }, null, 2);
    copyToClipboard(json);
  });

  // Extract Site Palette Logic
  extractBtn.addEventListener('click', async () => {
    extractGrid.innerHTML = '<div class="extract-empty">Scanning site colors...</div>';
    extractActions.classList.add('hidden');

    const tabsList = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabsList[0]) return;

    const tabId = tabsList[0].id!;

    try {
      const response = await browser.tabs.sendMessage(tabId, { action: 'extract_palette' });
      if (response && (response as { palette?: unknown[] }).palette && (response as { palette: unknown[] }).palette.length > 0) {
        renderExtractedPalette(
          (response as { palette: Array<{ color: string; percentage: number }> }).palette,
          `${getGlobeSVG()} <span>Site Colors</span>`,
        );
      } else {
        extractGrid.innerHTML = '<div class="extract-empty">No colors found on this page.</div>';
      }
    } catch {
      // Inject script and retry
      try {
        await browser.scripting.executeScript({
          target: { tabId: tabId },
          files: ['/content-scripts/audit.js'],
        });
        setTimeout(async () => {
          try {
            const retryResponse = await browser.tabs.sendMessage(tabId, { action: 'extract_palette' });
            if (retryResponse && (retryResponse as { palette?: unknown[] }).palette) {
              renderExtractedPalette(
                (retryResponse as { palette: Array<{ color: string; percentage: number }> }).palette,
              );
            } else {
              extractGrid.innerHTML = '<div class="extract-empty">Could not extract colors from this page.</div>';
            }
          } catch {
            extractGrid.innerHTML = '<div class="extract-empty">Could not extract colors from this page.</div>';
          }
        }, 300);
      } catch {
        extractGrid.innerHTML = '<div class="extract-empty">Cannot scan this page.</div>';
      }
    }
  });

  function renderExtractedPalette(
    colors: Array<{ color: string; percentage: number }>,
    title?: string,
  ) {
    // Handle both new format {color, percentage} and legacy string format
    const normalizedColors = colors.map((c) =>
      typeof c === 'string' ? { color: c as string, percentage: 0 } : c,
    );

    // Store just color strings for export
    extractedPalette = normalizedColors.map((c) => c.color);
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
      swatch.title =
        item.percentage > 0
          ? `${item.color.toUpperCase()} (${item.percentage}%)`
          : `Click to copy: ${item.color.toUpperCase()}`;
      (swatch as HTMLElement).dataset.hex = item.color.toUpperCase();
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

  function analyzeResults(elements: Violation[]) {
    auditResults.innerHTML = '';
    let violations = 0;

    elements.forEach((el) => {
      const ratio = getContrastRatio(el.fg, el.bg);

      let threshold = 4.5;
      const size = parseFloat(String(el.fontSize));
      const weight = parseInt(String(el.fontWeight)) || 400;

      if (size >= 24 || (size >= 18.5 && weight >= 700)) {
        threshold = 3.0;
      }

      if (ratio < threshold) {
        violations++;
        renderViolation(el, ratio);
      }
    });

    violationCount.innerText = String(violations);
    auditSummary.classList.remove('hidden');

    if (violations === 0) {
      auditResults.innerHTML = `<div class="empty-state" style="color: var(--success)">${getSparklesSVG()} No contrast violations found!</div>`;
    }
  }

  function renderViolation(el: Violation, ratio: number) {
    const recommended = getRecommendedColor(el.fg, el.bg);
    const card = document.createElement('div');
    card.className = 'violation-card';

    // WCAG thresholds
    const size = parseFloat(String(el.fontSize));
    const weight = parseInt(String(el.fontWeight)) || 400;
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

    card.innerHTML =
      '<div class="violation-header"><span>Ratio: ' +
      ratio.toFixed(2) +
      ':1</span><div class="badges">' +
      aaBadge +
      aaaBadge +
      '</div></div>' +
      '<div class="violation-meta">' +
      textType +
      '</div>' +
      '<div class="violation-text" title="' +
      safeText +
      '" style="color: ' +
      safeFg +
      '; background: ' +
      safeBg +
      '; padding: 8px; border-radius: 4px;">' +
      safeText +
      '</div>' +
      '<div class="recommendation"><div class="color-chip" style="background-color: ' +
      safeRec +
      '"></div>' +
      '<div class="rec-details"><div class="rec-label">Recommended</div><div class="rec-value">' +
      safeRec +
      '</div></div>' +
      '<button class="copy-btn mini" data-val="' +
      safeRec +
      '">' +
      getClipboardSVG() +
      '</button></div>';

    card.querySelector('.copy-btn')?.addEventListener('click', (e) => {
      copyToClipboard((e.target as HTMLElement).dataset.val || '');
    });

    auditResults.appendChild(card);
  }

  // Copy buttons
  copyBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.val) {
        copyToClipboard(target.dataset.val);
        return;
      }

      const row = target.closest('.value-row');
      if (row) {
        const value = row.querySelector('.value')?.textContent || '';
        copyToClipboard(value);
      }
    });
  });

  function updateDisplay(hex: string) {
    colorPreview.style.backgroundColor = hex;

    const rgb = hexToRgb(hex);
    const hsl = hexToHsl(hex);
    const name = getColorName(hex);

    colorName.innerText = name;
    hexValue.innerText = hex.toUpperCase();
    rgbValue.innerText = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
    hslValue.innerText = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
  }

  function addToHistory(hex: string) {
    recentColorsMut.splice(recentColorsMut.indexOf(hex), 1);
    recentColorsMut.unshift(hex);

    if (recentColorsMut.length > 10) {
      recentColorsMut.pop();
    }

    setData('chromaLens_recent', recentColorsMut);
    renderRecentColors();
  }

  function renderRecentColors() {
    recentGrid.innerHTML = '';
    recentColorsMut.forEach((color) => {
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
        if (e.target === heart) return; // Ignore heart click
        setCurrentColor(color);
        updateDisplay(color);
        updateFavoriteButton(color);
        if (!document.getElementById('view-palette')!.classList.contains('hidden')) {
          renderPalette(color);
        }
      });
      recentGrid.appendChild(swatch);
    });
  }

  let toastTimeout: ReturnType<typeof setTimeout>;
  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('Copied!'))
      .catch(() => showToast('Copy failed'));
  }

  function showToast(message: string, undoCallback?: () => void) {
    clearTimeout(toastTimeout);

    // Update toast HTML to include undo button if callback provided
    if (undoCallback) {
      toast.innerHTML = `
                <span>${message}</span>
                <button class="toast-undo-btn">Undo</button>
            `;
      const undoBtn = toast.querySelector<HTMLButtonElement>('.toast-undo-btn')!;
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
  function showConfirmModal(message: string, onConfirm: () => void) {
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

    modal.querySelector<HTMLButtonElement>('.cancel-btn')!.onclick = () => modal.remove();
    modal.querySelector<HTMLButtonElement>('.confirm-btn')!.onclick = () => {
      onConfirm();
      modal.remove();
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  // Run pending flows after initial render
  void checkPendingImage();
  void checkPendingCapture();
});
