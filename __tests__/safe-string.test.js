const request = require('supertest');
const express = require('express');
const { RpcEndpoint, RpcClient } = require('../src/index');

describe('SafeString Feature', () => {
  let app, server, client, serverUrl;
  let rpc;

  beforeAll(done => {
    app = express();
    app.use(express.json()); // CRITICAL: Add JSON middleware
    const router = express.Router();
    
    // Test with safeStringEnabled: true (default)
    rpc = new RpcEndpoint(router, {}, {
      safeStringEnabled: true
    });

    // Add test methods
    rpc.addMethod('echoString', (req, ctx, params) => ({
      value: params.value,
      type: typeof params.value
    }));

    rpc.addMethod('echoBigInt', (req, ctx, params) => ({
      value: params.value,
      type: typeof params.value
    }));

    rpc.addMethod('echoDate', (req, ctx, params) => ({
      value: params.value,
      type: typeof params.value,
      isDate: params.value instanceof Date
    }));

    rpc.addMethod('echoMixed', (req, ctx, params) => ({
      stringValue: params.stringValue,
      bigintValue: params.bigintValue,
      dateValue: params.dateValue,
      stringType: typeof params.stringValue,
      bigintType: typeof params.bigintValue,
      dateType: typeof params.dateValue
    }));

    app.use(router);
    
    server = app.listen(0, () => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}/api`;
      client = new RpcClient(serverUrl, {}, { safeStringEnabled: true });
      done();
    });
  });

  afterAll(done => {
    server.close(done);
  });

  describe('with safeStringEnabled: true', () => {
    it('should preserve strings with leading zeros', async () => {
      const result = await client.call('echoString', { value: '0123456' });
      expect(result.value).toBe('0123456');
      expect(result.type).toBe('string');
    });

    it('should preserve strings ending with n', async () => {
      const result = await client.call('echoString', { value: '012312031203120301230123123n' });
      expect(result.value).toBe('012312031203120301230123123n');
      expect(result.type).toBe('string');
    });

    it('should handle BigInt correctly', async () => {
      const result = await client.call('echoBigInt', { value: 123456789012345678901234567890n });
      expect(typeof result.value).toBe('bigint');
      expect(result.value.toString()).toBe('123456789012345678901234567890');
      expect(result.type).toBe('bigint');
    });

    it('should handle Date correctly', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z');
      const result = await client.call('echoDate', { value: testDate });
      expect(result.value instanceof Date).toBe(true);
      expect(result.value.toISOString()).toBe('2023-01-01T12:00:00.000Z');
      expect(result.type).toBe('object');
      expect(result.isDate).toBe(true);
    });

    it('should handle mixed string, BigInt and Date in same call', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z');
      const result = await client.call('echoMixed', { 
        stringValue: '0123456n',
        bigintValue: 123456789012345678901234567890n,
        dateValue: testDate
      });
      
      expect(result.stringValue).toBe('0123456n');
      expect(result.stringType).toBe('string');
      expect(typeof result.bigintValue).toBe('bigint');
      expect(result.bigintType).toBe('bigint');
      expect(result.bigintValue.toString()).toBe('123456789012345678901234567890');
      expect(result.dateValue instanceof Date).toBe(true);
      expect(result.dateType).toBe('object');
      expect(result.dateValue.toISOString()).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should preserve ISO date strings when safeDateEnabled is true', async () => {
      const result = await client.call('echoString', { value: '2023-01-01T12:00:00.000Z' });
      expect(result.value).toBe('2023-01-01T12:00:00.000Z');
      expect(result.type).toBe('string');
    });

    it('should handle empty string', async () => {
      const result = await client.call('echoString', { value: '' });
      expect(result.value).toBe('');
      expect(result.type).toBe('string');
    });

    it('should handle string with only n', async () => {
      const result = await client.call('echoString', { value: 'n' });
      expect(result.value).toBe('n');
      expect(result.type).toBe('string');
    });
  });
});

describe('SafeString Feature Disabled', () => {
  let app, server, client, serverUrl;
  let rpc;
  let consoleSpy;

  beforeAll(done => {
    app = express();
    app.use(express.json()); // CRITICAL: Add JSON middleware
    const router = express.Router();
    
    // Test with safeStringEnabled: false and safeDateEnabled: false
    rpc = new RpcEndpoint(router, {}, {
      safeStringEnabled: false,
      safeDateEnabled: false
      // Use default logging configuration to enable warnings
    });

    // Spy on console.warn to catch warnings
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Add test methods
    rpc.addMethod('echoWithBigInt', (req, ctx, params) => ({
      bigintValue: BigInt('123456789012345678901234567890'),
      stringValue: params.stringValue
    }));

    rpc.addMethod('echoWithDate', (req, ctx, params) => ({
      dateValue: new Date('2023-01-01T12:00:00.000Z'),
      stringValue: params.stringValue
    }));

    app.use(router);
    
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
    consoleSpy.mockRestore();
    server.close(done);
  });

  describe('with safeStringEnabled: false and safeDateEnabled: false', () => {
    it('should warn when BigInt is serialized', async () => {
      await client.call('echoWithBigInt', { stringValue: '0123456' });
      
      // Check if warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BigInt detected in serialization')
      );
    });

    it('should warn when Date is serialized', async () => {
      await client.call('echoWithDate', { stringValue: '0123456' });
      
      // Check if warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Date detected in serialization')
      );
    });

    it('should still handle strings and BigInt correctly', async () => {
      const result = await client.call('echoWithBigInt', { stringValue: '0123456' });
      
      expect(result.stringValue).toBe('0123456');
      expect(typeof result.bigintValue).toBe('bigint');
      expect(result.bigintValue.toString()).toBe('123456789012345678901234567890');
    });

    it('should still handle strings and Date correctly', async () => {
      const result = await client.call('echoWithDate', { stringValue: '0123456' });
      
      expect(result.stringValue).toBe('0123456');
      expect(result.dateValue instanceof Date).toBe(true);
      expect(result.dateValue.toISOString()).toBe('2023-01-01T12:00:00.000Z');
    });
  });
});
