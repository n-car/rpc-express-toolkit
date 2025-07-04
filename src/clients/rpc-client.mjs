/**
 * JSON-RPC 2.0 Client for browser and Node.js environments (ES Module).
 * Handles BigInt and Date serialization/deserialization automatically.
 * 
 * Note: We extend BigInt.prototype.toJSON to handle automatic serialization
 * when JSON.stringify() is called, as BigInt doesn't have native JSON support.
 */

// Extend BigInt prototype to handle JSON serialization
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function() { return this.toString(); };
}

// Polyfill for Node.js environments that don't have fetch
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  // Try to use node-fetch if available, otherwise use built-in fetch in Node.js 18+
  try {
    const { default: nodeFetch } = await import('node-fetch');
    fetchFn = nodeFetch;
  } catch (e) {
    // For Node.js 18+, use global fetch
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
      fetchFn = globalThis.fetch;
    } else {
      throw new Error('fetch is not available. Please install node-fetch or use Node.js 18+');
    }
  }
}

export class RpcClient {
  #endpoint;
  #defaultHeaders;
  #requestId;

  /**
   * @param {string} endpoint The JSON-RPC endpoint URL.
   * @param {Object} [defaultHeaders={}] Optional default headers to include in requests.
   */
  constructor(endpoint, defaultHeaders = {}) {
    this.#endpoint = endpoint;
    this.#defaultHeaders = {
      "Content-Type": "application/json", // Default header
      ...defaultHeaders, // Merge with user-provided defaults
    };
    // Initialize request ID counter with timestamp + random component for uniqueness
    this.#requestId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  /**
   * Make a JSON-RPC call to the server.
   * @param {string} method The RPC method name.
   * @param {any} params The parameters to pass to the RPC method.
   * @param {string|number|null} [id] The request ID (optional for notifications). If null, auto-generates unique ID.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<any>} The result of the RPC call.
   */
  async call(method, params = {}, id = null, overrideHeaders = {}) {
    // Auto-generate unique ID if not provided
    if (id === null) {
      id = ++this.#requestId;
    }

    const requestBody = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    try {
      const response = await fetchFn(this.#endpoint, {
        method: "POST",
        headers: {
          ...this.#defaultHeaders,
          ...overrideHeaders,
        },
        // Since we have BigInt.prototype.toJSON, we don't need manual serialization
        // JSON.stringify will handle BigInt and Date automatically
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const responseBody = await response.json();

      if (responseBody.error) { throw responseBody.error; }

      // Convert back BigInts and Dates in the result
      return this.deserializeBigIntsAndDates(responseBody.result);
    } catch (error) {
      console.error("RPC call failed:", error);
      throw error;
    }
  }

  /**
   * Make a JSON-RPC notification (no response expected).
   * @param {string} method The RPC method name.
   * @param {any} params The parameters to pass to the RPC method.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<void>}
   */
  async notify(method, params = {}, overrideHeaders = {}) {
    const requestBody = {
      jsonrpc: "2.0",
      method,
      params,
      // No ID for notifications
    };

    try {
      const response = await fetchFn(this.#endpoint, {
        method: "POST",
        headers: {
          ...this.#defaultHeaders,
          ...overrideHeaders,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("RPC notification failed:", error);
      throw error;
    }
  }

  /**
   * Make a batch JSON-RPC call to the server.
   * @param {Array<{method: string, params: any, id?: string|number|null, notification?: boolean}>} requests Array of request objects.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<Array<any>>} Array of results corresponding to the requests.
   */
  async batch(requests, overrideHeaders = {}) {
    const requestBodies = requests.map(req => {
      const body = {
        jsonrpc: "2.0",
        method: req.method,
        params: req.params || {},
      };

      // If it's not a notification, add ID
      if (!req.notification) {
        body.id = req.id !== undefined ? req.id : ++this.#requestId;
      }

      return body;
    });

    try {
      const response = await fetchFn(this.#endpoint, {
        method: "POST",
        headers: {
          ...this.#defaultHeaders,
          ...overrideHeaders,
        },
        body: JSON.stringify(requestBodies),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const responseBody = await response.json();

      // Handle batch response
      if (Array.isArray(responseBody)) {
        return responseBody.map(res => {
          if (res.error) {
            throw res.error;
          }
          return this.deserializeBigIntsAndDates(res.result);
        });
      } else {
        // Single response (shouldn't happen with batch, but handle gracefully)
        if (responseBody.error) {
          throw responseBody.error;
        }
        return [this.deserializeBigIntsAndDates(responseBody.result)];
      }
    } catch (error) {
      console.error("RPC batch call failed:", error);
      throw error;
    }
  }

  /**
   * Recursively convert BigInt values to strings and Date objects to ISO strings
   * so they can be JSON-serialized.
   * @param {any} value
   * @returns {any}
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

    // If it's neither an array, an object, a Date, nor a bigint, return as-is
    return value;
  }

  /**
   * Recursively convert stringified BigInt values back to BigInt
   * and ISO 8601 date strings back to Date objects.
   *
   * @param {any} value The value to deserialize.
   * @returns {any}
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
        // Ensure it's valid
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
          this.deserializeBigIntsAndDates(val),
        ])
      );
    }

    // 4. Fallback for primitives, etc.
    return value;
  }
}

// Export only the main class
export { RpcClient };
