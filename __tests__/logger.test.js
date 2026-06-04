const Logger = require('../src/logger');

describe('Logger utility helpers', () => {
  let originalConsole;
  let logger;

  beforeEach(() => {
    originalConsole = { ...console };
    console.info = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    logger = new Logger({ level: 'info' });
  });

  afterEach(() => {
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
  });

  test('sanitizeParams redacts sensitive keys recursively', () => {
    const input = {
      a: 1,
      password: 'x',
      nested: { token: 'y', cookie: 'z' },
    };
    const out = logger.sanitizeParams(input);
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.nested.cookie).toBe('[REDACTED]');
  });

  test('safeStringify handles BigInt and Date', () => {
    const str = logger.safeStringify({ n: 10n, d: new Date('2023-01-01T00:00:00.000Z') });
    expect(str).toContain('"n":"10n"');
    expect(str).toContain('"d":"2023-01-01T00:00:00.000Z"');
  });

  test('safeStringify handles circular structures', () => {
    const input = { ok: true };
    input.self = input;

    const str = logger.safeStringify(input);

    expect(str).toContain('"self":"[Circular]"');
  });

  test('sanitizeParams handles circular structures', () => {
    const input = { sessionToken: 'secret' };
    input.self = input;

    const out = logger.sanitizeParams(input);

    expect(out.sessionToken).toBe('[REDACTED]');
    expect(out.self).toBe('[Circular]');
  });

  test('rpc logging methods call console', () => {
    logger.rpcCall('m', { a: 1 }, 1, { headers: { 'user-agent': 'x' }, ip: '::1' });
    expect(console.info).toHaveBeenCalled();
    logger.rpcSuccess('m', 1, 5, { ok: true });
    expect(console.info).toHaveBeenCalled();
    logger.rpcError('m', 1, 5, new Error('x'));
    expect(console.error).toHaveBeenCalled();
  });

  test('rpcError omits stack at info level', () => {
    logger.rpcError('m', 1, 5, new Error('x'));

    expect(console.error.mock.calls[0][0]).not.toContain('stack');
  });

  test('rpcError includes stack at debug level', () => {
    logger = new Logger({ level: 'debug' });

    logger.rpcError('m', 1, 5, new Error('x'));

    expect(console.error.mock.calls[0][0]).toContain('stack');
  });
});
