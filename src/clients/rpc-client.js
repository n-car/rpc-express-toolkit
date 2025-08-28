/**
 * JSON-RPC 2.0 Client for browser and Node.js environments.
 * Handles BigInt and Date serialization/deserialization automatically
 * using explicit serializers (no global prototype extensions).
 */

// Select fetch implementation (Node 18+ or browser)
let fetchFn;
if (typeof globalThis !== 'undefined' && globalThis.fetch) {
  fetchFn = globalThis.fetch.bind(globalThis);
} else {
  throw new Error(
    'globalThis.fetch is not available. Node.js 18+ is required.'
  );
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
   * @param {boolean} [options.safeEnabled=false] Whether to use safe serialization for both strings and dates to avoid confusion with BigInt/ISO values. Default false for JSON-RPC 2.0 compliance.
   * @param {boolean} [options.warnOnUnsafe=true] Whether to show educational warnings when BigInt/Date objects are serialized without safe mode. Default true.
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
      safeEnabled: options.safeEnabled === true, // Default false
      warnOnUnsafe: options.warnOnUnsafe !== false, // Default true
      ...options,
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
   * @template T
   * @param {string} method The RPC method name.
   * @param {any} params The parameters to pass to the RPC method.
   * @param {string|number|null} [id] The request ID (auto-generated if not provided).
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<T>} The result of the RPC call.
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
          // Add safe options header so server knows what client expects
          'X-RPC-Safe-Enabled': this.#options.safeEnabled ? 'true' : 'false',
          ...overrideHeaders,
        },
        // Params are pre-serialized (BigInt/Date) via serializeBigIntsAndDates
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

      // Check server's safe options from response headers - strict compatibility checking
      const serverSafeHeader = response.headers.get('X-RPC-Safe-Enabled');

      // Errore rigoroso: se client ha safe enabled ma server non risponde con header
      if (this.#options.safeEnabled && serverSafeHeader === null) {
        throw new Error(
          'RPC Compatibility Error: Client has safe serialization enabled but server did not respond with compatibility header (X-RPC-Safe-Enabled). ' +
            'This may indicate a version mismatch or non-toolkit server. ' +
            'Solutions: (1) Update server to rpc-express-toolkit v4+, (2) Disable client safeEnabled option, or (3) Use a compatible JSON-RPC server.'
        );
      }

      // Warning: se client ha safe disabled ma server offre compatibilità
      if (
        !this.#options.safeEnabled &&
        serverSafeHeader === 'true' &&
        this.#options.warnOnUnsafe
      ) {
        console.warn(
          '⚠️  RPC Compatibility Notice: Server supports safe serialization but client has safeEnabled=false. ' +
            'Consider enabling safeEnabled option for better BigInt/Date handling and forward compatibility.'
        );
      }

      const serverSafeEnabled = serverSafeHeader === 'true';

      // Create deserialization options based on server's configuration
      const deserializationOptions = {
        safeEnabled: serverSafeEnabled,
      };

      // Convert back BigInts and Dates in the result using server's options
      return this.deserializeBigIntsAndDates(
        responseBody.result,
        deserializationOptions
      );
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
   * @template T
   * @param {Array<{method: string, params?: any, id?: string|number}>} requests Array of request objects.
   * @param {Object} [overrideHeaders={}] Optional headers to override defaults for this request.
   * @returns {Promise<Array<T>>} Array of results in the same order as requests.
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
          // Add safe options header so server knows what client expects
          'X-RPC-Safe-Enabled': this.#options.safeEnabled ? 'true' : 'false',
          ...overrideHeaders,
        },
        // Params are pre-serialized per item
        body: JSON.stringify(batchRequests),
        ...this.#fetchOptions, // Include any additional fetch options (e.g., SSL settings)
      });

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      const responseBody = await response.json();

      // Check server's safe options from response headers - strict compatibility checking
      const serverSafeHeader = response.headers.get('X-RPC-Safe-Enabled');

      // Errore rigoroso: se client ha safe enabled ma server non risponde con header
      if (this.#options.safeEnabled && serverSafeHeader === null) {
        throw new Error(
          'RPC Compatibility Error: Client has safe serialization enabled but server did not respond with compatibility header (X-RPC-Safe-Enabled). ' +
            'This may indicate a version mismatch or non-toolkit server. ' +
            'Solutions: (1) Update server to rpc-express-toolkit v4+, (2) Disable client safeEnabled option, or (3) Use a compatible JSON-RPC server.'
        );
      }

      // Warning: se client ha safe disabled ma server offre compatibilità
      if (
        !this.#options.safeEnabled &&
        serverSafeHeader === 'true' &&
        this.#options.warnOnUnsafe
      ) {
        console.warn(
          '⚠️  RPC Compatibility Notice: Server supports safe serialization but client has safeEnabled=false. ' +
            'Consider enabling safeEnabled option for better BigInt/Date handling and forward compatibility.'
        );
      }

      const serverSafeEnabled = serverSafeHeader === 'true';

      // Create deserialization options based on server's configuration
      const deserializationOptions = {
        safeEnabled: serverSafeEnabled,
      };

      // Handle batch response
      if (Array.isArray(responseBody)) {
        return responseBody.map((res) => {
          if (res.error) {
            throw res.error;
          }
          return this.deserializeBigIntsAndDates(
            res.result,
            deserializationOptions
          );
        });
      }
      // Single response in batch
      if (responseBody.error) {
        throw responseBody.error;
      }
      return [
        this.deserializeBigIntsAndDates(
          responseBody.result,
          deserializationOptions
        ),
      ];
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
      return `${value.toString()}n`;
    }
    if (value instanceof Date) {
      // Convert Date to ISO string with D: prefix if safeEnabled
      const isoString = value.toISOString();
      if (this.#options.safeEnabled) {
        return `D:${isoString}`;
      }
      // Show educational warning if enabled
      if (this.#options.warnOnUnsafe) {
        console.warn(
          '⚠️  Date serialization: Using plain ISO string format for JSON-RPC 2.0 compliance. Date objects will be deserialized as strings on the receiving end. Consider enabling safeEnabled or using string timestamps for better type safety.'
        );
      }
      return isoString;
    }
    if (typeof value === 'string') {
      // Add S: prefix if safeEnabled is true
      if (this.#options.safeEnabled) {
        return `S:${value}`;
      }
      // Show educational warning if enabled and string could be confused with BigInt
      if (this.#options.warnOnUnsafe && /^-?\d+n?$/.test(value)) {
        console.warn(
          `⚠️  String serialization: String "${value}" could be confused with BigInt. Consider enabling safeEnabled for disambiguation or use explicit typing.`
        );
      }
      return value;
    }
    if (Array.isArray(value)) {
      // Recurse into arrays
      return value.map((v) => this.serializeBigIntsAndDates(v));
    }
    if (value && typeof value === 'object') {
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
   * @param {boolean} [options.safeEnabled] Whether to expect safe prefixes for strings and dates.
   * @returns {any}
   */
  deserializeBigIntsAndDates(value, options = null) {
    // Use provided options or fall back to client options
    const safeEnabled = options
      ? options.safeEnabled
      : this.#options.safeEnabled;

    // More comprehensive ISO date regex that handles:
    // - UTC: 2023-01-01T12:00:00.000Z
    // - With timezone: 2023-01-01T12:00:00.000+01:00
    // - Without timezone: 2023-01-01T12:00:00.000 (treated as local)
    const ISO_DATE_REGEX =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

    // 1. Check if it's a string that might be a BigInt, Date, or safe string
    if (typeof value === 'string') {
      // Safe string check: if safeEnabled and starts with S:
      if (safeEnabled && value.startsWith('S:')) {
        return value.substring(2); // Remove 'S:' prefix
      }

      // Safe date check: if safeEnabled and starts with D:
      if (safeEnabled && value.startsWith('D:')) {
        const isoString = value.substring(2); // Remove 'D:' prefix
        const date = new Date(isoString);
        // Double-check that we got a valid date
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }

      // BigInt check: only convert strings that explicitly end with "n"
      // e.g., "42n", "-42n" but NOT "42", "0123456"
      if (/^-?\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1)); // Remove 'n' and convert
      }

      // Date check: matches an ISO 8601 string (only if safeEnabled is false)
      if (!safeEnabled && ISO_DATE_REGEX.test(value)) {
        const date = new Date(value);
        // Ensure it's valid
        if (!Number.isNaN(date.getTime())) {
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

module.exports = RpcClient;
