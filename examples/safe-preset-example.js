const express = require('express');
/* eslint-disable import/no-unresolved, prettier/prettier */
const { createSafeEndpoint, createSafeClient } = require('rpc-express-toolkit/safe');
/* eslint-enable import/no-unresolved, prettier/prettier */

async function main() {
  const app = express();
  app.use(express.json());

  // Server with safe defaults (safeEnabled=true, strictMode=true)
  const rpc = createSafeEndpoint(app, {}, { endpoint: '/api' });

  rpc.addMethod('sum', (req, ctx, params) => {
    // params are already deserialized according to the client's safe header
    const a =
      typeof params.a === 'string' && params.a.endsWith('n')
        ? BigInt(params.a.slice(0, -1))
        : BigInt(params.a);
    const b =
      typeof params.b === 'string' && params.b.endsWith('n')
        ? BigInt(params.b.slice(0, -1))
        : BigInt(params.b);
    return a + b; // will be serialized as "<value>n" safely
  });

  const server = app.listen(0, async () => {
    const { port } = server.address();
    const url = `http://localhost:${port}/api`;
    console.log('Safe server listening on', url);

    // Safe client (sends header and expects safe response)
    const client = createSafeClient(url);
    const res = await client.call('sum', { a: '10n', b: '32n' });
    console.log('sum result (BigInt):', res.toString());

    server.close();
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
