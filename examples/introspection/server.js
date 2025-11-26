/**
 * Introspection Example - Server
 * Demonstrates how to enable and use __rpc.* introspection methods
 */

const express = require('express');
const { RpcEndpoint } = require('../..');

const app = express();
app.use(express.json());

// Context for methods
const context = {
  database: 'mock-db',
  config: { maxValue: 1000 },
};

// Create endpoint with introspection enabled
const rpc = new RpcEndpoint(app, context, {
  endpoint: '/api',
  enableIntrospection: true, // Enable __rpc.* methods
  introspectionPrefix: '__rpc', // Optional: customize prefix (default: __rpc)
});

// Public method with exposed schema
rpc.addMethod('add', async (req, ctx, params) => params.a + params.b, {
  schema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  exposeSchema: true,
  description: 'Add two numbers and return the sum',
});

// Public method with exposed schema
rpc.addMethod('multiply', async (req, ctx, params) => params.a * params.b, {
  schema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  exposeSchema: true,
  description: 'Multiply two numbers',
});

// Private method (schema not exposed)
rpc.addMethod(
  'internalCalculation',
  async (req, ctx, params) => params.value * 2 + 42,
  {
    schema: {
      type: 'object',
      properties: {
        value: { type: 'number' },
      },
      required: ['value'],
    },
    exposeSchema: false, // Schema is private
    description: 'Internal calculation (not exposed)',
  }
);

// Public method without schema
rpc.addMethod('echo', async (req, ctx, params) => params, {
  exposeSchema: true,
  description: 'Echo back the parameters',
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `RPC Server with introspection running on http://localhost:${PORT}/api`
  );
  console.log('\nAvailable introspection methods:');
  console.log('- __rpc.listMethods()');
  console.log('- __rpc.describe({method: "add"})');
  console.log('- __rpc.describeAll()');
  console.log('- __rpc.version()');
  console.log('- __rpc.capabilities()');
  console.log('\nTry: node client.js');
});
