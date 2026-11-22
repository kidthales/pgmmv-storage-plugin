# PGMMV Storage Plugin

[![CI](https://github.com/kidthales/pgmmv-storage-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/pgmmv-storage-plugin/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/kidthales/pgmmv-storage-plugin.svg)](https://github.com/kidthales/pgmmv-storage-plugin/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![ES5 / PGMMV 1.0.6+](https://img.shields.io/badge/ES5-PGMMV%201.0.6%2B-brightgreen.svg)](https://rpgmakerofficial.com/product/act/en/manual/01_01.html)

Save/load [Pixel Game Maker MV (PGMMV)](https://rpgmakerofficial.com/product/act/en/manual/01_01.html) switch and variable values to/from a persistent JSON file (`kt_store.json`) outside PGMMV's save-slot system, providing four Action Commands and a `window.kt.storage` runtime script API.

## Installation (PGMMV Editor)

1. Download the latest `pgmmv-storage-plugin-v<version>.js` asset (and optionally verify it against `SHA256SUMS.txt`) from [GitHub Releases](https://github.com/kidthales/pgmmv-storage-plugin/releases).
    - Alternatively, build the stripped release bundle locally from source with `npm run build` (outputs `dist/pgmmv-storage-plugin-v0.2.0.js`).
2. In PGMMV, open **Plugins** -> **Add** and select the downloaded `.js` file.
3. Enable the plugin in your project's plugin list.

> Compatible with **PGMMV 1.0.6+** (SpiderMonkey 33 / ECMAScript 5.1).

## Persistent Storage Behavior

### Storage File (`Agtk.settings.projectPath`)

All saved values are persisted as a flat JSON object in `kt_store.json` inside the directory specified by `Agtk.settings.projectPath` (`<Agtk.settings.projectPath>/kt_store.json`) via Cocos2d-JS `jsb.fileUtils`. Because this file is independent of PGMMV's save-slot system, it is well suited for high scores, achievements, statistics, unlock flags, and other cross-slot global data.

- **Startup load & blocking**: Outside the PGMMV editor, `initialize()` sets up the storage I/O state machine and reads `kt_store.json` (if present) on the first `update()` tick. While initial loading is still pending, `Load Variable` and `Load Switch` return `CommandBehaviorBlock` (`2`) so PGMMV waits before advancing; once loaded, they apply stored values and return `CommandBehaviorNext` (`0`).
- **Asynchronous save**: `Save Variable` and `Save Switch` update the in-memory store immediately and queue a write to `kt_store.json`, which is flushed and verified across `update()` ticks via UTF-8 byte-length and file-content polling.
- **Error deactivation**: If reading, parsing, encoding, or writing `kt_store.json` fails (or if the parsed JSON is not a plain object), the plugin logs `[ERROR][PGMMV Storage Plugin] ...`, deactivates further I/O, and logs a warning while skipping subsequent Action Commands.

### Project Common vs. Object Instance Semantics

- **Project Common (`ProjectCommon`)**: Saves and loads project-wide variables (`Agtk.variables.get(id)`) and switches (`Agtk.switches.get(id)`), keyed as `0,0,<variableId>` and `0,1,<switchId>`.
- **Object Instance (`SelfObject`, `ParentObject`)**: Resolves the target instance (`SelfObject` or `ParentObject` via `ParentObjectInstanceIDId`) and keys the stored value by the **object template ID** (`source.objectId`), not the runtime `instanceId`. When loaded, `execCommandSwitchVariableChange` applies the value with `QualifierWhole`, so values saved by one object instance can be loaded by other object instances of the same object kind.
- **Validation & coercion**: IDs must be finite integers `>= 1`. Variable loads accept finite numbers or non-empty numeric strings (coerced with `Number(...)`), and switch loads accept booleans or finite numbers (coerced with `Boolean(...)`). Unset sources, invalid IDs, invalid stored values, or missing accessors log `[WARNING][PGMMV Storage Plugin] ...` and skip cleanly.

## Action Commands

All four Action Commands appear under the object **Action Command** menu in PGMMV:

### `Save Variable [PGMMV Storage Plugin]`

Saves the specified variable's current value to `kt_store.json` (queued on the next I/O tick).

| Parameter         | Type                     | Default      | Description                                                                                               |
| :---------------- | :----------------------- | :----------- | :-------------------------------------------------------------------------------------------------------- |
| `Variable Source` | `SwitchVariableObjectId` | `-1` (Unset) | Source (`ProjectCommon`, `SelfObject`, or `ParentObject`) owning the variable to save.                    |
| `Variable`        | `VariableId`             | `-1` (Unset) | Variable to save (`withNewButton: true`, bound to `Variable Source`). Must resolve to an integer ID >= 1. |

### `Load Variable [PGMMV Storage Plugin]`

Loads a previously saved variable value from `kt_store.json` into the target variable (blocks until initial file load completes).

| Parameter         | Type                     | Default      | Description                                                                            |
| :---------------- | :----------------------- | :----------- | :------------------------------------------------------------------------------------- |
| `Variable Source` | `SwitchVariableObjectId` | `-1` (Unset) | Source (`ProjectCommon`, `SelfObject`, or `ParentObject`) owning the variable to load. |
| `Variable`        | `VariableId`             | `-1` (Unset) | Variable to populate (bound to `Variable Source`). Must resolve to an integer ID >= 1. |

### `Save Switch [PGMMV Storage Plugin]`

Saves the specified switch's current boolean state to `kt_store.json` (queued on the next I/O tick).

| Parameter       | Type                     | Default      | Description                                                                                           |
| :-------------- | :----------------------- | :----------- | :---------------------------------------------------------------------------------------------------- |
| `Switch Source` | `SwitchVariableObjectId` | `-1` (Unset) | Source (`ProjectCommon`, `SelfObject`, or `ParentObject`) owning the switch to save.                  |
| `Switch`        | `SwitchId`               | `-1` (Unset) | Switch to save (`withNewButton: true`, bound to `Switch Source`). Must resolve to an integer ID >= 1. |

### `Load Switch [PGMMV Storage Plugin]`

Loads a previously saved switch state from `kt_store.json` into the target switch (blocks until initial file load completes).

| Parameter       | Type                     | Default      | Description                                                                          |
| :-------------- | :----------------------- | :----------- | :----------------------------------------------------------------------------------- |
| `Switch Source` | `SwitchVariableObjectId` | `-1` (Unset) | Source (`ProjectCommon`, `SelfObject`, or `ParentObject`) owning the switch to load. |
| `Switch`        | `SwitchId`               | `-1` (Unset) | Switch to populate (bound to `Switch Source`). Must resolve to an integer ID >= 1.   |

## Script API (`window.kt.storage`)

Outside the PGMMV editor, `initialize()` registers the storage helper functions on `window.kt.storage`:

- `window.kt.storage.saveVariable(variableObjectId, variableId, instanceId)` -> `CommandBehaviorNext` (`0`)
- `window.kt.storage.loadVariable(variableObjectId, variableId, instanceId)` -> `CommandBehaviorNext` (`0`) | `CommandBehaviorBlock` (`2`)
- `window.kt.storage.saveSwitch(switchObjectId, switchId, instanceId)` -> `CommandBehaviorNext` (`0`)
- `window.kt.storage.loadSwitch(switchObjectId, switchId, instanceId)` -> `CommandBehaviorNext` (`0`) | `CommandBehaviorBlock` (`2`)

Parameters:

- `variableObjectId` / `switchObjectId`: `Agtk.constants.switchVariableObjects.ProjectCommon` (`0`), `SelfObject` (`-2`), `ParentObject` (`-7`), or `Agtk.constants.actionCommands.UnsetObject` (`-1`).
- `variableId` / `switchId`: Positive integer variable or switch ID (`>= 1`).
- `instanceId`: Target object instance ID (used when resolving `SelfObject` or `ParentObject`).

Example (ES5 inside a PGMMV **Execute Script** action):

```js
var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon;
var selfObject = Agtk.constants.switchVariableObjects.SelfObject;

// Save/load Project Common variable ID 1 (e.g., high score)
window.kt.storage.saveVariable(projectCommon, 1, instanceId);
window.kt.storage.loadVariable(projectCommon, 1, instanceId);

// Save/load SelfObject switch ID 2 (shared by object template ID across instances)
window.kt.storage.saveSwitch(selfObject, 2, instanceId);
window.kt.storage.loadSwitch(selfObject, 2, instanceId);
```

> Note: When calling `loadVariable` or `loadSwitch` immediately on scene startup from **Execute Script**, check whether the return value equals `Agtk.constants.actionCommands.commandBehavior.CommandBehaviorBlock` (`2`) if you need to retry until initial file loading completes.

## Development

### Requirements

- Any current [Node.js](https://nodejs.org/en/download) LTS (Long-Term Support) version.
- A [Git](https://git-scm.com/) client.

### Setup

```bash
git clone https://github.com/kidthales/pgmmv-storage-plugin.git
cd pgmmv-storage-plugin
npm install
```

### SpiderMonkey 33 & ES5 Constraints

PGMMV embeds **SpiderMonkey 33**, which executes plugins in an [ECMAScript 5.1](https://262.ecma-international.org/5.1/) script environment. `eslint.config.js` enforces `ecmaVersion: 5` and `sourceType: 'script'` on `plugin.js` with `Agtk`, `cc`, and `jsb` declared as read-only globals, while `tsconfig.json` runs strict JSDoc type-checking against `@kidthales/pgmmv-types` without emitting ES6+ syntax.

### Scripts Reference

| Script             | Command                                                | Purpose                                                                                                                                                                                                                              |
| :----------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`     | `eslint --cache .`, `prettier --check`, `tsc --noEmit` | Verify ES5 compliance (`plugin.js`), ESM syntax (`scripts/**/*.mjs`, `tests/**/*.mjs`), Markdown/JSON/YAML formatting, and strict JSDoc types.                                                                                       |
| `npm run lint-fix` | `eslint --cache --fix .`, `prettier --write`           | Auto-fix ESLint and Prettier formatting issues across source and documentation files.                                                                                                                                                |
| `npm test`         | `node --test`                                          | Run `tests/plugin.test.mjs` covering `plugin.js` hooks, Action Commands, `window.kt.storage`, ID/accessor/coercion guards, I/O state machine & error deactivation, `scripts/build.mjs` invariants, and negative ESLint/`tsc` checks. |
| `npm run build`    | `node scripts/build.mjs`                               | Strip non-banner comments from `plugin.js`, format with Prettier, and emit `dist/pgmmv-storage-plugin-v<version>.js` (accepts an optional output path strictly inside `dist/`).                                                      |

## References & License

- [Changelog](./CHANGELOG.md)
- [MIT License](./LICENSE)
- [@kidthales/pgmmv-types](https://github.com/kidthales/pgmmv-types)
- [PGMMV Plug-in Specifications](https://rpgmakerofficial.com/product/act/en/manual/Plug-in_Spec_en.pdf)
