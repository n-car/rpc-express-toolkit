import type { Router } from 'express';
import type { RpcEndpoint, RpcClient, RpcEndpointOptions, RpcClientOptions } from './index';

/**
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
 * Factory: create a RpcClient with safe defaults (safeEnabled=true).
 */
export function createSafeClient(
  endpoint: string,
  defaultHeaders?: Record<string, string>,
  options?: RpcClientOptions
): RpcClient;

export * from './index';

