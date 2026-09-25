# Changelog

## [Unreleased]

## [4.5.1] - 2026-09-25

### Fixed

- Published the main and Safe proxy npm packages with regular files set to `0644` instead of `0755`.
- Added a packaging check that rejects unexpected executable file modes before publication.

## [4.5.0] - 2026-09-24

### Added

- Added `enableBatch` and `maxBatchSize` endpoint options.
- Added pluggable rate-limit stores with `MemoryRateLimitStore` as the default.
- Added a final call-context argument for handlers, including `authenticatedUser`.

### Fixed

- Propagated middleware context and `afterCall` result changes to handlers and responses.
- Made CORS work for batch calls, origin allowlists, credentials, and preflight requests.

## [4.4.2] - 2026-07-30

### Changed

- Updated the shared `rpc-toolkit-js-client` dependency to `^1.1.3`.

## [4.4.1] - 2026-07-29

### Added

- Added packaged consumer tests for TypeScript ESM/NodeNext, TypeScript CommonJS, and Node.js ESM and CommonJS runtime imports.
- Added package validation based on the `npm pack` tarball to CI and the prepublish hook.

### Fixed

- Corrected the root and `/safe` TypeScript declarations for strict consumers with `skipLibCheck: false`, preserving the CommonJS default export, named imports in NodeNext, and the existing runtime API without requiring `esModuleInterop`.

## [4.4.0] - 2026-06-19

### Added
- Added Express 4/5 compatibility tests and a CI matrix across Node.js 18, 20, 22, and 24.
- Added `docs/COMPATIBILITY.md` with the supported runtime matrix.

### Changed
- Declared Express as a peer dependency supporting `^4.21.2 || ^5.0.0`.
- Updated installation documentation to install Express explicitly alongside `rpc-express-toolkit`.

## [4.3.5] - 2026-06-11

### Changed
- Updated `rpc-toolkit-js-client` to the npm-published `^1.1.2` package.

## [4.3.2] - 2026-06-10

### Changed
- Clarified authentication, method whitelisting, and custom authorization guidance.
- Updated Safe preset documentation to prefer `RpcSafeEndpoint` and `RpcSafeClient`.
- Aligned the `rpc-express-toolkit-safe` proxy package with the main package version.

### Fixed
- Corrected TypeScript declarations for the `auth` endpoint option.

## [4.3.1] - 2026-06-04

### Changed
- Updated the shared JavaScript client dependency to `rpc-toolkit-js-client` `v1.1.0`.

## [4.3.0] - 2026-06-04

### Changed
- JSON-RPC notifications no longer produce response bodies; single notifications and all-notification batches now return HTTP 204.
- Batch execution now applies envelope validation, strict Safe Mode checks, schema validation, and validation middleware hooks consistently with single requests.
- Batch duplicate ids are processed instead of rejected, matching JSON-RPC 2.0 behavior.
- Batch error responses now preserve method error data and add `batchIndex` without replacing existing data.

### Fixed
- `id: null` in batch is now treated as a response-bearing request id instead of a notification.
- Empty batches now return a single JSON-RPC invalid request error object.
- Invalid `id` and invalid `params` envelope values now return `-32600`.
- Server-side serializer/deserializer traversal now fails deterministically for circular or too-deep structures and keeps `__proto__` keys inert.
- Logger stringification and parameter sanitization now handle circular structures and redact more credential-like fields; stack traces are limited to debug/trace logs.

## [4.2.3] - 2026-06-04

### Changed
- Removed obsolete local browser client build scripts; browser assets now come only from `rpc-toolkit-js-client`.
- Type declarations now reference the shared JavaScript client types exported by `rpc-toolkit-js-client`.

### Removed
- Removed duplicated `src/clients/*` browser client bundles from the Express package.

## [4.2.2] - 2026-06-04

### Changed
- `RpcClient` is now provided by the shared `rpc-toolkit-js-client` package while remaining exported from `rpc-express-toolkit`.
- `RpcEndpoint.serveScripts()` now serves browser client assets from the shared JavaScript client package.

## [4.2.1] - 2025-11-27

### Fixed
- Fixed Ajv strict mode error when using `exposeSchema` option in method configuration
- Added `strict: false` to Ajv configuration to allow additional properties like `exposeSchema` and `description` in method options

## [4.2.0] - Previous releases
