# Release Notes v2.1.0

## 🚀 New Features

### SSL Certificate Bypass for Development
- **New `rejectUnauthorized` option** in `RpcClient` constructor
- Support for self-signed certificates in development environments
- Environment-based SSL configuration examples

```javascript
// Development client for self-signed certificates
const client = new RpcClient('https://localhost:3000/api', {
    'Authorization': 'Bearer dev-token'
}, {
    rejectUnauthorized: false // Only for development!
});
```

## 📚 Documentation Improvements

- **New "Client Configuration" section** in README
- Comprehensive SSL configuration examples
- Security warnings and best practices
- **New example file**: `examples/ssl-development-example.js`

## 🔧 Technical Enhancements

- Updated TypeScript definitions for new SSL options
- Enhanced client configuration capabilities
- Built and updated minified client files
- Improved JSDoc documentation

## ⚠️ Security Considerations

- **Important**: `rejectUnauthorized: false` should ONLY be used in development
- Added comprehensive security warnings in documentation
- Recommended best practices for production deployments
- Environment-based configuration examples

## 📦 Package Information

- **NPM**: Published as `rpc-express-toolkit@2.1.0`
- **GitHub**: Tagged as `v2.1.0`
- **Compatibility**: Fully backward compatible with existing code
- **Bundle Size**: Optimized with updated minified clients

## 🔄 Migration

This is a **minor version update** with no breaking changes. Existing code will continue to work unchanged. The new SSL bypass feature is opt-in and only affects new client instantiations that explicitly use the new options parameter.

## 🏗️ Build Status

- ✅ All 26 tests passing
- ✅ TypeScript definitions updated
- ✅ Minified clients rebuilt
- ✅ Documentation updated
- ✅ Examples verified

---

**Full Changelog**: [v2.0.3...v2.1.0](https://github.com/n-car/rpc-express-toolkit/compare/v2.0.3...v2.1.0)
