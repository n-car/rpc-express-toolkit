/**
 * JSON-RPC 2.0 Client for browser and Node.js environments.
 * Handles BigInt and Date serialization/deserialization automatically.
 *
 * Note: We extend BigInt.prototype.toJSON to handle automatic serialization
 * when JSON.stringify() is called, as BigInt doesn't have native JSON support.
 */

// Extend BigInt prototype to handle JSON serialization
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

// Polyfill for Node.js environments that don't have fetch
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  // Try to use node-fetch if available, otherwise use built-in fetch in Node.js 18+
  try {
    fetchFn = require('node-fetch');
  } catch (e) {
    // For Node.js 18+, use global fetch
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
      fetchFn = globalThis.fetch;
    } else {
      throw new Error(
        'fetch is not available. Please install node-fetch or use Node.js 18+'
      );
    }
  }
}

class RpcClient {
  #endpoint;
  #defaultHeaders;
  #requestId;
  #fetchOptions;
  #options;

  /**
   * @param {string} endpoint The JSON-RPC endpoint URL.
   * @param {Object} [defaultHeaders={}] Optional default headers to include in requests.
   * @param {Object} [options={}] Optional configuration options.
   * @param {boolean} [options.rejectUnauthorized=true] Whether to reject unauthorized SSL certificates. Set to false for development with self-signed certificates.
   * @param {boolean} [options.safeStringEnabled=true] Whether to prefix strings with 'S:' to avoid confusion with BigInt values.
   * @param {boolean} [options.safeDateEnabled=true] Whether to prefix dates with 'D:' to avoid confusion with ISO string values.
   */
  constructor(endpoint, defaultHeaders = {}, options = {}) {
    this.#endpoint = endpoint;
    this.#defaultHeaders = {
      'Content-Type': 'application/json', // Default header
      ...defaultHeaders, // Merge with user-provided defaults
    };
    // Initialize request ID counter with timestamp + random component for uniqueness
    this.#requestId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    // Store options
    this.#options = {
      safeStringEnabled: options.safeStringEnabled !== false, // Default true
      safeDateEnabled: options.safeDateEnabled !== false, // Default true
      ...options
    };

    // Store fetch options for Node.js environments
    this.#fetchOptions = {};
    // SSL validation: advanced options (agent/ca) have been removed for simplicity and compatibility.
    // To bypass self-signed certificates in development, set:
    //   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    // See README for details and best practices.
  }

  /**
   * Generate a unique request ID
   * @returns {number} Unique request ID
   */
  #generateId() {
    return ++this.#requestId;
  }

  /**
   * Make a JSON-RPC call to the server.
   * @param {string} method The RPC method name.
   * @param {any} params The parameters to pass to the RPC method.
   * @param {string|number|null} [id] The request ID (auto-generated if not provided).
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<any>} The result of the RPC call.
   */
  async call(method, params, id = undefined, overrideHeaders = {}) {
    // Auto-generate ID if not provided (null means notification)
    const requestId = id === undefined ? this.#generateId() : id;

    // Build the payload according to the spec: params omitted if undefined/null
    const requestBody = {
      jsonrpc: '2.0',
      method,
      id: requestId,
    };
    if (params !== undefined && params !== null) {
      // Serialize parameters to handle BigInt and safe strings
      requestBody.params = this.serializeBigIntsAndDates(params);
    }

    try {
      const response = await fetchFn(this.#endpoint, {
        method: 'POST',
        headers: {
          ...this.#defaultHeaders,
          // Add safe options headers so server knows what client expects
          'X-RPC-SafeString-Enabled': this.#options.safeStringEnabled ? 'true' : 'false',
          'X-RPC-SafeDate-Enabled': this.#options.safeDateEnabled ? 'true' : 'false',
          ...overrideHeaders,
        },
        // Since we have BigInt.prototype.toJSON, we don't need manual serialization
        // JSON.stringify will handle BigInt and Date automatically
        body: JSON.stringify(requestBody),
        ...this.#fetchOptions, // Include any additional fetch options (e.g., SSL settings)
      });

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      const responseBody = await response.json();

      if (responseBody.error) {
        throw responseBody.error;
      }

      // Check server's safe options from response headers
      const serverSafeStringEnabled = response.headers.get('X-RPC-SafeString-Enabled') === 'true';
      const serverSafeDateEnabled = response.headers.get('X-RPC-SafeDate-Enabled') === 'true';

      // Create deserialization options based on server's configuration
      const deserializationOptions = {
        safeStringEnabled: serverSafeStringEnabled,
        safeDateEnabled: serverSafeDateEnabled
      };

      // Convert back BigInts and Dates in the result using server's options
      return this.deserializeBigIntsAndDates(responseBody.result, deserializationOptions);
    } catch (error) {
      console.error('RPC call failed:', error);
      throw error;
    }
  }

  /**
   * Send a notification (no response expected).
   * @param {string} method The RPC method name.
   * @param {any} params The parameters to pass to the RPC method.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<void>} Promise that resolves when notification is sent.
   */
  async notify(method, params = {}, overrideHeaders = {}) {
    await this.call(method, params, null, overrideHeaders);
  }

  /**
   * Make multiple JSON-RPC calls in a single batch request.
   * @param {Array<{method: string, params?: any, id?: string|number}>} requests Array of request objects.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<Array<any>>} Array of results in the same order as requests.
   */
  async batch(requests, overrideHeaders = {}) {
    const batchRequests = requests.map((req) => {
      const obj = {
        jsonrpc: '2.0',
        method: req.method,
        id: req.id !== undefined ? req.id : this.#generateId(),
      };
      if (req.params !== undefined && req.params !== null) {
        // Serialize parameters to handle BigInt and safe strings
        obj.params = this.serializeBigIntsAndDates(req.params);
      }
      return obj;
    });

    try {
      const response = await fetchFn(this.#endpoint, {
        method: 'POST',
        headers: {
          ...this.#defaultHeaders,
          // Add safe options headers so server knows what client expects
          'X-RPC-SafeString-Enabled': this.#options.safeStringEnabled ? 'true' : 'false',
          'X-RPC-SafeDate-Enabled': this.#options.safeDateEnabled ? 'true' : 'false',
          ...overrideHeaders,
        },
        body: JSON.stringify(batchRequests),
        ...this.#fetchOptions, // Include any additional fetch options (e.g., SSL settings)
      });

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      const responseBody = await response.json();

      // Check server's safe options from response headers
      const serverSafeStringEnabled = response.headers.get('X-RPC-SafeString-Enabled') === 'true';
      const serverSafeDateEnabled = response.headers.get('X-RPC-SafeDate-Enabled') === 'true';

      // Create deserialization options based on server's configuration
      const deserializationOptions = {
        safeStringEnabled: serverSafeStringEnabled,
        safeDateEnabled: serverSafeDateEnabled
      };

      // Handle batch response
      if (Array.isArray(responseBody)) {
        return responseBody.map((res) => {
          if (res.error) {
            throw res.error;
          }
          return this.deserializeBigIntsAndDates(res.result, deserializationOptions);
        });
      } else {
        // Single response in batch
        if (responseBody.error) {
          throw responseBody.error;
        }
        return [this.deserializeBigIntsAndDates(responseBody.result, deserializationOptions)];
      }
    } catch (error) {
      console.error('Batch RPC call failed:', error);
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
    if (typeof value === 'bigint') {
      // Convert BigInt to string with 'n' suffix for proper deserialization
      return value.toString() + 'n';
    } else if (value instanceof Date) {
      // Convert Date to ISO string with D: prefix if safeDateEnabled
      const isoString = value.toISOString();
      return this.#options.safeDateEnabled ? `D:${isoString}` : isoString;
    } else if (typeof value === 'string') {
      // Add S: prefix if safeStringEnabled is true
      if (this.#options.safeStringEnabled) {
        return 'S:' + value;
      }
      return value;
    } else if (Array.isArray(value)) {
      // Recurse into arrays
      return value.map((v) => this.serializeBigIntsAndDates(v));
    } else if (value && typeof value === 'object') {
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
   * @param {Object} [options] Custom deserialization options (uses client options if not provided).
   * @param {boolean} [options.safeStringEnabled] Whether to expect S: prefixed strings.
   * @param {boolean} [options.safeDateEnabled] Whether to expect D: prefixed dates.
   * @returns {any}
   */
  deserializeBigIntsAndDates(value, options = null) {
    // Use provided options or fall back to client options
    const safeStringEnabled = options ? options.safeStringEnabled : this.#options.safeStringEnabled;
    const safeDateEnabled = options ? options.safeDateEnabled : this.#options.safeDateEnabled;

    // More comprehensive ISO date regex that handles:
    // - UTC: 2023-01-01T12:00:00.000Z
    // - With timezone: 2023-01-01T12:00:00.000+01:00
    // - Without timezone: 2023-01-01T12:00:00.000 (treated as local)
    const ISO_DATE_REGEX =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

    // 1. Check if it's a string that might be a BigInt, Date, or safe string
    if (typeof value === 'string') {
      // Safe string check: if safeStringEnabled and starts with S:
      if (safeStringEnabled && value.startsWith('S:')) {
        return value.substring(2); // Remove 'S:' prefix
      }

      // Safe date check: if safeDateEnabled and starts with D:
      if (safeDateEnabled && value.startsWith('D:')) {
        const isoString = value.substring(2); // Remove 'D:' prefix
        const date = new Date(isoString);
        // Double-check that we got a valid date
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // BigInt check: only convert strings that explicitly end with "n"
      // e.g., "42n", "-42n" but NOT "42", "0123456"
      if (/^-?\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1)); // Remove 'n' and convert
      }
      
      // Date check: matches an ISO 8601 string (only if safeDateEnabled is false)
      if (!safeDateEnabled && ISO_DATE_REGEX.test(value)) {
        const date = new Date(value);
        // Ensure it's valid
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // 2. If it's an array, handle each element
    if (Array.isArray(value)) {
      return value.map((v) => this.deserializeBigIntsAndDates(v, options));
    }

    // 3. If it's a plain object, recurse into each property
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [
          key,
          this.deserializeBigIntsAndDates(val, options),
        ])
      );
    }

    // 4. Fallback for primitives, etc.
    return value;
  }
}

export default RpcClient;
module.exports.RpcClient = RpcClient;
