/**
 * JSON-RPC envelope validation helpers.
 */

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function isValidId(id) {
  return id === null || typeof id === 'string' || typeof id === 'number';
}

function isValidParams(params) {
  return Array.isArray(params) || (params !== null && typeof params === 'object');
}

function validateEnvelope(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {
      valid: false,
      id: null,
      error: {
        code: -32600,
        message: 'Invalid Request: Request must be an object.',
      },
    };
  }

  const id = hasOwn(request, 'id') ? request.id : null;

  if (request.jsonrpc !== '2.0') {
    return {
      valid: false,
      id,
      error: {
        code: -32600,
        message: "Invalid Request: 'jsonrpc' must be '2.0'.",
      },
    };
  }

  if (typeof request.method !== 'string' || request.method.length === 0) {
    return {
      valid: false,
      id,
      error: {
        code: -32600,
        message: "Invalid Request: 'method' must be a non-empty string.",
      },
    };
  }

  if (hasOwn(request, 'params') && !isValidParams(request.params)) {
    return {
      valid: false,
      id,
      error: {
        code: -32600,
        message: "Invalid Request: 'params' must be an object or array.",
      },
    };
  }

  if (hasOwn(request, 'id') && !isValidId(request.id)) {
    return {
      valid: false,
      id: null,
      error: {
        code: -32600,
        message: "Invalid Request: 'id' must be a string, number, or null.",
      },
    };
  }

  return {
    valid: true,
    id,
    hasId: hasOwn(request, 'id'),
  };
}

module.exports = {
  validateEnvelope,
  hasOwn,
};
