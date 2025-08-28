const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Endpoint compatibility and endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('strictMode with safeEnabled requires header', async () => {
    const rpc = new RpcEndpoint(app, {}, { safeEnabled: true, strictMode: true });
    rpc.addMethod('ping', () => 'pong');

    const res = await request(app)
      .post('/api')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32600);
    expect(res.body.error.data.requiredHeader).toBe('X-RPC-Safe-Enabled');
  });

  test('health and metrics endpoints', async () => {
    const rpc = new RpcEndpoint(app, {}, { metrics: true });
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(typeof health.body.version).toBe('string');

    const metrics = await request(app).get('/api/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.body).toHaveProperty('methods');
    expect(metrics.body).toHaveProperty('middleware');
  });
});

