/**
 * Introspection Example - Client
 * Demonstrates how to use __rpc.* introspection methods
 */

const { RpcClient } = require('../..');

async function main() {
  const client = new RpcClient('http://localhost:3000/api');

  console.log('=== RPC Introspection Demo ===\n');

  // 1. List all methods
  console.log('1. __rpc.listMethods():');
  const methods = await client.call('__rpc.listMethods');
  console.log('  Available methods:', methods);
  console.log('');

  // 2. Get version info
  console.log('2. __rpc.version():');
  const version = await client.call('__rpc.version');
  console.log('  Toolkit:', version.toolkit);
  console.log('  Version:', version.version);
  console.log('  Express:', version.expressVersion);
  console.log('  Node:', version.nodeVersion);
  console.log('');

  // 3. Get server capabilities
  console.log('3. __rpc.capabilities():');
  const caps = await client.call('__rpc.capabilities');
  console.log('  Safe Mode:', caps.safeMode);
  console.log('  Batch Support:', caps.batch);
  console.log('  Introspection:', caps.introspection);
  console.log('  Method Count:', caps.methodCount);
  console.log('');

  // 4. Describe a specific method
  console.log('4. __rpc.describe({ method: "add" }):');
  const addInfo = await client.call('__rpc.describe', { method: 'add' });
  console.log('  Name:', addInfo.name);
  console.log('  Description:', addInfo.description);
  console.log('  Schema:', JSON.stringify(addInfo.schema, null, 2));
  console.log('');

  // 5. Describe all public methods
  console.log('5. __rpc.describeAll():');
  const allMethods = await client.call('__rpc.describeAll');
  allMethods.forEach(method => {
    console.log(`  - ${method.name}: ${method.description}`);
  });
  console.log('');

  // 6. Try to describe a private method (should fail)
  console.log('6. Try to describe private method:');
  try {
    await client.call('__rpc.describe', { method: 'internalCalculation' });
  } catch (error) {
    console.log('  Error:', error.message);
  }
  console.log('');

  // 7. Test a public method
  console.log('7. Call add method:');
  const sum = await client.call('add', { a: 5, b: 3 });
  console.log('  5 + 3 =', sum);
}

main().catch(console.error);
