const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('String Coercion Tests', () => {
  let app;
  let rpc;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    const context = {};
    // Disable safe options for backward compatibility in tests
    rpc = new RpcEndpoint(app, context, {
      safeStringEnabled: false,
      safeDateEnabled: false
    });
  });

  test('should preserve leading zeros in string parameters without validation', async () => {
    // Method without schema validation
    rpc.addMethod('echoString', (req, ctx, params) => {
      return {
        received: params.value,
        type: typeof params.value
      };
    });

    const response = await request(app)
      .post('/api')
      .send({
        jsonrpc: '2.0',
        method: 'echoString',
        params: { value: '0123456' },
        id: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.result.received).toBe('0123456');
    expect(response.body.result.type).toBe('string');
  });

  test('should preserve leading zeros with strict string schema', async () => {
    // Method with string schema validation
    rpc.addMethod('echoStringWithSchema', {
      handler: (req, ctx, params) => {
        return {
          received: params.value,
          type: typeof params.value
        };
      },
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        },
        required: ['value'],
        additionalProperties: false
      }
    });

    const response = await request(app)
      .post('/api')
      .send({
        jsonrpc: '2.0',
        method: 'echoStringWithSchema',
        params: { value: '0123456' },
        id: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.result.received).toBe('0123456');
    expect(response.body.result.type).toBe('string');
  });

  test('should handle coercion with number schema', async () => {
    // Create RPC with coercion enabled
    const contextWithCoercion = {};
    const rpcWithCoercion = new RpcEndpoint(app, contextWithCoercion, {
      endpoint: '/api-coerce',
      validation: {
        coerceTypes: true
      },
      safeStringEnabled: false,
      safeDateEnabled: false
    });

    rpcWithCoercion.addMethod('coerceToNumber', {
      handler: (req, ctx, params) => {
        return {
          received: params.value,
          type: typeof params.value
        };
      },
      schema: {
        type: 'object',
        properties: {
          value: { type: 'number' }
        },
        required: ['value'],
        additionalProperties: false
      }
    });

    const response = await request(app)
      .post('/api-coerce')
      .send({
        jsonrpc: '2.0',
        method: 'coerceToNumber',
        params: { value: '0123456' },
        id: 1
      });

    expect(response.status).toBe(200);
    // With coercion, '0123456' becomes number 123456
    expect(response.body.result.received).toBe(123456);
    expect(response.body.result.type).toBe('number');
  });

  test('should preserve leading zeros without coercion', async () => {
    // Create RPC with coercion disabled
    const contextNoCoercion = {};
    const rpcNoCoercion = new RpcEndpoint(app, contextNoCoercion, {
      endpoint: '/api-no-coerce',
      validation: {
        coerceTypes: false
      },
      safeStringEnabled: false,
      safeDateEnabled: false
    });

    rpcNoCoercion.addMethod('strictString', {
      handler: (req, ctx, params) => {
        return {
          received: params.value,
          type: typeof params.value
        };
      },
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        },
        required: ['value'],
        additionalProperties: false
      }
    });

    const response = await request(app)
      .post('/api-no-coerce')
      .send({
        jsonrpc: '2.0',
        method: 'strictString',
        params: { value: '0123456' },
        id: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.result.received).toBe('0123456');
    expect(response.body.result.type).toBe('string');
  });

  test('should reject string when number expected without coercion', async () => {
    // Create RPC with coercion disabled
    const contextNoCoercion = {};
    const rpcNoCoercion = new RpcEndpoint(app, contextNoCoercion, {
      endpoint: '/api-strict',
      validation: {
        coerceTypes: false
      },
      safeStringEnabled: false,
      safeDateEnabled: false
    });

    rpcNoCoercion.addMethod('strictNumber', {
      handler: (req, ctx, params) => {
        return {
          received: params.value,
          type: typeof params.value
        };
      },
      schema: {
        type: 'object',
        properties: {
          value: { type: 'number' }
        },
        required: ['value'],
        additionalProperties: false
      }
    });

    const response = await request(app)
      .post('/api-strict')
      .send({
        jsonrpc: '2.0',
        method: 'strictNumber',
        params: { value: '0123456' },
        id: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe(-32602); // Invalid params
  });
});
