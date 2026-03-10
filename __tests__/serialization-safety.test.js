const express = require('express');
const { RpcEndpoint } = require('../src/index');

describe('Serialization safety', () => {
  let rpc;

  beforeEach(() => {
    const app = express();
    app.use(express.json());
    rpc = new RpcEndpoint(app, {}, { safeEnabled: true });
  });

  test('circular object fails safely during serialization', () => {
    const obj = { a: 1 };
    obj.self = obj;

    expect(() => rpc.serializeBigIntsAndDates(obj)).toThrow(
      'Circular reference detected during serialization'
    );
  });

  test('__proto__ key does not pollute object prototype during serialization', () => {
    const payload = { ['__proto__']: { polluted: true } };
    const result = rpc.serializeBigIntsAndDates(payload);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined();
    expect(result.__proto__).toEqual({ polluted: true });
  });

  test('safe mode remains symmetric for protected prefixes', () => {
    const value = 'S:123n';
    const serialized = rpc.serializeBigIntsAndDates(value);
    const deserialized = rpc.deserializeBigIntsAndDates(serialized, {
      safeEnabled: true,
    });

    expect(serialized).toBe('S:S:123n');
    expect(deserialized).toBe('S:123n');
  });
});
