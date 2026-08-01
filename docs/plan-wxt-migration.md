# ChromaLens → WXT Migration — Plan v2 (EXECUTION)

**Date:** 2026-08-01
**Status:** DRAFT (v1 architecture approved-in-principle; v2 adds Google-style execution)
**Branch:** `wxt-migration`
**Changelog v2:** execution methodology (Google engineering process), Claude Code delegation model, CL breakdown with acceptance criteria, review gates + CI, verification pyramid (unit → static → build → AMO lint → browser UI/E2E), staged rollout + rollback, updated risks.

**Research sources:** (unchanged from v1) WXT docs, MDN, framework comparisons, full source read. Plus: claude-code skill (v2.2.0), cross-modal-review skill, superpowers-verification-before-completion skill. Claude Code 2.1.177 installed + authed via 9Router (ANTHROPIC_BASE_URL=http://127.0.0.1:20128/v1). gh 2.89 available.

---

## RESEARCH FINDINGS (from v1 — kept verbatim)

### Framework landscape (2026)
| Option | Verdict | Why |
|---|---|---|
| **WXT** | ✅ CHOICE | Actively maintained (216 contributors), framework-agnostic, auto per-browser manifests, smallest bundles, fastest builds, HMR, first-class TS, Firefox sources ZIP, `wxt submit` automation |
| Plasmo / CRXJS / Extension.js | ❌ | React-heavy or unmaintained or no advantage |
| Vanilla + dual manifest (current main) | ⚠️ fallback | Kept on `main` as zero-dep fallback path |

### WXT facts that shape architecture (verified from docs)
1. `browser` global (`wxt/browser`, auto-imported) — promise-style API on Chromium, Firefox, Safari.
2. On-demand scripts = `defineContentScript({ registration: 'runtime' })` injected via `browser.scripting.executeScript({ files: ['content-scripts/<name>.js'] })`. No WAR needed.
3. Manifest generated from `wxt.config.ts` + entrypoints. Icons explicit via `manifest.icons`.
4. Force `manifestVersion: 3` for all targets (WXT defaults Firefox/Safari to MV2).
5. `browser.*` calls MUST live inside `main()` of entrypoints (Node import during build).
6. Storage: keep existing wrapper during migration (WXT docs explicitly).
7. Unit testing: `WxtVitest` plugin + `@webext-core/fake-browser`.

### Codebase facts (from full read)
| Finding | Action |
|---|---|
| **Bug: duplicate `pendingCapture` handlers** (popup.js:224 + :454) — double-processing race | Fix in CL6 |
| **Duplicated logic** — audit.js re-implements k-means/contrast/luminance | Import shared `utils/color.ts` (CL5) |
| **Dead code** — storage.js never imported | Delete (CL7) |
| **Empty CSS stubs** — audit.css, palette.css (31 bytes) | Delete (CL7) |
| **Vestigial WAR entry** in manifest | Dropped automatically by WXT pattern |
| Dev-only: generate_icons.js, test_node.js, test_utils.mjs | scripts/ + vitest port (CL2, CL7) |

---

## 1. GOALS / NON-GOALS (from v1)

**Goals:** WXT foundation, TS everywhere, zero behavior change to 5 views (Picker, Harmony, Capture site/screen/image, Audit, Saved), fix known bugs, 46 assertions ported green, publish automation ready.
**Non-goals:** no UI framework, no sync storage, no typed-messaging lib, no Safari packaging this phase (documented path exists).

## 2. ARCHITECTURE DECISIONS (from v1 — D1..D8, unchanged)
D1 WXT · D2 strict TS · D3 `registration:'runtime'` content scripts · D4 shared `utils/` · D5 MV3 forced all targets · D6 pnpm · D7 typed localStorage wrapper (keys `chromaLens_*` preserved) · D8 light popup split (index.ts + utils/image.ts + components/icons.ts).

## 3. TARGET STRUCTURE (from v1 — file-by-file mapping, unchanged)
`entrypoints/` (background.ts, popup/{index.html,index.ts,style.css}, audit.content.ts, select-area.content.ts) · `utils/` (color.ts, color-data.ts, image.ts, storage.ts, types.ts) · `components/icons.ts` · `tests/` · `public/icons/` · `scripts/generate-icons.mjs` · `wxt.config.ts` · `vitest.config.ts` · `tsconfig.json` · deleted: storage.js, audit.css, palette.css, manifest.json, manifest.firefox.json, build.sh, dist/, *.bmp, old test files.

## 4. MANIFEST MAPPING (from v1 — permissions parity: activeTab, scripting, storage, contextMenus, tabs — unchanged; WAR dropped; gecko id conditional for firefox target)

## 5. API MIGRATION MAP (from v1 — chrome.* → browser.* promise style; undoes v1 callback rewrites)

## 6. BUG FIXES (from v1 — duplicate pendingCapture, audit.js duplication, dead storage.js, empty css; EyeDropper fallback kept)

## 7. TESTING STRATEGY (v1 base + v2 pyramid — see §9 L0-L5)

## 8. BUILD / PUBLISH MATRIX (from v1 — dev/build/zip/submit per browser; safari via xcrun packager)

---

## 9. EXECUTION METHODOLOGY — GOOGLE-STYLE

### 9.1 Engineering principles (how Google runs this kind of change)
1. **Design doc before code** — this plan is the design doc; reviewed by user before any implementation.
2. **Small, reviewable CLs** — one logical change per commit; each reviewable in one sitting; no mega-diffs.
3. **Tests before code (TDD)** — new logic lands with tests written first (red → green → refactor).
4. **Independent review** — every CL reviewed by a different AI model (cross-modal review), then by the user (approver). No self-review.
5. **Presubmit gates in CI** — lint, typecheck, unit tests, both browser builds, AMO lint; PR cannot merge with any red gate.
6. **Staged rollout** — 2.0.0 ships via Chrome Web Store staged rollout (10% → 50% → 100%); Firefox AMO review is the canary gate.
7. **Instant rollback** — v1.1.0 zip archived; revert commit on `main` is a one-command path; store-side version rollback available.

### 9.2 Roles
| Role | Who | Responsibility |
|---|---|---|
| Tech lead / orchestrator | Hermes (me) | Plan, CL specs, verification, review triage, merge |
| Implementation engineer | Claude Code CLI | Write code per CL spec, commit to `wxt-migration` |
| Independent reviewer | Different AI model (cross-modal review) | Diff review per substantive CL: bugs, races, missing tests, UI regressions |
| Approver | Azhar | Approves plan, reviews findings, final sign-off, store publishing |

### 9.3 Delegation model (Claude Code)
- **Workspace prep (before CL1):** `CLAUDE.md` at repo root (architecture summary, commands, standards, constraints: never touch `main`, preserve `chromaLens_*` keys, no framework, TS strict) + `.claude/settings.json` (permissions: allow Read/Edit/Write/Bash(pnpm|node|npx|git); deny Read(.env*), force-push, rm -rf).
- **Invocation (print mode per CL):**
  `claude -p "<CL spec from this plan>" --allowedTools "Read,Edit,Write,Bash(git *),Bash(pnpm *),Bash(node *),Bash(npx *),Bash(cp *),Bash(mv *),Bash(rm *),Bash(mkdir *)" --max-turns 25 --max-budget-usd 5 --output-format json` with `workdir=/Users/azharudh33n/Development/Chroma Lens/Color-Picker`
- **Session continuity:** `--continue` for fix iterations on the same CL.
- **Trust rule (Iron Law):** Claude Code's success report is NEVER accepted as evidence. After every CL: check `git diff`, re-run every gate myself, screenshot the UI. Evidence before claims (verification-before-completion skill).
- **Failure handling:** CL hits max-turns or budget → inspect partial `git diff`, fix remaining bits myself with patch/write_file, re-delegate only if large scope remains.

### 9.4 Verification pyramid (every CL passes its level; full stack before merge)
| Level | Gate | Command / Tool | Evidence |
|---|---|---|---|
| L0 | Static | `tsc --noEmit` + eslint (flat config) | 0 errors |
| L1 | Unit | `pnpm test` (vitest: 46 ported + new image/storage tests) | 0 failures, output shown |
| L2 | Build | `pnpm build` + `pnpm build:firefox` | exit 0 |
| L3 | Manifest parity | diff generated manifests vs v1 (permissions identical) | no diff in permissions |
| L4 | AMO lint | `web-ext lint --source-dir .output/firefox-mv3` | 0 errors |
| L5 | Browser UI/E2E | Playwright (chromium + firefox, extension loaded in persistent context): open popup, click all 5 views + 3 capture modes + modals, assert zero console errors, screenshot every view; visual diff vs v1 baseline screenshots | screenshots + console log clean |
| L6 | Manual QA | User checklist: Chrome + Firefox, every feature, 10 min | user sign-off |

### 9.5 Definition of Done (per CL)
- Spec implemented exactly (diff reviewed line-by-line vs CL spec)
- L0-L2 green (L3-L5 for the CLs that touch manifest/UI)
- No console errors in browser session
- Committed on `wxt-migration` with descriptive message; no changes to `main`
- Cross-modal review findings resolved or explicitly deferred with user approval

---

## 10. CHANGE LIST (CLs) — execution order, delegation targets

| CL | Scope | TDD / tests | Acceptance (beyond DoD) |
|---|---|---|---|
| **CL1** | Scaffold: `pnpm dlx wxt@latest init` (vanilla template), wxt.config.ts (manifest config, MV3 forced, icons, commands, gecko conditional), tsconfig.json, vitest.config.ts, eslint, .gitignore, CLAUDE.md, .claude/settings.json | — | `wxt prepare` generates .wxt/; `pnpm build` + `build:firefox` exit 0 with entrypoint stubs |
| **CL2** | `utils/color.ts` + `utils/color-data.ts` — pure port of utils.js/color_data.js to strict TS | Port all 46 assertions to vitest FIRST, run red against JS? (no — port tests + code together, then green; new tests for typed edge cases) | `pnpm test` green ≥46; tsc clean |
| **CL3** | `utils/types.ts`, `utils/storage.ts` (typed localStorage wrapper, `chromaLens_*` keys), `utils/image.ts` (extractColorsFromImage, cropImageToBounds extracted from popup.js), `components/icons.ts` (SVG factories) | New: storage round-trip tests, image crop/extract tests (canvas mocked) | `pnpm test` green incl. new; tsc clean |
| **CL4** | `entrypoints/background.ts` — port background.js (context menu, message router, captureVisibleTab, scripting injection) inside `defineBackground(main)` | Message-router unit tests (fake-browser) | Build green both targets; manifest shows worker (chrome) / scripts (firefox) |
| **CL5** | `entrypoints/audit.content.ts` + `entrypoints/select-area.content.ts` — `registration:'runtime'`, import utils/color.ts (kill duplication), same message protocol | audit scan/extract unit tests (jsdom for DOM parts) | Build green; `content-scripts/audit.js` + `select-area.js` present; injectable via executeScript |
| **CL6** | `entrypoints/popup/` — port popup.html/css/js (index.html + index.ts + style.css), wiring per API migration map; **fix duplicate pendingCapture bug**; keep EyeDropper fallback | Storage wrapper used everywhere (no raw localStorage in popup) | Build green; popup renders; console clean (L5 partial: popup-only screenshots) |
| **CL7** | Cleanup: delete storage.js, audit.css, palette.css, *.bmp, build.sh, manifest*.json, old tests, dist/; README (dev/build/submit — AMO sources-review requirement); scripts/generate-icons.mjs | — | `git diff` shows only intended deletions; full L0-L4 re-run |
| **CL8** | CI: GitHub Actions workflow on PR → main: pnpm install, eslint, tsc, vitest, build chrome+firefox, web-ext lint, upload zips as artifacts | — | Workflow green on a draft PR of the branch |
| **CL9** | Publish: version 2.0.0, `wxt zip` + `zip:firefox`, sources-zip rebuild test (`pnpm i && pnpm zip:firefox` inside extracted zip), `wxt submit init` dry-run | — | Zips build; sources zip rebuilds identically; submit dry-run passes (secrets when store accounts ready) |

Dependencies: CL1 → CL2 → CL3 → CL4/CL5 → CL6 → CL7 → CL8 → CL9. CL4 and CL5 independent once CL3 done. Estimated 8-12h wall time (delegation + verification dominates).

## 11. REVIEW GATES & CI

- **After each CL (me):** `git diff` review vs spec → run L0-L4 gates → record evidence. Any failure → fix loop back to Claude Code (`--continue`) or direct patch.
- **Cross-modal review (skill):** after CL4 (background/API semantics), CL5 (content scripts), CL6 (popup + bug fix), and the full branch before PR: spawn a different model to review the diff against this plan's contract. Findings presented to you — **you decide** (user sovereignty, no auto-apply).
- **PR:** `wxt-migration` → `main` draft PR; CI (CL8) must be green; final human review = you.
- **Merge rule:** only after L0-L5 green + all review findings resolved + your explicit approval.

## 12. ROLLOUT & ROLLBACK (staged, Google-style)
1. Load unpacked builds in Chrome + Firefox (L6 manual QA).
2. Chrome Web Store: draft → publish with staged rollout 10% → 50% → 100% (monitor store ratings/issues between steps, min 24h each).
3. Firefox AMO: submit sources zip; AMO review is the independent canary (expect 1-7 days).
4. Rollback triggers: crash reports, console errors spike, store complaints about 2.0.0. Rollback = store-side version revert to 1.1.0 (zip archived) + revert commit on main. WXT pin in package.json prevents tooling drift.

## 13. RISKS (v1 + delegation additions)

| Risk | Mitigation |
|---|---|
| Claude Code drifts from spec or hits turn limits | CL specs are explicit (mapping tables); inspect partial diffs; fix myself; never trust self-reports |
| Claude Code breaks popup.html (595 lines) during port | CL6 moves logic in small steps; L5 Playwright + screenshots per view; restore from git if broken (never patch-fix agent-broken HTML — revert and redo) |
| Vite HTML processing differences | CL1 shells the HTML before CL6 fills it; early build catches issues |
| `browser.*` promise timing vs callbacks | Semantics identical; L5 UI pass verifies flows (capture, scan, extract) |
| localStorage key drift | CL3 tests assert exact `chromaLens_*` names |
| CI flakiness (Playwright extension mode) | Pin browser versions; Firefox E2E marked best-effort with web-ext + manual fallback |
| WXT version drift | Pin wxt + vitest in package.json |
| AMO sources-zip mismatch | CL9 rebuild-from-zip gate |

## 14. OPEN QUESTIONS (need your decision before CL1)
1. **Version bump 1.1.0 → 2.0.0?** (recommended: yes)
2. **Repo rename** `azharudh33n/Color-Picker` → `chromalens`? (recommended: yes; 2 min, gh repo rename)
3. **Safari**: packaged this cycle (needs Apple dev account) or documented stretch? (recommended: stretch)
4. **Credits** in about modal unchanged? (assuming yes)
