import assert from 'node:assert/strict';
import express from 'express';
import RpcEndpoint, {
  RpcClient,
  RpcEndpoint as NamedRpcEndpoint,
  serveScripts,
} from 'rpc-express-toolkit';
import {
  Logger as SafeLogger,
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

assert.equal(RpcEndpoint, NamedRpcEndpoint);
assert.equal(typeof RpcClient, 'function');
assert.equal(serveScripts, RpcEndpoint.serveScripts);
assert.equal(SafeRootEndpoint, RpcEndpoint);
assert.equal(SafeRootClient, RpcClient);
assert.equal(typeof SafeLogger, 'function');
assert.equal(typeof RpcSafeEndpoint, 'function');
assert.equal(typeof RpcSafeClient, 'function');
assert.equal(SafeProxy.RpcEndpoint, RpcEndpoint);
assert.equal(SafeProxy.RpcClient, RpcClient);
assert.equal(ProxyRootEndpoint, RpcEndpoint);
assert.equal(ProxyRootClient, RpcClient);
assert.equal(ProxySafeEndpoint, RpcSafeEndpoint);
assert.equal(ProxySafeClient, RpcSafeClient);

const app = express();
app.use(express.json());

const endpoint = new RpcEndpoint(app, { consumer: 'esm' }, '/rpc');
const safeEndpoint = new RpcSafeEndpoint(app, { consumer: 'esm' }, '/safe');
const client = new RpcClient('http://127.0.0.1/rpc');
const safeClient = new RpcSafeClient('http://127.0.0.1/safe');
const proxyEndpoint = new ProxySafeEndpoint(app, { consumer: 'esm' }, '/proxy');
const proxyClient = new ProxySafeClient('http://127.0.0.1/proxy');

assert.ok(endpoint instanceof RpcEndpoint);
assert.ok(safeEndpoint instanceof RpcSafeEndpoint);
assert.ok(client instanceof RpcClient);
assert.ok(safeClient instanceof RpcSafeClient);
assert.ok(proxyEndpoint instanceof RpcSafeEndpoint);
assert.ok(proxyClient instanceof RpcSafeClient);
