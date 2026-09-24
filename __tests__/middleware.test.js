const {
  MiddlewareManager,
  MemoryRateLimitStore,
  builtInMiddlewares,
} = require('../src/middleware');

describe('MiddlewareManager', () => {
  test('stops chain when middleware returns false', async () => {
    const mm = new MiddlewareManager();
    const calls = [];
    mm.use('beforeCall', async (ctx) => {
      calls.push('first');
      return { a: 1 };
    });
    mm.use('beforeCall', async (ctx) => {
      calls.push('second');
      return false; // stop chain
    });
    mm.use('beforeCall', async (ctx) => {
      calls.push('third'); // should not run
      return { b: 2 };
    });

    const result = await mm.execute('beforeCall', {});
    expect(calls).toEqual(['first', 'second']);
    // state from first preserved; false does not merge but stops further execution
    expect(result).toMatchObject({ a: 1 });
  });

  test('onError continues on middleware failure', async () => {
    const mm = new MiddlewareManager();
    const calls = [];
    mm.use('onError', async () => {
      calls.push('first');
      throw new Error('boom');
    });
    mm.use('onError', async () => {
      calls.push('second');
      return { handled: true };
    });

    const result = await mm.execute('onError', { error: new Error('orig') });
    expect(calls).toEqual(['first', 'second']);
    expect(result).toMatchObject({ handled: true });
  });
});

describe('rate limit stores', () => {
  test('uses the in-memory store by default', async () => {
    const store = new MemoryRateLimitStore();
    await expect(store.increment('client', 1000, 1000)).resolves.toBe(1);
    await expect(store.increment('client', 1000, 1500)).resolves.toBe(2);
    await expect(store.increment('client', 1000, 2501)).resolves.toBe(1);
  });

  test('accepts an asynchronous shared store implementation', async () => {
    const store = { increment: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2) };
    const middleware = builtInMiddlewares.rateLimit({ max: 1, store });
    const context = { req: { ip: '127.0.0.1' } };

    await expect(middleware(context)).resolves.toBe(context);
    await expect(middleware(context)).rejects.toMatchObject({ code: -32000 });
    expect(store.increment).toHaveBeenCalledTimes(2);
  });
});
