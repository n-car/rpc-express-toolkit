const express = require('express');
const { RpcEndpoint, RpcClient } = require('../src/index');

// === SERVER SETUP ===
const app = express();
app.use(express.json());

const context = {
  database: new Map(),
  userId: 'system',
};

// Create JSON-RPC endpoint
const rpc = new RpcEndpoint(app, context);

// Add some methods
rpc.addMethod('saveData', (req, ctx, params) => {
  const { key, value } = params;
  ctx.database.set(key, value);
  return { success: true, message: `Data saved with key: ${key}` };
});

rpc.addMethod('getData', (req, ctx, params) => {
  const { key } = params;
  const value = ctx.database.get(key);
  if (value === undefined) {
    throw new Error(`Key '${key}' not found`);
  }
  return { key, value };
});

rpc.addMethod('getAllData', (req, ctx) =>
  Array.from(ctx.database.entries()).map(([key, value]) => ({
    key,
    value,
  }))
);

rpc.addMethod('testBigInt', (req, ctx, params) => {
  const bigNumber = BigInt(params.number || '123456789012345678901234567890');
  return {
    original: params.number,
    bigint: bigNumber,
    doubled: bigNumber * 2n,
    timestamp: new Date(),
  };
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/api`);

  // === CLIENT DEMO ===
  setTimeout(async () => {
    console.log('\nTesting client...');

    const client = new RpcClient(`http://localhost:${PORT}/api`);

    try {
      // Test 1: Save some data
      console.log('Saving data...');
      const saveResult = await client.call('saveData', {
        key: 'test',
        value: 'Hello World!',
      });
      console.log('Save result:', saveResult);

      // Test 2: Get data back
      console.log('\nGetting data...');
      const getData = await client.call('getData', { key: 'test' });
      console.log('Get result:', getData);

      // Test 3: Test BigInt handling
      console.log('\nTesting BigInt...');
      const bigIntResult = await client.call('testBigInt', {
        number: '999999999999999999999999999999',
      });
      console.log('BigInt result:', bigIntResult);
      console.log('   - bigint type:', typeof bigIntResult.bigint);
      console.log('   - doubled type:', typeof bigIntResult.doubled);
      console.log('   - timestamp type:', typeof bigIntResult.timestamp);

      // Test 4: Get all data
      console.log('\nGetting all data...');
      const allData = await client.call('getAllData');
      console.log('All data:', allData);

      // Test 5: Test error handling
      console.log('\nTesting error handling...');
      try {
        await client.call('getData', { key: 'nonexistent' });
      } catch (error) {
        console.log('Error caught correctly:', error.message);
      }

      console.log('\nAll tests completed successfully!');
    } catch (error) {
      console.error('Client error:', error);
    }

    // Close server after demo
    setTimeout(() => {
      server.close(() => {
        console.log('\nServer closed');
        process.exit(0);
      });
    }, 1000);
  }, 1000);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
