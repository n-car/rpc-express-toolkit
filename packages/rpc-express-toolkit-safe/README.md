# rpc-express-toolkit-safe (proxy)

This package is a thin wrapper around `rpc-express-toolkit/safe` that enables a “safe preset” import path.

- Server factory: `createSafeEndpoint(app, context, options?)`
  - Applies `{ safeEnabled: true, strictMode: true }` by default
- Client factory: `createSafeClient(endpoint, headers?, options?)`
  - Applies `{ safeEnabled: true }` by default

Usage:

```js
// Server
const express = require('express');
const { createSafeEndpoint } = require('rpc-express-toolkit-safe');
const app = express();
app.use(express.json());
const rpc = createSafeEndpoint(app, {}, { endpoint: '/api' });

// Client
const { createSafeClient } = require('rpc-express-toolkit-safe');
const client = createSafeClient('http://localhost:3000/api');
```

Under the hood this package simply exports from `rpc-express-toolkit/safe` and depends on `rpc-express-toolkit >= 4.0.1`.

