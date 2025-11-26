/**
 * Introspection Methods Tests
 * Tests for __rpc.* introspection methods
 */

const express = require('express');
const request = require('supertest');
const { RpcEndpoint } = require('../src/index');

describe('Introspection Methods', () => {
  let app;
  let rpc;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const context = { database: 'test-db' };

    // Create endpoint with introspection enabled
    rpc = new RpcEndpoint(app, context, {
      endpoint: '/api',
      enableIntrospection: true,
    });

    // Register public method with schema
    rpc.addMethod(
      'add',
      async (req, ctx, params) => {
        return params.a + params.b;
      },
      {
        schema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
        },
        exposeSchema: true,
        description: 'Add two numbers',
      }
    );

    // Register public method without schema
    rpc.addMethod(
      'echo',
      async (req, ctx, params) => {
        return params;
      },
      {
        exposeSchema: true,
        description: 'Echo back parameters',
      }
    );

    // Register private method (schema not exposed)
    rpc.addMethod(
      'internalCalc',
      async (req, ctx, params) => {
        return params.value * 2;
      },
      {
        schema: {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
          required: ['value'],
        },
        exposeSchema: false,
        description: 'Internal calculation',
      }
    );

    // Register method without description
    rpc.addMethod('simple', async (req, ctx, params) => {
      return 'ok';
    });
  });

  describe('__rpc.listMethods', () => {
    it('should list all user methods (excluding __rpc.* methods)', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.listMethods',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(1);
      expect(response.body.result).toEqual(
        expect.arrayContaining(['add', 'echo', 'internalCalc', 'simple'])
      );
      expect(response.body.result).not.toContain('__rpc.listMethods');
      expect(response.body.result).not.toContain('__rpc.describe');
    });
  });

  describe('__rpc.describe', () => {
    it('should describe a public method with schema', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: { method: 'add' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(1);
      expect(response.body.result).toMatchObject({
        name: 'add',
        description: 'Add two numbers',
        schema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
        },
      });
    });

    it('should describe a public method without schema', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: { method: 'echo' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({
        name: 'echo',
        description: 'Echo back parameters',
        schema: null,
      });
    });

    it('should reject describe request for private method', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: { method: 'internalCalc' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601);
      expect(response.body.error.message).toContain('schema not available');
    });

    it('should reject describe request for non-existent method', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: { method: 'nonExistent' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601);
      expect(response.body.error.message).toContain('not found');
    });

    it('should reject describe request for __rpc.* methods', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: { method: '__rpc.listMethods' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601);
      expect(response.body.error.message).toContain(
        'Cannot describe introspection methods'
      );
    });

    it('should reject describe request without method parameter', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describe',
          params: {},
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('Validation failed');
    });
  });

  describe('__rpc.describeAll', () => {
    it('should list all methods with public schemas', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.describeAll',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'add',
            description: 'Add two numbers',
            schema: expect.any(Object),
          }),
          expect.objectContaining({
            name: 'echo',
            description: 'Echo back parameters',
            schema: null,
          }),
        ])
      );

      // Should not include private methods
      const privateMethod = response.body.result.find(
        (m) => m.name === 'internalCalc'
      );
      expect(privateMethod).toBeUndefined();

      // Should not include methods without exposeSchema
      const simpleMethod = response.body.result.find(
        (m) => m.name === 'simple'
      );
      expect(simpleMethod).toBeUndefined();
    });
  });

  describe('__rpc.version', () => {
    it('should return version information', async () => {
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
        version: expect.any(String),
        expressVersion: expect.any(String),
        nodeVersion: expect.any(String),
      });
      expect(response.body.result.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('__rpc.capabilities', () => {
    it('should return server capabilities', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.capabilities',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({
        safeMode: false,
        batch: true,
        introspection: true,
        introspectionPrefix: '__rpc',
        validation: false,
        cors: false,
        auth: false,
        rateLimit: false,
        methodCount: 4, // add, echo, internalCalc, simple
      });
    });
  });

  describe('Custom introspection prefix', () => {
    it('should work with custom prefix', async () => {
      const app2 = express();
      app2.use(express.json());

      const rpc2 = new RpcEndpoint(app2, {}, {
        endpoint: '/api',
        enableIntrospection: true,
        introspectionPrefix: '_meta',
      });

      rpc2.addMethod('test', async () => 'ok', {
        exposeSchema: true,
        description: 'Test method',
      });

      const response = await request(app2)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '_meta.listMethods',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toContain('test');
      expect(response.body.result).not.toContain('_meta.listMethods');
    });
  });

  describe('Introspection disabled', () => {
    it('should not register __rpc.* methods when introspection is disabled', async () => {
      const app2 = express();
      app2.use(express.json());

      const rpc2 = new RpcEndpoint(app2, {}, {
        endpoint: '/api',
        enableIntrospection: false, // Disabled
      });

      rpc2.addMethod('test', async () => 'ok');

      const response = await request(app2)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: '__rpc.listMethods',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601);
      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('Reserved namespace protection', () => {
    it('should prevent users from registering __rpc.* methods', () => {
      expect(() => {
        rpc.addMethod('__rpc.custom', async () => 'bad');
      }).toThrow(/reserved for RPC introspection/);
    });

    it('should allow users to register methods with other prefixes', () => {
      expect(() => {
        rpc.addMethod('_custom', async () => 'ok');
      }).not.toThrow();

      expect(() => {
        rpc.addMethod('rpc.method', async () => 'ok');
      }).not.toThrow();

      expect(() => {
        rpc.addMethod('__custom', async () => 'ok');
      }).not.toThrow();
    });
  });

  describe('Batch requests with introspection', () => {
    it('should handle introspection methods in batch requests', async () => {
      const response = await request(app)
        .post('/api')
        .send([
          {
            jsonrpc: '2.0',
            method: '__rpc.listMethods',
            id: 1,
          },
          {
            jsonrpc: '2.0',
            method: '__rpc.version',
            id: 2,
          },
          {
            jsonrpc: '2.0',
            method: 'add',
            params: { a: 1, b: 2 },
            id: 3,
          },
        ]);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);

      const listResult = response.body.find((r) => r.id === 1);
      expect(listResult).toBeDefined();
      expect(listResult.error).toBeUndefined();
      expect(listResult.result).toEqual(
        expect.arrayContaining(['add', 'echo', 'internalCalc', 'simple'])
      );

      const versionResult = response.body.find((r) => r.id === 2);
      expect(versionResult).toBeDefined();
      expect(versionResult.error).toBeUndefined();
      expect(versionResult.result.toolkit).toBe('rpc-express-toolkit');

      const addResult = response.body.find((r) => r.id === 3);
      expect(addResult.result).toBe(3);
    });
  });
});
