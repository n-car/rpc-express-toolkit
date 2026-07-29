import type { Router } from 'express';
import Main = require('./index');

/**
 * Public properties attached to the CommonJS safe preset export.
 */
declare namespace Safe {
  // Root values re-exported by src/safe.js.
  export import RpcEndpoint = Main;
  export import RpcClient = Main.RpcClient;
  export import RpcError = Main.RpcError;
  export import RpcHttpError = Main.RpcHttpError;
  export import Logger = Main.Logger;
  export import MiddlewareManager = Main.MiddlewareManager;
  export import builtInMiddlewares = Main.builtInMiddlewares;
  export import SchemaValidator = Main.SchemaValidator;
  export import commonSchemas = Main.commonSchemas;
  export import SchemaBuilder = Main.SchemaBuilder;
  export import BatchHandler = Main.BatchHandler;

  // Root public types previously re-exported by `export *`.
  export import JSONRPCHandler = Main.JSONRPCHandler;
  export import MethodConfig = Main.MethodConfig;
  export import JSONRPCError = Main.JSONRPCError;
  export import JSONRPCResponsePayload = Main.JSONRPCResponsePayload;
  export import LogLevel = Main.LogLevel;
  export import LoggingConfig = Main.LoggingConfig;
  export import CorsConfig = Main.CorsConfig;
  export import RateLimitConfig = Main.RateLimitConfig;
  export import AuthConfig = Main.AuthConfig;
  export import ValidationConfig = Main.ValidationConfig;
  export import RpcEndpointOptions = Main.RpcEndpointOptions;
  export import RpcClientOptions = Main.RpcClientOptions;
  export import RpcBatchRequest = Main.RpcBatchRequest;
  export import DeserializationOptions = Main.DeserializationOptions;
  export import MiddlewareHook = Main.MiddlewareHook;
  export import MiddlewareContext = Main.MiddlewareContext;
  export import Middleware = Main.Middleware;
  export import RpcMetrics = Main.RpcMetrics;
  export import SchemaValidationResult = Main.SchemaValidationResult;

  /**
   * RPC client with safe serialization enabled by default.
   */
  export class RpcSafeClient extends Main.RpcClient {
    constructor(
      endpoint: string,
      defaultHeaders?: Record<string, string>,
      options?: Main.RpcClientOptions
    );
  }

  /**
   * RPC endpoint with safe serialization and strict mode enabled by default.
   */
  export class RpcSafeEndpoint<C = any> extends Main<C> {
    constructor(
      router: Router,
      context: C,
      endpoint?: string,
      options?: Main.RpcEndpointOptions
    );
    constructor(router: Router, context: C, options?: Main.RpcEndpointOptions);
  }

  /**
   * @deprecated Use `new RpcSafeEndpoint(...)` instead.
   */
  export function createSafeEndpoint<C = any>(
    router: Router,
    context: C,
    endpoint?: string,
    options?: Main.RpcEndpointOptions
  ): RpcSafeEndpoint<C>;
  export function createSafeEndpoint<C = any>(
    router: Router,
    context: C,
    options?: Main.RpcEndpointOptions
  ): RpcSafeEndpoint<C>;

  /**
   * @deprecated Use `new RpcSafeClient(...)` instead.
   */
  export function createSafeClient(
    endpoint: string,
    defaultHeaders?: Record<string, string>,
    options?: Main.RpcClientOptions
  ): RpcSafeClient;
}

export = Safe;
