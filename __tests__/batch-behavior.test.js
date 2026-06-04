const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Batch behavior', () => {
  let app;
  let rpc;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    rpc = new RpcEndpoint(app, {}, { safeEnabled: false });

    rpc.addMethod('echo', (req, ctx, params) => params);
    rpc.addMethod('mul', (req, ctx, params) => {
      let a = params.a;
      let b = params.b;
      if (typeof a === 'string' && /n$/.test(a)) a = BigInt(a.slice(0, -1));
      if (typeof b === 'string' && /n$/.test(b)) b = BigInt(b.slice(0, -1));
      return a * b;
    });
    rpc.addMethod('strictNumber', {
      handler: (req, ctx, params) => params.value,
      schema: {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
        required: ['value'],
        additionalProperties: false,
      },
    });
    rpc.addMethod('domainError', () => {
      const error = new Error('Domain failure');
      error.code = -32010;
      error.data = { reason: 'bad-domain' };
      throw error;
    });
  });

  test('rejects empty batch', async () => {
    const res = await request(app).post('/api').send([]);
    expect(res.status).toBe(200);
    // Implementation returns a single error object for empty array
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32600);
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
    expect(res.body).toEqual([
      { jsonrpc: '2.0', id: 1, result: { a: 1 } },
      { jsonrpc: '2.0', id: 1, result: { a: 2 } },
    ]);
  });

  test('id null is a response-bearing request and missing id is notification', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { ok: true }, id: null },
        { jsonrpc: '2.0', method: 'echo', params: { ok: true } },
      ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { jsonrpc: '2.0', id: null, result: { ok: true } },
    ]);
  });

  test('batch with only notifications returns 204', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { ok: true } },
        { jsonrpc: '2.0', method: 'echo', params: { ok: false } },
      ]);
    expect(res.status).toBe(204);
  });

  test('deserializes params in batch using header', async () => {
    // send BigInt-like strings and let server handle them via batch
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

  test('rejects invalid id type in batch item', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: {}, id: { bad: true } },
      ]);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBeNull();
    expect(res.body[0].error.code).toBe(-32600);
    expect(res.body[0].error.message).toBe(
      "Invalid Request: 'id' must be a string, number, or null."
    );
    expect(res.body[0].error.data.batchIndex).toBe(0);
  });

  test('rejects invalid params type in batch item', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: 'bad', id: 1 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].error.code).toBe(-32600);
    expect(res.body[0].error.message).toBe(
      "Invalid Request: 'params' must be an object or array."
    );
  });

  test('applies schema validation in batch', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'strictNumber', params: { value: '1' }, id: 1 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].error.code).toBe(-32602);
    expect(res.body[0].error.data.validationErrors).toBeDefined();
    expect(res.body[0].error.data.batchIndex).toBe(0);
  });

  test('preserves domain error data in batch', async () => {
    const res = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'domainError', params: {}, id: 1 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body[0].error).toMatchObject({
      code: -32010,
      message: 'Domain failure',
      data: {
        reason: 'bad-domain',
        batchIndex: 0,
      },
    });
  });

  test('enforces strict safe mode in batch', async () => {
    const strictApp = express();
    strictApp.use(express.json());
    const strictRpc = new RpcEndpoint(strictApp, {}, {
      safeEnabled: true,
      strictMode: true,
    });
    strictRpc.addMethod('echo', (req, ctx, params) => params);

    const res = await request(strictApp)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: {}, id: 1 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body[0].error.code).toBe(-32600);
    expect(res.body[0].error.data.requiredHeader).toBe('X-RPC-Safe-Enabled');
    expect(res.body[0].error.data.batchIndex).toBe(0);
  });
});
