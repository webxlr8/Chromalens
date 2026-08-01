# ChromaLens — Color Picker & Accessibility Toolkit

[![CI](https://github.com/azharudh33n/Color-Picker/actions/workflows/ci.yml/badge.svg)](https://github.com/azharudh33n/Color-Picker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0--beta.1-orange.svg)](https://github.com/azharudh33n/Color-Picker/releases)

**Status: Beta (v2.0.0-beta.1)** — see [RELEASE.md](RELEASE.md) for the release plan and [CHANGELOG.md](CHANGELOG.md) for history.

Professional color picker, palette extractor, contrast checker & WCAG accessibility auditor. Built with [WXT](https://wxt.dev) + TypeScript, targeting Chrome, Edge, and Firefox (MV3). Open source under the [MIT License](LICENSE).

## Features

- **Precision Color Picker**: native EyeDropper API (Chromium) with a screenshot-based fallback + 8x magnifier loupe for Firefox/Safari
- **Manual Hex Input**: type any `#RRGGBB` — values, harmonies and history update
- **Color Harmonies**: complementary, analogous, triadic, split-complementary, tetradic, square, monochromatic
- **Extraction**:
  - **Site Extract**: dominant colors from any page's CSS (weighted k-means in CIELAB)
  - **Screen Capture**: select an area on the page → capture → extract palette
  - **Image Extract**: right-click any image or upload a file
- **Named Palettes**: save any capture as a named palette (load, delete, 50-palette cap)
- **WCAG Audit**: contrast scan with AA/AAA badges and recommended-color fixes
- **Favorites + Export**: CSS variables, SCSS, Tailwind config, JSON
- Light/dark/auto theme

## Stack

- [WXT](https://wxt.dev) 0.21 — build framework, per-browser manifests (service worker for Chromium, event page for Firefox)
- TypeScript (strict), Vite 8, Vitest 4, ESLint (typescript-eslint)
- Node 24 LTS (see `.nvmrc`), pnpm 10
- Zero runtime dependencies

## Development

```bash
pnpm install          # installs deps, runs wxt prepare
pnpm dev              # Chrome with HMR
pnpm dev:firefox      # Firefox with HMR
```

## Verification

```bash
pnpm compile          # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest
pnpm build            # .output/chrome-mv3
pnpm build:firefox    # .output/firefox-mv3
```

Manual load: `chrome://extensions` → Load unpacked → `.output/chrome-mv3`. Firefox: `about:debugging` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`.

## Publishing

```bash
pnpm zip              # Chrome/Edge store zip → .output/*-chrome.zip
pnpm zip:firefox      # Firefox store zip + sources zip → .output/*-firefox.zip + *-sources.zip
```

Firefox (AMO) requires the sources zip. To rebuild from it:

```bash
pnpm i && pnpm zip:firefox
```

`wxt submit` can automate store uploads — run `pnpm wxt submit init` once and store credentials in `.env.submit` (never commit it).

Safari: `pnpm wxt build -b safari` then wrap `.output/safari-mv3` with `xcrun safari-web-extension-packager`.

## Structure

```
entrypoints/
  background.ts            # service worker / event page
  popup/                   # popup UI (index.html, main.ts, style.css)
  audit.content.ts         # WCAG audit + site palette (injected on demand)
  select-area.content.ts   # area selection overlay (injected on demand)
  pick-screen.content.ts   # cross-browser picker overlay + loupe (injected on demand)
utils/                     # pure logic: color, image, palettes, storage, types
components/icons.ts        # SVG icon factories
tests/                     # vitest suites
```

## Privacy

ChromaLens collects nothing. No analytics, no telemetry, no network calls from the extension. Everything you save (favorites, recents, palettes, theme) stays in your browser's local storage on your device.

## Contributing & License

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, gates, and commit style. Released under the [MIT License](LICENSE) — the ChromaLens name and logo are not covered by the license.
