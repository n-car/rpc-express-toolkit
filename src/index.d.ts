// Type definitions for rpc-express-toolkit

import type { Router, Request, Response } from 'express';

/**
 * JSON-RPC handler function type
 */
type JSONRPCHandler<C> = (
  req: Request,
  context: C,
  params: any
) => any | Promise<any>;

/**
 * Method configuration object
 */
interface MethodConfig<C> {
  handler: JSONRPCHandler<C>;
  schema?: object;
}

/**
 * JSON-RPC error object
 */
interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC response payload
 */
interface JSONRPCResponsePayload {
  id?: string | number | null;
  result?: any;
  error?: JSONRPCError;
}

/**
 * Logging configuration
 */
interface LoggingConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  format?: 'json' | 'simple';
  transports?: Array<'console' | 'file'>;
  file?: {
    filename?: string;
    maxsize?: number;
    maxFiles?: number;
  };
}

/**
 * CORS configuration
 */
interface CorsConfig {
  origin?: string | string[] | boolean;
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

/**
 * Authentication configuration
 */
interface AuthConfig {
  required?: boolean;
  verify?: (req: Request) => boolean | Promise<boolean>;
}

/**
 * Schema validation configuration
 */
interface ValidationConfig {
  strict?: boolean;
  coerceTypes?: boolean;
  removeAdditional?: boolean;
}

/**
 * RPC endpoint configuration options
 */
interface RpcEndpointOptions {
  prefix?: string;
  maxBodySize?: string;
  timeout?: number;
  cors?: boolean | CorsOptions;
  auth?: AuthConfig;
  validation?: ValidationConfig;
  safeEnabled?: boolean;
  crossConfigurationEnabled?: boolean;
  enableSchema?: boolean;
  rateLimit?: RateLimitConfig;
  logging?: LoggingConfig;
  warnOnUnsafe?: boolean;
  strictMode?: boolean;
  autoJsonMiddleware?: boolean;
  jsonOptions?: {
    limit?: string;
    strict?: boolean;
    type?: string | string[] | ((req: any) => boolean);
    verify?: (req: any, res: any, buf: Buffer, encoding: string) => void;
  };
}

/**
 * RPC client configuration options
 */
interface RpcClientOptions {
  safeEnabled?: boolean;
  warnOnUnsafe?: boolean;
}

/**
 * Deserialization options for safe prefixes
 */
interface DeserializationOptions {
  safeEnabled?: boolean;
}

/**
 * The main RpcEndpoint class for JSON-RPC 2.0 endpoints.
 */
declare class RpcEndpoint<C = any> {
  /**
   * Constructor.
   */
  constructor(router: Router, context: C, endpoint?: string);
  constructor(router: Router, context: C, options?: RpcEndpointOptions);
  constructor(router: Router, context: C, endpoint?: string, options?: RpcEndpointOptions);

  /**
   * Returns the endpoint path, e.g. "/api".
   */
  get endpoint(): string;

  /**
   * Returns the map of all registered methods.
   */
  get methods(): { [methodName: string]: JSONRPCHandler<C> | MethodConfig<C> };

  /**
   * Get logger instance
   */
  get logger(): any;

  /**
   * Get middleware manager
   */
  get middleware(): any;

  /**
   * Get validator instance
   */
  get validator(): any;

  /**
   * Add a JSON-RPC method with optional schema validation.
   */
  addMethod(name: string, handler: JSONRPCHandler<C>): void;
  addMethod(name: string, handler: JSONRPCHandler<C>, schema: object): void;
  addMethod(name: string, config: MethodConfig<C>): void;

  /**
   * Add middleware for specific hooks
   */
  use(hook: 'beforeCall' | 'afterCall' | 'onError' | 'beforeValidation' | 'afterValidation', middleware: Function): void;

  /**
   * Remove a method
   */
  removeMethod(name: string): void;

  /**
   * Get method configuration
   */
  getMethod(name: string): JSONRPCHandler<C> | MethodConfig<C> | undefined;

  /**
   * List all registered methods
   */
  listMethods(): string[];

  /**
   * Get metrics data
   */
  getMetrics(): object;

  /**
   * Serve client scripts (for calling JSON-RPC from browser).
   */
  static serveScripts(router: Router, url?: string): void;

  /**
   * Send a JSON-RPC 2.0 response to the client.
   */
  reply(res: Response, responsePayload: JSONRPCResponsePayload): void;

  /**
   * Recursively serialize BigInt and Date to JSON-safe string formats.
   */
  serializeBigIntsAndDates(value: any): any;

  /**
   * Recursively deserialize strings representing BigInt and Date.
   */
  deserializeBigIntsAndDates(value: any, options?: DeserializationOptions): any;
}

/**
 * JSON-RPC 2.0 Client for Node.js environments.
 */
declare class RpcClient {
  /**
   * Client constructor.
   */
  constructor(endpoint: string, options?: RpcClientOptions);
  constructor(endpoint: string, defaultHeaders?: Record<string, string>, options?: RpcClientOptions);

  /**
   * Make a JSON-RPC call to the server.
   */
  call<T = any>(
    method: string,
    params?: any,
    id?: string | number | null,
    overrideHeaders?: Record<string, string>
  ): Promise<T>;

  /**
   * Make a JSON-RPC notification (no response expected).
   */
  notify(
    method: string,
    params?: any,
    overrideHeaders?: Record<string, string>
  ): Promise<void>;

  /**
   * Make a batch JSON-RPC call.
   */
  batch<T = any>(
    requests: Array<{
      method: string;
      params?: any;
      id?: string | number | null;
      notification?: boolean;
    }>,
    overrideHeaders?: Record<string, string>
  ): Promise<T[]>;

  /**
   * Recursively serialize BigInt and Date to JSON-safe string formats.
   */
  serializeBigIntsAndDates(value: any): any;

  /**
   * Recursively deserialize strings representing BigInt and Date.
   */
  deserializeBigIntsAndDates(value: any, options?: DeserializationOptions): any;
}

/**
 * Export types for external use
 */
export {
  JSONRPCHandler,
  MethodConfig,
  JSONRPCError,
  JSONRPCResponsePayload,
  LoggingConfig,
  CorsConfig,
  RateLimitConfig,
  AuthConfig,
  ValidationConfig,
  RpcEndpointOptions,
  RpcClientOptions,
  DeserializationOptions,
  RpcEndpoint,
  RpcClient
};

/**
 * Main export - RpcEndpoint class with static properties
 */
declare const Main: {
  new <C>(router: Router, context: C, endpoint?: string): RpcEndpoint<C>;
  new <C>(router: Router, context: C, options?: RpcEndpointOptions): RpcEndpoint<C>;
  new <C>(router: Router, context: C, endpoint?: string, options?: RpcEndpointOptions): RpcEndpoint<C>;
  prototype: RpcEndpoint<any>;
  serveScripts(router: Router, url?: string): void;
  RpcEndpoint: typeof RpcEndpoint;
  RpcClient: typeof RpcClient;
  Logger: any;
  MiddlewareManager: any;
  builtInMiddlewares: any;
  SchemaValidator: any;
  commonSchemas: any;
  SchemaBuilder: any;
  BatchHandler: any;
};

export = Main;
