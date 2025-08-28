/* eslint-disable no-unused-vars, no-console */
/**
 * Example: Using RpcClient with self-signed certificates in development.
 *
 * WARNING: Do not disable SSL validation in production.
 */

const { RpcClient } = require('../src/index.js');

async function demonstrateSSLOptions() {
  console.log('=== RPC Client SSL Configuration Example ===\n');

  // Example 1: Standard production client (default - strict SSL)
  console.log('1. Production Client (strict SSL validation):');
  const productionClient = new RpcClient('https://api.example.com/rpc', {
    Authorization: 'Bearer prod-token',
  });
  console.log('   - Created client with strict SSL validation (default)\n');

  // Example 2: Development client for self-signed certificates (bypass validation)
  console.log('2. Development Client (bypass SSL validation):');
  console.log(
    '   To bypass SSL validation in Node.js, set BEFORE starting the client:'
  );
  console.log('   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";');
  console.log(
    '   - All requests will accept self-signed certificates (development only!)\n'
  );

  // Example 3: Best practices summary
  console.log('3. Best Practices:');
  console.log('   - Always use SSL validation in production');
  console.log(
    '   - Disable validation only for development with self-signed certificates'
  );
  console.log('   - Use environment variables to control SSL behavior');
  console.log(
    '   - Never commit process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" to production'
  );
  console.log(
    '   - Consider using valid development certificates instead of disabling validation\n'
  );

  // Example 4: Choose configuration based on environment
  console.log('4. Environment-based Configuration:');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = isDevelopment
    ? 'https://localhost:3000/api'
    : 'https://api.production.com/rpc';
  const environmentClient = new RpcClient(baseUrl, {
    Authorization: `Bearer ${process.env.API_TOKEN || 'default-token'}`,
    'X-Environment': process.env.NODE_ENV || 'development',
  });
  console.log(
    `   - Created client for ${isDevelopment ? 'development' : 'production'} environment`
  );
  console.log(
    `   - SSL validation: ${isDevelopment ? 'controlled by NODE_TLS_REJECT_UNAUTHORIZED' : 'enabled (secure)'}\n`
  );

  console.log('=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateSSLOptions().catch(console.error);
}

module.exports = { demonstrateSSLOptions };
