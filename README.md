# RPC Express Toolkit

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)

Enterprise-ready JSON-RPC 2.0 toolkit for Express.js with simplified APIs, middleware, schema validation, batch support, and optional safe type disambiguation.

## Quick Start

### Installation

```bash
npm install rpc-express-toolkit
# or
yarn add rpc-express-toolkit
```

Requirements:
- Node.js 18+ (uses `globalThis.fetch`)

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
const { RpcClient } = require('rpc-express-toolkit');
const client = new RpcClient('http://localhost:3000/api');
const sum = await client.call('add', { a: 1, b: 2 });
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

## Full Details

For advanced configuration, middleware, structured logging, safe serialization, error handling, and more, see `README_ADVANCED.md`.

## Contributing

```bash
git clone https://github.com/n-car/rpc-express-toolkit.git
npm install
npm test
npm run lint
```

## License

MIT. See [LICENSE](LICENSE).
