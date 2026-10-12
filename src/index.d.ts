// Type definitions for rpc-express-toolkit

import type { Request, Response, Router } from 'express';
import {
  RpcClient as SharedRpcClient,
  RpcError as SharedRpcError,
  RpcHttpError as SharedRpcHttpError,
  RpcSafeClient as SharedRpcSafeClient,
} from 'rpc-toolkit-js-client';
import type {
  RpcBatchRequest as SharedRpcBatchRequest,
  RpcClientOptions as SharedRpcClientOptions,
} from 'rpc-toolkit-js-client';

/**
 * The main RpcEndpoint class for JSON-RPC 2.0 endpoints.
 */
declare class RpcEndpoint<C = any> {
  constructor(router: Router, context: C, endpoint?: string);
  constructor(
    router: Router,
    context: C,
    options?: RpcEndpoint.RpcEndpointOptions
  );
  constructor(
    router: Router,
    context: C,
    endpoint?: string,
    options?: RpcEndpoint.RpcEndpointOptions
  );

  /** The endpoint path, for example "/api". */
  get endpoint(): string;

  /** All registered methods. */
  get methods(): Record<
    string,
    RpcEndpoint.JSONRPCHandler<C> | RpcEndpoint.MethodConfig<C>
  >;

  get logger(): RpcEndpoint.Logger;
  get middleware(): RpcEndpoint.MiddlewareManager;
  get validator(): RpcEndpoint.SchemaValidator;
  get options(): RpcEndpoint.RpcEndpointOptions;

  addMethod(name: string, handler: RpcEndpoint.JSONRPCHandler<C>): void;
  addMethod(
    name: string,
    handler: RpcEndpoint.JSONRPCHandler<C>,
    schemaOrOptions: object
  ): void;
  addMethod(name: string, config: RpcEndpoint.MethodConfig<C>): void;

  use(hook: RpcEndpoint.MiddlewareHook, middleware: Function): void;

  removeMethod(name: string): void;
  getMethod(
    name: string
  ): RpcEndpoint.JSONRPCHandler<C> | RpcEndpoint.MethodConfig<C> | undefined;
  listMethods(): string[];
  getMetrics(): object;

  formatError(error: unknown, batchIndex?: number): RpcEndpoint.JSONRPCError;

  static serveScripts(router: Router, url?: string): void;

  reply(
    res: Response,
    responsePayload: RpcEndpoint.JSONRPCResponsePayload
  ): void;

  serializeBigIntsAndDates(value: any): any;
  deserializeBigIntsAndDates(
    value: any,
    options?: RpcEndpoint.DeserializationOptions
  ): any;
}

/**
 * Public properties and types attached to the CommonJS export.
 */
declare namespace RpcEndpoint {
  // module.exports.RpcEndpoint === module.exports
  export { RpcEndpoint };

  // Classes re-exported from rpc-toolkit-js-client.
  export {
    SharedRpcClient as RpcClient,
    SharedRpcError as RpcError,
    SharedRpcHttpError as RpcHttpError,
    SharedRpcSafeClient as RpcSafeClient,
  };

  /** JSON-RPC handler function. */
  export type JSONRPCHandler<C> = (
    req: Request,
    context: C,
    params: any,
    callContext?: MiddlewareContext<C>
  ) => any | Promise<any>;

  /** Method configuration object. */
  export interface MethodConfig<C> {
    handler: JSONRPCHandler<C>;
    schema?: object;
    exposeSchema?: boolean;
    description?: string;
  }

  /** JSON-RPC error object. */
  export interface JSONRPCError {
    code: number;
    message: string;
    data?: any;
  }

  /** JSON-RPC response payload. */
  export interface JSONRPCResponsePayload {
    id?: string | number | null;
    result?: any;
    error?: JSONRPCError;
  }

  export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

  /** Logging configuration. */
  export interface LoggingConfig {
    level?: LogLevel;
    enabled?: boolean;
    prefix?: string;
    logger?: Partial<
      Record<LogLevel, (entry: Record<string, unknown>) => void>
    >;
    format?: 'json' | 'simple';
    transports?: Array<'console' | 'file'>;
    file?: {
      filename?: string;
      maxsize?: number;
      maxFiles?: number;
    };
  }

  /** CORS configuration. */
  export interface CorsConfig {
    origin?: string | string[] | boolean;
    credentials?: boolean;
    methods?: string[];
    allowedHeaders?: string[];
    headers?: string[];
  }

  /** Rate limiting configuration. */
  export interface RateLimitConfig {
    windowMs?: number;
    max?: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    store?: RateLimitStore;
  }

  /** Authentication verifier. A truthy non-boolean result becomes authenticatedUser. */
  export type AuthConfig = (req: Request) => unknown | Promise<unknown>;

  export interface RateLimitStore {
    increment(
      key: string,
      windowMs: number,
      now: number
    ): number | Promise<number>;
  }

  /** Schema validation configuration. */
  export interface ValidationConfig {
    strict?: boolean;
    coerceTypes?: boolean;
    removeAdditional?: boolean;
    useDefaults?: boolean;
    ajvOptions?: Record<string, unknown>;
  }

  /** RPC endpoint configuration options. */
  export interface RpcEndpointOptions {
    endpoint?: string;
    prefix?: string;
    maxBodySize?: string;
    timeout?: number;
    cors?: boolean | CorsConfig;
    auth?: AuthConfig;
    validation?: ValidationConfig;
    safeEnabled?: boolean;
    crossConfigurationEnabled?: boolean;
    enableSchema?: boolean;
    rateLimit?: RateLimitConfig;
    logging?: LoggingConfig;
    warnOnUnsafe?: boolean;
    strictMode?: boolean;
    /** Hide unexpected error details (default true); false is for local debugging only. */
    sanitizeErrors?: boolean;
    maxSerializationDepth?: number;
    maxDeserializationDepth?: number;
    autoJsonMiddleware?: boolean;
    jsonOptions?: {
      limit?: string;
      strict?: boolean;
      type?: string | string[] | ((req: any) => boolean);
      verify?: (req: any, res: any, buf: Buffer, encoding: string) => void;
    };
    methodWhitelist?: string[];
    timing?: boolean;
    metrics?: boolean;
    healthCheck?: boolean;
    enableIntrospection?: boolean;
    introspectionPrefix?: string;
    enableBatch?: boolean;
    maxBatchSize?: number;
  }

  /** RPC client configuration options. */
  export type RpcClientOptions = SharedRpcClientOptions;
  export type RpcBatchRequest = SharedRpcBatchRequest;

  /** Deserialization options for safe prefixes. */
  export interface DeserializationOptions {
    safeEnabled?: boolean;
  }

  export type MiddlewareHook =
    | 'beforeCall'
    | 'afterCall'
    | 'onError'
    | 'beforeValidation'
    | 'afterValidation';

  export interface MiddlewareContext<C = any> {
    req?: Request;
    res?: Response | null;
    context?: C;
    method?: string;
    params?: any;
    result?: any;
    error?: any;
    batchIndex?: number;
    isNotification?: boolean;
    startTime?: number;
    authenticatedUser?: unknown;
    [key: string]: any;
  }

  export type Middleware = (context: MiddlewareContext) => any | Promise<any>;

  export interface RpcMetrics {
    methods: number;
    middleware: {
      beforeCall: number;
      afterCall: number;
      onError: number;
    };
    uptime: number;
    memory: Record<string, number>;
    timestamp: string;
  }

  /**
   * Utility helpers were historically exposed as `any`. Keep their instance
   * contracts permissive in this patch while still publishing value/type names.
   */
  export type Logger = any;
  export const Logger: {
    new (...args: any[]): Logger;
  };

  export type MiddlewareManager = any;
  export const MiddlewareManager: {
    new (...args: any[]): MiddlewareManager;
  };

  export const MemoryRateLimitStore: {
    new (): RateLimitStore;
  };

  export const builtInMiddlewares: any;

  export interface SchemaValidationResult<T = any> {
    valid: boolean;
    errors: any[] | null;
    data: T;
  }

  export type SchemaValidator = any;
  export const SchemaValidator: {
    new (...args: any[]): SchemaValidator;
  };

  export const commonSchemas: any;

  export type SchemaBuilder = any;
  export const SchemaBuilder: {
    new (...args: any[]): SchemaBuilder;
  };

  export type BatchHandler = any;
  export const BatchHandler: {
    new (...args: any[]): BatchHandler;
  };
}

export = RpcEndpoint;
