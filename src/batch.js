"use strict";

/**
 * Batch request handler for JSON-RPC 2.0
 */
class BatchHandler {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Check if request is a batch request
   * @param {any} body 
   * @returns {boolean}
   */
  isBatchRequest(body) {
    return Array.isArray(body) && body.length > 0;
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
        error: { code: -32600, message: 'Invalid Request: Batch must be an array' }
      };
    }

    if (batch.length === 0) {
      return {
        valid: false,
        error: { code: -32600, message: 'Invalid Request: Batch cannot be empty' }
      };
    }

    // Check for duplicate IDs in the batch
    const ids = batch.map(req => req.id).filter(id => id !== undefined && id !== null);
    const uniqueIds = new Set(ids);
    
    if (ids.length !== uniqueIds.size) {
      return {
        valid: false,
        error: { code: -32600, message: 'Invalid Request: Duplicate IDs in batch' }
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
      return [{ 
        jsonrpc: '2.0', 
        id: null, 
        error: validation.error 
      }];
    }

    // Process all requests in parallel
    const promises = batch.map(async (request, index) => {
      try {
        return await this.processSingleRequest(request, req, context, index);
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: request.id || null,
          error: {
            code: error.code || -32603,
            message: error.message || 'Internal error',
            data: { batchIndex: index }
          }
        };
      }
    });

    const results = await Promise.all(promises);
    
    // Filter out notifications (requests without id)
    return results.filter(result => result !== null);
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
    const { jsonrpc, method, params, id } = request;

    // Validate JSON-RPC 2.0 request structure
    if (jsonrpc !== "2.0") {
      return {
        jsonrpc: '2.0',
        id: id || null,
        error: { 
          code: -32600, 
          message: `Invalid Request: 'jsonrpc' must be '2.0'`,
          data: { batchIndex }
        }
      };
    }

    if (typeof method !== "string") {
      return {
        jsonrpc: '2.0',
        id: id || null,
        error: { 
          code: -32600, 
          message: `Invalid Request: 'method' must be a string`,
          data: { batchIndex }
        }
      };
    }

    const handler = this.endpoint.methods[method];
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: id || null,
        error: { 
          code: -32601, 
          message: `Method "${method}" not found`,
          data: { batchIndex }
        }
      };
    }

    // If no id is provided, this is a notification - don't return response
    const isNotification = id === undefined || id === null;

    try {
      // Execute middleware
      let middlewareContext = {
        req,
        res: null, // No response object for batch items
        method,
        params,
        context,
        batchIndex,
        isNotification
      };

      if (this.endpoint.middleware) {
        middlewareContext = await this.endpoint.middleware.execute('beforeCall', middlewareContext);
      }

      // Execute the handler
      const result = await Promise.resolve(handler(req, context, middlewareContext.params));
      
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
        result: safeResult
      };

    } catch (error) {
      // Execute error middleware
      if (this.endpoint.middleware) {
        try {
          await this.endpoint.middleware.execute('onError', {
            ...middlewareContext,
            error,
            batchIndex
          });
        } catch (middlewareError) {
          // Ignore middleware errors in error handling
        }
      }

      // For notifications, return null even on error
      if (isNotification) {
        return null;
      }

      return {
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: error.code || -32603,
          message: error.message || 'Internal error',
          data: { batchIndex }
        }
      };
    }
  }

  /**
   * Get batch statistics
   * @param {Array} batch 
   * @returns {Object}
   */
  getBatchStats(batch) {
    const notifications = batch.filter(req => req.id === undefined || req.id === null).length;
    const requests = batch.length - notifications;
    const methods = [...new Set(batch.map(req => req.method))];
    
    return {
      total: batch.length,
      requests,
      notifications,
      uniqueMethods: methods.length,
      methods
    };
  }
}

module.exports = BatchHandler;
