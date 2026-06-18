# RPC Express Toolkit

[![CI](https://github.com/n-car/rpc-express-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/n-car/rpc-express-toolkit/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/n-car/rpc-express-toolkit/badge.svg?branch=main)](https://coveralls.io/github/n-car/rpc-express-toolkit?branch=main)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)
[![node](https://img.shields.io/node/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)
[![Status](https://img.shields.io/badge/status-stable-green.svg)](https://github.com/n-car/rpc-express-toolkit/releases)

JSON-RPC 2.0 toolkit for Express.js with simplified APIs, middleware, schema validation, batch support, and optional Safe Mode type preservation.

## Which Package Should I Use?

- Use `rpc-express-toolkit` if you are building a JSON-RPC endpoint on Express.
- Use [`rpc-node-toolkit`](https://github.com/n-car/rpc-node-toolkit) if you want framework-agnostic Node.js or plain `node:http`.
- Use [`rpc-toolkit-js-client`](https://github.com/n-car/rpc-toolkit-js-client) if you only need a browser or Node.js client.
- Use [`rpc-toolkit`](https://github.com/n-car/rpc-toolkit) as the ecosystem hub and compatibility reference.

## Quick Start

### Installation

```bash
npm install express rpc-express-toolkit
# or
yarn add express rpc-express-toolkit
```

Requirements:
- Node.js 18+ (uses `globalThis.fetch`)
- Express 4.21+ or Express 5.x

### Compatibility

`rpc-express-toolkit` is tested with Node.js 18, 20, 22, and 24 across Express 4 and Express 5. See [Compatibility](docs/COMPATIBILITY.md) for the current runtime matrix.

### Server

```javascript
const express = require('express');
const { RpcEndpoint } = require('rpc-express-toolkit');

const app = express();
app.use(express.json()); // required

const context = { database: db, config };

const rpc = new RpcEndpoint(app, context);
rpc.addMethod('add', (req, ctx, params) => params.a + params.b);

app.listen(3000);
```

### Client

```javascript
const { RpcClient, RpcSafeClient } = require('rpc-express-toolkit');

const client = new RpcClient('http://localhost:3000/api');
const sum = await client.call('add', { a: 1, b: 2 });

const safeClient = new RpcSafeClient('http://localhost:3000/api');
await safeClient.notify('add', { a: 0, b: 0 });
```

`RpcClient` and `RpcSafeClient` are re-exported from the shared `rpc-toolkit-js-client` package, so existing Node.js imports from `rpc-express-toolkit` continue to work.

### Browser Client Assets

Serve the shared browser client bundles from the endpoint:

```javascript
const { RpcEndpoint } = require('rpc-express-toolkit');

RpcEndpoint.serveScripts(app);
```

Default paths:

```text
/vendor/rpc-client/rpc-client.js
/vendor/rpc-client/rpc-client.min.js
/vendor/rpc-client/rpc-client.mjs
/vendor/rpc-client/rpc-client.min.mjs
```

Classic browser script:

```html
<script src="/vendor/rpc-client/rpc-client.min.js"></script>
<script>
  const client = new RpcToolkitClient.RpcClient('/api');
  const safeClient = new RpcToolkitClient.RpcSafeClient('/api');

  client.call('add', { a: 1, b: 2 }).then(console.log);
  safeClient.notify('add', { a: 0, b: 0 });
</script>
```

Module script:

```html
<script type="module">
  import { RpcClient, RpcSafeClient } from '/vendor/rpc-client/rpc-client.mjs';

  const client = new RpcClient('/api');
  const safeClient = new RpcSafeClient('/api');

  console.log(await client.call('add', { a: 1, b: 2 }));
  await safeClient.notify('add', { a: 0, b: 0 });
</script>
```

### Safe Type Disambiguation (optional)

Safe type disambiguation is disabled by default for maximum JSON-RPC 2.0 compatibility. The library can show warnings when BigInt or Date values are serialized in standard mode. Enable safe serialization with `safeEnabled: true` to add safe prefixes (`S:` for strings, `D:` for dates), or suppress warnings with `warnOnUnsafe: false`. See `README_ADVANCED.md#safe-serialization` for details.

## Minimal API

- `new RpcEndpoint(router, context, options?)`: create and attach a JSON-RPC endpoint.
- `rpc.addMethod(name, handlerOrConfig)`: register a method (function or `{ handler, schema }`).
- `new RpcClient(baseUrl, headers?, options?)`: client for making calls.
- `client.call(method, params?)`: single call.
- `client.batch([...])`: batch.
- `client.notify(method, params?)`: notification.

## Authentication And Method Restrictions

Authentication is supported through the built-in `auth` middleware. The `auth` option is a function that receives the Express request. Returning a truthy value allows the RPC call; returning a falsy value rejects it with JSON-RPC error `-32001` and message `Authentication required`. Throwing also rejects the call and returns a JSON-RPC error based on the thrown error.

```js
const rpc = new RpcEndpoint(app, context, {
  auth: async (req) => {
    const token = req.headers.authorization;
    return token === 'Bearer secret-token';
  },
});

rpc.addMethod('ping', () => 'pong');
```

For simple method-level restriction, use `methodWhitelist`:

```js
const rpc = new RpcEndpoint(app, context, {
  methodWhitelist: ['ping', 'status.read'],
});
```

Calls to methods outside the whitelist are rejected. This is a basic method restriction mechanism, not a complete role or permission system. Project-specific authorization rules can be implemented with middleware hooks such as `beforeCall`; see `README_ADVANCED.md`.

### Safe Import (opt-in)

[![npm (proxy)](https://img.shields.io/npm/v/rpc-express-toolkit-safe.svg)](https://www.npmjs.com/package/rpc-express-toolkit-safe)
[![safe preset](https://img.shields.io/badge/safe%20preset-available-blue)](#safe-import-opt-in)

When you control both client and server and want safer type round-trips, import the built-in safe preset from `rpc-express-toolkit/safe`. It enables safe serialization by default and strict mode on the server:

```js
// Server (safe preset)
const express = require('express');
const { RpcSafeEndpoint } = require('rpc-express-toolkit/safe');

const app = express();
app.use(express.json());

const rpc = new RpcSafeEndpoint(app, {}, { endpoint: '/api' /* strictMode: true by default */ });

// Client (safe preset)
const { RpcSafeClient } = require('rpc-express-toolkit/safe');
const client = new RpcSafeClient('http://localhost:3000/api');
```

This keeps JSON-RPC 2.0 compliance as default for the main entrypoint, while offering a convenient safe-mode import for projects that prefer explicit type disambiguation.

#### Alternative Compatibility Package

`rpc-express-toolkit-safe` is a thin compatibility package that re-exports the same safe preset. Use it only when a separate package name is useful for dependency policy or migration; new projects can import `rpc-express-toolkit/safe` directly.

```bash
npm install rpc-express-toolkit-safe
```

```js
// Server
const express = require('express');
const { RpcSafeEndpoint } = require('rpc-express-toolkit-safe');
const app = express();
app.use(express.json());
const rpc = new RpcSafeEndpoint(app, {}, { endpoint: '/api' });

// Client
const { RpcSafeClient } = require('rpc-express-toolkit-safe');
const client = new RpcSafeClient('http://localhost:3000/api');
```

## Introspection Methods

Enable introspection to expose metadata about registered methods via reserved `__rpc.*` methods:

```javascript
const rpc = new RpcEndpoint(app, context, {
  enableIntrospection: true  // Enable __rpc.* methods
});

// Register methods with public schemas
rpc.addMethod('add', async (req, ctx, params) => {
  return params.a + params.b;
}, {
  schema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['a', 'b']
  },
  exposeSchema: true,        // Make schema publicly queryable
  description: 'Add two numbers'
});

// Available introspection methods:
// __rpc.listMethods() → ["add", "multiply", ...]
// __rpc.describe({method: "add"}) → {name, schema, description}
// __rpc.describeAll() → [{name, schema, description}, ...]
// __rpc.version() → {toolkit, version, expressVersion, nodeVersion}
// __rpc.capabilities() → {safeMode, batch, introspection, ...}

// Client usage
const methods = await client.call('__rpc.listMethods');
const addInfo = await client.call('__rpc.describe', { method: 'add' });
```

In `__rpc.capabilities`, `auth` is a boolean indicating whether authentication middleware is configured. It does not expose roles, scopes, or permission rules.

**Note:** The introspection prefix is configurable via `introspectionPrefix` option (default: `__rpc`). User methods starting with this prefix are rejected to prevent conflicts.

## Full Details

For advanced configuration, middleware, structured logging, safe serialization, error handling, and more, see `README_ADVANCED.md`.

## Related Projects

- [rpc-php-toolkit](https://github.com/n-car/rpc-php-toolkit) - PHP implementation
- [rpc-dotnet-toolkit](https://github.com/n-car/rpc-dotnet-toolkit) - .NET implementation
- [rpc-arduino-toolkit](https://github.com/n-car/rpc-arduino-toolkit) - Arduino/ESP32 implementation
- [rpc-java-toolkit](https://github.com/n-car/rpc-java-toolkit) - Java & Android implementation
- [node-red-contrib-rpc-toolkit](https://github.com/n-car/node-red-contrib-rpc-toolkit) - Node-RED visual programming

## Contributing

```bash
git clone https://github.com/n-car/rpc-express-toolkit.git
npm install
npm test
npm run lint
```

## License

MIT. See [LICENSE](LICENSE).
