'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const Main = require('rpc-express-toolkit');
const Safe = require('rpc-express-toolkit/safe');
const SafeProxy = require('rpc-express-toolkit-safe');

assert.equal(Main, Main.RpcEndpoint);
assert.equal(typeof Main.RpcClient, 'function');
assert.equal(typeof Main.serveScripts, 'function');
assert.equal(Safe.RpcEndpoint, Main.RpcEndpoint);
assert.equal(Safe.RpcClient, Main.RpcClient);
assert.equal(Safe.Logger, Main.Logger);
assert.equal(typeof Safe.RpcSafeEndpoint, 'function');
assert.equal(typeof Safe.RpcSafeClient, 'function');
assert.equal(SafeProxy.RpcEndpoint, Main.RpcEndpoint);
assert.equal(SafeProxy.RpcClient, Main.RpcClient);
assert.equal(SafeProxy.RpcSafeEndpoint, Safe.RpcSafeEndpoint);
assert.equal(SafeProxy.RpcSafeClient, Safe.RpcSafeClient);

const app = express();
app.use(express.json());

const endpoint = new Main(app, { consumer: 'commonjs' }, '/rpc');
const safeEndpoint = new Safe.RpcSafeEndpoint(
  app,
  { consumer: 'commonjs' },
  '/safe'
);
const client = new Main.RpcClient('http://127.0.0.1/rpc');
const safeClient = new Safe.RpcSafeClient('http://127.0.0.1/safe');
const proxyEndpoint = new SafeProxy.RpcSafeEndpoint(
  app,
  { consumer: 'commonjs' },
  '/proxy'
);
const proxyClient = new SafeProxy.RpcSafeClient('http://127.0.0.1/proxy');

assert.ok(endpoint instanceof Main);
assert.ok(safeEndpoint instanceof Safe.RpcSafeEndpoint);
assert.ok(client instanceof Main.RpcClient);
assert.ok(safeClient instanceof Safe.RpcSafeClient);
assert.ok(proxyEndpoint instanceof Safe.RpcSafeEndpoint);
assert.ok(proxyClient instanceof Safe.RpcSafeClient);
