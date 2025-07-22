"use strict";

/**
 * Simple structured logger for JSON-RPC operations
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enabled = options.enabled !== false;
    this.prefix = options.prefix || '[JSON-RPC]';
    this.customLogger = options.logger || null;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
  }

  /**
   * Check if the given level should be logged
   * @param {string} level 
   * @returns {boolean}
   */
  shouldLog(level) {
    return this.enabled && this.levels[level] <= this.levels[this.level];
  }

  /**
   * Format log message with metadata
   * @param {string} level 
   * @param {string} message 
   * @param {Object} meta 
   * @returns {Object}
   */
  formatMessage(level, message, meta = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    };
  }

  /**
   * Generic log method
   * @param {string} level 
   * @param {string} message 
   * @param {Object} meta 
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const logData = this.formatMessage(level, message, meta);
    
    if (this.customLogger) {
      this.customLogger[level](logData);
    } else {
      const logMessage = `${this.prefix} ${logData.timestamp} [${logData.level}] ${message}`;
      const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
      console[level === 'debug' || level === 'trace' ? 'log' : level](`${logMessage}${metaStr}`);
    }
  }

  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  info(message, meta) { this.log('info', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
  trace(message, meta) { this.log('trace', message, meta); }

  /**
   * Log RPC call start
   * @param {string} method 
   * @param {any} params 
   * @param {string|number} id 
   * @param {Object} req 
   */
  rpcCall(method, params, id, req) {
    this.info('RPC call started', {
      method,
      id,
      params: this.sanitizeParams(params),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress
    });
  }

  /**
   * Log RPC call success
   * @param {string} method 
   * @param {string|number} id 
   * @param {number} duration 
   * @param {any} result 
   */
  rpcSuccess(method, id, duration, result) {
    this.info('RPC call completed', {
      method,
      id,
      duration: `${duration}ms`,
      resultType: typeof result,
      resultSize: result ? JSON.stringify(result).length : 0
    });
  }

  /**
   * Log RPC call error
   * @param {string} method 
   * @param {string|number} id 
   * @param {number} duration 
   * @param {Error} error 
   */
  rpcError(method, id, duration, error) {
    this.error('RPC call failed', {
      method,
      id,
      duration: `${duration}ms`,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   * @param {any} params 
   * @returns {any}
   */
  sanitizeParams(params) {
    if (!params || typeof params !== 'object') return params;
    
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'authorization'];
    const sanitized = Array.isArray(params) ? [...params] : { ...params };
    
    const sanitizeObj = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitizeObj(value);
        }
      }
      return obj;
    };
    
    return sanitizeObj(sanitized);
  }
}

module.exports = Logger;
