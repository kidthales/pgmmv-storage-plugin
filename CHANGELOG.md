# Changelog

All notable changes to `@kidthales/pgmmv-storage-plugin` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-21

Modernizes `@kidthales/pgmmv-storage-plugin` for PGMMV's SpiderMonkey 33 (ES5.1) runtime with strict `@kidthales/pgmmv-types` JSDoc checking, hardened ID/accessor/coercion guards, a canonical `scripts/build.mjs` release bundler, a `node:test` verification suite, CI/publish workflow parity, and self-contained documentation.

### Added

- **Canonical release bundler (`scripts/build.mjs`, `npm run build`) (`#73`, `#77`)**: Added `buildPlugin`, `stripComments`, `assertSafeOutputPath`, and `resolveRealPath` to emit Prettier-formatted `dist/pgmmv-storage-plugin-v<version>.js` bundles while preserving `/**!` / `/*!` license banners, enforcing `fs.realpathSync` self-overwrite and `dist/` containment guards, preserving ES5.1 §7.3 `LineTerminator` boundaries, and rescanning template literal braces.
- **Automated `node:test` suite (`tests/plugin.test.mjs`, `npm test`) (`#77`)**: Added 24 tests covering `plugin.js` save/load Action Commands, `window.kt.storage`, fractional/out-of-range/null-accessor guards, JSON coercion edge cases, I/O error deactivation, UTF-8 byte-length write polling, `scripts/build.mjs` symlink/containment/scanner edge cases, ESLint ES5 enforcement, and `tsc --noEmit` verification.
- **Self-contained documentation (`README.md`, `CHANGELOG.md`) (`#77`)**: Removed the nonexistent `kidthales.com/pgmmv/storage-plugin/` link and documented standardized badges, GitHub Releases `.js` installation, `Agtk.settings.projectPath` persistent storage behavior, Project Common vs. Object Instance semantics, all 4 Action Commands, the `window.kt.storage` script API, npm scripts, and this Keep-a-Changelog history.

### Changed

- **Strict `@kidthales/pgmmv-types` JSDoc typing (`tsconfig.json`, `env.d.ts`, `plugin.js`) (`#73`, `#77`)**: Switched to `@kidthales/pgmmv-types@^0.2.1`, declared `Window.kt` in `env.d.ts`, enabled `allowJs`/`checkJs`/`strict`/`noEmit`, and standardized `plugin.js` JSDoc types with a preserved `/**!` `@version 0.2.0` header banner.
- **CI, publish, ignore & Dependabot parity (`package.json`, `eslint.config.js`, `.prettierignore`, `.gitignore`, `.github/workflows/{ci,publish}.yml`, `.github/dependabot.yml`) (`#73`, `#77`)**: Updated devDependencies (`eslint`, `@eslint/js`, `prettier`, `typescript`, `concurrently`), ignored `.ci-local` and `**/.tmp-*/**`, hardened `ci.yml` (`timeout-minutes: 10`, `concurrency`, `npm test`, `npm run build`), hardened `publish.yml` (`cancel-in-progress: false`, tag/`package.json`/`@version` parity, `npm run lint && npm test`, `SHA256SUMS.txt`), and switched Dependabot to quarterly non-major updates.

### Fixed

- **Integer ID, null-accessor, and runtime coercion guards (`plugin.js`) (`#73`, `#76`, `#77`)**: Enforced finite integer validation (`id % 1 === 0`) in `isValidId`, added strict runtime JSON coercion (`Number(...)` / `Boolean(...)`) for loaded variables and switches, and guarded null/undefined `Agtk.variables.get(...)`, `Agtk.switches.get(...)`, and object-instance accessor lookups with `logWarning` fallbacks.

## [0.1.4] - 2026-04-01

- Fix punctuation (`#18`).

## [0.1.3] - 2026-04-01

- Documentation updates (`#17`).

## [0.1.2] - 2026-03-03

- Expose storage API on `window.kt.storage` (`#7`).

## [0.1.1] - 2026-03-03

- Fix `Load Switch` Action Command description (`#6`).

## [0.1.0] - 2026-03-03

Initial release of `@kidthales/pgmmv-storage-plugin` with `Save Variable`, `Load Variable`, `Save Switch`, and `Load Switch` Action Commands backed by `kt_store.json` I/O.
