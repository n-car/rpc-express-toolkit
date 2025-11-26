const express = require('express');
const request = require('supertest');
const {
  RpcSafeEndpoint,
  RpcSafeClient,
  createSafeEndpoint,
  createSafeClient,
} = require('../src/safe');

describe('Safe Classes', () => {
  describe('RpcSafeEndpoint', () => {
    it('should create endpoint with safeEnabled by default', async () => {
      const app = express();
      app.use(express.json());
      const rpc = new RpcSafeEndpoint(app, {}, { endpoint: '/api' });

      rpc.addMethod('test', () => ({ value: 'test' }));

      const response = await request(app)
        .post('/api')
        .set('X-RPC-Safe-Enabled', 'true')
        .send({
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.headers['x-rpc-safe-enabled']).toBe('true');
      expect(response.body.result).toBeDefined();
      expect(response.body.result.value).toBe('S:test');
    });

    it('should allow overriding options', async () => {
      const app = express();
      app.use(express.json());
      const rpc = new RpcSafeEndpoint(
        app,
        {},
        {
          endpoint: '/api',
          safeEnabled: false,
        }
      );

      rpc.addMethod('test', () => ({ value: 'test' }));

      const response = await request(app).post('/api').send({
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      });

      expect(response.status).toBe(200);
      expect(response.headers['x-rpc-safe-enabled']).toBe('false');
      expect(response.body.result).toEqual({ value: 'test' });
    });
  });

  describe('RpcSafeClient', () => {
    let app;
    let server;
    let port;

    beforeAll((done) => {
      app = express();
      app.use(express.json());
      const rpc = new RpcSafeEndpoint(app, {}, { endpoint: '/api' });

      rpc.addMethod('echo', (req, ctx, params) => params);
      rpc.addMethod('getBigInt', () => ({
        value: 123456789012345678901234567890n,
      }));

      server = app.listen(0, () => {
        port = server.address().port;
        done();
      });
    });

    afterAll((done) => {
      server.close(done);
    });

    it('should send safe enabled header', async () => {
      const client = new RpcSafeClient(`http://localhost:${port}/api`);
      const result = await client.call('echo', { test: 'value' });
      expect(result).toEqual({ test: 'value' });
    });

    it('should deserialize BigInt correctly', async () => {
      const client = new RpcSafeClient(`http://localhost:${port}/api`);
      const result = await client.call('getBigInt', {});
      expect(result.value).toBe(123456789012345678901234567890n);
    });
  });

  describe('Deprecated factory functions', () => {
    it('createSafeEndpoint should work but show deprecation warning', () => {
      const app = express();
      app.use(express.json());
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const rpc = createSafeEndpoint(app, {}, { endpoint: '/api' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'createSafeEndpoint() is deprecated. Use `new RpcSafeEndpoint(...)` instead.'
      );
      expect(rpc).toBeDefined();

      consoleWarnSpy.mockRestore();
    });

    it('createSafeClient should work but show deprecation warning', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const client = createSafeClient('http://localhost:3000/api');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'createSafeClient() is deprecated. Use `new RpcSafeClient(...)` instead.'
      );
      expect(client).toBeDefined();

      consoleWarnSpy.mockRestore();
    });
  });
});
