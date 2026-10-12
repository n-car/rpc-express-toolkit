# RPC Express Toolkit — Advanced Usage

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)

Enterprise-ready JSON-RPC 2.0 toolkit for Express.js applications with structured logging, middleware, schema validation, batch processing, and precise type handling via optional safe prefixes.

This guide describes **4.5.2**. Earlier
published versions may differ, particularly in unexpected-error sanitization.

## Table of Contents

- Features
- Installation
- Quick Start
- Advanced Usage
  - Configuration Options
  - Request Contract
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
- Extensible middleware system with authentication, method whitelisting, rate limiting, CORS, timing, and custom authorization hooks.
- JSON Schema validation via Ajv with helper builder.
- Health and metrics endpoints.

## Installation

```bash
npm install express rpc-express-toolkit
# or
yarn add express rpc-express-toolkit
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
  auth: (req) => Boolean(req.headers.authorization),
  methodWhitelist: ['add', 'subtract', 'getUser'],
  validation: { coerceTypes: true, removeAdditional: true },
  safeEnabled: false,
  sanitizeErrors: true,
  warnOnUnsafe: true,
  healthCheck: true,
  metrics: true,
  enableBatch: true,
  maxBatchSize: 100,
});
```

### Request Contract

Requests require `jsonrpc: "2.0"` and a nonempty string `method`. When present,
`params` must be an object or array; `null` and scalar parameters are invalid
envelopes. IDs may be strings, finite numbers, or `null`. A missing `id` means a
notification with no JSON-RPC response; an explicit `id: null` receives a response.

Invalid envelopes return `-32600` with `id: null`, including invalid batch items.
Valid notifications are omitted from batch responses; an all-notification batch
has no response body. Schema validation failures return `-32602` with the
original ID. Null results remain `result: null`, and empty objects remain objects.

Handlers receive `(request, applicationContext, params, callContext)`. Client
array parameters occupy the `params` argument only; they cannot replace the
server-owned context arguments. Handler signatures are unchanged in this patch.

### Safe Serialization

The toolkit can optionally prefix string and date values to avoid ambiguity between plain strings, BigInt, and Date objects when both client and server use the toolkit:

- `S:...` for strings (only when `safeEnabled: true`)
- `D:...` for dates (only when `safeEnabled: true`)
- BigInt values are serialized as strings with a trailing `n` (e.g. `"42n"`).

By default `safeEnabled` is disabled to maximize interoperability. When disabled, BigInt are still serialized as strings with `n` suffix and Date as ISO strings; the server/client can warn to educate about potential ambiguity.

Only `params`, `result`, and `error.data` are recursively encoded or decoded.
Envelope fields, including `method`, `id`, and `error.message`, are unchanged.
Safe Mode preserves value types; it does not authenticate or encrypt requests.

#### Defaults and Negotiation

- Server sends header `X-RPC-Safe-Enabled` in responses.
- Client sends the same header in requests.
- Strict compatibility: if server is `safeEnabled: true` and `strictMode: true`, and the client does not send the header, response-bearing calls return a JSON-RPC error `-32600`. Valid notifications still produce no response.
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
  // e.g., inspect req, method, params, or mutate params
  return ctx;
});
```

Built-ins:
- `rateLimit({ windowMs, max, store })`
- `auth(verifyFn)`
- `cors({ origin, methods, headers })`
- `timing()`
- `methodWhitelist(["allowedMethod"])`

Authentication uses `auth: async (req) => userOrBoolean` in the endpoint options. Returning a truthy value allows the call; a truthy non-boolean value is exposed to handlers as `callContext.authenticatedUser`. Returning a falsy value rejects it with JSON-RPC error `-32001` and message `Authentication required`.

Handlers can accept a fourth, optional call context argument containing the final values produced by middleware:

```javascript
rpc.addMethod('whoami', (_req, _appContext, _params, callContext) =>
  callContext.authenticatedUser
);
```

The default rate-limit store is process-local. A shared store can be supplied without adding a database dependency to the toolkit. It must implement the atomic contract `increment(key, windowMs, now)` and return the hit count for the active window.

`methodWhitelist` is a simple method-level restriction mechanism. It rejects calls to registered methods that are not in the whitelist, but it is not a declarative RBAC, roles, scopes, or permission framework.

#### Custom Authorization

Use `beforeCall` middleware for project-specific authorization rules:

```javascript
rpc.use('beforeCall', async (ctx) => {
  const user = await authenticate(ctx.req);

  if (!user) {
    const error = new Error('Authentication required');
    error.code = -32001;
    throw error;
  }

  if (ctx.method.startsWith('admin.') && !user.roles.includes('admin')) {
    const error = new Error('Forbidden');
    error.code = -32003;
    throw error;
  }

  return {
    ...ctx,
    user,
  };
});
```

Middleware can inspect `ctx.method`, `ctx.params`, `ctx.req`, `ctx.res`, and the application context in `ctx.context`. This enables project-specific authorization rules without forcing a specific auth provider, identity model, roles format, or scopes model.

### Structured Logging

The `Logger` supports `error`, `warn`, `info`, `debug`, `trace`. Server logs RPC start/success/error and sanitizes common sensitive fields in params. This is best-effort redaction, not a guarantee that arbitrary secrets are removed. Keep internal diagnostics and logs access-controlled.

### Error Handling

Unexpected handler, middleware, and endpoint exceptions return only
`{ "code": -32603, "message": "Internal error" }` by default, for both single
calls and batches. Internal messages, data, and exception stacks are not sent to
clients. This also applies to native errors without a safe-integer RPC code.

To deliberately expose an application error, assign a safe-integer `code` other
than `-32603`. Its `message` and optional `data` are public, so never put secrets
or internal diagnostics in those fields:

```javascript
const error = new Error('Access denied');
error.code = -32003;
error.data = { reason: 'permission' };
throw error;
```

Schema validation errors remain public `-32602` errors. Batch application errors
may include `batchIndex` metadata without discarding their original data. Stacks
are not automatically attached to explicit application errors. Server-side
`onError` middleware can still inspect the original exception for diagnostics.

Setting `{ sanitizeErrors: false }` on `RpcEndpoint` is an explicit **local
debugging only** opt-out: unexpected messages, data, and serialized exception
stacks can then reach callers. Never enable it in production.

### Client Configuration

`RpcClient` delegates to the shared `rpc-toolkit-js-client` and handles
serialization automatically without modifying `BigInt.prototype`. It uses
`globalThis.fetch` (built in on Node.js 18+) unless a custom `fetch` implementation
is provided in the client options.

Options:
- `safeEnabled`: enable safe prefixes for strings/dates.
- `warnOnUnsafe`: show compatibility warnings in standard mode.

### Examples

See the `examples/` folder for runnable samples.

### Safe Preset Entry Point

If you prefer safe serialization by default (and you control both client and server), you can use the dedicated classes:

```js
// Server
const express = require('express');
const { RpcSafeEndpoint } = require('rpc-express-toolkit/safe');

const app = express();
app.use(express.json());
const rpc = new RpcSafeEndpoint(app, {}, { endpoint: '/api' }); // safeEnabled + strictMode by default

// Client
const { RpcSafeClient } = require('rpc-express-toolkit/safe');
const client = new RpcSafeClient('http://localhost:3000/api'); // safeEnabled by default
```

These classes extend `RpcClient` and `RpcEndpoint` with `safeEnabled: true` (and `strictMode: true` on the server) as defaults. This lets you keep the default entrypoint fully JSON‑RPC 2.0 compliant while offering a clear opt‑in for advanced type disambiguation.

**Note:** The factory functions `createSafeClient()` and `createSafeEndpoint()` are deprecated in favor of the class-based API.

### Contributing

Issues and PRs are welcome. Run tests and lint before submitting.

```bash
npm test
npm run lint
```

### Security & Performance

- Use authentication middleware and `methodWhitelist` for basic access restrictions.
- Implement project-specific authorization with middleware hooks when you need roles, scopes, or other permission checks.
- Enable `rateLimit` to mitigate abuse.
- Use a shared rate-limit store when running multiple workers or instances.
- Set `enableBatch: false` when batch is unnecessary, or configure a conservative `maxBatchSize`.
- Keep introspection disabled and configure an explicit CORS origin in production; do not use `cors: true` for public deployments because it implies a wildcard origin.
- Keep the default `sanitizeErrors: true`; treat explicit application error messages and data as public.
- Avoid logging sensitive data; the logger sanitizes common keys.

## License

MIT. See [LICENSE](LICENSE).
