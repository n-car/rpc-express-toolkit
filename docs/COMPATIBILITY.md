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

Broader RPC behavior is covered by the main test suite and is expected to run identically on Express 4 and Express 5.
