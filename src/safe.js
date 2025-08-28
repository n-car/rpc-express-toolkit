const Main = require('./index');

// Default safe options applied unless explicitly overridden
const defaultSafeOptions = {
  safeEnabled: true,
  strictMode: true,
};

/**
 * Create a RpcEndpoint with safe defaults (safeEnabled=true, strictMode=true).
 * Preserves both constructor signatures supported by RpcEndpoint.
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
  if (typeof endpointOrOptions === 'string') {
    const finalOptions = { ...defaultSafeOptions, ...options };
    return new Main.RpcEndpoint(
      router,
      context,
      endpointOrOptions,
      finalOptions
    );
  }
  // options object form
  const final = { ...defaultSafeOptions, ...endpointOrOptions };
  return new Main.RpcEndpoint(router, context, final);
}

/**
 * Create a RpcClient with safe defaults (safeEnabled=true).
 * @param {string} endpoint
 * @param {Record<string,string>} [defaultHeaders]
 * @param {object} [options]
 */
function createSafeClient(endpoint, defaultHeaders = {}, options = {}) {
  const finalOptions = { safeEnabled: true, ...options };
  return new Main.RpcClient(endpoint, defaultHeaders, finalOptions);
}

module.exports = {
  // Re-export everything for convenience
  ...Main,
  createSafeEndpoint,
  createSafeClient,
};
