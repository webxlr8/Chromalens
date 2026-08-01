# Changelog

All notable changes to ChromaLens are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/) with store-compatible manifests (see [RELEASE.md](RELEASE.md)).

## [Unreleased]

## [2.0.0-beta.1] - 2026-08-01

### Added
- WXT 0.21 + strict TypeScript rewrite (v1 vanilla JS), MV3 for Chrome, Edge and Firefox (event-page fallback)
- Cross-browser picker fallback with 8x magnifier loupe — exact pixel sampling for Firefox/Safari (native EyeDropper kept on Chromium)
- Manual hex color input (`#RRGGBB` + Enter) with validation
- Named palettes: save any capture (site/screen/image) as a palette, load, delete (50-palette cap)
- CI pipeline (typecheck, lint, 87 tests, Chrome + Firefox builds, AMO lint)
- Algorithm conformance tests: CIEDE2000 against the Sharma et al. (2005) reference dataset, WCAG contrast reference values

### Fixed
- WCAG large-text threshold: 18-24px text now correctly audited at 4.5:1 (was 3:1) — `isLargeText` matches 24px / 18.66px-bold
- Duplicate pending-capture handler race (screen captures could be processed twice)
- Firefox manifest limits (45-char name, 132-char description)

### Changed
- Migration: 70 → 87 automated tests; web-ext lint 0 errors; storage keys preserved (`chromaLens_favorites`, `chromaLens_recent`, `chromaLens_theme`)
- Removed dead crop-modal UI, legacy vanilla files, unused storage/audit duplication

## [1.1.0] - 2026-02-19

Initial public version (vanilla JS MV3). Chromium-only; cross-browser compatibility fix via event-page background.

[Unreleased]: https://github.com/webxlr8/Chromalens/compare/v2.0.0-beta.1...HEAD
[2.0.0-beta.1]: https://github.com/webxlr8/Chromalens/releases/tag/v2.0.0-beta.1
[1.1.0]: https://github.com/webxlr8/Chromalens/releases/tag/v1.1.0
