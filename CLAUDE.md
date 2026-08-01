# ChromaLens (WXT)

Color Picker & Accessibility Toolkit Chrome/Firefox extension. Migrating from vanilla MV3 to WXT on branch `wxt-migration`.

## Architecture

- **entrypoints/** — WXT entrypoints: `background.ts`, `popup/` (index.html + main.ts + style.css), `audit.content.ts` + `select-area.content.ts` (both `registration: 'runtime'`, injected on demand via `browser.scripting.executeScript`)
- **utils/** — pure logic, no browser APIs: `color.ts` (hex/rgb/hsl/Lab/CIEDE2000/contrast/harmonies/k-means/VP-tree color names), `color-data.ts` (COLOR_NAMES), `image.ts` (image color extraction + crop), `storage.ts` (typed localStorage wrapper, keys MUST stay `chromaLens_favorites` / `chromaLens_recent` / `chromaLens_theme`), `types.ts` (shared types + MessageMap)
- **components/icons.ts** — SVG string factories
- **public/icons/** — icon16/48/128.png (PNG only; no .bmp)
- **tests/** — vitest

## Key commands

- `pnpm dev` / `pnpm dev:firefox` — dev with HMR
- `pnpm build` / `pnpm build:firefox` — output `.output/chrome-mv3/` / `.output/firefox-mv3/`
- `pnpm test` — vitest
- `pnpm compile` — tsc --noEmit
- `pnpm lint` — eslint
- `pnpm zip` / `pnpm zip:firefox` — store zips (+ Firefox sources zip)

## Hard constraints

- MV3 only (`manifestVersion: 3` in wxt.config.ts). Never change it.
- NO UI framework, NO new runtime dependencies. Vanilla TS only.
- Use `browser.*` (promise style) from WXT auto-imports, never `chrome.*`.
- `browser.*` calls only inside entrypoint `main()` functions, never at module top level.
- Preserve the `chromaLens_*` localStorage keys exactly — user data must survive.
- Keep permissions identical: activeTab, scripting, storage, contextMenus, tabs. No new permissions, no host_permissions.
- Never touch `main` branch. Commit on `wxt-migration` with descriptive messages.
- Don't delete or rewrite the old root-level files (popup.js, audit.js, etc.) — CL7 handles cleanup after verification.
