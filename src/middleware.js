/**
 * @file Middleware Manager
 * @description Handles middleware execution for JSON-RPC requests including built-in middleware
 */

const MemoryRateLimitStore = require('./memory-rate-limit-store');

/**
 * Middleware manager for handling RPC middleware
 */
class MiddlewareManager {
  constructor() {
    this.middlewares = {
      beforeCall: [],
      afterCall: [],
      onError: [],
      beforeValidation: [],
      afterValidation: [],
    };
  }

  /**
   * Add middleware for a specific hook
   * @param {string} hook - The hook name (beforeCall, afterCall, onError, etc.)
   * @param {Function} middleware - The middleware function
   */
  use(hook, middleware) {
    if (!this.middlewares[hook]) {
      throw new Error(`Unknown middleware hook: ${hook}`);
    }

    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }

    this.middlewares[hook].push(middleware);
  }

  /**
   * Execute middlewares for a specific hook
   * @param {string} hook
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async execute(hook, context) {
    const middlewares = this.middlewares[hook] || [];
    const isErrorHook = hook === 'onError';

    const finalResult = await middlewares.reduce(
      (promise, middleware) =>
        promise.then(async (acc) => {
          // If a previous middleware requested stop, propagate without executing others
          if (acc && acc.__middlewareStopped) {
            return acc;
          }
          try {
            const middlewareResult = await middleware(acc);

            if (middlewareResult === false) {
              // Mark chain as stopped
              return { ...acc, __middlewareStopped: true };
            }

            // If middleware returns an object, merge it with context
            if (middlewareResult && typeof middlewareResult === 'object') {
              return { ...acc, ...middlewareResult };
            }

            return acc;
          } catch (error) {
            if (isErrorHook) {
              console.error('Error middleware failed:', error);
              return acc;
            }
            throw error;
          }
        }),
      Promise.resolve(context)
    );

    // Do not expose internal marker
    if (finalResult && finalResult.__middlewareStopped) {
      const rest = { ...finalResult };
      delete rest.__middlewareStopped;
      return rest;
    }
    return finalResult;
  }

  /**
   * Get all middlewares for a hook
   * @param {string} hook
   * @returns {Function[]}
   */
  getMiddlewares(hook) {
    return this.middlewares[hook] || [];
  }

  /**
   * Remove all middlewares for a hook
   * @param {string} hook
   */
  clear(hook) {
    if (hook) {
      this.middlewares[hook] = [];
    } else {
      // Clear all hooks
      Object.keys(this.middlewares).forEach((h) => {
        this.middlewares[h] = [];
      });
    }
  }

  /**
   * Remove a specific middleware from a hook
   * @param {string} hook
   * @param {Function} middleware
   */
  remove(hook, middleware) {
    if (!this.middlewares[hook]) return;

    const index = this.middlewares[hook].indexOf(middleware);
    if (index > -1) {
      this.middlewares[hook].splice(index, 1);
    }
  }
}

/**
 * Built-in middleware functions
 */
const builtInMiddlewares = {
  /**
   * Rate limiting middleware
   * @param {Object} options
   * @returns {Function}
   */
  rateLimit(options = {}) {
    const windowMs = options.windowMs || 60000; // 1 minute
    const max = options.max || 100; // 100 requests per window
    const message = options.message || 'Too many requests';

    const store = options.store || new MemoryRateLimitStore();

    if (!store || typeof store.increment !== 'function') {
      throw new TypeError(
        'Rate limit store must implement increment(key, windowMs, now)'
      );
    }

    return async (context) => {
      const { req } = context;
      const key = req.ip || req.connection?.remoteAddress || 'unknown';
      const now = Date.now();

      const requestCount = await store.increment(key, windowMs, now);

      if (requestCount > max) {
        const error = new Error(message);
        error.code = -32000; // Custom JSON-RPC error code
        throw error;
      }

      return context;
    };
  },

  /**
   * Authentication middleware
   * @param {Function} authFunction
   * @returns {Function}
   */
  auth(authFunction) {
    return async (context) => {
      const { req } = context;
      const authenticatedUser = await authFunction(req);

      if (!authenticatedUser) {
        const error = new Error('Authentication required');
        error.code = -32001;
        throw error;
      }

      return {
        ...context,
        authenticatedUser:
          authenticatedUser === true ? undefined : authenticatedUser,
      };
    };
  },

  /**
   * CORS middleware
   * @param {Object} options
   * @returns {Function}
   */
  cors(options = {}) {
    const config = options === true ? {} : options;
    const origin = config.origin ?? '*';
    const methods = config.methods || ['POST'];
    const headers = config.headers || config.allowedHeaders || ['Content-Type'];

    return async (context) => {
      const { req, res } = context;
      const requestOrigin = req?.headers?.origin;
      let allowedOrigin = origin;

      if (origin === false) {
        return context;
      }

      if (Array.isArray(origin)) {
        if (!requestOrigin || !origin.includes(requestOrigin)) {
          return context;
        }
        allowedOrigin = requestOrigin;
        res.vary('Origin');
      } else if (origin === true) {
        allowedOrigin = requestOrigin || '*';
        if (requestOrigin) res.vary('Origin');
      }

      res.header('Access-Control-Allow-Origin', allowedOrigin);
      res.header('Access-Control-Allow-Methods', methods.join(', '));
      res.header('Access-Control-Allow-Headers', headers.join(', '));
      if (config.credentials === true) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      return context;
    };
  },

  /**
   * Request timing middleware
   * @returns {Function}
   */
  timing() {
    return async (context) => {
      context.startTime = Date.now();
      return context;
    };
  },

  /**
   * Method whitelist middleware
   * @param {string[]} allowedMethods
   * @returns {Function}
   */
  methodWhitelist(allowedMethods) {
    return async (context) => {
      const { method } = context;

      if (!allowedMethods.includes(method)) {
        const error = new Error(`Method '${method}' is not allowed`);
        error.code = -32601;
        throw error;
      }

      return context;
    };
  },
};

module.exports = {
  MiddlewareManager,
  MemoryRateLimitStore,
  builtInMiddlewares,
};
