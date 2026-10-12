const { validateEnvelope } = require('../src/protocol');

test('invalid envelopes always use null id, including non-finite native ids', () => {
  const valid = { jsonrpc: '2.0', method: 'echo', id: 42 };
  for (const input of [
    null, [], {}, { ...valid, jsonrpc: '1.0' }, { ...valid, method: 42 },
    ...[null, true, 'bad', 42].map((params) => ({ ...valid, params })),
    ...[true, {}, [], NaN, Infinity, -Infinity].map((id) => ({ ...valid, id })),
  ]) {
    const response = validateEnvelope(input);
    expect(response.valid).toBe(false);
    expect(response.error.code).toBe(-32600);
    expect(response.responseId).toBeNull();
  }
});

test('id:null remains a request and only an absent id is a notification', () => {
  expect(validateEnvelope({ jsonrpc: '2.0', method: 'echo', id: null }).isNotification).toBe(false);
  expect(validateEnvelope({ jsonrpc: '2.0', method: 'echo' }).isNotification).toBe(true);
});
