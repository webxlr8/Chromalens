import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Force MV3 for ALL targets (Chrome, Firefox, Edge). WXT defaults Firefox/Safari to MV2.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'ChromaLens - Color Picker & Accessibility Toolkit',
    description:
      'Professional color picker, palette extractor, contrast checker & WCAG accessibility auditor. Pick colors, generate harmonies, analyze websites.',
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
