const { MiddlewareManager } = require('../src/middleware');

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

