const { SchemaValidator, SchemaBuilder } = require('../src/validation');

describe('SchemaValidator', () => {
  test('validates object schema and removes additional when enabled', () => {
    const sv = new SchemaValidator({ removeAdditional: true });
    const schema = {
      type: 'object',
      properties: { a: { type: 'number' } },
      additionalProperties: false,
      required: ['a'],
    };
    const resOk = sv.validate({ a: 1, extra: 'x' }, schema);
    expect(resOk.valid).toBe(true);
    expect(resOk.data).toEqual({ a: 1 });

    const resKo = sv.validate({ extra: 'x' }, schema);
    expect(resKo.valid).toBe(false);
    expect(Array.isArray(resKo.errors)).toBe(true);
  });

  test('custom format bigint accepts 123n and rejects alpha', () => {
    const sv = new SchemaValidator();
    const schema = { type: 'string', format: 'bigint' };
    expect(sv.validate('123n', schema).valid).toBe(true);
    expect(sv.validate('-42n', schema).valid).toBe(true);
    expect(sv.validate('abc', schema).valid).toBe(false);
  });

  test('middleware throws detailed error on validation failure', async () => {
    const sv = new SchemaValidator();
    const schema = {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
      required: ['email'],
      additionalProperties: false,
    };
    const mw = sv.middleware(schema);
    await expect(
      mw({ params: { email: 'not-an-email' } })
    ).rejects.toHaveProperty('code', -32602);
  });
});

describe('SchemaBuilder', () => {
  test('builds schema with properties and required', () => {
    const sb = new SchemaBuilder();
    const schema = sb
      .property('id', { type: 'string' }, true)
      .property('age', { type: 'integer' })
      .additionalProperties(false)
      .build();

    expect(schema).toEqual({
      type: 'object',
      properties: { id: { type: 'string' }, age: { type: 'integer' } },
      required: ['id'],
      additionalProperties: false,
    });
  });
});

