# PGMMV Storage Plugin

[![CI](https://github.com/kidthales/pgmmv-storage-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/pgmmv-storage-plugin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Save/load [PGMMV](https://rpgmakerofficial.com/product/act/en/manual/01_01.html) switch and variable values to/from a file.

> For usage instructions and downloads, please refer to the [documentation](https://kidthales.com/pgmmv/storage-plugin/).

## Requirements

- Any current [Node.js](https://nodejs.org/en/download) LTS (Long-Term Support) version.
- A [Git](https://git-scm.com/) client.

## Setup

1. `git clone https://github.com/kidthales/pgmmv-storage-plugin.git`
2. `cd pgmmv-storage-plugin`
3. `npm install`

## Lint

PGMMV plugins must conform to the [ECMAScript 5 specification](https://262.ecma-international.org/5.1/). To ensure compliance, the following npm scripts are available:

- `npm run lint` (Report errors)
- `npm run lint-fix` (Fix errors)
