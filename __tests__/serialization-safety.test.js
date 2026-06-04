const express = require('express');
const { RpcEndpoint } = require('../src/index');

describe('serialization safety', () => {
  let rpc;

  beforeEach(() => {
    const app = express();
    app.use(express.json());
    rpc = new RpcEndpoint(app, {}, { safeEnabled: false });
  });

  test('serializeBigIntsAndDates fails safely on circular objects', () => {
    const value = { ok: true };
    value.self = value;

    expect(() => rpc.serializeBigIntsAndDates(value)).toThrow(
      'Circular reference detected during serialization'
    );
  });

  test('deserializeBigIntsAndDates fails safely on circular objects', () => {
    const value = { ok: true };
    value.self = value;

    expect(() => rpc.deserializeBigIntsAndDates(value)).toThrow(
      'Circular reference detected during deserialization'
    );
  });

  test('serializeBigIntsAndDates enforces max depth', () => {
    const shallowRpc = new RpcEndpoint(express().use(express.json()), {}, {
      endpoint: '/depth-serialize',
      maxSerializationDepth: 1,
      safeEnabled: false,
    });

    expect(() =>
      shallowRpc.serializeBigIntsAndDates({ a: { b: { c: true } } })
    ).toThrow('Serialization depth limit exceeded');
  });

  test('deserializeBigIntsAndDates enforces max depth', () => {
    const shallowRpc = new RpcEndpoint(express().use(express.json()), {}, {
      endpoint: '/depth-deserialize',
      maxDeserializationDepth: 1,
      safeEnabled: false,
    });

    expect(() =>
      shallowRpc.deserializeBigIntsAndDates({ a: { b: { c: true } } })
    ).toThrow('Deserialization depth limit exceeded');
  });

  test('__proto__ key remains inert during serialization', () => {
    const value = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');

    const result = rpc.serializeBigIntsAndDates(value);

    expect(Object.prototype.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
      true
    );
    expect(result.__proto__).toEqual({ polluted: true });
  });

  test('__proto__ key remains inert during deserialization', () => {
    const value = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');

    const result = rpc.deserializeBigIntsAndDates(value);

    expect(Object.prototype.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
      true
    );
    expect(result.__proto__).toEqual({ polluted: true });
  });
});
