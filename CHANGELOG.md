# Changelog

## [4.2.2] - 2026-06-04

### Changed
- `RpcClient` is now provided by the shared `rpc-toolkit-js-client` package while remaining exported from `rpc-express-toolkit`.
- `RpcEndpoint.serveScripts()` now serves browser client assets from the shared JavaScript client package.

## [4.2.1] - 2025-11-27

### Fixed
- Fixed Ajv strict mode error when using `exposeSchema` option in method configuration
- Added `strict: false` to Ajv configuration to allow additional properties like `exposeSchema` and `description` in method options

## [4.2.0] - Previous releases
