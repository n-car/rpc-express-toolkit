const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * JSON-RPC 2.0 Schema Validation Error
 */
class SchemaValidator {
  constructor(options = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      removeAdditional: options.removeAdditional || false,
      useDefaults: options.useDefaults !== false,
      ...options.ajvOptions,
    });

    addFormats(this.ajv);

    // Add custom formats
    this.addCustomFormats();
  }

  /**
   * Add custom format validators
   */
  addCustomFormats() {
    // BigInt format
    this.ajv.addFormat('bigint', {
      type: 'string',
      validate: (data) => /^-?\d+n?$/.test(data),
    });

    // ObjectId format (MongoDB style)
    this.ajv.addFormat('objectid', {
      type: 'string',
      validate: (data) => /^[0-9a-fA-F]{24}$/.test(data),
    });
  }

  /**
   * Validate parameters against a schema
   * @param {any} params
   * @param {Object} schema
   * @returns {Object} validation result
   */
  validate(params, schema) {
    const validator = this.ajv.compile(schema);
    const valid = validator(params);

    return {
      valid,
      errors: valid ? null : validator.errors,
      data: params,
    };
  }

  /**
   * Create a validation middleware
   * @param {Object} schema
   * @returns {Function}
   */
  middleware(schema) {
    return async (context) => {
      const { params } = context;
      const result = this.validate(params, schema);

      if (!result.valid) {
        const error = new Error('Validation failed');
        error.code = -32602; // Invalid params
        error.data = {
          validationErrors: result.errors.map((err) => ({
            field: err.instancePath || err.schemaPath,
            message: err.message,
            value: err.data,
          })),
        };
        throw error;
      }

      // Update params with validated/coerced data
      context.params = result.data;
      return context;
    };
  }

  /**
   * Add a custom keyword
   * @param {string} name
   * @param {Object} definition
   */
  addKeyword(name, definition) {
    this.ajv.addKeyword(name, definition);
  }
}

/**
 * Common schema definitions
 */
const commonSchemas = {
  // Pagination parameters
  pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
      sort: { type: 'string' },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
    },
  },

  // User identification
  userId: {
    oneOf: [
      { type: 'string', format: 'objectid' },
      { type: 'string', format: 'uuid' },
      { type: 'integer', minimum: 1 },
    ],
  },

  // Email validation
  email: {
    type: 'string',
    format: 'email',
    maxLength: 255,
  },

  // Password requirements
  password: {
    type: 'string',
    minLength: 8,
    maxLength: 128,
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
  },

  // BigInt validation
  bigintString: {
    type: 'string',
    format: 'bigint',
  },

  // Date validation
  dateString: {
    type: 'string',
    format: 'date-time',
  },
};

/**
 * Schema builder helper
 */
class SchemaBuilder {
  constructor() {
    this.schema = {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  /**
   * Add a property to the schema
   * @param {string} name
   * @param {Object} definition
   * @param {boolean} required
   * @returns {SchemaBuilder}
   */
  property(name, definition, required = false) {
    this.schema.properties[name] = definition;
    if (required) {
      this.schema.required.push(name);
    }
    return this;
  }

  /**
   * Add multiple properties
   * @param {Object} properties
   * @returns {SchemaBuilder}
   */
  properties(properties) {
    Object.entries(properties).forEach(([name, definition]) => {
      this.property(name, definition);
    });
    return this;
  }

  /**
   * Set required fields
   * @param {string[]} fields
   * @returns {SchemaBuilder}
   */
  required(fields) {
    this.schema.required = [...new Set([...this.schema.required, ...fields])];
    return this;
  }

  /**
   * Add additional properties setting
   * @param {boolean} allowed
   * @returns {SchemaBuilder}
   */
  additionalProperties(allowed) {
    this.schema.additionalProperties = allowed;
    return this;
  }

  /**
   * Build and return the schema
   * @returns {Object}
   */
  build() {
    return this.schema;
  }
}

module.exports = {
  SchemaValidator,
  commonSchemas,
  SchemaBuilder,
};
