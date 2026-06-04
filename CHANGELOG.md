# Changelog

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
