/* eslint-disable max-classes-per-file */
const Main = require('./index');

/**
 * RPC Client with safe serialization enabled by default.
 * Extends RpcClient with safeEnabled: true preset.
 *
 * This class automatically enables safe prefixes for strings (S:) and dates (D:)
 * to avoid ambiguity with BigInt and ISO date strings.
 *
 * @example
 * const client = new RpcSafeClient('http://localhost:3000/api');
 * const result = await client.call('add', { a: 10n, b: 20n });
 */
class RpcSafeClient extends Main.RpcClient {
  /**
   * @param {string} endpoint The JSON-RPC endpoint URL.
   * @param {Object} [defaultHeaders={}] Optional default headers to include in requests.
   * @param {Object} [options={}] Optional configuration options (safeEnabled will be set to true).
   */
  constructor(endpoint, defaultHeaders = {}, options = {}) {
    super(endpoint, defaultHeaders, { safeEnabled: true, ...options });
  }
}

/**
 * RPC Endpoint with safe serialization enabled by default.
 * Extends RpcEndpoint with safeEnabled: true and strictMode: true presets.
 *
 * This class automatically enables safe prefixes for strings (S:) and dates (D:)
 * and enforces strict compatibility checking with clients.
 *
 * @example
 * const app = express();
 * const rpc = new RpcSafeEndpoint(app, {});
 * rpc.addMethod('add', {
 *   handler: (req, ctx, params) => params.a + params.b,
 * });
 *
 * @template C
 */
class RpcSafeEndpoint extends Main.RpcEndpoint {
  /**
   * @param {import('express').Router} router Express router or app
   * @param {C} context Context object passed to handlers
   * @param {string|object} [endpointOrOptions='/api'] Endpoint path or options object
   * @param {object} [options] Options object (when endpointOrOptions is a string)
   */
  constructor(router, context, endpointOrOptions = '/api', options = {}) {
    const defaultSafeOptions = {
      safeEnabled: true,
      strictMode: true,
    };

    if (typeof endpointOrOptions === 'string') {
      // String endpoint with options object
      const finalOptions = { ...defaultSafeOptions, ...options };
      super(router, context, endpointOrOptions, finalOptions);
    } else {
      // Options object form
      const finalOptions = { ...defaultSafeOptions, ...endpointOrOptions };
      super(router, context, finalOptions);
    }
  }
}

/**
 * @deprecated Use `new RpcSafeEndpoint(...)` instead.
 * Create a RpcEndpoint with safe defaults (safeEnabled=true, strictMode=true).
 *
 * @param {import('express').Router} router
 * @param {any} context
 * @param {string|object} [endpointOrOptions='/api']
 * @param {object} [options]
 */
function createSafeEndpoint(
  router,
  context,
  endpointOrOptions = '/api',
  options = {}
) {
  console.warn(
    'createSafeEndpoint() is deprecated. Use `new RpcSafeEndpoint(...)` instead.'
  );
  return new RpcSafeEndpoint(router, context, endpointOrOptions, options);
}

/**
 * @deprecated Use `new RpcSafeClient(...)` instead.
 * Create a RpcClient with safe defaults (safeEnabled=true).
 *
 * @param {string} endpoint
 * @param {Record<string,string>} [defaultHeaders]
 * @param {object} [options]
 */
function createSafeClient(endpoint, defaultHeaders = {}, options = {}) {
  console.warn(
    'createSafeClient() is deprecated. Use `new RpcSafeClient(...)` instead.'
  );
  return new RpcSafeClient(endpoint, defaultHeaders, options);
}

module.exports = {
  // Re-export everything for convenience
  ...Main,
  // New class-based API
  RpcSafeClient,
  RpcSafeEndpoint,
  // Deprecated factory functions (kept for backward compatibility)
  createSafeEndpoint,
  createSafeClient,
};
