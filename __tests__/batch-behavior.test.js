const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Batch behavior', () => {
  let app;
  let rpc;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    rpc = new RpcEndpoint(app, {}, { safeEnabled: false, strictMode: false });

    rpc.addMethod('echo', (req, ctx, params) => params);
    rpc.addMethod('mul', (req, ctx, params) => {
      let a = params.a;
      let b = params.b;
      if (typeof a === 'string' && /n$/.test(a)) a = BigInt(a.slice(0, -1));
      if (typeof b === 'string' && /n$/.test(b)) b = BigInt(b.slice(0, -1));
      return a * b;
    });
  });

  test('rejects empty batch', async () => {
    const res = await request(app).post('/api').send([]);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].error).toBeDefined();
    expect(res.body[0].error.code).toBe(-32600);
  });

  test('allows duplicate ids in batch', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { a: 1 }, id: 1 },
        { jsonrpc: '2.0', method: 'echo', params: { a: 2 }, id: 1 },
      ]);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].result).toEqual({ a: 1 });
    expect(res.body[1].result).toEqual({ a: 2 });
  });

  test('batch with only notifications returns 204', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { ok: true } },
        { jsonrpc: '2.0', method: 'echo', params: { ok: true } },
      ]);
    expect(res.status).toBe(204);
  });

  test('deserializes params in batch using header', async () => {
    const res = await request(app)
      .post('/api')
      .set('X-RPC-Safe-Enabled', 'true')
      .send([
        {
          jsonrpc: '2.0',
          method: 'mul',
          params: { a: '3n', b: '5n' },
          id: 10,
        },
      ]);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual({ jsonrpc: '2.0', id: 10, result: '15n' });
  });
});
