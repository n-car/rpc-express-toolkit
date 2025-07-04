"use strict";

const path = require("path");
const express = require("express");

/** @typedef {import("express").Router} Router */
/** @typedef {import("express").Request} Request */
/** @typedef {import("express").Response} Response */

const NestedError = require('nested-error-stacks');
const Logger = require('./logger');
const { MiddlewareManager, builtInMiddlewares } = require('./middleware');
const { SchemaValidator, commonSchemas, SchemaBuilder } = require('./validation');
const BatchHandler = require('./batch');

/**
 * Default properties to include in error serialization.
 * @type {Array<string>}
 */
const defaultProperties = [
  'stackTraceLimit', 'cause', 'code', 'message', 'stack', 'address',
  'dest', 'errno', 'info', 'path', 'port', 'syscall', 'opensslErrorStack',
  'function', 'library', 'reason'
];

/**
 * Serializes an error into a JSON-compatible format, with optional sanitization.
 * @param {Error | NestedError | Object} error - The error to serialize.
 * @param {boolean} sanitize - Whether to remove sensitive fields.
 * @param {Array<string>} properties - Properties to include in serialization.
 * @returns {Object} The serialized error.
 */
const serializeError = (error, sanitize = false, properties = defaultProperties) => {
  if (error === null || error === undefined) return error;

  const result = {};
  const includeProperties = sanitize
      ? properties.filter(prop => !['address', 'path'].includes(prop))
      : properties;

  includeProperties.forEach(prop => {
      if (error?.[prop] !== undefined) {
          result[prop] = error[prop];
      }
  });

  if (error instanceof NestedError) {
      result.type = 'NestedError';
      if (error.nested) result.nested = serializeError(error.nested, sanitize, properties);
  } else if (error instanceof Error) {
      result.type = 'Error';
  } else if (error instanceof Object) {
      result.type = 'Object';
      Object.assign(result, error);
  } else {
      result.type = 'Default';
      result.instance = error;
  }

  return result;
};

/**
 * @template C
 */
class RpcEndpoint {
  /**
   * Serve client scripts for making JSON-RPC calls from the browser.
   * @param {Router} router Express.Router instance
   * @param {string} [url="/vendor/rpc-client"]
   *    The path from which client scripts will be served.
   */
  static serveScripts(router, url = "/vendor/rpc-client") {
    router.use(url, express.static(path.join(__dirname, "clients")));
  }

  /** @type {string} */
  #endpoint;

  /** @type {{ [name: string]: any }} */
  #methods = {};

  /** @type {Logger} */
  #logger;

  /** @type {MiddlewareManager} */
  #middleware;

  /** @type {SchemaValidator} */
  #validator;

  /** @type {BatchHandler} */
  #batchHandler;

  /** @type {Object} */
  #options;

  /**
   * @param {Router} router The Express router to attach the endpoint to.
   * @param {C} context The context object to pass to the method handlers.
   * @param {string|Object} [endpointOrOptions="/api"] The endpoint path or options object.
   * @param {Object} [options={}] Options object if first param is string.
   */
  constructor(router, context, endpointOrOptions = "/api", options = {}) {
    // Handle both signatures: (router, context, "/api", options) and (router, context, options)
    if (typeof endpointOrOptions === 'string') {
      this.#endpoint = endpointOrOptions;
      this.#options = { ...options };
    } else {
      this.#endpoint = endpointOrOptions.endpoint || "/api";
      this.#options = { ...endpointOrOptions };
    }

    // Initialize components
    this.#logger = new Logger(this.#options.logging || {});
    this.#middleware = new MiddlewareManager();
    this.#validator = new SchemaValidator(this.#options.validation || {});
    this.#batchHandler = new BatchHandler(this);

    // Setup built-in middleware if configured
    this.#setupBuiltInMiddleware();

    // Wire up routes
    this.#setupRoutes(router, context);
  }

  /**
   * Setup built-in middleware based on options
   */
  #setupBuiltInMiddleware() {
    const { rateLimit, cors, auth, timing, methodWhitelist } = this.#options;

    if (timing !== false) {
      this.use('beforeCall', builtInMiddlewares.timing());
    }

    if (cors) {
      this.use('beforeCall', builtInMiddlewares.cors(cors));
    }

    if (rateLimit) {
      this.use('beforeCall', builtInMiddlewares.rateLimit(rateLimit));
    }

    if (auth) {
      this.use('beforeCall', builtInMiddlewares.auth(auth));
    }

    if (methodWhitelist && Array.isArray(methodWhitelist)) {
      this.use('beforeCall', builtInMiddlewares.methodWhitelist(methodWhitelist));
    }
  }

  /**
   * Setup Express routes
   * @param {Router} router 
   * @param {C} context 
   */
  #setupRoutes(router, context) {
    // Health check endpoint
    if (this.#options.healthCheck !== false) {
      router.get(`${this.#endpoint}/health`, (req, res) => {
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: require('../package.json').version
        });
      });
    }

    // Metrics endpoint
    if (this.#options.metrics) {
      router.get(`${this.#endpoint}/metrics`, (req, res) => {
        res.json(this.getMetrics());
      });
    }

    // Main JSON-RPC endpoint
    router.post(this.#endpoint, async (req, res) => {
      const startTime = Date.now();
      
      try {
        // Check if it's a batch request
        if (this.#batchHandler.isBatchRequest(req.body)) {
          this.#logger.info('Batch request received', {
            batchSize: req.body.length,
            ip: req.ip
          });

          const results = await this.#batchHandler.processBatch(req.body, req, res, context);
          
          // Only send response if there are results (non-notification requests)
          if (results.length > 0) {
            res.json(results);
          } else {
            res.status(204).end(); // No content for all-notification batch
          }
          
          this.#logger.info('Batch request completed', {
            batchSize: req.body.length,
            responseCount: results.length,
            duration: Date.now() - startTime
          });
          
          return;
        }

        // Single request processing
        await this.#processSingleRequest(req, res, context, startTime);
        
      } catch (error) {
        this.#logger.error('Endpoint error', { error: error.message, stack: error.stack });
        
        res.json({
          jsonrpc: "2.0",
          id: null,
          error: { 
            code: -32603, 
            message: "Internal error",
            data: serializeError(error, true)
          }
        });
      }
    });
  }

  /**
   * Process a single JSON-RPC request
   * @param {Request} req 
   * @param {Response} res 
   * @param {C} context 
   * @param {number} startTime 
   */
  async #processSingleRequest(req, res, context, startTime) {
    const { jsonrpc, method, params, id } = req.body || {};

    // Log the incoming request
    this.#logger.rpcCall(method, params, id, req);

    // Validate JSON-RPC 2.0 request
    if (jsonrpc !== "2.0") {
      return this.reply(res, {
        id,
        error: { code: -32600, message: `Invalid Request: 'jsonrpc' must be '2.0'.` }
      });
    }

    if (typeof method !== "string") {
      return this.reply(res, {
        id,
        error: { code: -32600, message: `Invalid Request: 'method' must be a string.` }
      });
    }

    const methodConfig = this.#methods[method];
    if (!methodConfig) {
      return this.reply(res, {
        id,
        error: { code: -32601, message: `Method "${method}" not found` }
      });
    }

    const handler = typeof methodConfig === 'function' ? methodConfig : methodConfig.handler;
    const schema = typeof methodConfig === 'object' ? methodConfig.schema : null;

    try {
      // Prepare middleware context
      let middlewareContext = {
        req,
        res,
        method,
        params,
        context,
        id,
        startTime
      };

      // Execute beforeCall middleware
      middlewareContext = await this.#middleware.execute('beforeCall', middlewareContext);

      // Validate parameters if schema is provided
      if (schema) {
        middlewareContext = await this.#middleware.execute('beforeValidation', middlewareContext);
        
        const validation = this.#validator.validate(middlewareContext.params, schema);
        if (!validation.valid) {
          const error = new Error('Validation failed');
          error.code = -32602;
          error.data = {
            validationErrors: validation.errors.map(err => ({
              field: err.instancePath || err.schemaPath,
              message: err.message,
              value: err.data
            }))
          };
          throw error;
        }
        
        middlewareContext.params = validation.data;
        middlewareContext = await this.#middleware.execute('afterValidation', middlewareContext);
      }

      // Invoke the handler
      const result = await Promise.resolve(handler(req, context, middlewareContext.params));
      
      // Execute afterCall middleware
      middlewareContext.result = result;
      await this.#middleware.execute('afterCall', middlewareContext);

      // Log success
      const duration = Date.now() - startTime;
      this.#logger.rpcSuccess(method, id, duration, result);

      // Convert any BigInt/Date values before JSON-stringifying
      const safeResult = this.serializeBigIntsAndDates(result);
      this.reply(res, { id, result: safeResult });

    } catch (err) {
      const duration = Date.now() - startTime;
      this.#logger.rpcError(method, id, duration, err);

      // Execute error middleware
      try {
        await this.#middleware.execute('onError', {
          req,
          res,
          method,
          params,
          context,
          id,
          error: err,
          startTime,
          duration
        });
      } catch (middlewareError) {
        this.#logger.error('Error middleware failed', { error: middlewareError.message });
      }

      this.reply(res, {
        id,
        error: { 
          code: err.code || -32603, 
          message: err.message || `Internal error`, 
          ...(err.data && { data: err.data }),
          error: serializeError(err, true) 
        }
      });
    }
  }

  /**
   * Register a new JSON-RPC method.
   * @param {string} name The method name.
   * @param {Function|Object} handlerOrConfig The function to handle calls or config object.
   * @param {Object} [schema] Optional schema for parameter validation.
   */
  addMethod(name, handlerOrConfig, schema = null) {
    if (typeof handlerOrConfig === 'function') {
      this.#methods[name] = schema ? { handler: handlerOrConfig, schema } : handlerOrConfig;
    } else if (typeof handlerOrConfig === 'object' && handlerOrConfig.handler) {
      this.#methods[name] = handlerOrConfig;
    } else {
      throw new Error('Invalid handler configuration');
    }

    this.#logger.debug('Method registered', { method: name, hasSchema: !!schema });
  }

  /**
   * Add middleware for specific hooks
   * @param {string} hook 
   * @param {Function} middleware 
   */
  use(hook, middleware) {
    this.#middleware.use(hook, middleware);
  }

  /**
   * Remove method
   * @param {string} name 
   */
  removeMethod(name) {
    delete this.#methods[name];
    this.#logger.debug('Method removed', { method: name });
  }

  /**
   * Get method configuration
   * @param {string} name 
   * @returns {any}
   */
  getMethod(name) {
    return this.#methods[name];
  }

  /**
   * List all registered methods
   * @returns {string[]}
   */
  listMethods() {
    return Object.keys(this.#methods);
  }

  /** @returns {string} The endpoint path (e.g. "/api"). */
  get endpoint() {
    return this.#endpoint;
  }

  /**
   * @returns {{ [name: string]: any }}
   * All registered methods.
   */
  get methods() {
    return this.#methods;
  }

  /**
   * Get logger instance
   * @returns {Logger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Get middleware manager
   * @returns {MiddlewareManager}
   */
  get middleware() {
    return this.#middleware;
  }

  /**
   * Get validator instance
   * @returns {SchemaValidator}
   */
  get validator() {
    return this.#validator;
  }

  /**
   * Get metrics data
   * @returns {Object}
   */
  getMetrics() {
    return {
      methods: Object.keys(this.#methods).length,
      middleware: {
        beforeCall: this.#middleware.getMiddlewares('beforeCall').length,
        afterCall: this.#middleware.getMiddlewares('afterCall').length,
        onError: this.#middleware.getMiddlewares('onError').length
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send a JSON-RPC 2.0 response.
   * @param {Response} res The Express response object.
   * @param {{
   *   id?: string|number|null,
   *   result?: any,
   *   error?: { code: number, message: string, data?: any }
   * }} responsePayload The JSON-RPC response fields.
   */
  reply(res, { id, result, error }) {
    const response = { jsonrpc: "2.0", id: id === undefined ? null : id };

    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }

    res.json(response);
  }

  /**
   * Recursively convert BigInt values to strings and Date objects to ISO strings.
   * This is crucial because JSON.stringify() cannot handle BigInt natively
   * and Date objects are best transmitted in a standardized format.
   *
   * @param {any} value The value to serialize.
   * @returns {any} A version of `value` safe for JSON serialization.
   */
  serializeBigIntsAndDates(value) {
    if (typeof value === "bigint") {
      // Convert BigInt to string
      return value.toString();
    } else if (Array.isArray(value)) {
      // Recurse into arrays
      return value.map((v) => this.serializeBigIntsAndDates(v));
    } else if (value instanceof Date) {
      // Convert Date to ISO string (UTC)
      return value.toISOString();
    } else if (value && typeof value === "object") {
      // Recurse into plain objects
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.serializeBigIntsAndDates(val);
      }
      return result;
    }

    // If it's none of the above, return as-is
    return value;
  }

  /**
   * Recursively convert stringified BigInts back to BigInt,
   * and ISO 8601 date strings back to Date objects.
   *
   * This is useful if you receive JSON that was serialized
   * by `serializeBigIntsAndDates()` and want to re-hydrate
   * the original types.
   *
   * @param {any} value The value to deserialize.
   * @returns {any} The re-hydrated value.
   */
  deserializeBigIntsAndDates(value) {
    // More comprehensive ISO date regex that handles:
    // - UTC: 2023-01-01T12:00:00.000Z
    // - With timezone: 2023-01-01T12:00:00.000+01:00  
    // - Without timezone: 2023-01-01T12:00:00.000 (treated as local)
    const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

    // 1. Check if it's a string that might be a BigInt or a Date
    if (typeof value === "string") {
      // BigInt check: matches digits (including negative), optionally ending in "n"
      // e.g., "42n", "42", "-42n", "-42"
      if (/^-?\d+n?$/.test(value)) {
        return BigInt(value.replace(/n$/, ""));
      }

      // Date check: matches an ISO 8601 string
      if (ISO_DATE_REGEX.test(value)) {
        const date = new Date(value);
        // Double-check that we got a valid date
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // 2. If it's an array, handle each element
    if (Array.isArray(value)) {
      return value.map((v) => this.deserializeBigIntsAndDates(v));
    }

    // 3. If it's a plain object, recurse into each property
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [
          key,
          this.deserializeBigIntsAndDates(val)
        ])
      );
    }

    // 4. For everything else (number, boolean, null, undefined, etc.), return as-is
    return value;
  }
}

// Import the client class
const RpcClient = require('./clients/rpc-client');

// Export both server and client, plus utilities
module.exports = RpcEndpoint;
module.exports.RpcEndpoint = RpcEndpoint;
module.exports.RpcClient = RpcClient;
module.exports.Logger = Logger;
module.exports.MiddlewareManager = MiddlewareManager;
module.exports.builtInMiddlewares = builtInMiddlewares;
module.exports.SchemaValidator = SchemaValidator;
module.exports.commonSchemas = commonSchemas;
module.exports.SchemaBuilder = SchemaBuilder;
module.exports.BatchHandler = BatchHandler;
