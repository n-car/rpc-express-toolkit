# RPC Express Toolkit — Advanced Usage

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rpc-express-toolkit.svg)](https://www.npmjs.com/package/rpc-express-toolkit)

Enterprise-ready JSON-RPC 2.0 toolkit for Express.js applications with structured logging, middleware, schema validation, batch processing, and precise type handling via optional safe prefixes.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Advanced Usage](#advanced-usage)
  - [Configuration Options](#configuration-options)
  - [Safe Serialization](#safe-serialization)
  - [Schema Validation](#schema-validation)
  - [Middleware System](#middleware-system)
  - [Structured Logging](#structured-logging)
  - [Error Handling](#error-handling)
  - [Client Configuration](#client-configuration)
  - [Built-in Middlewares](#built-in-middlewares)
- [API Reference](#api-reference)
  - [RpcEndpoint Class](#rpcendpoint-class)
  - [RpcClient Class](#rpcclient-class)
  - [Logger Class](#logger-class)
  - [SchemaValidator Class](#schemavalidator-class)
  - [SchemaBuilder](#schemabuilder)
- [Examples](#examples)
- [Contributing](#contributing)
- [Security](#security)
- [Performance](#performance)
- [Support](#support)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Features

### Core Features
- **JSON-RPC 2.0 Compliance:** Fully adheres to the JSON-RPC 2.0 specification in its baseline behavior.  
- **Server & Client Support:** Provides both server endpoint and client classes.  
- **Asynchronous Support:** Seamless handling of asynchronous operations with Promises.  
- **BigInt & Date Serialization:** Robust serialization/deserialization with timezone support; optional safe prefixes to disambiguate.  
- **Cross-Platform:** Works in both browser and Node.js environments.  
- **Error Handling:** Comprehensive error responses with sanitization options.

### Enterprise Features
- **Structured Logging:** Configurable logging with multiple transports and levels.  
- **Extensible Middleware System:** Hooks and built-in middleware (rate limiting, CORS, auth, etc.).  
- **Schema Validation:** JSON Schema validation with Ajv and schema builder utilities.  
- **Batch Processing:** Efficient batch request handling with concurrency control.  
- **Health & Metrics:** Built-in health checks and metrics endpoints.  
- **Security:** Method whitelisting, authentication, and error sanitization.  
- **Performance Enhancements:** Request timing, caching support, and optimized serialization.

## Installation

```bash
npm install rpc-express-toolkit
# or
yarn add rpc-express-toolkit
```

## Quick Start

### Server

```javascript
const express = require('express');
const { RpcEndpoint } = require('rpc-express-toolkit');

const app = express();
app.use(express.json());

const context = { database: db, config };

const rpc = new RpcEndpoint(app, context);
rpc.addMethod('add', (req, ctx, params) => params.a + params.b);

app.listen(3000);
```

### Client

```javascript
const { RpcClient } = require('rpc-express-toolkit');
const client = new RpcClient('http://localhost:3000/api');
const result = await client.call('add', { a: 1, b: 2 });
```

## Advanced Usage

### Configuration Options

```javascript
const rpc = new RpcEndpoint(app, context, {
  endpoint: '/api',
  logging: { level: 'info', format: 'json', transports: ['console', 'file'], file: { filename: 'rpc.log', maxsize: 10485760, maxFiles: 5 } },
  cors: { origin: ['http://localhost:3000'], credentials: true },
  rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { required: true, verify: (req) => verifyToken(req.headers.authorization) },
  methodWhitelist: ['add', 'subtract', 'getUser'],
  validation: { strict: true, coerceTypes: true, removeAdditional: true },
  safeEnabled: false,
  warnOnUnsafe: true,
  jsonOptions: { limit: '10mb', strict: true, type: 'application/json' },
  healthCheck: true,
  metrics: true,
  timing: true
});
```

### Safe Serialization

The toolkit can optionally prefix string and date values with markers to avoid ambiguity between plain strings, BigInt, and Date objects. This prefixing is a custom convention on top of JSON-RPC 2.0 to aid developer ergonomics and round-trip fidelity when both client and server use the toolkit. The core protocol remains compliant in all modes, but the prefixes change the content seen by external parties. If you interact with third-party JSON-RPC implementations that do not understand the prefixes, disable `safeEnabled` so the payloads remain plain.

#### Defaults and Negotiation

By default `safeEnabled` is **disabled** to guarantee out-of-the-box JSON-RPC 2.0 compliance and maximum interoperability with external systems. However, the toolkit will warn you when BigInt or Date objects are detected, helping you understand when you might benefit from enabling safe serialization:

```javascript
// Default behavior - warnings guide you when needed
const rpc = new RpcEndpoint(app, context);
// ⚠️ Warning: "BigInt detected in serialization. Consider enabling safeEnabled option..."

// Enable safe serialization when you control both endpoints
const rpc = new RpcEndpoint(app, context, {
  safeEnabled: true,
  strictMode: true  // Requires clients to support safe serialization
});

// Alternative: Use schema validation for type safety without prefixes
const userSchema = SchemaBuilder.object({
  id: SchemaBuilder.string().pattern(/^\d+$/).required(), // String representation of BigInt
  createdAt: SchemaBuilder.string().format('date-time').required() // ISO date string
});

rpc.addMethod('getUser', {
  handler: (req, ctx, params) => ({
    id: user.id.toString(),  // Explicit BigInt → string conversion
    createdAt: user.createdAt.toISOString()  // Explicit Date → ISO string
  }),
  schema: userSchema
});

// Silence warnings if you handle BigInt/Date manually
const rpc = new RpcEndpoint(app, context, {
  warnOnUnsafe: false
});
```

#### Compatibility Behavior Matrix

The toolkit automatically handles compatibility between different client/server configurations:

##### Server Behavior

| Server Config | Client Request | Behavior |
|---------------|---------------|----------|
| `safeEnabled: false` | Any | ⚠️  **Warning** on BigInt/Date serialization |
| `safeEnabled: true, strictMode: true` | Without headers | ❌ **JSON-RPC Error** (-32600) |
| `safeEnabled: true, strictMode: false` | Without headers | ✅ **Standard mode** (no prefixes) |
| `safeEnabled: true, strictMode: false` | With headers | ✅ **Safe mode** (with prefixes) |

##### Client Behavior

| Client Config | Server Response | Behavior |
|---------------|----------------|----------|
| `safeEnabled: false` | Any | ⚠️  **Warning** on BigInt/Date serialization |
| `safeEnabled: true` | Without headers | ❌ **Exception** thrown |
| `safeEnabled: false` | With safe headers | ⚠️  **Compatibility notice** |
| `safeEnabled: true` | With safe headers | ✅ **Safe deserialization** |

##### Common Scenarios

```javascript
// ✅ Scenario 1: Both standard (JSON-RPC 2.0 compliant)
Client: { safeEnabled: false }  →  Server: { safeEnabled: false }
// Result: Standard JSON, warnings on BigInt/Date

// ✅ Scenario 2: Both safe (enterprise internal API)
Client: { safeEnabled: true }   →  Server: { safeEnabled: true }
// Result: Safe serialization with prefixes

// ✅ Scenario 3: Mixed with permissive server
Client: { safeEnabled: false }  →  Server: { safeEnabled: true, strictMode: false }
// Result: Server adapts to client, standard JSON

// ❌ Scenario 4: Incompatible strict
Client: legacy (no headers)     →  Server: { safeEnabled: true, strictMode: true }
// Result: Server returns JSON-RPC error

// ❌ Scenario 5: Client expects safe, server doesn't support
Client: { safeEnabled: true }   →  Server: legacy (no headers)
// Result: Client throws exception
```

> **💡 Pro Tip**: For complex scenarios with mixed client types or legacy systems, consider using [Schema Validation as Compatibility Mediator](#schema-validation-as-compatibility-mediator) to eliminate warnings and compatibility errors through explicit type definitions and transformations.

#### Recommended Approaches

1. **For controlled environments** (your client + your server):
   ```javascript
   // Enable safe serialization on both ends
   const rpc = new RpcEndpoint(app, context, {
     safeEnabled: true,
     strictMode: true
   });
   ```

2. **For external integrations** (third-party clients):
   ```javascript
   // Use schema validation + explicit conversion
   rpc.addMethod('api', {
     handler: (req, ctx, params) => ({
       id: bigIntValue.toString(),
       timestamp: dateValue.toISOString()
     }),
     schema: SchemaBuilder.object({
       id: SchemaBuilder.string(),
       timestamp: SchemaBuilder.string().format('date-time')
     })
   });
   ```

3. **Permissive server** (adapts to client capabilities):
   ```javascript
   const rpc = new RpcEndpoint(app, context, {
     safeEnabled: true,
     strictMode: false  // Auto-adapts to client headers
   });
   ```

4. **Silence warnings** (when you handle BigInt/Date manually):
   ```javascript
   const rpc = new RpcEndpoint(app, context, {
     warnOnUnsafe: false
   });
   ```

#### Prefixes

- `S:` for strings when `safeEnabled` is enabled (e.g., "S:123n" distinguishes a string from a BigInt).  
- `D:` for dates when `safeEnabled` is enabled (e.g., "D:2023-01-01T00:00:00.000Z").

#### Examples

```javascript
// Safe prefixes enabled (both sides agree)
const rpc = new RpcEndpoint(app, context, {
  safeEnabled: true
});
rpc.addMethod('example', () => ({
  ref: "S:0123456",
  date: "D:2023-01-01T00:00:00.000Z"
}));
```

```javascript
// Safe prefixes disabled (vanilla JSON-RPC payloads)
const rpc2 = new RpcEndpoint(app, context, {
  safeEnabled: false,
  warnOnUnsafe: true
});
```

#### Interoperability

When communicating with external JSON-RPC consumers or providers that do not understand the safe prefixes, disable `safeEnabled` so the payload remains in a compatible form, or explicitly strip or interpret prefixes at integration boundaries.

#### Disabling Warnings Selectively

```javascript
const rpc = new RpcEndpoint(app, context, {
  safeEnabled: false,
  warnOnUnsafe: false
});
```

### Schema Validation as Compatibility Mediator

Schema validation can act as a **"peace keeper"** between different `safeEnabled`/`strictMode` configurations, eliminating warnings and compatibility errors by providing explicit type definitions and transformations.

#### Eliminating BigInt/String Confusion Warnings

**Problem**: String values that look like BigInt trigger warnings:
```javascript
// Client with safeEnabled: false
const client = new RpcClient('/api', {}, { safeEnabled: false });

await client.call('getUser', { id: "123" });
// ⚠️ Warning: String "123" could be confused with BigInt
```

**Solution**: Explicit schema definition eliminates ambiguity:
```javascript
// Server with clear schema
const userSchema = SchemaBuilder.object({
  id: SchemaBuilder.string().pattern(/^\d+$/).required()
});

rpc.addMethod('getUser', {
  handler: (req, ctx, params) => {
    // params.id is guaranteed to be a valid string
    // No warnings because type is explicit via schema
    return db.getUser(params.id);
  },
  schema: userSchema
});
```

#### Universal Date/Time Handling

**Problem**: Date serialization generates warnings and compatibility issues:
```javascript
// Warning when using Date objects without safe mode
await client.call('createEvent', { 
  startTime: new Date('2023-01-01') 
});
// ⚠️ Warning: Date serialization using plain ISO string format...
```

**Solution**: Schema with multiple input formats and normalization:
```javascript
const eventSchema = SchemaBuilder.object({
  startTime: SchemaBuilder.union([
    SchemaBuilder.date(),                     // Safe mode clients
    SchemaBuilder.string().format('date-time'), // Standard clients  
    SchemaBuilder.number()                    // Unix timestamps
  ]).transform(val => {
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    if (typeof val === 'number') return new Date(val * 1000);
    throw new Error('Invalid date format');
  })
});

// Clients can use any format - no warnings
await client.call('createEvent', { 
  startTime: Math.floor(Date.now() / 1000)  // Unix timestamp
});
```

#### Flexible BigInt Support

**Problem**: Mixed client environments with different BigInt support:
```javascript
// Server: safeEnabled: true, strictMode: true  
// Legacy client without safe headers
// Result: JSON-RPC Error -32600
```

**Solution**: Schema-driven flexibility:
```javascript
const transferSchema = SchemaBuilder.object({
  amount: SchemaBuilder.union([
    SchemaBuilder.bigint(),                   // Safe mode clients
    SchemaBuilder.string().pattern(/^\d+$/), // Standard clients
    SchemaBuilder.number()                    // Simple numbers
  ]).transform(val => {
    if (typeof val === 'bigint') return val;
    if (typeof val === 'string') return BigInt(val);
    if (typeof val === 'number') return BigInt(val);
    throw new Error('Invalid amount format');
  })
});

rpc.addMethod('transfer', {
  handler: (req, ctx, params) => {
    // params.amount is always BigInt regardless of client type
    return processTransfer(params.amount);
  },
  schema: transferSchema,
  options: { strictMode: false }  // Allow different client types
});
```

#### Schema-Aware Client Pattern

For maximum compatibility, create clients that define expected response schemas:

```javascript
class SchemaAwareClient {
  constructor(endpoint, options = {}) {
    this.client = new RpcClient(endpoint, {}, options);
  }
  
  async callWithSchema(method, params, responseSchema) {
    try {
      const result = await this.client.call(method, params);
      // Validate and normalize response regardless of server headers
      return responseSchema.validate(result);
    } catch (error) {
      if (error.message.includes('RPC Compatibility Error')) {
        // Fallback: retry with safe mode disabled
        console.warn('Retrying with compatibility mode...');
        const fallbackClient = new RpcClient(this.client.endpoint, {}, { 
          safeEnabled: false 
        });
        const result = await fallbackClient.call(method, params);
        return responseSchema.validate(result);
      }
      throw error;
    }
  }
}

// Usage
const client = new SchemaAwareClient('/api');
const user = await client.callWithSchema('getUser', { id: "123" }, userSchema);
```

#### Advanced: Schema-Driven Serialization Adapter

For servers that need to support multiple client types seamlessly:

```javascript
class AdaptiveEndpoint extends RpcEndpoint {
  addMethod(name, config) {
    const originalHandler = config.handler;
    
    config.handler = async (req, ctx, params) => {
      // Pre-processing: normalize input based on schema
      if (config.inputSchema) {
        params = config.inputSchema.validate(params);
      }
      
      const result = await originalHandler(req, ctx, params);
      
      // Post-processing: adapt output to client capabilities
      if (config.outputSchema) {
        return this.adaptOutputToClient(result, config.outputSchema, req);
      }
      
      return result;
    };
    
    super.addMethod(name, config);
  }
  
  adaptOutputToClient(result, schema, req) {
    const clientSafeEnabled = req.headers['x-rpc-safe-enabled'] === 'true';
    
    if (!clientSafeEnabled) {
      // Convert BigInt/Date for standard clients
      return this.convertForStandardClient(result, schema);
    }
    
    return result;
  }
  
  convertForStandardClient(obj, schema) {
    // Recursively convert based on schema field types
    if (schema.type === 'bigint' && typeof obj === 'bigint') {
      return obj.toString();
    }
    if (schema.type === 'date' && obj instanceof Date) {
      return obj.toISOString();
    }
    // Handle objects and arrays...
    return obj;
  }
}
```

#### Summary: Schema as Peace Keeper

| Scenario | Without Schema | With Schema |
|----------|---------------|-------------|
| String resembling BigInt | ⚠️ Warning | ✅ Explicit string type |
| Legacy client + strict server | ❌ Error -32600 | ✅ Schema union + coercion |
| Date serialization warnings | ⚠️ Warning | ✅ Multiple format support |
| Mixed client environments | ❌ Compatibility errors | ✅ Adaptive responses |
| Type safety across versions | ❌ Runtime surprises | ✅ Compile-time safety |

Schema validation transforms the compatibility matrix from a source of conflicts into a harmonious system where different client/server configurations coexist peacefully.

### TypeScript Support

The library provides full TypeScript support with generic type parameters for type-safe RPC calls:

```typescript
import { RpcClient } from 'rpc-express-toolkit/src/clients/rpc-client.mjs';

interface User {
  id: number;
  name: string;
  email: string;
}

const client = new RpcClient('/api');

// Type-safe calls with generics
const user = await client.call<User>('getUser', { id: 123 });
// user is automatically typed as User

const users = await client.batch<User>([
  { method: 'getUser', params: { id: 1 } },
  { method: 'getUser', params: { id: 2 } }
]);
// users is automatically typed as User[]

// Works with React hooks
function useRpcCall<T>(method: string, params: any) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  
  const call = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.call<T>(method, params);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [method, params]);

  return { data, loading, call };
}

// Usage in React component
const { data: user, loading } = useRpcCall<User>('getUser', { id: 123 });
```

### Schema Validation

Use the schema builder or common schemas to validate inputs:

```javascript
const { SchemaBuilder, commonSchemas } = require('rpc-express-toolkit');

const addSchema = SchemaBuilder.object({
  a: SchemaBuilder.number().required(),
  b: SchemaBuilder.number().required()
});

rpc.addMethod('add', {
  handler: (req, ctx, params) => params.a + params.b,
  schema: addSchema
});
```

### Middleware System

RpcEndpoint exposes lifecycle hooks and validates JSON middleware compatibility:

```javascript
const express = require('express');
const { RpcEndpoint } = require('rpc-express-toolkit');
const app = express();
app.use(express.json());

try {
  const rpc = new RpcEndpoint(app, context);
  console.log('✅ JSON middleware validation passed');
} catch (error) {
  console.error('❌ JSON middleware validation failed:', error.message);
}
```

### Structured Logging

```javascript
const { Logger } = require('rpc-express-toolkit');
const logger = new Logger({ level: 'info', format: 'json', transports: ['console', 'file'] });

logger.info('User login', { userId: 123, action: 'login', ip: '192.168.1.1' });
logger.error('Database error', { error: 'message', duration: 150 });
```

### Error Handling

```javascript
rpc.addMethod('mayFail', (req, ctx, params) => {
  if (params.shouldFail) {
    const err = new Error('Something went wrong');
    err.code = -32001;
    err.data = { details: 'Extra info' };
    throw err;
  }
  return 'success';
});
```

Client-side:

```javascript
try {
  await client.call('mayFail', { shouldFail: true });
} catch (error) {
  console.log(error.code, error.message, error.data);
}
```

### Client Configuration

```javascript
const { RpcClient } = require('rpc-express-toolkit');
const client = new RpcClient('https://api.example.com/rpc', {
  'Authorization': 'Bearer token'
}, {
  rejectUnauthorized: false // dev only
});
```

### Built-in Middlewares

```javascript
const { builtInMiddlewares } = require('rpc-express-toolkit');

rpc.use('beforeCall', builtInMiddlewares.rateLimit({ windowMs: 900000, max: 100 }));
rpc.use('beforeCall', builtInMiddlewares.cors({ origin: ['https://myapp.com'], credentials: true }));
rpc.use('beforeCall', builtInMiddlewares.auth({
  required: true,
  verify: async (req) => { /* ... */ },
  onError: (req, error) => { console.log('Auth failed', error.message); }
}));
rpc.use('beforeCall', builtInMiddlewares.methodWhitelist(['add', 'getUser']));
rpc.use('beforeCall', builtInMiddlewares.timing());
```

## API Reference

### RpcEndpoint Class

#### Constructor

```javascript
new RpcEndpoint(router, context, options)
```

Parameters:
- `router` *(Express.Router)*: Express application or router to attach to.  
- `context` *(Object)*: Context passed to method handlers.  
- `options` *(Object|string)*: Full configuration or shorthand endpoint path.

Common options: `endpoint`, `logging`, `cors`, `rateLimit`, `auth`, `methodWhitelist`, `validation`, `healthCheck`, `metrics`, `timing`.

#### Methods

- `addMethod(name, handlerOrConfig, schema?)` — Register a new RPC method.  
- `use(hook, middleware)` — Attach middleware to lifecycle hooks (`beforeCall`, `afterCall`, `onError`).  
- `removeMethod(name)` — Unregister a method.  
- `getMethod(name)` — Retrieve a method’s config.  
- `listMethods()` — List all registered methods.  
- `getMetrics()` — Get current metrics.

#### Properties

- `endpoint`, `methods`, `logger`, `middleware`, `validator`

### RpcClient Class

#### Constructor

```javascript
new RpcClient(baseUrl, headers?, options?)
```

#### Methods

- `call(method, params?, options?)` — Single RPC call.  
- `batch(requests)` — Batch calls.  
- `notify(method, params?)` — Notification without response.

### Logger Class

Structured logger with transports:

```javascript
const logger = new Logger({ level: 'info', format: 'json', transports: ['console', 'file'] });
```

### SchemaValidator Class

Ajv-based validator:

```javascript
const validator = new SchemaValidator({ strict: true, coerceTypes: true });
const result = validator.validate(data, schema);
```

### SchemaBuilder

Fluent builder for JSON Schema.

```javascript
const schema = SchemaBuilder.object({
  name: SchemaBuilder.string().required(),
  age: SchemaBuilder.number().min(0).max(150)
});
```

## Examples

### Enterprise Configuration

```javascript
const express = require('express');
const { RpcEndpoint, SchemaBuilder } = require('rpc-express-toolkit');

const app = express();
app.use(express.json());

const rpc = new RpcEndpoint(app, { db, config }, {
  endpoint: '/api/v1',
  logging: { level: 'info', format: 'json', transports: ['console', 'file'], file: { filename: 'api.log' } },
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'], credentials: true },
  rateLimit: { windowMs: 900000, max: 100 },
  auth: { required: true, verify: async (req) => { const token = req.headers.authorization?.replace('Bearer ', ''); return await verifyJWT(token); } },
  validation: { strict: true, coerceTypes: true },
  healthCheck: true,
  metrics: true
});

rpc.addMethod('createUser', {
  handler: async (req, ctx, params) => {
    const user = await ctx.db.users.create(params);
    return { id: user.id, message: 'User created successfully' };
  },
  schema: SchemaBuilder.object({
    name: SchemaBuilder.string().min(1).max(100).required(),
    email: SchemaBuilder.string().format('email').required(),
    age: SchemaBuilder.number().min(0).max(150).optional()
  })
});

app.listen(3000);
```

## Contributing

```bash
git clone https://github.com/n-car/rpc-express-toolkit.git
npm install
npm test
npm run lint
```

## Security

- Validate inputs via schema validation.  
- Use authentication for sensitive methods.  
- Enable rate limiting.  
- Sanitize errors in production.  
- Use HTTPS in production.  
- Log audit trails.

## Performance

- Batch requests where possible.  
- Implement caching.  
- Use connection pooling.  
- Monitor metrics and use clustering under load.

## Support

- Documentation: https://github.com/n-car/rpc-express-toolkit/wiki  
- Issues: https://github.com/n-car/rpc-express-toolkit/issues  
- Discussions: https://github.com/n-car/rpc-express-toolkit/discussions  

## Acknowledgments

- JSON-RPC 2.0 Specification  
- Express.js community  
- Ajv JSON Schema validator  
- Contributors and users

## License

MIT. See [LICENSE](LICENSE).
