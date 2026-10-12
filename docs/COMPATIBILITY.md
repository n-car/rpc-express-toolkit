# Compatibility

`rpc-express-toolkit` is tested as an Express integration library, not as an application framework replacement.

## Runtime Matrix

| Runtime | Status |
| --- | --- |
| Node.js 18.x | Configured CI target |
| Node.js 20.x | Configured CI target |
| Node.js 22.x | Configured CI target |
| Node.js 24.x | Configured CI target |
| Node.js 26.x | Configured CI target |
| Express 4.x | Configured CI target |
| Express 5.x | Configured CI target |

The GitHub Actions matrix is configured to run the test suite across Node.js 18,
20, 22, 24, and 26 with both Express 4 and Express 5. This is the configured
coverage, not a claim that every target has been rerun for the 4.5.2 release.

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

Under WSL, run packaging from a native Linux filesystem: Windows-mounted source trees can
make regular files appear executable (`0755`), which the runner deliberately
rejects. A temporary source copy with regular file modes preserves this check
without changing the original checkout.

An offline run requires both registry metadata and package tarballs in npm's
selected cache. A package installed elsewhere, or a cached version listing,
does not by itself guarantee that npm can install the isolated consumer offline.
Select the cache for that process with `npm_config_cache`; use
`npm_config_offline=true` when network access must be disabled.

Local validation on 2026-10-12 passed the full packaged-consumer runner for the
4.5.2 source: Node.js 24.14.0, npm 11.12.0, TypeScript 6.0.3, Express
4.22.2, `@types/express` 5.0.6, and `@types/node` 26.6.2. The offline run used
`npm_config_before=2026-09-20T00:00:00Z` to select compatible versions already
cached, without changing manifests or tests. It covered packaging, installation,
ESM/CommonJS types and runtime, Publint, and ATTW for both the main and Safe proxy
packages. This does not establish a result for uncached `@types/node` 26.6.4 or
for every configured CI target.

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
- introspection reporting of the active Express runtime;
- invalid request envelopes and null IDs/results;
- default error sanitization, intentional public errors, and the debug opt-out.

Broader RPC behavior is covered by the main test suite and is expected to run identically on Express 4 and Express 5. Module and declaration compatibility is covered separately by the packaged consumer validation.
