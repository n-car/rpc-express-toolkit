const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Protocol correctness and pipeline parity', () => {
  let app;
  let rpc;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    rpc = new RpcEndpoint(app, {}, { safeEnabled: true, strictMode: true });

    rpc.addMethod('echo', (req, ctx, params) => params);
    rpc.addMethod(
      'schemaMethod',
      (req, ctx, params) => params,
      {
        type: 'object',
        properties: {
          a: { type: 'number' },
        },
        required: ['a'],
      }
    );
    rpc.addMethod('domainError', () => {
      const err = new Error('domain failure');
      err.code = 4001;
      err.data = { domain: true };
      throw err;
    });
  });

  test('single notification produces no response body', async () => {
    const res = await request(app).post('/api').send({
      jsonrpc: '2.0',
      method: 'echo',
      params: { ok: true },
    });

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  test('batch with id:null request still responds while notification does not', async () => {
    const res = await request(app)
      .post('/api')
      .set('X-RPC-Safe-Enabled', 'true')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { ok: true }, id: null },
        { jsonrpc: '2.0', method: 'echo', params: { ok: true } },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { jsonrpc: '2.0', id: null, result: { ok: true } },
    ]);
  });

  test('invalid id type returns -32600', async () => {
    const res = await request(app).post('/api').send({
      jsonrpc: '2.0',
      method: 'echo',
      params: { ok: true },
      id: { bad: true },
    });

    expect(res.body.error.code).toBe(-32600);
  });

  test('invalid params envelope type returns -32600', async () => {
    const res = await request(app).post('/api').send({
      jsonrpc: '2.0',
      method: 'echo',
      params: 'invalid',
      id: 1,
    });

    expect(res.body.error.code).toBe(-32600);
  });

  test('batch schema validation parity with single path', async () => {
    const res = await request(app)
      .post('/api')
      .set('X-RPC-Safe-Enabled', 'true')
      .send([
        { jsonrpc: '2.0', method: 'schemaMethod', params: { a: 'x' }, id: 1 },
      ]);

    expect(res.body[0].error.code).toBe(-32602);
  });

  test('batch strict safe-mode parity with single path', async () => {
    const res = await request(app).post('/api').send([
      { jsonrpc: '2.0', method: 'echo', params: { ok: true }, id: 1 },
    ]);

    expect(res.body[0].error.code).toBe(-32600);
    expect(res.body[0].error.message).toContain('RPC Compatibility Error');
  });

  test('batch preserves error data with batchIndex', async () => {
    const res = await request(app)
      .post('/api')
      .set('X-RPC-Safe-Enabled', 'true')
      .send([
        { jsonrpc: '2.0', method: 'domainError', id: 7 },
      ]);

    expect(res.body[0].error.data).toMatchObject({ domain: true, batchIndex: 0 });
  });

  test('empty batch returns spec-correct invalid request error array', async () => {
    const res = await request(app).post('/api').send([]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].error.code).toBe(-32600);
  });

  test('duplicate ids are processed independently', async () => {
    const res = await request(app)
      .post('/api')
      .set('X-RPC-Safe-Enabled', 'true')
      .send([
        { jsonrpc: '2.0', method: 'echo', params: { a: 1 }, id: 1 },
        { jsonrpc: '2.0', method: 'echo', params: { a: 2 }, id: 1 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].result).toEqual({ a: 1 });
    expect(res.body[1].result).toEqual({ a: 2 });
  });
});
