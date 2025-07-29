const express = require('express');
const request = require('supertest');
const { RpcEndpoint, RpcClient } = require('../src/index');

describe('RpcEndpoint', () => {
  let app;
  let rpc;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console.error per evitare output durante i test
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    app = express();
    app.use(express.json());
    
    const context = { user: 'test-user' };
    // Disable safe options for backward compatibility in tests
    rpc = new RpcEndpoint(app, context, {
      safeStringEnabled: false,
      safeDateEnabled: false
    });
  });

  afterEach(() => {
    // Ripristina console.error dopo ogni test
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create an instance with default endpoint', () => {
      expect(rpc.endpoint).toBe('/api');
    });

    it('should create an instance with custom endpoint', () => {
      const customRpc = new RpcEndpoint(app, {}, '/custom');
      expect(customRpc.endpoint).toBe('/custom');
    });
  });

  describe('addMethod', () => {
    it('should add a method to the methods object', () => {
      const handler = jest.fn();
      rpc.addMethod('testMethod', handler);
      
      expect(rpc.methods.testMethod).toBe(handler);
    });
  });

  describe('JSON-RPC 2.0 protocol', () => {
    beforeEach(() => {
      rpc.addMethod('greet', (req, ctx, params) => {
        return `Hello, ${params.name}!`;
      });

      rpc.addMethod('getContextUser', (req, ctx) => {
        return ctx.user;
      });

      rpc.addMethod('throwError', () => {
        throw new Error('Test error');
      });
    });

    it('should handle valid JSON-RPC 2.0 request', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: 'greet',
          params: { name: 'World' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'Hello, World!',
      });
    });

    it('should return error for invalid jsonrpc version', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '1.0',
          method: 'greet',
          params: { name: 'World' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: "Invalid Request: 'jsonrpc' must be '2.0'.",
        },
      });
    });

    it('should return error for invalid method type', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: 123,
          params: { name: 'World' },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: "Invalid Request: 'method' must be a string.",
        },
      });
    });

    it('should return error for method not found', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: 'nonexistent',
          params: {},
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method "nonexistent" not found',
        },
      });
    });

    it('should pass context to method handlers', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: 'getContextUser',
          params: {},
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'test-user',
      });
    });

    it('should handle method errors gracefully', async () => {
      const response = await request(app)
        .post('/api')
        .send({
          jsonrpc: '2.0',
          method: 'throwError',
          params: {},
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(1);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toBe('Test error');
    });
  });

  describe('serializeBigIntsAndDates', () => {
    it('should serialize BigInt to string', () => {
      const result = rpc.serializeBigIntsAndDates(123n);
      expect(result).toBe('123n');
    });

    it('should serialize strings without prefix when safeStringEnabled is false', () => {
      const result = rpc.serializeBigIntsAndDates('test string');
      expect(result).toBe('test string');
    });

    it('should serialize Date to ISO string without prefix when safeDateEnabled is false', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const result = rpc.serializeBigIntsAndDates(date);
      expect(result).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should serialize nested objects', () => {
      const obj = {
        bigint: 456n,
        date: new Date('2023-01-01T00:00:00.000Z'),
        nested: {
          bigint: 789n,
        },
      };
      const result = rpc.serializeBigIntsAndDates(obj);
      expect(result).toEqual({
        bigint: '456n',
        date: '2023-01-01T00:00:00.000Z',
        nested: {
          bigint: '789n',
        },
      });
    });
  });

  describe('deserializeBigIntsAndDates', () => {
    it('should deserialize string to BigInt', () => {
      const result = rpc.deserializeBigIntsAndDates('123n');
      expect(result).toBe(123n);
    });

    it('should deserialize string without prefix when safeStringEnabled is false', () => {
      const result = rpc.deserializeBigIntsAndDates('2023-01-01T00:00:00.000Z');
      expect(result).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });

    it('should deserialize nested objects', () => {
      const obj = {
        bigint: '456n',
        date: '2023-01-01T00:00:00.000Z',
        nested: {
          bigint: '789n',
        },
      };
      const result = rpc.deserializeBigIntsAndDates(obj);
      expect(result).toEqual({
        bigint: 456n,
        date: new Date('2023-01-01T00:00:00.000Z'),
        nested: {
          bigint: 789n,
        },
      });
    });
  });

  describe('RpcClient', () => {
    let app;
    let rpc;
    let server;
    let client;
    let serverUrl;

    beforeAll(done => {
      app = express();
      app.use(express.json());
      
      const context = { testData: new Map() };
      // Disable safe options for backward compatibility in tests
      rpc = new RpcEndpoint(app, context, {
        safeStringEnabled: false,
        safeDateEnabled: false
      });
      
      rpc.addMethod('echo', (req, ctx, params) => params);
      rpc.addMethod('add', (req, ctx, params) => params.a + params.b);
      rpc.addMethod('saveData', (req, ctx, params) => {
        ctx.testData.set(params.key, params.value);
        return { success: true };
      });
      rpc.addMethod('getData', (req, ctx, params) => {
        const value = ctx.testData.get(params.key);
        if (value === undefined) throw new Error('Key not found');
        return { key: params.key, value };
      });
      rpc.addMethod('testBigInt', (req, ctx, params) => {
        let number = params.number;
        if (typeof number === 'string' && number.endsWith('n')) {
          number = BigInt(number.slice(0, -1));
        } else if (typeof number === 'string') {
          number = BigInt(number);
        }
        return {
          bigint: number,
          date: new Date('2023-01-01T00:00:00.000Z')
        };
      });
      
      server = app.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://localhost:${port}/api`;
        client = new RpcClient(serverUrl, {}, {
          safeStringEnabled: false,
          safeDateEnabled: false
        });
        done();
      });
    });

    afterAll(done => {
      server.close(done);
    });

    describe('basic functionality', () => {
      it('should make a simple RPC call', async () => {
        const result = await client.call('echo', { message: 'Hello World' });
        expect(result).toEqual({ message: 'Hello World' });
      });

      it('should handle mathematical operations', async () => {
        const result = await client.call('add', { a: 5, b: 3 });
        expect(result).toBe(8);
      });

      it('should handle data storage and retrieval', async () => {
        await client.call('saveData', { key: 'test', value: 'test value' });
        const result = await client.call('getData', { key: 'test' });
        expect(result).toEqual({ key: 'test', value: 'test value' });
      });
    });

    describe('BigInt and Date handling', () => {
      it('should serialize and deserialize BigInt correctly', async () => {
        const result = await client.call('testBigInt', { number: '123456789012345678901234567890n' });
        expect(typeof result.bigint).toBe('bigint');
        expect(result.bigint.toString()).toBe('123456789012345678901234567890');
      });

      it('should serialize and deserialize Date correctly', async () => {
        const result = await client.call('testBigInt', { number: '123' });
        expect(result.date instanceof Date).toBe(true);
        expect(result.date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
      });
    });

    describe('enhanced BigInt and Date handling', () => {
      it('should handle negative BigInt correctly', async () => {
        rpc.addMethod('testNegativeBigInt', (req, ctx, params) => {
          let number = params.number;
          if (typeof number === 'string' && number.endsWith('n')) {
            number = BigInt(number.slice(0, -1));
          } else if (typeof number === 'string') {
            number = BigInt(number);
          }
          return {
            negative: -number,
            positive: number
          };
        });

        const result = await client.call('testNegativeBigInt', { number: '123456789012345678901234567890n' });
        expect(typeof result.negative).toBe('bigint');
        expect(typeof result.positive).toBe('bigint');
        expect(result.negative < 0n).toBe(true);
        expect(result.positive > 0n).toBe(true);
        expect(result.negative.toString()).toMatch(/^-\d+$/);
        expect(result.positive.toString()).toMatch(/^\d+$/);
      });

      it('should handle dates with timezone', async () => {
        rpc.addMethod('testDateWithTimezone', (req, ctx, params) => ({
          utcDate: new Date('2023-01-01T12:00:00.000Z'),
          localDate: new Date('2023-01-01T12:00:00.000'),
          timezoneDate: new Date('2023-01-01T12:00:00.000+01:00')
        }));

        const result = await client.call('testDateWithTimezone', {});
        expect(result.utcDate instanceof Date).toBe(true);
        expect(result.localDate instanceof Date).toBe(true);
        expect(result.timezoneDate instanceof Date).toBe(true);
      });

      it('should handle mixed BigInt and Date in complex objects', async () => {
        rpc.addMethod('testComplexObject', (req, ctx, params) => {
          let id = params.id;
          let balance = params.balance;
          
          if (typeof id === 'string' && id.endsWith('n')) {
            id = BigInt(id.slice(0, -1));
          } else if (typeof id === 'string') {
            id = BigInt(id);
          }
          
          if (typeof balance === 'string' && balance.endsWith('n')) {
            balance = BigInt(balance.slice(0, -1));
          } else if (typeof balance === 'string') {
            balance = BigInt(balance);
          }
          
          return {
            data: {
              id: id,
              balance: -balance,
              created: new Date('2023-01-01T12:00:00.000Z'),
              updated: new Date('2023-01-01T12:00:00.000+01:00'),
              tags: [
                { name: 'tag1', count: BigInt(10) },
                { name: 'tag2', count: BigInt(-5) }
              ]
            }
          };
        });

        const result = await client.call('testComplexObject', { 
          id: '999999999999999999999999999999n',
          balance: '123456789012345678901234567890n'
        });
        
        expect(typeof result.data.id).toBe('bigint');
        expect(typeof result.data.balance).toBe('bigint');
        expect(result.data.created instanceof Date).toBe(true);
        expect(result.data.updated instanceof Date).toBe(true);
        expect(typeof result.data.tags[0].count).toBe('bigint');
        expect(typeof result.data.tags[1].count).toBe('bigint');
        expect(result.data.balance < 0n).toBe(true);
        expect(result.data.balance.toString()).toMatch(/^-\d+$/);
      });
    });

    describe('error handling', () => {
      it('should handle server errors gracefully', async () => {
        try {
          await client.call('getData', { key: 'nonexistent' });
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toBe('Key not found');
        }
      });

      it('should handle method not found errors', async () => {
        try {
          await client.call('nonexistentMethod', {});
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toBe('Method "nonexistentMethod" not found');
        }
      });
    });

    describe('custom headers', () => {
      it('should allow custom headers', async () => {
        const customClient = new RpcClient(serverUrl, { 
          'X-Custom-Header': 'test-value' 
        }, {
          safeStringEnabled: false,
          safeDateEnabled: false
        });
        const result = await customClient.call('echo', { message: 'with headers' });
        expect(result).toEqual({ message: 'with headers' });
      });
    });
  });

});
