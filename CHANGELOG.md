# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-07-09

### Added
- SSL certificate bypass option for development environments
- `rejectUnauthorized` option in RpcClient constructor for both CommonJS and ESM clients
- Comprehensive SSL configuration documentation with security warnings
- SSL development example with best practices (`examples/ssl-development-example.js`)
- TypeScript definitions for new SSL configuration options

### Changed
- Updated client minified versions to include new SSL functionality
- Enhanced README.md with client configuration section

### Security
- Added proper security warnings for SSL bypass functionality
- Documented that `rejectUnauthorized: false` should only be used in development

## [2.0.3] - Previous Version

### Changed
- Cleaned up legacy code and removed deprecated aliases
- Improved documentation and examples
- Added client minification support
- Updated TypeScript definitions

### Removed
- Legacy `JsonRPCEndpoint`, `JsonRPCClient`, `Server`, and `Client` aliases
- Deprecated API references from all files

### Fixed
- Various code quality improvements
- Updated test suite for modern APIs only