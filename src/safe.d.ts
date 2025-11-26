import type { Router } from 'express';
import type { RpcEndpoint, RpcClient, RpcEndpointOptions, RpcClientOptions } from './index';

/**
 * RPC Client with safe serialization enabled by default.
 * Extends RpcClient with safeEnabled: true preset.
 */
export class RpcSafeClient extends RpcClient {
  constructor(
    endpoint: string,
    defaultHeaders?: Record<string, string>,
    options?: RpcClientOptions
  );
}

/**
 * RPC Endpoint with safe serialization enabled by default.
 * Extends RpcEndpoint with safeEnabled: true and strictMode: true presets.
 */
export class RpcSafeEndpoint<C = any> extends RpcEndpoint<C> {
  constructor(
    router: Router,
    context: C,
    endpoint?: string,
    options?: RpcEndpointOptions
  );
  
  constructor(
    router: Router,
    context: C,
    options?: RpcEndpointOptions
  );
}

/**
 * @deprecated Use `new RpcSafeEndpoint(...)` instead.
 * Factory: create a RpcEndpoint with safe defaults (safeEnabled=true, strictMode=true).
 */
export function createSafeEndpoint<C = any>(
  router: Router,
  context: C,
  endpoint?: string,
  options?: RpcEndpointOptions
): RpcEndpoint<C>;

export function createSafeEndpoint<C = any>(
  router: Router,
  context: C,
  options?: RpcEndpointOptions
): RpcEndpoint<C>;

/**
 * @deprecated Use `new RpcSafeClient(...)` instead.
 * Factory: create a RpcClient with safe defaults (safeEnabled=true).
 */
export function createSafeClient(
  endpoint: string,
  defaultHeaders?: Record<string, string>,
  options?: RpcClientOptions
): RpcClient;

export * from './index';

