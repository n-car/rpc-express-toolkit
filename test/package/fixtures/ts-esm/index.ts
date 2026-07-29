import type { Router } from 'express';
import RpcEndpoint, {
  RpcClient,
  RpcEndpoint as NamedRpcEndpoint,
  serveScripts,
  type RpcEndpointOptions,
} from 'rpc-express-toolkit';
import {
  RpcClient as SafeRootClient,
  RpcEndpoint as SafeRootEndpoint,
  RpcSafeClient,
  RpcSafeEndpoint,
} from 'rpc-express-toolkit/safe';
import SafeProxy, {
  RpcClient as ProxyRootClient,
  RpcEndpoint as ProxyRootEndpoint,
  RpcSafeClient as ProxySafeClient,
  RpcSafeEndpoint as ProxySafeEndpoint,
} from 'rpc-express-toolkit-safe';

declare const router: Router;

const options: RpcEndpointOptions = {
  safeEnabled: false,
  strictMode: true,
};
const context = { consumer: 'esm' };

const endpoint = new RpcEndpoint(router, context, '/rpc', options);
const namedEndpoint = new NamedRpcEndpoint(router, context, options);
const client = new RpcClient('http://127.0.0.1/rpc');
const safeRootEndpoint = new SafeRootEndpoint(router, context, '/safe-root');
const safeRootClient = new SafeRootClient('http://127.0.0.1/safe-root');
const safeEndpoint = new RpcSafeEndpoint(router, context, '/safe');
const safeClient = new RpcSafeClient('http://127.0.0.1/safe');
const proxyRootEndpoint = new ProxyRootEndpoint(router, context, '/proxy-root');
const proxyRootClient = new ProxyRootClient('http://127.0.0.1/proxy-root');
const proxySafeEndpoint = new ProxySafeEndpoint(router, context, '/proxy');
const proxySafeClient = new ProxySafeClient('http://127.0.0.1/proxy');
const proxyDefaultEndpoint = new SafeProxy.RpcSafeEndpoint(
  router,
  context,
  '/proxy-default'
);
const proxyOptions: SafeProxy.RpcEndpointOptions = options;

const typedDefaultEndpoint: RpcEndpoint<typeof context> = endpoint;
const typedNamedEndpoint: NamedRpcEndpoint<typeof context> = namedEndpoint;

void [
  typedDefaultEndpoint,
  typedNamedEndpoint,
  client,
  safeRootEndpoint,
  safeRootClient,
  safeEndpoint,
  safeClient,
  proxyRootEndpoint,
  proxyRootClient,
  proxySafeEndpoint,
  proxySafeClient,
  proxyDefaultEndpoint,
  proxyOptions,
  serveScripts,
];
