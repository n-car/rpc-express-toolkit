const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

const internalResponse = { code: -32603, message: 'Internal error' };

function unexpectedError(code) {
  const error = new Error('Synthetic failure in /private/example/config');
  if (code !== undefined) error.code = code;
  error.data = { credential: 'synthetic-secret' };
  error.cause = new Error('Synthetic inner failure');
  return error;
}

function setup(options = {}) {
  const app = express();
  app.use(express.json());
  const rpc = new RpcEndpoint(
    app,
    { actor: 'trusted' },
    {
      logging: { enabled: false },
      timing: false,
      ...options,
    }
  );
  rpc.addMethod('echo', (_req, context, params) => ({ context, params }));
  return { app, rpc };
}

function call(app, method = 'fail', batch = false) {
  const payload = { jsonrpc: '2.0', id: 1, method, params: {} };
  return request(app)
    .post('/api')
    .send(batch ? [payload] : payload);
}

describe('RPC error sanitization', () => {
  test.each([null, undefined, 'Synthetic private failure', false, 0])(
    'handles thrown primitive %s without exposing framework errors',
    async (value) => {
      const { app, rpc } = setup();
      rpc.addMethod('fail', () => {
        throw value;
      });
      expect((await call(app)).body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: internalResponse,
      });
      expect((await call(app, 'fail', true)).body).toEqual([
        { jsonrpc: '2.0', id: 1, error: internalResponse },
      ]);
    }
  );

  test.each([undefined, -32603, 'ENOENT', '-32001', NaN, Infinity, 2 ** 53])(
    'hides unexpected errors with code %s in single and batch calls',
    async (code) => {
      const { app, rpc } = setup();
      rpc.addMethod('fail', () => {
        throw unexpectedError(code);
      });

      const single = await call(app);
      const batch = await call(app, 'fail', true);
      expect(single.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: internalResponse,
      });
      expect(batch.body).toEqual([
        { jsonrpc: '2.0', id: 1, error: internalResponse },
      ]);
    }
  );

  test('does not inspect or serialize internal error data', async () => {
    const { app, rpc } = setup();
    const error = unexpectedError();
    error.data.self = error.data;
    rpc.addMethod('fail', () => {
      throw error;
    });

    expect((await call(app)).body.error).toEqual(internalResponse);
    expect((await call(app, 'fail', true)).body[0].error).toEqual(
      internalResponse
    );
  });

  test.each(['beforeCall', 'beforeValidation', 'afterValidation', 'afterCall'])(
    'sanitizes unexpected %s middleware errors',
    async (hook) => {
      const { app, rpc } = setup();
      rpc.addMethod('validated', (_req, _ctx, params) => params, {
        type: 'object',
      });
      rpc.use(hook, () => {
        throw unexpectedError();
      });

      expect((await call(app, 'validated')).body.error).toEqual(
        internalResponse
      );
      expect((await call(app, 'validated', true)).body[0].error).toEqual(
        internalResponse
      );
    }
  );

  test.each([-32001, -32602, 0])(
    'preserves application code %s, message and data',
    async (code) => {
      const { app, rpc } = setup();
      rpc.addMethod('fail', () => {
        const error = new Error('Public application failure');
        error.code = code;
        error.data = { reason: 'public-reason' };
        error.cause = unexpectedError();
        throw error;
      });

      expect((await call(app)).body.error).toEqual({
        code,
        message: 'Public application failure',
        data: { reason: 'public-reason' },
      });
      expect((await call(app, 'fail', true)).body[0].error).toEqual({
        code,
        message: 'Public application failure',
        data: { reason: 'public-reason', batchIndex: 0 },
      });
    }
  );

  test('preserves intentional authorization errors from middleware', async () => {
    const { app, rpc } = setup({ auth: () => false });
    expect((await call(app, 'echo')).body.error).toEqual({
      code: -32001,
      message: 'Authentication required',
    });
    expect((await call(app, 'echo', true)).body[0].error).toEqual({
      code: -32001,
      message: 'Authentication required',
      data: { batchIndex: 0 },
    });
  });

  test('sanitizes the outer endpoint error path', async () => {
    const { app, rpc } = setup();
    jest.spyOn(rpc.logger, 'rpcCall').mockImplementation(() => {
      throw unexpectedError();
    });
    expect((await call(app, 'echo')).body).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: internalResponse,
    });
  });

  test('handles a thrown null at the outer endpoint boundary', async () => {
    const { app, rpc } = setup();
    jest.spyOn(rpc.logger, 'rpcCall').mockImplementation(() => {
      throw null;
    });
    expect((await call(app, 'echo')).body).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: internalResponse,
    });
  });

  test('does not expose a secondary onError middleware failure', async () => {
    const { app, rpc } = setup();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    rpc.use('onError', () => {
      throw unexpectedError();
    });
    rpc.addMethod('fail', () => {
      throw unexpectedError();
    });
    try {
      expect((await call(app)).body.error).toEqual(internalResponse);
      expect((await call(app, 'fail', true)).body[0].error).toEqual(
        internalResponse
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  test('sanitizes batch failures outside handler processing', async () => {
    const { app, rpc } = setup();
    jest.spyOn(rpc, 'deserializeBigIntsAndDates').mockImplementation(() => {
      throw unexpectedError();
    });
    expect((await call(app, 'echo', true)).body).toEqual([
      { jsonrpc: '2.0', id: 1, error: internalResponse },
    ]);
  });

  test('supports explicit debug opt-out for single and batch errors', async () => {
    const { app, rpc } = setup({ sanitizeErrors: false });
    rpc.addMethod('fail', () => {
      throw unexpectedError();
    });
    const single = (await call(app)).body.error;
    const batch = (await call(app, 'fail', true)).body[0].error;
    for (const error of [single, batch]) {
      expect(error.code).toBe(-32603);
      expect(error.message).toContain('/private/example/config');
      expect(error.data.credential).toBe('synthetic-secret');
      expect(error.error.stack).toContain('Synthetic failure');
    }
  });

  test('keeps notifications silent and successful calls unchanged in a mixed batch', async () => {
    const { app, rpc } = setup();
    rpc.addMethod('fail', () => {
      throw unexpectedError();
    });
    const response = await request(app)
      .post('/api')
      .send([
        { jsonrpc: '2.0', method: 'fail' },
        { jsonrpc: '2.0', method: 'fail', id: 1 },
        { jsonrpc: '2.0', method: 'echo', params: [1, 2], id: 2 },
      ]);
    expect(response.body).toEqual([
      { jsonrpc: '2.0', id: 1, error: internalResponse },
      {
        jsonrpc: '2.0',
        id: 2,
        result: { context: { actor: 'trusted' }, params: [1, 2] },
      },
    ]);
    expect(
      (await request(app).post('/api').send({ jsonrpc: '2.0', method: 'fail' }))
        .status
    ).toBe(204);
  });
});
