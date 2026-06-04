const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidId(id) {
  return id === null || typeof id === 'string' || typeof id === 'number';
}

function isValidParams(params) {
  return Array.isArray(params) || isObject(params);
}

function validationError(message, id = null) {
  return {
    valid: false,
    responseId: id,
    error: {
      code: -32600,
      message,
    },
  };
}

function validateEnvelope(request) {
  if (!isObject(request)) {
    return validationError('Invalid Request: request must be an object');
  }

  const hasId = hasOwn(request, 'id');
  const responseId = hasId && isValidId(request.id) ? request.id : null;

  if (request.jsonrpc !== '2.0') {
    return validationError(
      "Invalid Request: 'jsonrpc' must be '2.0'.",
      responseId
    );
  }

  if (typeof request.method !== 'string') {
    return validationError(
      "Invalid Request: 'method' must be a string.",
      responseId
    );
  }

  if (request.method.length === 0) {
    return validationError(
      "Invalid Request: 'method' must not be empty.",
      responseId
    );
  }

  if (hasOwn(request, 'params') && !isValidParams(request.params)) {
    return validationError(
      "Invalid Request: 'params' must be an object or array.",
      responseId
    );
  }

  if (hasId && !isValidId(request.id)) {
    return validationError(
      "Invalid Request: 'id' must be a string, number, or null.",
      null
    );
  }

  return {
    valid: true,
    hasId,
    isNotification: !hasId,
    responseId,
  };
}

function addBatchIndex(error, batchIndex) {
  const data =
    error.data !== undefined && isObject(error.data) ? error.data : {};

  return {
    ...error,
    data: {
      ...data,
      ...(error.data !== undefined && !isObject(error.data)
        ? { value: error.data }
        : {}),
      batchIndex,
    },
  };
}

module.exports = {
  addBatchIndex,
  hasOwn,
  validateEnvelope,
};
