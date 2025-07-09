/**
 * Example demonstrating how to use RpcClient with self-signed certificates
 * in development environments.
 * 
 * WARNING: Only use rejectUnauthorized: false in development!
 * Never use this in production as it disables SSL certificate validation.
 */

const { RpcClient } = require('../src/index.js');

async function demonstrateSSLOptions() {
  console.log('=== RPC Client SSL Configuration Example ===\n');

  // Example 1: Standard production client (default - strict SSL)
  console.log('1. Production Client (strict SSL validation):');
  const productionClient = new RpcClient('https://api.example.com/rpc', {
    'Authorization': 'Bearer prod-token'
  });
  console.log('   ✓ Created client with strict SSL validation (default)\n');


  // Example 2: Development client for self-signed certificates (bypasses ALL SSL validation)
  console.log('2. Development Client (bypasses SSL validation):');
  const developmentClient = new RpcClient('https://localhost:3000/api', {
    'Authorization': 'Bearer dev-token',
    'X-Environment': 'development'
  }, {
    rejectUnauthorized: false // Solo per sviluppo!
  });
  console.log('   ✓ Created client that bypasses SSL certificate validation');
  console.log('   ⚠️  WARNING: Only use this for development with self-signed certificates!\n');

  // Example 3: Development client with custom CA (accepts only your self-signed CA)
  console.log('3. Development Client with custom CA:');
  const fs = require('fs');
  const ca = fs.readFileSync('path/to/your/selfsigned-ca.pem');
  const devClientWithCA = new RpcClient('https://localhost:3000/api', {
    'Authorization': 'Bearer dev-token',
    'X-Environment': 'development'
  }, {
    ca // Passa il certificato della tua CA self-signed
  });
  console.log('   ✓ Created client that accepts only your self-signed CA');
  console.log('   ⚠️  WARNING: This is safer than disabling validation, but use valid certificates in production!\n');

  // Example 4: Demonstrate how to choose configuration based on environment
  console.log('4. Environment-based Configuration:');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = isDevelopment ? 'https://localhost:3000/api' : 'https://api.production.com/rpc';
  const environmentClient = new RpcClient(baseUrl, {
    'Authorization': `Bearer ${process.env.API_TOKEN || 'default-token'}`,
    'X-Environment': process.env.NODE_ENV || 'development'
  }, isDevelopment ? { ca } : {});
  console.log(`   ✓ Created client for ${isDevelopment ? 'development' : 'production'} environment`);
  console.log(`   ✓ SSL validation: ${isDevelopment ? 'custom CA (dev only)' : 'enabled (secure)'}\n`);

  // Example usage (commented out since we don't have a real server)
  /*
  try {
    // This would work with a real server
    const result = await developmentClient.call('ping', {});
    console.log('Server response:', result);
  } catch (error) {
    console.error('Error calling server:', error.message);
  }
  */

  console.log('4. Best Practices:');
  console.log('   ✓ Always use strict SSL validation in production');
  console.log('   ✓ Only disable SSL validation for development with self-signed certificates');
  console.log('   ✓ Use environment variables to control SSL behavior');
  console.log('   ✓ Never commit rejectUnauthorized: false to production code');
  console.log('   ✓ Consider using proper development certificates instead of disabling validation\n');

  console.log('=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateSSLOptions().catch(console.error);
}

module.exports = { demonstrateSSLOptions };
