// ChromaLens Background Service Worker

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'extract-image-colors',
        title: 'Extract colors from this image',
        contexts: ['image']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'extract-image-colors') {
        chrome.storage.local.set({
            pendingImageExtract: info.srcUrl
        });
    }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Start area selection - use the tabId passed from popup
    if (request.action === 'start_area_selection') {
        const tabId = request.tabId;
        if (!tabId) {
            return false;
        }

        // Check if we can inject into this tab
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                return;
            }

            // Skip restricted URLs (chrome://, edge://, about:, etc.)
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('edge://') ||
                url.startsWith('about:') || url.startsWith('chrome-extension://') ||
                url.startsWith('moz-extension://') || !url.startsWith('http')) {
                return;
            }

            // Inject CSS first, then JS (callback style for Firefox compatibility)
            chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['content/select-area.css']
            }, () => {
                if (chrome.runtime.lastError) {
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/select-area.js']
                }, () => {
                    // Injection failed for this tab, ignore
                });
            });
        });

        return false; // No response needed, popup is closing
    }

    // Area was selected - capture screenshot and store
    if (request.action === 'area_selected') {
        const bounds = request.bounds;

        // Capture visible tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                return;
            }

            // Store the data
            chrome.storage.local.set({
                pendingCapture: {
                    screenshot: dataUrl,
                    bounds: bounds
                }
            }, () => {
                // Set badge to indicate capture is ready
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
            });
        });
        return false;
    }

    // Selection was cancelled
    if (request.action === 'selection_cancelled') {
        chrome.storage.local.remove('pendingCapture');
        return false;
    }

    // Get pending image for context menu extraction
    if (request.action === 'get_pending_image') {
        chrome.storage.local.get(['pendingImageExtract'], (result) => {
            sendResponse({ imageUrl: result.pendingImageExtract });
            chrome.storage.local.remove('pendingImageExtract');
        });
        return true;
    }

    return false;
});
