# rpc-express-toolkit-safe (proxy)

This package is a thin wrapper around `rpc-express-toolkit/safe` that enables a “safe preset” import path.

- Server class: `new RpcSafeEndpoint(app, context, options?)`
  - Applies `{ safeEnabled: true, strictMode: true }` by default
- Client class: `new RpcSafeClient(endpoint, headers?, options?)`
  - Applies `{ safeEnabled: true }` by default

Usage:

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

The deprecated `createSafeEndpoint()` and `createSafeClient()` factory functions are still exported for compatibility.

Under the hood this package simply exports from `rpc-express-toolkit/safe` and depends on `rpc-express-toolkit`.
