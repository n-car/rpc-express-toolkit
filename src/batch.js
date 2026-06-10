/**
 * @file BatchHandler Class
 * @description Handles JSON-RPC 2.0 batch requests processing multiple requests in a single call
 */
const { addBatchIndex, hasOwn, validateEnvelope } = require('./protocol');

class BatchHandler {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  serializeErrorData(error, batchIndex) {
    const errorWithBatchIndex = addBatchIndex(error, batchIndex);
    if (!hasOwn(errorWithBatchIndex, 'data')) {
      return undefined;
    }
    return this.endpoint.serializeBigIntsAndDates(errorWithBatchIndex.data);
  }

  /**
   * Check if request is a batch request
   * @param {any} body
   * @returns {boolean}
   */
  isBatchRequest(body) {
    return Array.isArray(body);
  }

  /**
   * Validate batch request
   * @param {Array} batch
   * @returns {Object}
   */
  validateBatch(batch) {
    if (!Array.isArray(batch)) {
      return {
        valid: false,
        error: {
          code: -32600,
          message: 'Invalid Request: Batch must be an array',
        },
      };
    }

    if (batch.length === 0) {
      return {
        valid: false,
        error: {
          code: -32600,
          message: 'Invalid Request: Batch cannot be empty',
        },
      };
    }

    return { valid: true };
  }

  /**
   * Process a batch of JSON-RPC requests
   * @param {Array} batch
   * @param {Object} req
   * @param {Object} res
   * @param {any} context
   * @returns {Promise<Array>}
   */
  async processBatch(batch, req, res, context) {
    const validation = this.validateBatch(batch);
    if (!validation.valid) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: validation.error,
      };
    }

    // Process all requests in parallel
    const promises = batch.map(async (request, index) => {
      try {
        return await this.processSingleRequest(request, req, context, index);
      } catch (error) {
        const errorData = this.serializeErrorData(error, index);
        return {
          jsonrpc: '2.0',
          id: request && hasOwn(request, 'id') ? request.id : null,
          error: {
            code: error.code || -32603,
            message: error.message || 'Internal error',
            ...(errorData !== undefined && { data: errorData }),
          },
        };
      }
    });

    const results = await Promise.all(promises);

    // Filter out notifications (requests without id)
    return results.filter((result) => result !== null);
  }

  /**
   * Process a single request within a batch
   * @param {Object} request
   * @param {Object} req
   * @param {any} context
   * @param {number} batchIndex
   * @returns {Promise<Object|null>}
   */
  async processSingleRequest(request, req, context, batchIndex) {
    const { method, params, id } = request || {};
    const envelope = validateEnvelope(request);

    if (!envelope.valid) {
      return {
        jsonrpc: '2.0',
        id: envelope.responseId,
        error: addBatchIndex(envelope.error, batchIndex),
      };
    }

    const methodConfig = this.endpoint.methods[method];
    if (!methodConfig) {
      if (envelope.isNotification) {
        return null;
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method "${method}" not found`,
          data: { batchIndex },
        },
      };
    }

    // Extract handler (support both function and config object)
    const handler =
      typeof methodConfig === 'function' ? methodConfig : methodConfig.handler;
    const schema =
      typeof methodConfig === 'object' ? methodConfig.schema : null;

    // If no id is provided, this is a notification - don't return response
    const isNotification = !envelope.hasId;

    // Determine client safe mode from headers and deserialize params accordingly
    const clientSafeHeader = req.headers['x-rpc-safe-enabled'];
    if (
      this.endpoint.options.strictMode &&
      this.endpoint.options.safeEnabled &&
      !clientSafeHeader
    ) {
      if (isNotification) {
        return null;
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message:
            'RPC Compatibility Error: Server requires safe serialization header but client did not provide it.',
          data: {
            serverSafeEnabled: this.endpoint.options.safeEnabled,
            requiredHeader: 'X-RPC-Safe-Enabled',
            strictMode: true,
            solution:
              'Update client to rpc-express-toolkit v4+ or disable server strict mode',
            batchIndex,
          },
        },
      };
    }

    const clientSafeEnabled = clientSafeHeader === 'true';
    const deserializedParams = hasOwn(request, 'params')
      ? this.endpoint.deserializeBigIntsAndDates(params, {
          safeEnabled: clientSafeEnabled,
        })
      : params;

    // Initialize middleware context
    let middlewareContext = {
      req,
      res: null, // No response object for batch items
      method,
      params: deserializedParams,
      context,
      batchIndex,
      isNotification,
    };

    try {
      // Execute middleware
      if (this.endpoint.middleware) {
        middlewareContext = await this.endpoint.middleware.execute(
          'beforeCall',
          middlewareContext
        );
      }

      if (schema) {
        if (this.endpoint.middleware) {
          middlewareContext = await this.endpoint.middleware.execute(
            'beforeValidation',
            middlewareContext
          );
        }

        const validation = this.endpoint.validator.validate(
          middlewareContext.params,
          schema
        );
        if (!validation.valid) {
          const error = new Error('Validation failed');
          error.code = -32602;
          error.data = {
            validationErrors: validation.errors.map((err) => ({
              field: err.instancePath || err.schemaPath,
              message: err.message,
              value: err.data,
            })),
          };
          throw error;
        }

        middlewareContext.params = validation.data;

        if (this.endpoint.middleware) {
          middlewareContext = await this.endpoint.middleware.execute(
            'afterValidation',
            middlewareContext
          );
        }
      }

      // Execute the handler
      const result = await Promise.resolve(
        handler(req, context, middlewareContext.params)
      );

      // Execute after middleware
      if (this.endpoint.middleware) {
        middlewareContext.result = result;
        await this.endpoint.middleware.execute('afterCall', middlewareContext);
      }

      // For notifications, return null (will be filtered out)
      if (isNotification) {
        return null;
      }

      // Serialize the result
      const safeResult = this.endpoint.serializeBigIntsAndDates(result);

      return {
        jsonrpc: '2.0',
        id,
        result: safeResult,
      };
    } catch (error) {
      // Execute error middleware
      if (this.endpoint.middleware) {
        try {
          await this.endpoint.middleware.execute('onError', {
            ...middlewareContext,
            error,
            batchIndex,
          });
        } catch (middlewareError) {
          // Ignore middleware errors in error handling
        }
      }

      // For notifications, return null even on error
      if (isNotification) {
        return null;
      }

      const errorData = this.serializeErrorData(error, batchIndex);

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: error.code || -32603,
          message: error.message || 'Internal error',
          ...(errorData !== undefined && { data: errorData }),
        },
      };
    }
  }

  /**
   * Get batch statistics
   * @param {Array} batch
   * @returns {Object}
   */
  getBatchStats(batch) {
    const notifications = batch.filter((req) => !hasOwn(req, 'id')).length;
    const requests = batch.length - notifications;
    const methods = [...new Set(batch.map((req) => req.method))];

    return {
      total: batch.length,
      requests,
      notifications,
      uniqueMethods: methods.length,
      methods,
    };
  }
}

module.exports = BatchHandler;
