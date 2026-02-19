// Storage wrapper for chrome.storage.sync with localStorage fallback
// Provides async interface for data persistence across devices

const STORAGE_KEYS = {
    FAVORITES: 'chromaLens_favorites',
    RECENT: 'chromaLens_recent',
    THEME: 'chromaLens_theme'
};

// Check if chrome.storage is available (extension context)
const useChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

/**
 * Get data from storage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {Promise<*>} - Stored value or default
 */
export async function getData(key, defaultValue = null) {
    if (useChromeStorage) {
        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    } else {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    }
}

/**
 * Set data in storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<void>}
 */
export async function setData(key, value) {
    if (useChromeStorage) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ [key]: value }, resolve);
        });
    } else {
        localStorage.setItem(key, JSON.stringify(value));
        return Promise.resolve();
    }
}

/**
 * Remove data from storage
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
export async function removeData(key) {
    if (useChromeStorage) {
        return new Promise((resolve) => {
            chrome.storage.sync.remove([key], resolve);
        });
    } else {
        localStorage.removeItem(key);
        return Promise.resolve();
    }
}

// Export storage keys for easy access
export { STORAGE_KEYS };
