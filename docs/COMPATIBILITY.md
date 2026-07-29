# Compatibility

`rpc-express-toolkit` is tested as an Express integration library, not as an application framework replacement.

## Runtime Matrix

| Runtime | Status |
| --- | --- |
| Node.js 18.x | CI tested |
| Node.js 20.x | CI tested |
| Node.js 22.x | CI tested |
| Node.js 24.x | CI tested |
| Express 4.x | CI tested |
| Express 5.x | CI tested |

The GitHub Actions matrix runs the test suite across Node.js 18, 20, 22, and 24 with both Express 4 and Express 5.

## Module And TypeScript Compatibility

The published package remains CommonJS at runtime and supports both CommonJS and Node.js ESM consumers. Its TypeScript declarations model the CommonJS default export and the named properties exposed by the root and `/safe` entrypoints.

| Consumer | Module setup | Verified imports | Validation |
| --- | --- | --- | --- |
| TypeScript ESM | `"type": "module"` with `module` and `moduleResolution` set to `NodeNext` | Root default and named imports, public root types, and named `/safe` imports | TypeScript 6, `strict: true`, `skipLibCheck: false`, `esModuleInterop: false` |
| TypeScript CommonJS | `.cts` with NodeNext resolution | `import = require()` for the root and `/safe`, including namespace properties | TypeScript 6, `strict: true`, `skipLibCheck: false`, `esModuleInterop: false` |
| Node.js ESM | `.mjs` | Root default and named imports plus named `/safe` imports | Runtime smoke test |
| Node.js CommonJS | `.cjs` | `require()` for the root and `/safe`, including root default identity | Runtime smoke test |

The TypeScript ESM consumer covers `RpcEndpoint` as both the default and a named import, `RpcClient`, `RpcEndpointOptions`, `RpcSafeEndpoint`, and `RpcSafeClient`. The CommonJS consumer covers the constructable root export, `RpcEndpoint.RpcClient`, `Safe.RpcSafeEndpoint`, and `Safe.RpcSafeClient`.

TypeScript applications using Express should install `@types/express` and
`@types/node`; the package test installs these declarations in its isolated
consumer.

The TypeScript 6 fixtures set `ignoreDeprecations: "6.0"` solely to
acknowledge the compiler's deprecation notice for the deliberately explicit
`esModuleInterop: false` test setting.

### Packaged Consumer Validation

`npm run package-test` builds a tarball with `npm pack`, installs that tarball into isolated consumer fixtures, and runs the full matrix above. This verifies the published `exports` map, included files, declaration resolution, module extensions, and runtime format instead of importing the repository sources directly.

Package validation runs in CI and as part of `prepublishOnly`, so declaration or packaging regressions block publication.

## Express Dependency

Express is declared as a peer dependency:

```json
"express": "^4.21.2 || ^5.0.0"
```

Applications should install Express directly alongside `rpc-express-toolkit`.

## Compatibility Coverage

The Express compatibility tests cover:

- standard JSON-RPC endpoint calls;
- batch requests;
- Safe Mode endpoints;
- introspection reporting of the active Express runtime.

Broader RPC behavior is covered by the main test suite and is expected to run identically on Express 4 and Express 5. Module and declaration compatibility is covered separately by the packaged consumer validation.
