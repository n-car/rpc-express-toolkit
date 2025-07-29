# 🔢 Handling Numeric Strings with Leading Zeros

## Problem Description

When using schema validation with `coerceTypes: true`, numeric strings with leading zeros like `'0123456'` may be automatically converted to numbers, losing the leading zeros.

## When This Happens

```javascript
// ⚠️ PROBLEMATIC: Will convert '0123456' to 123456
const rpc = new RpcEndpoint(app, context, {
  validation: {
    coerceTypes: true  // This enables type coercion
  }
});

rpc.addMethod('problematicMethod', {
  handler: (req, ctx, params) => {
    console.log(params.id); // 123456 (number) - leading zeros lost!
    return params;
  },
  schema: {
    type: 'object',
    properties: {
      id: { type: 'number' }  // This triggers the conversion
    }
  }
});
```

### Test Results

| Input      | Schema Type | Coercion | Output     | Type     | Status |
|------------|-------------|----------|------------|----------|---------|
| '0123456'  | No schema   | N/A      | '0123456'  | string   | ✅ Safe |
| '0123456'  | string      | false    | '0123456'  | string   | ✅ Safe |
| '0123456'  | string      | true     | '0123456'  | string   | ✅ Safe |
| '0123456'  | number      | true     | 123456     | number   | ⚠️ Loses zeros |

## Solutions

### Solution 1: Disable Type Coercion (Recommended)

```javascript
const rpc = new RpcEndpoint(app, context, {
  validation: {
    coerceTypes: false  // Disable automatic type conversion
  }
});
```

### Solution 2: Use String Schema for IDs/Codes

```javascript
rpc.addMethod('handleUserID', {
  handler: (req, ctx, params) => {
    // Convert manually if needed for calculations
    const numericId = parseInt(params.userId, 10);
    return { 
      originalId: params.userId,    // '0123456' - preserved
      numericId: numericId          // 123456 - for calculations
    };
  },
  schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' }    // Always string to preserve format
    },
    required: ['userId']
  }
});
```

### Solution 3: Pattern Validation for Numeric Strings

```javascript
rpc.addMethod('handleProductCode', {
  handler: (req, ctx, params) => {
    return { code: params.code };
  },
  schema: {
    type: 'object',
    properties: {
      code: { 
        type: 'string',
        pattern: '^[0-9]+$',         // Only digits allowed
        minLength: 1,
        maxLength: 20
      }
    },
    required: ['code']
  }
});
```

### Solution 4: Custom Validation with anyOf

```javascript
rpc.addMethod('flexibleId', {
  handler: (req, ctx, params) => {
    const id = typeof params.id === 'string' ? params.id : params.id.toString();
    return { id, type: typeof params.id };
  },
  schema: {
    type: 'object',
    properties: {
      id: {
        anyOf: [
          { type: 'string', pattern: '^[0-9]+$' },
          { type: 'number', minimum: 0 }
        ]
      }
    },
    required: ['id']
  }
});
```

## Best Practices

1. **For IDs, codes, phone numbers**: Always use `type: 'string'`
2. **For calculations**: Use `type: 'number'` but document the limitation
3. **For mixed use**: Accept string and convert manually in handler
4. **Default recommendation**: Set `coerceTypes: false` for predictable behavior

## Real-World Examples

```javascript
// ✅ GOOD: Preserves leading zeros for phone numbers
rpc.addMethod('updatePhone', {
  handler: (req, ctx, params) => {
    // Phone numbers like '0123456789' stay intact
    return { phone: params.phone };
  },
  schema: {
    type: 'object',
    properties: {
      phone: { 
        type: 'string',
        pattern: '^[0-9+\\-\\s\\(\\)]+$',
        minLength: 10,
        maxLength: 15
      }
    }
  }
});

// ✅ GOOD: Product codes with leading zeros
rpc.addMethod('findProduct', {
  handler: (req, ctx, params) => {
    // Product codes like '000123' preserved
    return { productCode: params.code };
  },
  schema: {
    type: 'object',
    properties: {
      code: { 
        type: 'string',
        pattern: '^[0-9]{6}$'  // Exactly 6 digits
      }
    }
  }
});

// ✅ GOOD: Banking account numbers
rpc.addMethod('getAccount', {
  handler: (req, ctx, params) => {
    return { accountNumber: params.account };
  },
  schema: {
    type: 'object',
    properties: {
      account: { 
        type: 'string',
        pattern: '^[0-9]{8,12}$'
      }
    }
  }
});
```
