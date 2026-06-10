const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

function createAppWithRpc(options = {}) {
  const app = express();
  app.use(express.json());
  const rpc = new RpcEndpoint(app, { appName: 'test' }, {
    safeEnabled: false,
    ...options,
  });

  return { app, rpc };
}

describe('authentication and method restrictions', () => {
  let consoleErrorSpy;
  let consoleInfoSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  test('allows authenticated calls with auth middleware', async () => {
    const { app, rpc } = createAppWithRpc({
      auth: async (req) => req.headers.authorization === 'Bearer secret-token',
    });

    rpc.addMethod('ping', () => 'pong');

    const response = await request(app)
      .post('/api')
      .set('Authorization', 'Bearer secret-token')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: 'pong',
    });
  });

  test('rejects unauthenticated calls with JSON-RPC -32001', async () => {
    const { app, rpc } = createAppWithRpc({
      auth: async (req) => req.headers.authorization === 'Bearer secret-token',
    });

    rpc.addMethod('ping', () => 'pong');

    const response = await request(app)
      .post('/api')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32001,
        message: 'Authentication required',
      },
    });
  });

  test('allows whitelisted methods', async () => {
    const { app, rpc } = createAppWithRpc({
      methodWhitelist: ['ping'],
    });

    rpc.addMethod('ping', () => 'pong');

    const response = await request(app)
      .post('/api')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: 'pong',
    });
  });

  test('rejects registered methods outside the whitelist', async () => {
    const { app, rpc } = createAppWithRpc({
      methodWhitelist: ['ping'],
    });

    rpc.addMethod('ping', () => 'pong');
    rpc.addMethod('admin.secret', () => 'secret');

    const response = await request(app)
      .post('/api')
      .send({ jsonrpc: '2.0', method: 'admin.secret', id: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32601,
        message: "Method 'admin.secret' is not allowed",
      },
    });
  });

  test('allows custom beforeCall middleware to reject admin methods', async () => {
    const { app, rpc } = createAppWithRpc();

    rpc.use('beforeCall', async (ctx) => {
      const user = ctx.req.headers.authorization === 'Bearer admin-token'
        ? { roles: ['admin'] }
        : { roles: ['user'] };

      if (ctx.method.startsWith('admin.') && !user.roles.includes('admin')) {
        const error = new Error('Forbidden');
        error.code = -32003;
        throw error;
      }

      return {
        ...ctx,
        user,
      };
    });

    rpc.addMethod('admin.secret', () => 'secret');

    const response = await request(app)
      .post('/api')
      .send({ jsonrpc: '2.0', method: 'admin.secret', id: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32003,
        message: 'Forbidden',
      },
    });
  });
});
