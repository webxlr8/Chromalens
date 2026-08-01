// ChromaLens Background Service Worker (WXT)

export default defineBackground(() => {
  type BackgroundRequest = {
    action: string;
    tabId?: number;
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
      devicePixelRatio: number;
    };
  };

  // Create context menu on install
  browser.runtime.onInstalled.addListener(() => {
    try {
      browser.contextMenus.create({
        id: 'extract-image-colors',
        title: 'Extract colors from this image',
        contexts: ['image'],
      });
    } catch {
      // Context menu already exists or creation failed — ignore
    }
  });

  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== 'extract-image-colors') return;

    void browser.storage.local
      .set({ pendingImageExtract: info.srcUrl })
      .catch(() => {});
  });

  // Handle messages from popup and content scripts
  browser.runtime.onMessage.addListener(
    (request: BackgroundRequest, _sender, sendResponse) => {
      // Start area selection — inject the select-area content script
      if (request.action === 'start_area_selection') {
        const tabId = request.tabId;
        if (tabId === undefined) {
          return false;
        }

        void (async () => {
          try {
            const tab = await browser.tabs.get(tabId);
            const url = tab.url || '';

            // Skip restricted URLs (chrome://, edge://, about:, etc.)
            if (
              url.startsWith('chrome://') ||
              url.startsWith('edge://') ||
              url.startsWith('about:') ||
              url.startsWith('chrome-extension://') ||
              url.startsWith('moz-extension://') ||
              !url.startsWith('http')
            ) {
              return;
            }

            // Inject CSS first, then JS
            await browser.scripting.insertCSS({
              target: { tabId },
              files: ['/content-scripts/select-area.css'],
            });
            await browser.scripting.executeScript({
              target: { tabId },
              files: ['/content-scripts/select-area.js'],
            });
          } catch {
            // Injection failed for this tab — ignore
          }
        })();

        return false; // No response needed, popup is closing
      }

      // Area was selected — capture screenshot and store
      if (request.action === 'area_selected') {
        const bounds = request.bounds;

        void (async () => {
          try {
            const dataUrl = await browser.tabs.captureVisibleTab(
              browser.windows.WINDOW_ID_CURRENT,
              { format: 'png' },
            );

            await browser.storage.local.set({
              pendingCapture: { screenshot: dataUrl, bounds },
            });

            // Set badge to indicate capture is ready
            await browser.action.setBadgeText({ text: '!' });
            await browser.action.setBadgeBackgroundColor({ color: '#667eea' });
          } catch {
            // Capture failed — ignore
          }
        })();

        return false;
      }

      // Selection was cancelled
      if (request.action === 'selection_cancelled') {
        void browser.storage.local.remove('pendingCapture').catch(() => {});
        return false;
      }

      // Get pending image for context menu extraction
      if (request.action === 'get_pending_image') {
        void (async () => {
          try {
            const result = await browser.storage.local.get(['pendingImageExtract']);
            sendResponse({ imageUrl: result.pendingImageExtract });
            await browser.storage.local.remove('pendingImageExtract');
          } catch {
            sendResponse({ imageUrl: undefined });
          }
        })();

        return true; // Keep the message channel open for async sendResponse
      }

      return false;
    },
  );
});
