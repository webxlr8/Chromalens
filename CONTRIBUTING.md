# Contributing to ChromaLens

Thanks for helping. ChromaLens is a small, focused extension — the bar for new code is: it must be useful, tested, and free of speculative bloat.

## Setup

```bash
# Node 24 LTS (fnm: `fnm use`), pnpm 10
pnpm i
pnpm compile   # strict TypeScript
pnpm lint      # eslint
pnpm test      # vitest (87+ tests)
pnpm build     # Chrome/Edge build → .output/chrome-mv3
pnpm build:firefox
```

Load for manual testing: `chrome://extensions` → Load unpacked → `.output/chrome-mv3` (Firefox: `about:debugging` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`).

## Before you submit

1. All gates green: `pnpm compile && pnpm lint && pnpm test && pnpm build && pnpm build:firefox`
2. New color-math or data logic ships with unit tests — conformance values preferred over self-asserted ones
3. Popup changes verified with `node scripts/e2e-popup.mjs` (zero console errors)
4. `pnpm web-ext lint --source-dir .output/firefox-mv3 --no-config-discovery` — 0 errors

## Commit style

- One logical change per commit, imperative summary line (e.g. `fix: correct WCAG large-text threshold`)
- No AI co-author trailers, no filler (".", "done", "wip")
- Feature work on a branch → PR; trivial fixes may go straight to `main`

## Scope guardrails

- No new permissions or `host_permissions` without a written justification in the PR
- `browser.*` promise API only (no `chrome.*` callbacks)
- Behavioral parity unless a bug fix is explicitly scoped

## License

MIT — see [LICENSE](LICENSE). The ChromaLens name and logo are not covered by the license.
