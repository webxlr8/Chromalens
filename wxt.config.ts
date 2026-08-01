import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Force MV3 for ALL targets (Chrome, Firefox, Edge). WXT defaults Firefox/Safari to MV2.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Firefox limits name to 45 chars and description to 132 chars
    name:
      browser === 'firefox'
        ? 'ChromaLens - Color Picker'
        : 'ChromaLens - Color Picker & Accessibility Toolkit',
    // Store manifests must use numeric versions (CWS/Edge/AMO reject prerelease strings).
    // The package version (2.0.0-beta.1) drives zips + GitHub release tags.
    version: '2.0.0',
    // Display label shown in the Chrome/Edge Web Store
    version_name: browser === 'firefox' ? undefined : '2.0.0 Beta',
    description:
      browser === 'firefox'
        ? 'Professional color picker, palette extractor, contrast checker & WCAG accessibility auditor.'
        : 'Professional color picker, palette extractor, contrast checker & WCAG accessibility auditor. Pick colors, generate harmonies, analyze websites.',
    author: 'Muhammed Azharudheen K J - YIB Global Technology Services LLP',
    homepage_url: 'https://webxlr8.com',
    permissions: ['activeTab', 'scripting', 'storage', 'contextMenus', 'tabs'],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
    action: {
      default_icon: {
        16: '/icons/icon16.png',
        48: '/icons/icon48.png',
        128: '/icons/icon128.png',
      },
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+Y',
          mac: 'Command+Shift+Y',
        },
        description: 'Open Color Picker',
      },
    },
    // Firefox-only keys
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'chromalens@webxlr8.com',
          strict_min_version: '109.0',
        },
      },
    }),
  }),
});
