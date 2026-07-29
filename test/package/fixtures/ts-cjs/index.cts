import express = require('express');
import RpcEndpoint = require('rpc-express-toolkit');
import Safe = require('rpc-express-toolkit/safe');
import SafeProxy = require('rpc-express-toolkit-safe');

const app = express();
app.use(express.json());

const options: RpcEndpoint.RpcEndpointOptions = {
  safeEnabled: false,
  strictMode: true,
};
const context = { consumer: 'commonjs' };

const endpoint = new RpcEndpoint(app, context, '/rpc', options);
const client = new RpcEndpoint.RpcClient('http://127.0.0.1/rpc');
const safeRootEndpoint = new Safe.RpcEndpoint(app, context, '/safe-root');
const safeRootClient = new Safe.RpcClient('http://127.0.0.1/safe-root');
const safeEndpoint = new Safe.RpcSafeEndpoint(app, context, '/safe');
const safeClient = new Safe.RpcSafeClient('http://127.0.0.1/safe');
const proxyRootEndpoint = new SafeProxy.RpcEndpoint(
  app,
  context,
  '/proxy-root'
);
const proxyRootClient = new SafeProxy.RpcClient('http://127.0.0.1/proxy-root');
const proxySafeEndpoint = new SafeProxy.RpcSafeEndpoint(app, context, '/proxy');
const proxySafeClient = new SafeProxy.RpcSafeClient('http://127.0.0.1/proxy');
const proxyOptions: SafeProxy.RpcEndpointOptions = options;

const typedDefaultEndpoint: RpcEndpoint<typeof context> = endpoint;
const typedNamedEndpoint: RpcEndpoint.RpcEndpoint<typeof context> = endpoint;

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
  proxyOptions,
];
