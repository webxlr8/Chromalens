# Release Plan

Every ChromaLens release follows this document. Versioning is SemVer with a store-compatible split.

## Versioning scheme

| Artifact | Value | Why |
|---|---|---|
| `package.json` version | `2.0.0-beta.1` (semver prerelease) | Drives zip names + GitHub tags |
| Store manifests (`version`) | Numeric only: `2.0.0` | CWS / Edge / AMO reject prerelease strings |
| Store display (`version_name`) | `2.0.0 Beta` (Chromium stores only) | User-facing label |
| GitHub release tag | `v2.0.0-beta.1` → `v2.0.0` | Semver-complete history |

Lifecycle: `2.0.0-beta.N` → `2.0.0-rc.N` → `2.0.0` → `2.0.1` patches → `2.1.0` features. Each beta/rc release is a GitHub **prerelease**.

## Release checklist

1. **Gate sweep** — `pnpm compile`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm build:firefox`, web-ext lint (0 errors)
2. **E2E** — `node scripts/e2e-popup.mjs` exits 0, zero console errors
3. **Manual QA** (every browser target):
   - Chrome/Edge: native EyeDropper pick, hex input, site/screen/image capture, Save Palette, audit scan, favorites, theme
   - Firefox: fallback picker (loupe) pick, image right-click extract, audit, context menu
4. **Bump version** — `package.json` (beta.N → rc → stable); update `CHANGELOG.md`; about-modal label if it carries a version
5. **Zips** — `pnpm zip` + `pnpm zip:firefox`; verify manifest `version` inside each zip is numeric
6. **Sources rebuild test** — extract `*-sources.zip`, `pnpm i && pnpm zip:firefox`, builds must pass (AMO requirement)
7. **Merge** — feature branch → PR → squash merge to `main`; CI must be green
8. **Release** — `gh release create vX.Y.Z[-pre]` (prerelease flag for beta/rc) with `-chrome.zip`, `-firefox.zip`, `-sources.zip`
9. **Store submissions** (same day as release):
   - Chrome Web Store: upload zip → draft → staged rollout **10% → 50% → 100%**
   - Edge Add-ons: upload same chrome zip → publish
   - AMO (Firefox): upload `-firefox.zip` + `-sources.zip` → listed
10. **Close out** — mark GitHub release non-prerelease at stable; update README badge/version if shown

## Rollback

- Store: revert listing to previous version (CWS dashboard / AMO) — manifests are numeric so store downgrades are allowed
- Code: `git revert` the release commit on `main`; previous zips remain on the previous GitHub release tag

## Store notes

- CWS + AMO require a privacy-policy URL even though ChromaLens collects no data (state "no data collection" in the form and point the policy link at a one-pager)
- AMO requires the sources zip and a rebuild-from-sources check (step 6) — it is not optional
- Keep `version_name` in sync with the phase (Beta/RC/stable) but never put it in the numeric `version`
