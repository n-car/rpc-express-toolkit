/**
 * @file BatchHandler Class
 * @description Handles JSON-RPC 2.0 batch requests processing multiple requests in a single call
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
      return [
        {
          jsonrpc: '2.0',
          id: null,
          error: validation.error,
        },
      ];
    }

    const results = await Promise.all(
      batch.map(async (request, index) => {
        const outcome = await this.endpoint.executeRequest(
          request,
          req,
          res,
          context,
          {
            startTime: Date.now(),
            batchIndex: index,
          }
        );

        if (outcome.notification) {
          return null;
        }

        return {
          jsonrpc: '2.0',
          ...outcome.response,
        };
      })
    );

    // Filter out notifications (requests without id)
    return results.filter((result) => result !== null);
  }

  /**
   * Get batch statistics
   * @param {Array} batch
   * @returns {Object}
   */
  getBatchStats(batch) {
    const notifications = batch.filter(
      (req) => !Object.prototype.hasOwnProperty.call(req, 'id')
    ).length;
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
