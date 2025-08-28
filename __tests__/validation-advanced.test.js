const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Validation advanced behaviors', () => {
  test('removeAdditional removes unknown props when enabled', async () => {
    const app = express();
    app.use(express.json());
    const rpc = new RpcEndpoint(app, {}, {
      endpoint: '/api-ra',
      validation: { removeAdditional: true },
      safeEnabled: false,
    });

    rpc.addMethod('sanitize', {
      handler: (req, ctx, params) => params,
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
        },
        additionalProperties: false,
        required: ['a'],
      },
    });

    const res = await request(app)
      .post('/api-ra')
      .send({ jsonrpc: '2.0', method: 'sanitize', id: 1, params: { a: 1, extra: 'x' } });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ a: 1 });
  });
});

