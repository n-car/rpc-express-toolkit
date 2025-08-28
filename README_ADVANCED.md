# RPC Express Toolkit — Advanced Usage

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)

Enterprise-ready JSON-RPC 2.0 toolkit for Express.js applications with structured logging, middleware, schema validation, batch processing, and precise type handling via optional safe prefixes.

## Table of Contents

- Features
- Installation
- Quick Start
- Advanced Usage
  - Configuration Options
  - Safe Serialization
  - Schema Validation
  - Middleware System
  - Structured Logging
  - Error Handling
  - Client Configuration
  - Built-in Middlewares
- Examples
- Contributing
- Security
- Performance
- License

## Features

### Core Features
- JSON-RPC 2.0 compliance in baseline mode.
- Server endpoint and client classes.
- Robust BigInt & Date handling with optional safe prefixes.
- Batch processing and notifications.
- Comprehensive error responses with sanitization.

### Enterprise Features
- Structured logging with configurable levels.
- Extensible middleware system with built-ins (rate limit, CORS, auth, timing, whitelist).
- JSON Schema validation via Ajv with helper builder.
- Health and metrics endpoints.

## Installation

```bash
npm install rpc-express-toolkit
# or
yarn add rpc-express-toolkit
```

## Quick Start

See README.md for a minimal server and client example.

## Advanced Usage

### Configuration Options

```javascript
const rpc = new RpcEndpoint(app, context, {
  endpoint: '/api',
  logging: { level: 'info' },
  cors: { origin: ['http://localhost:3000'], credentials: true },
  rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { verify: (req) => Boolean(req.headers.authorization) },
  methodWhitelist: ['add', 'subtract', 'getUser'],
  validation: { coerceTypes: true, removeAdditional: true },
  safeEnabled: false,
  warnOnUnsafe: true,
  healthCheck: true,
  metrics: true,
});
```

### Safe Serialization

The toolkit can optionally prefix string and date values to avoid ambiguity between plain strings, BigInt, and Date objects when both client and server use the toolkit:

- `S:...` for strings (only when `safeEnabled: true`)
- `D:...` for dates (only when `safeEnabled: true`)
- BigInt values are serialized as strings with a trailing `n` (e.g. `"42n"`).

By default `safeEnabled` is disabled to maximize interoperability. When disabled, BigInt are still serialized as strings with `n` suffix and Date as ISO strings; the server/client can warn to educate about potential ambiguity.

#### Defaults and Negotiation

- Server sends header `X-RPC-Safe-Enabled` in responses.
- Client sends the same header in requests.
- Strict compatibility: if server is `safeEnabled: true` and `strictMode: true`, and the client does not send the header, the server returns a JSON-RPC error `-32600`.
- Client with `safeEnabled: true` expects the server header; if missing, it throws an exception.

#### Example

```javascript
// Standard mode: JSON-RPC compliant, warnings on BigInt/Date
const rpc = new RpcEndpoint(app, context); // safeEnabled=false by default

// Safe mode: both ends controlled by you
const rpcSafe = new RpcEndpoint(app, context, { safeEnabled: true, strictMode: true });

// Client
const clientStandard = new RpcClient('http://localhost:3000/api'); // safeEnabled=false
const clientSafe = new RpcClient('http://localhost:3000/api', {}, { safeEnabled: true });
```

### Schema Validation

Validation uses Ajv under the hood. You can provide plain JSON Schema or build it with the helper.

```javascript
// Using SchemaBuilder helper (fluent instance API)
const { SchemaBuilder } = require('rpc-express-toolkit');
const sb = new SchemaBuilder();
const userSchema = sb
  .property('id', { type: 'string', pattern: '^\\d+$' }, true)
  .property('createdAt', { type: 'string', format: 'date-time' }, true)
  .additionalProperties(false)
  .build();

rpc.addMethod('getUser', {
  handler: (req, ctx, params) => ({
    id: String(params.id),
    createdAt: new Date().toISOString(),
  }),
  schema: userSchema,
});
```

### Middleware System

Hooks: `beforeCall`, `beforeValidation`, `afterValidation`, `afterCall`, `onError`.

```javascript
rpc.use('beforeCall', async (ctx) => {
  // e.g., auth or mutate params
  return ctx;
});
```

Built-ins:
- `rateLimit({ windowMs, max })`
- `auth(verifyFn)`
- `cors({ origin, methods, headers })`
- `timing()`
- `methodWhitelist(["allowedMethod"])`

### Structured Logging

The `Logger` supports `error`, `warn`, `info`, `debug`, `trace`. Server logs RPC start/success/error and sanitizes sensitive fields in params.

### Error Handling

Errors are returned as JSON-RPC `error` with `code`, `message`, and optional `data`. Internally, errors are serialized with safe fields; stack traces are included but you can treat them as sensitive in production-level logs.

### Client Configuration

`RpcClient` handles serialization automatically. In Node.js it uses `fetch` (builtin on Node 18+ or `node-fetch` if available). BigInt serialization is supported via `BigInt.prototype.toJSON` polyfill installed by the client.

Options:
- `safeEnabled`: enable safe prefixes for strings/dates.
- `warnOnUnsafe`: show compatibility warnings in standard mode.

### Examples

See the `examples/` folder for runnable samples.

### Contributing

Issues and PRs are welcome. Run tests and lint before submitting.

```bash
npm test
npm run lint
```

### Security & Performance

- Use `auth` and `methodWhitelist` to restrict access.
- Enable `rateLimit` to mitigate abuse.
- Avoid logging sensitive data; the logger sanitizes common keys.

## License

MIT. See [LICENSE](LICENSE).

