# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-07-09

### Added
- **SSL Certificate Bypass Support**: Added `rejectUnauthorized` option to RpcClient constructor for development environments with self-signed certificates
- **Enhanced Client Configuration**: RpcClient now accepts an optional `options` parameter for advanced configuration
- **SSL Development Example**: Added `examples/ssl-development-example.js` demonstrating SSL configuration best practices
- **TypeScript Support**: Updated TypeScript definitions to include new SSL configuration options

### Changed
- **Client Constructor**: RpcClient constructor now accepts a third parameter `options` for SSL and other configuration
- **Documentation**: Enhanced README.md with "Client Configuration" section and SSL security warnings
- **Build Process**: Updated minified clients to include SSL support

### Security
- Added comprehensive security warnings about SSL certificate validation bypass
- Documented best practices for development vs production SSL handling
- Emphasized that `rejectUnauthorized: false` should never be used in production

### Fixed
- **Jest Configuration**: Removed reference to non-existent setup file in jest.config.js
- **TypeScript Definitions**: Corrected client constructor signature in index.d.ts

## [2.0.3] - Previous Release

### Added
- Modern RpcEndpoint and RpcClient APIs
- Comprehensive BigInt and Date serialization/deserialization
- Structured logging with winston
- Schema validation support
- Client script minification
- Enterprise-ready middleware system

### Removed
- Legacy JsonRPCEndpoint and JsonRPCClient classes
- Deprecated Server and Client aliases
- Legacy API references throughout codebase

### Migration
- See MIGRATION.md for detailed upgrade instructions from legacy APIs
