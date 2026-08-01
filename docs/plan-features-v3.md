# ChromaLens — Feature Expansion Plan v3 (algorithms first, parallel waves)

**Date:** 2026-08-01
**Status:** DRAFT — implementation starts after approval
**Branch:** `wxt-migration` (pushed)
**Rule:** every feature = algorithm designed + tests first; every wave verified (compile/lint/test/build/e2e) before the next.

---

## FEATURE BACKLOG (from gap analysis, prioritized)

| ID | Feature | Priority |
|---|---|---|
| F1 | Cross-browser picker fallback + magnifier loupe (Firefox/Safari) | P0 |
| F2 | Manual color input + RGB/HSL sliders | P0 |
| F3 | Copy formats: CMYK / OKLCH / HSB + default-format setting | P0 |
| F4 | **Bug fix:** audit large-text threshold (18px → 24px / 18.66px bold) | P0 |
| F5 | Extracted-palette per-color copy with format + tooltip | P1 |
| F6 | Named palettes library (save/load/delete/export) | P1 |
| F7 | URL-based image extraction (CORS-limited, documented) | P1 |
| F8 | Audit report export (Markdown + JSON download) | P1 |
| F9 | Favorites/recent cross-device sync (storage.sync + migration) | P1 |
| F10 | Favorites file import/export (merge semantics) | P1 |
| F11 | Options page (default copy format, context-menu toggle, picker mode) | P2 |
| F12 | Store listing assets (screenshots, privacy text) | P2 — manual |

Deferred with reason: non-text contrast audit (unreliable adjacent-color sampling — needs a research spike, not an implementation), i18n (touches every string — parallel-unsafe, do last if wanted), gradient generator (nice-to-have, no algorithm risk).

---

## ALGORITHM DESIGN (the "understand it fully" part)

### F1 — Cross-browser picker + loupe
**Why this design:** EyeDropper API is Chromium-only. The universal primitive every extension uses: screenshot the viewport, sample pixels from a canvas. No host_permissions needed (captureVisibleTab requires only activeTab).

**Flow:**
1. Popup pick-btn: `window.EyeDropper` exists → native (unchanged). Else → `browser.runtime.sendMessage({action:'start_pick'})`.
2. Background: `tabs.captureVisibleTab(WINDOW_ID_CURRENT, {format:'png'})` → `storage.local.set({pendingPick:{screenshot, dpr}})` → inject `pick-screen.content.ts` + CSS (same executeScript pattern as select-area).
3. Content script: draw screenshot into fullscreen canvas (`canvas.width = innerWidth*dpr`, `ctx.drawImage(img,0,0)`); overlay + circular loupe (140px) + hex chip.
4. mousemove: `ctx.getImageData(floor(x*dpr), floor(y*dpr), 1, 1)` → exact pixel (no interpolation); loupe: `drawImage(canvas, cx-8, cy-8, 16, 16, 0, 0, 128, 128)` with `imageSmoothingEnabled=false` → 8x pixel-perfect zoom.
5. click: `sendMessage({action:'pick_selected', color})` → background stores `pendingPickResult` → popup on open consumes it (same pattern as pendingCapture — ONE handler).
6. ESC cancels; cleanup identical to select-area.

**Correctness:** DPR math mirrors select-area (multiply, not divide); 1×1 getImageData per move is O(1); canvas is extension-owned (no CORS).

### F2 — Manual input + sliders
**Model:** single source of truth = hex string (currentColor). Inputs: hex text field + R/G/B (0-255) + H(0-360)/S/L(0-100) sliders, all two-way synced with a `syncing` guard flag (no feedback loops).
- Hex input: accept `#rgb`/`#rrggbb`/`rrggbb` (case-insensitive), normalize via `normalizeHex()`; invalid → revert to last valid.
- Slider→hex: `rgbToHex`, `hslToHex` (already in utils, tested).
- hex→slider: `hexToRgb`, `hexToHsl` (already tested).
- All updates flow through existing `setCurrentColor` → display + harmony + favorite-button update. No new color math — reuses the 70-test-verified core.

### F3 — Format conversions (pure functions, all testable)
- `rgbToCmyk(r,g,b)`: standard `c=1-r/255, m=1-g/255, y=1-b/255, k=min(c,m,y)`, normalize `c=(c-k)/(1-k)` (k=1 → c=m=y=0). Known test: pure red → (0,1,1,0); black → (0,0,0,1); white → (0,0,0,0).
- `rgbToHsb(r,g,b)`: same hue math as HSL, `b=max/255`, `s=(max-min)/max` (max=0 → 0). Red → (0,100,100).
- `rgbToOklch(r,g,b)`: sRGB→linear (existing gamma decode) → LMS (Ottosson matrices) → cube root → OKLab → polar (C, H°). **Reference values for tests:** white → L=1, C=0, H=0; red → L≈0.62796, C≈0.25768, H≈29.234; blue → L≈0.45201, C≈0.31321, H≈264.05.
- `normalizeHex(input)`: strip `#`, 3→6 expand, lowercase; reject invalid.
- `isLargeText(fontSizePx, fontWeight)`: `fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)` — WCAG 18pt/14pt-bold, extracted from audit so it can be unit-tested.

### F4 — Audit threshold fix
`audit.content.ts:110` becomes `isLargeText(fontSize, fontWeight)` from utils. This changes scan classification for 18-24px text (now correctly flagged at 4.5:1). No other behavior change.

### F5 — Per-color copy
Click already copies hex; upgrade: copy uses default format (F11 setting), hex text in chip stays, plus a 1.2s "Copied #xxx" toast. No new algorithm.

### F6 — Named palettes
**Data model:** `utils/palettes.ts` — `SavedPalette {id: string, name: string, colors: string[], source: 'site'|'screen'|'image'|'manual', createdAt: number}`; localStorage key `chromaLens_palettes` (array, cap 50 — hygiene). CRUD: `listPalettes/savePalette/deletePalette/renamePalette`, `mergePalette` (dedupe preserving order). Tests: CRUD, dedupe, cap, corrupt-JSON fallback.
**UI:** "Save palette" button in Capture results (name inline input) + Palettes section in Saved view (load → sets currentColor/history; delete; export via F8-style download).

### F7 — URL extraction
Image mode gains URL input + Extract button → `extractColorsFromImage(url)` (existing). Same CORS wall as right-click extraction (crossOrigin='Anonymous'); failure shows "Blocked by CORS — upload the file instead." Optional `optional_host_permissions` grant for arbitrary hosts is a later enhancement — not now (keeps install surface clean).

### F8 — Audit report export
`utils/audit-report.ts`: `violationsToMarkdown(violations)` (table: element, text, ratio, required, AA, AAA, recommended) + `violationsToJson`. Download via Blob + `a.download` in popup. Tests: builders produce expected shapes for sample violations.

### F9 — Sync (biggest refactor, isolated)
`utils/storage.ts` becomes **async**: `getData/setData/removeData → Promise<T>` backed by `browser.storage.sync` (extension context, promise API) with localStorage fallback (non-extension/test context). One-time migration: on first sync-read, if sync empty and localStorage has `chromaLens_*` → push to sync, keep local as cache. Quota guard: sync item ≤8KB; on QuotaExceeded → fall back to local silently.
**Impact:** popup init becomes async (await before first render) — handled in the popup wave. Tests use WXT fake-browser (`wxt/testing/fake-browser`).

### F10 — File import/export
`mergeFavorites(existing, imported)`: union, preserve existing order, appended new ones first? — append new at end, dedupe. Export: JSON `[{color, savedAt}]`? Keep simple: `string[]` (compat with v2.0.0 data). Import: replace vs merge — confirm modal (reuse showConfirmModal). Tests: merge semantics.

### F11 — Options page
`entrypoints/options.html/.ts/.css` (WXT auto-links into manifest). Settings via `utils/settings.ts`: `{defaultCopyFormat: 'hex'|'rgb'|'hsl'|'cmyk'|'oklch'|'hsb', contextMenuEnabled: boolean, pickerMode: 'auto'|'native'|'fallback'}` stored in storage.sync with defaults. Background reads contextMenuEnabled at onInstalled/onStartup (create/remove context menu accordingly). Popup reads settings for F3/F5 copy + F1 picker choice. Tests: defaults, round-trip, partial update.

---

## PARALLELIZATION (subagents — only where file-disjoint)

| Wave | Subagent | Files touched | Parallel-safe? |
|---|---|---|---|
| W1 | S1: color formats + isLargeText | utils/color.ts, tests/color-formats.test.ts | ✅ disjoint |
| W1 | S2: palettes module | utils/palettes.ts, tests/palettes.test.ts | ✅ |
| W1 | S3: settings module | utils/settings.ts, tests/settings.test.ts | ✅ |
| W1 | S4: async sync storage | utils/storage.ts, tests/storage.test.ts | ✅ (no other file reads it in W1) |
| W1 | S5: audit-report builders | utils/audit-report.ts, tests/audit-report.test.ts | ✅ |
| **W1 gate:** compile + lint + test (all green), then W2. | | | |
| W2 | S6: pick-screen content script + background flow | entrypoints/pick-screen.content.ts (+css), entrypoints/background.ts | ✅ (background only; popup NOT touched) |
| W2 | S7: options page | entrypoints/options.* — new files | ✅ |
| W2 | S8: audit threshold fix | entrypoints/audit.content.ts | ✅ |
| **W2 gate:** compile + builds (chrome+firefox) + web-ext lint. | | | |
| W3 | **SERIAL — popup integration** (one agent, sequential commits): F2 sliders/input, F3 display+copy, F5, F7 URL input, F8 export button, F6 palettes UI, F9 async init, F10 import/export, F1 fallback wiring | entrypoints/popup/index.html, main.ts, style.css | ❌ parallel-unsafe (one file region, merge-conflict hell) — must be one agent or me, step-by-step with verify after each step |
| **W3 gate:** full gates + e2e popup run + screenshots. | | | |
| W4 | Cross-modal review (different model) of the whole branch diff | read-only | ✅ |
| Final | Full L0-L5 + zips + version 2.1.0 | — | — |

**Why W3 is serial:** five features touch `popup/main.ts` (1,200+ lines) simultaneously — parallel agents there guarantee merge conflicts and silent regressions. The utils layers (W1) and entrypoints (W2) are cleanly separable, which is where parallelism pays.

**Verification protocol (every wave):** `pnpm compile && pnpm lint && pnpm test && pnpm build && pnpm build:firefox` + web-ext lint on W2; e2e-popup.mjs + screenshots after W3; every subagent self-reports are re-verified by me (no trust).

---

## OPEN QUESTIONS
1. OKLCH everywhere or just copy-format display? (plan: copy-format only — zero risk to existing UI)
2. Palettes cap 50 OK? (plan: yes, with oldest-evicted warning)
3. Sync migration: overwrite sync with local, or merge? (plan: local wins once — local is the power-user's data)
4. Version bump 2.0.0 → 2.1.0 at the end? (plan: yes)
