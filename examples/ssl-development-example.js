/**
 * Example demonstratin  // Example 3: Best practices
  console.log('3. Best Practices:');
  console.log('   ✓ Always use SSL validation in production');
  console.log('   ✓ Disable validation only for development with self-signed certificates');
  console.log('   ✓ Use environment variables to control SSL behavior');
  console.log('   ✓ Never commit process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" to production');
  console.log('   ✓ Consider using valid development certificates instead of disabling validation\n');o use RpcClient with self-signed certificates
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
    Authorization: 'Bearer prod-token',
  });
  console.log('   ✓ Created client with strict SSL validation (default)\n');

  // Example 2: Development client for self-signed certificates (bypasses ALL SSL validation)
  console.log('2. Development Client (bypasses SSL validation):');
  console.log(
    '   ⚠️  To bypass SSL validation in Node.js, set BEFORE starting the client:'
  );
  console.log('   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";');
  console.log(
    '   ✓ All requests will accept self-signed certificates (development only!)\n'
  );

  // Example 3: Best practice
  console.log('3. Best Practices:');
  console.log('   ✓ Usa sempre la validazione SSL in produzione');
  console.log(
    '   ✓ Disabilita la validazione solo per sviluppo con self-signed'
  );
  console.log(
    '   ✓ Usa variabili d’ambiente per controllare il comportamento SSL'
  );
  console.log(
    '   ✓ Non committare mai process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" in produzione'
  );
  console.log(
    '   ✓ Considera l’uso di certificati di sviluppo validi invece di disabilitare la validazione\n'
  );

  // Example 4: Demonstrate how to choose configuration based on environment
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
    `   ✓ Created client for ${isDevelopment ? 'development' : 'production'} environment`
  );
  console.log(
    `   ✓ SSL validation: ${isDevelopment ? 'controlled by NODE_TLS_REJECT_UNAUTHORIZED' : 'enabled (secure)'}\n`
  );

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

  console.log('5. Best Practices Summary:');
  console.log('   ✓ Always use strict SSL validation in production');
  console.log(
    '   ✓ Only disable SSL validation for development with self-signed certificates'
  );
  console.log('   ✓ Use environment variables to control SSL behavior');
  console.log('   ✓ Never commit rejectUnauthorized: false to production code');
  console.log(
    '   ✓ Consider using proper development certificates instead of disabling validation\n'
  );

  console.log('=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateSSLOptions().catch(console.error);
}

module.exports = { demonstrateSSLOptions };
