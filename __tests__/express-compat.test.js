const express = require('express');
const expressPkg = require('express/package.json');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');
const { RpcSafeEndpoint } = require('../src/safe');

describe(`Express ${expressPkg.version} runtime compatibility`, () => {
  test('serves standard JSON-RPC calls', async () => {
    const app = express();
    app.use(express.json());

    const rpc = new RpcEndpoint(app, {}, '/api', {
      enableIntrospection: true,
    });
    rpc.addMethod('sum', (_req, _ctx, params) => params.a + params.b);

    const response = await request(app)
      .post('/api')
      .send({
        jsonrpc: '2.0',
        method: 'sum',
        params: { a: 2, b: 3 },
        id: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 5,
    });
  });

  test('serves batch requests', async () => {
    const app = express();
    app.use(express.json());

    const rpc = new RpcEndpoint(app, {}, '/api');
    rpc.addMethod('ping', () => 'pong');
    rpc.addMethod('sum', (_req, _ctx, params) => params.a + params.b);

    const response = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'ping', id: 1 },
        { jsonrpc: '2.0', method: 'sum', params: { a: 4, b: 5 }, id: 2 },
      ]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'pong' },
      { jsonrpc: '2.0', id: 2, result: 9 },
    ]);
  });

  test('serves Safe Mode endpoints', async () => {
    const app = express();
    app.use(express.json());

    const rpc = new RpcSafeEndpoint(app, {}, '/safe');
    rpc.addMethod('ping', () => 'pong');

    const response = await request(app)
      .post('/safe')
      .set('X-RPC-Safe-Enabled', 'true')
      .send({
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });

    expect(response.status).toBe(200);
    expect(response.headers['x-rpc-safe-enabled']).toBe('true');
    expect(response.body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'S:pong',
    });
  });

  test('reports the active Express runtime through introspection', async () => {
    const app = express();
    app.use(express.json());

    new RpcEndpoint(app, {}, '/api', {
      enableIntrospection: true,
    });

    const response = await request(app)
      .post('/api')
      .send({
        jsonrpc: '2.0',
        method: '__rpc.version',
        id: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.result).toMatchObject({
      toolkit: 'rpc-express-toolkit',
      expressVersion: expressPkg.version,
    });
  });
});
