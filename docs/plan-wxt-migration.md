# ChromaLens → WXT Migration — Plan v1

**Date:** 2026-08-01
**Status:** DRAFT
**Branch:** `wxt-migration`
**Research sources:**
- WXT docs (wxt.dev): migrate guide, project structure, entrypoints, manifest config, extension APIs, scripting, content scripts, storage, unit testing, publishing, targets, compare page
- MDN Chrome incompatibilities + Firefox MV3 event-page status (bugzilla meta 1573659)
- Framework comparison data: ExtensionBooster 2026 (build times/bundle sizes), PlugThis 2026, redreamality 2025, WXT compare page
- Full source read of the current extension (every file, 2,500+ lines)

---

## RESEARCH FINDINGS

### Framework landscape (2026)
| Option | Verdict | Why |
|---|---|---|
| **WXT** | ✅ CHOICE | Actively maintained (216 contributors, regular 2026 releases), framework-agnostic, auto per-browser manifests, small bundles (387KB React test vs Plasmo 812KB; vanilla output ~60-90KB), fastest builds (1.2s), HMR, first-class TS, Firefox sources ZIP, `wxt submit` automation for Chrome/Firefox/Edge |
| Plasmo | ❌ | React-first, heavier bundles, maintenance yellow flag |
| CRXJS | ❌ | Maintainer stepped back, Firefox beta/yellow, ESM content scripts WIP |
| Extension.js | ❌ | Webpack-based, smaller ecosystem, no advantage for this codebase |
| Vanilla + dual manifest (current main) | ⚠️ fallback | Zero deps, works, but hand-rolled manifests, no HMR/TS, Safari requires manual work; fine as the non-migration path |

### WXT facts that shape the architecture (verified from docs)
1. `browser` global (`wxt/browser`, auto-imported) — promise-style API that works on Chromium, Firefox, AND Safari. Replaces both `chrome.*` callbacks and our manual callback rewrites.
2. Entrypoints live in `entrypoints/`; background = `defineBackground`, on-demand scripts = `defineContentScript({ registration: 'runtime' })`, injected via `browser.scripting.executeScript({ files: ['content-scripts/<name>.js'] })`. **No `web_accessible_resources` needed** for this pattern.
3. Manifest is generated from `wxt.config.ts` + entrypoints. No `manifest.json` in source. Icons auto-discovered from `public/` or set explicitly via `manifest.icons`.
4. Firefox MV3 in WXT: default target is MV2 for Firefox/Safari — we explicitly force MV3 for all targets (`manifestVersion: 3`) to match current codebase and AMO's MV3 direction.
5. Entrypoint rule: `browser.*` calls MUST live inside `main()` — no top-level API usage (Node import during build).
6. Storage: docs explicitly recommend keeping an existing storage wrapper during migration. Our localStorage usage is fine — wrap it typed, don't rewrite.
7. Unit testing: `WxtVitest` plugin + `@webext-core/fake-browser` — our 46 assertions port directly to vitest.

### Codebase facts found during full read (matters for the plan)
| Finding | Location | Action |
|---|---|---|
| **Bug: duplicate `pendingCapture` handlers** — two `chrome.storage.local.get(['pendingCapture'])` blocks run on popup open (lines 224 + 454); both process the same capture → double-processing race | popup.js | Fix during migration: single handler, remove badge+storage exactly once |
| **Duplicated logic** — audit.js re-implements kMeans, luminance, contrast, rgbToHex instead of importing utils.js | audit.js | Import from shared `utils/` (WXT bundles it — impossible to share before) |
| **Dead code** — `storage.js` wrapper never imported anywhere (popup uses localStorage directly) | storage.js | Delete; replace with typed `utils/storage.ts` |
| **Empty CSS stubs** — audit.css, palette.css are 31-byte stubs | root | Delete; fold nothing (popup.css covers all) |
| **Vestigial WAR entry** — `web_accessible_resources` for select-area, unnecessary with scripting API | manifest.json | Dropped (WXT never emits it for this pattern) |
| **Dev-only scripts** — generate_icons.js, test_node.js, test_utils.mjs | root | generate_icons → `scripts/` (kept), tests → vitest |
| **Duplicate area-selection code** — select-area.js overlays + popup.js crop modal both draw selection rectangles (page vs popup context — different, but crop-modal logic is dead for the screen flow since popup closes; verify during migration) | — | Verify, keep behavior identical |

---

## 1. GOALS / NON-GOALS

**Goals**
- WXT as the build foundation: one config, per-browser outputs (chrome/firefox/edge/safari-ready)
- TypeScript everywhere (first-class WXT support)
- Zero behavior change to the 5 views: Picker, Harmony, Capture (site/screen/image), Audit, Saved
- Fix the known bugs above while migrating
- All 46 existing assertions ported to vitest, green
- Publishing automation ready: `wxt zip` + `wxt submit` (Chrome/Edge/Firefox)

**Non-goals (YAGNI — explicitly rejected)**
- No UI framework (React/Vue/Svelte) — popup is 5 views of DOM code; a framework is a rewrite with zero user-visible gain
- No @wxt-dev/storage / sync storage — localStorage persists fine in extension popups across all targets; sync adds quota rules for no user need
- No typed messaging module (`wxt/utils/messaging`) — a shared `MessageMap` type gives the same safety with no magic
- No Safari packaging in this phase — needs Apple dev account + Xcode; WXT keeps the door open (`wxt build -b safari` + `xcrun safari-web-extension-packager`)

---

## 2. ARCHITECTURE DECISIONS (each: decision → why → alternatives rejected)

### D1. WXT over everything else
**Why:** only actively-maintained framework; smallest bundles; auto per-browser manifests including Firefox event-page handling; HMR; TS first-class; store submission automation; Safari path exists.
**Rejected:** Plasmo (React lock-in, heavier), CRXJS (unmaintained), Extension.js (Webpack, smaller ecosystem), vanilla dual-manifest (kept on `main` as fallback — zero-dependency path if WXT ever fails us; migration doesn't delete it, branch supersedes it).

### D2. TypeScript (strict) over JS
**Why:** WXT generates `.wxt/types` (typed entrypoints, imports, manifest env vars); `Browser` namespace types the whole extension API; catches the class of bugs we found (dead storage.js, duplicate handlers) at compile time; migration cost is low because the code is already clean ESM with clear signatures.
**Rejected:** keep `.js` — saves ~1 hour now, costs type safety for every future feature; user explicitly wants the best long-term option.

### D3. `registration: 'runtime'` content scripts for audit + select-area (on-demand injection)
**Why:** identical behavior to today (no injection until user acts), no `host_permissions` needed, works in Firefox and Chrome (`browser.scripting.executeScript`), WXT bundles them and shares the module graph (audit.ts can import utils.ts — kills the duplication).
**Rejected:** always-declared content scripts with `matches: http/https` — injects into every page at load, larger permission surface, changes runtime behavior. Rejected.

### D4. Shared `utils/` module for all pure logic
**Why:** one implementation of k-means/contrast/lab/VP-tree used by popup AND audit content script; testable in vitest without browser mocks.
**Rejected:** keeping audit.js self-contained (current state) — maintains the duplication.

### D5. `manifestVersion: 3` forced for all targets
**Why:** matches current MV3 codebase; AMO accepts MV3 event pages; single manifest version to reason about.
**Rejected:** WXT default (MV2 for Firefox/Safari) — diverges from existing code and adds a second manifest version to support.

### D6. pnpm as package manager
**Why:** WXT docs' default, disk-efficient (node_modules dedupe), pnpm 10.33 already installed.
**Rejected:** npm (works, slower, no real advantage), bun (1.3.14 available, fine but less battle-tested with WXT — documented as supported).

### D7. Typed localStorage wrapper (`utils/storage.ts`) instead of raw calls
**Why:** WXT storage docs explicitly bless keeping an existing wrapper during migration; typed wrapper centralizes keys (`chromaLens_*` preserved → user data survives the migration), removes 6 scattered `localStorage.setItem` calls.
**Rejected:** @wxt-dev/storage — behavior change (storage.sync quotas), new dependency, zero user benefit.

### D8. Light popup split (3 files) instead of 1×1197-line file
**Why:** `entrypoints/popup/index.ts` (wiring + views), `utils/image.ts` (extractColorsFromImage, cropImageToBounds — unit-testable), `components/icons.ts` (SVG string factories). Splits the largest file without over-engineering; image pipeline becomes testable.
**Rejected:** full component framework, or no split at all (1197-line file grows worse with new features).

---

## 3. TARGET STRUCTURE (file-by-file mapping)

```
Color-Picker/ (repo root)
├── package.json                  # name: chromalens, version: 2.0.0, type: module
├── wxt.config.ts                 # manifest config, manifestVersion: 3, zip config
├── tsconfig.json                 # extends .wxt/tsconfig.json
├── vitest.config.ts              # WxtVitest plugin
├── .gitignore                    # + .output/, .wxt/
├── README.md                     # dev/build/publish commands (Firefox sources-zip requirement)
├── public/
│   └── icons/                    # icon16.png, icon48.png, icon128.png (from icons/, drop .bmp)
├── entrypoints/
│   ├── background.ts             # ← background.js (listeners inside defineBackground main())
│   ├── popup/
│   │   ├── index.html            # ← popup.html (script src → ./index.ts)
│   │   ├── index.ts              # ← popup.js (wiring + views)
│   │   └── style.css             # ← popup.css
│   ├── audit.content.ts          # ← audit.js (registration: 'runtime', imports utils/)
│   └── select-area.content.ts    # ← select-area.js (registration: 'runtime')
├── utils/
│   ├── color.ts                  # ← utils.js (hex/rgb/hsl/lab/deltaE/contrast/harmonies/kMeans/VP-tree)
│   ├── color-data.ts             # ← color_data.js (typed COLOR_NAMES)
│   ├── image.ts                  # ← from popup.js: extractColorsFromImage, cropImageToBounds
│   ├── storage.ts                # ← NEW typed wrapper (localStorage, chromaLens_* keys preserved)
│   └── types.ts                  # ← NEW: HexColor, PaletteItem, Violation, MessageMap
├── components/
│   └── icons.ts                  # ← SVG string factories from popup.js
├── tests/
│   ├── color.test.ts             # ← test_utils.mjs + test_node.js (46 assertions ported)
│   ├── image.test.ts             # NEW: crop/extract pipeline (jsdom-free, canvas mocked)
│   └── storage.test.ts           # NEW: wrapper round-trip
└── scripts/
    └── generate-icons.mjs        # ← generate_icons.js (dev-only, not in build)
```

**Deleted:** storage.js (dead), audit.css + palette.css (empty stubs), manifest.json + manifest.firefox.json + build.sh (superseded by wxt.config.ts), dist/ (already gitignored), test_node.js/test_utils.mjs (ported), icons/*.bmp.

## 4. MANIFEST MAPPING (parity check — permissions must be identical)

| Current manifest | wxt.config.ts |
|---|---|
| manifest_version 3 | `manifestVersion: 3` (forced, all targets) |
| permissions: activeTab, scripting, storage, contextMenus, tabs | `manifest.permissions` — same 5, unchanged |
| background.service_worker / .scripts | generated by entrypoints/background.ts (worker for Chromium, event page for Firefox) |
| web_accessible_resources (select-area) | **dropped** — scripting.executeScript needs no WAR |
| action.default_popup | generated by entrypoints/popup/ |
| action.default_icon + icons | `manifest.icons` explicit: `/icons/icon16.png` etc. |
| commands._execute_action (Ctrl+Shift+Y / Cmd+Shift+Y) | `manifest.commands` — identical |
| browser_specific_settings.gecko.id (Firefox) | `manifest.browser_specific_settings.gecko` — only when browser is firefox (conditional config) |

## 5. API MIGRATION MAP (chrome.* → browser.*)

| Current call | WXT form |
|---|---|
| `chrome.runtime.onInstalled.addListener` | inside `defineBackground(main)` → `browser.runtime.onInstalled.addListener` |
| `chrome.contextMenus.create/onClicked` | same, `browser.contextMenus.*` |
| `chrome.runtime.onMessage` (background) | same, `browser.runtime.onMessage` |
| `chrome.scripting.insertCSS/executeScript(...).then` | `await browser.scripting.insertCSS/executeScript` (promise, works both browsers — undoes the callback rewrite from main) |
| `chrome.tabs.captureVisibleTab` | `browser.tabs.captureVisibleTab` |
| `chrome.storage.local.get/set/remove` (pendingCapture, pendingImageExtract) | `browser.storage.local.*` (promise style) |
| `chrome.action.setBadgeText/BackgroundColor` | `browser.action.*` |
| `chrome.tabs.query/sendMessage` (popup) | `browser.tabs.query/sendMessage` (promise — undoes callback rewrite) |
| `chrome.runtime.sendMessage` (content scripts) | `browser.runtime.sendMessage` |
| `localStorage` (favorites/recent/theme) | unchanged, behind `utils/storage.ts` |

## 6. BUG FIXES DURING MIGRATION (verified bugs, not refactors)

1. **Duplicate pendingCapture processing** (popup.js:224 + :454) → single handler; consume storage + clear badge exactly once.
2. **audit.js logic duplication** → import `utils/color.ts` (kMeans etc. — one implementation).
3. **Dead storage.js** → delete, replace with typed wrapper.
4. **Empty CSS stubs** → delete.
5. **EyeDropper fallback** stays (Chromium-only API; Firefox shows "Not Supported" — already handled).

## 7. TESTING STRATEGY

- vitest + `WxtVitest` plugin (auto-imports, `@/*` alias, fake-browser for any `browser.*` tests)
- Port all 46 assertions: color conversions, harmonies, k-means, Lab roundtrip, deltaE, color names
- New: `utils/image.ts` crop/extract tests; `utils/storage.ts` round-trip tests
- Verification gate per phase: `pnpm test` green + `wxt build` for chrome AND firefox + manifest parity diff

## 8. BUILD / PUBLISH MATRIX

| Command | Output |
|---|---|
| `pnpm dev` / `pnpm dev:firefox` | HMR dev server + auto-loaded extension |
| `pnpm build` | `.output/chrome-mv3/` |
| `pnpm build:firefox` | `.output/firefox-mv3/` (event-page background) |
| `pnpm zip` / `pnpm zip:firefox` | store ZIPs + Firefox sources ZIP (AMO requirement) |
| `pnpm submit` (after `wxt submit init` + `.env.submit`) | Chrome Web Store + Edge + AMO automated |
| `pnpm build:safari` (stretch) | `.output/safari-mv3/` → `xcrun safari-web-extension-packager` |

## 9. IMPLEMENTATION PHASES (each ends with a verification gate)

**Phase 0 — Scaffold (0.5h)**
`pnpm dlx wxt@latest init . --template vanilla` into the repo root; verify `wxt prepare` generates `.wxt/`; commit scaffold.

**Phase 1 — Config + entrypoint shells (1h)**
wxt.config.ts (manifest config, MV3 forced, icons, commands, gecko id conditional); entrypoints/background.ts + popup/index.html + index.ts + style.css stubs; utils/ + components/ + tests/ dirs. Gate: `wxt build -b chrome` + `-b firefox` produce manifests with identical permissions to current; diff against current manifest.json.

**Phase 2 — Logic migration (2-3h)**
Port utils.js → utils/color.ts + color-data.ts (typed); port tests to vitest; green. Port background.js → defineBackground; port select-area.js + audit.js → registration:'runtime' content scripts importing utils; port popup.js → index.ts split (wiring, image.ts, icons.ts, storage.ts). Gate: `pnpm test` green; both builds succeed; `web-ext lint --source-dir .output/firefox-mv3` passes.

**Phase 3 — Bug fixes + behavior verification (1-2h)**
Fix duplicate pendingCapture handler; delete dead code (storage.js, empty css, bmp icons); verify all 5 views + 3 capture modes manually in Chrome and Firefox (load unpacked / temporary add-on), screenshot each view. Gate: screenshot proof for every view, both browsers.

**Phase 4 — Publish readiness (1h)**
README (dev/build/submit commands — required by AMO source review); `wxt zip` + `wxt zip:firefox`; verify sources ZIP rebuilds (`pnpm i && pnpm zip:firefox` inside extracted zip); `wxt submit init` dry-run (optional until store accounts exist). Gate: zips build; sources zip rebuilds identically.

**Phase 5 — Merge path (0.5h)**
Bump version 1.1.0 → 2.0.0; PR `wxt-migration` → `main`; keep `main`'s vanilla commits as history (fallback path documented in README).

## 10. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Vite HTML processing breaks popup.html (595 lines, inline SVGs) | It's plain HTML+CSS; WXT/Vite handle it; Phase 1 shells the file before Phase 2 moves logic |
| `browser.*` promise style changes timing vs callbacks | Only 2 sites used promises before; all others were callbacks — semantics identical, verified in Phase 3 manual pass |
| localStorage keys must survive migration | `chromaLens_*` keys preserved verbatim in utils/storage.ts; test asserts key names |
| Firefox MV3 event-page differences (context menu persistence) | WXT generates the event page; contextMenus already event-page-safe (top-level listener registration inside main()) |
| WXT version drift during long migration | Pin wxt + vitest versions in package.json; upgrade separately |
| AMO sources-zip rebuild mismatch | Phase 4 gate: rebuild from extracted zip, compare output |

## 11. OPEN QUESTIONS (need user decision before Phase 2)

1. **Version bump to 2.0.0?** (recommended: yes — major architecture change; Chrome/AMO listings show it as a new release)
2. **Repo rename** `azharudh33n/Color-Picker` → `chromalens`? (cosmetic; gh repo rename + local remote update — 2 minutes, recommend yes if this is the product name)
3. **Safari**: plan the packaging phase now (needs Apple Developer account) or leave as documented stretch?
4. **Credits**: about modal lists Muhammed Azharudheen K J + Emmanul S Ayakara — keep as-is (assuming yes, no change planned)
