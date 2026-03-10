# rpc-express-toolkit: Architectural Review and Refactor Proposal

## 1) Architecture Summary

### Current architecture map

#### Server flow
1. `RpcEndpoint` attaches routes (`/health`, `/metrics`, main POST endpoint) in `#setupRoutes`.
2. Incoming JSON-RPC requests are dispatched to either batch processing or single-request processing.
3. Single-request processing (`#processSingleRequest`) performs:
   - JSON-RPC envelope checks (`jsonrpc`, `method`)
   - method lookup
   - safe-mode header compatibility checks
   - params deserialization
   - optional params schema validation (Ajv)
   - middleware execution (`beforeCall`, `beforeValidation`, `afterValidation`, `afterCall`, `onError`)
   - handler execution
   - result serialization and reply.
4. Errors are converted into JSON-RPC error payloads, including both simplified fields and serialized diagnostic object.

#### Client flow
1. `RpcClient.call` creates a JSON-RPC request body.
2. Params are pre-serialized using recursive Date/BigInt/string logic.
3. The client sends `X-RPC-Safe-Enabled` to advertise serialization mode.
4. It checks HTTP status and JSON-RPC `error` envelope.
5. It verifies compatibility header expectations and deserializes result accordingly.
6. `notify` and `batch` are built on top of `call` semantics.

#### Serialization layer
- Both server and CommonJS client use recursive conversion helpers:
  - BigInt `123n` string convention
  - Date as ISO or `D:` prefixed string in safe mode
  - string as `S:` prefixed in safe mode.
- Deserialization re-hydrates based on prefixes and regex checks.

#### Validation layer
- Ajv-backed `SchemaValidator` compiles schemas on each `validate` call.
- Validation is applied to request params only.
- Validation errors map to JSON-RPC `-32602` with error details in `data.validationErrors`.

#### Error handling
- Server uses local `serializeError` utility with allowlist fields + type tagging.
- Endpoint error responses include both top-level `code/message/data` and nested `error: serializeError(err, true)` object.
- Client throws raw `responseBody.error` object (not typed Error subclass).

#### Transport layer
- Server transport: Express POST endpoint and batch handler.
- Client transport: `fetch` with JSON body and custom compatibility headers.
- Batch support exists server-side and client-side, but batch error handling differs from single-call behavior.

---

## 2) Verification of Architectural Claims

### Claim 1: “The library provides end-to-end type safety for RPC methods.”
**Verdict: FALSE**

- Server method registration is name-string + handler/config dynamic map.
- TS types use `params: any`, return `any`, and client uses `call<T>` with caller-supplied generic, not contract-driven typing.
- No shared method contract ties server and client together.

### Claim 2: “The library correctly serializes errors for RPC transport.”
**Verdict: PARTIALLY TRUE**

- Server does serialize rich error metadata via `serializeError`.
- However, payload shape is inconsistent/redundant (`error` object contains nested `error` object in single-call path), and batch path returns less detail.
- Sanitization excludes only selected fields and may still leak stack/cause internals depending on error objects.

### Claim 3: “The client exposes a good developer experience for handling remote errors.”
**Verdict: PARTIALLY TRUE**

- It surfaces JSON-RPC failures.
- But it throws raw error objects instead of a stable `RpcError` class; stack, instanceof checks, and ergonomic narrowing are weak.

### Claim 4: “Runtime validation protects the system from invalid inputs.”
**Verdict: PARTIALLY TRUE**

- Single-request path validates params when schema is provided.
- Batch path does not apply method schema validation.
- If methods have no schema, no guard exists.

### Claim 5: “Runtime validation also guarantees valid outputs.”
**Verdict: FALSE**

- There is no `resultSchema` validation in either single or batch execution.

### Claim 6: “Safe serialization properly disambiguates Date, BigInt, and string values.”
**Verdict: PARTIALLY TRUE**

- In safe mode, `S:` and `D:` prefixes plus BigInt suffix disambiguate well.
- In non-safe mode, Date/BigInt-like strings can still collide conceptually; BigInt-like string detection remains heuristic.

### Claim 7: “The safe-mode negotiation protocol between client and server is robust.”
**Verdict: PARTIALLY TRUE**

- There is explicit header-based compatibility signaling and strict-mode checks.
- But behavior differs across flows (single vs batch), and missing-header logic is unilateral in places.
- The ESM client variant diverges (prototype patch + fallback differences), increasing protocol risk across builds.

---

## 3) Weakness Analysis

### Typing weaknesses
- Method keys are opaque `string` names.
- Handler params and results are effectively `any` in public typings.
- Client generic `<T>` is unchecked against runtime method/schema contract.
- No shared “contract” type between endpoint and client APIs.

### Error handling weaknesses
- Client throws plain objects for remote errors.
- No first-class `RpcError` abstraction.
- Error envelope has redundant nesting in single-request path.
- Potential overexposure of internals (stack/cause/system fields) in serialized error object.

### Validation weaknesses
- Params validation only in single-call path.
- No output validation (`resultSchema`).
- No per-method validation for `error.data` payloads.

### Serialization weaknesses
- ESM client mutates `BigInt.prototype.toJSON` globally.
- Serialization logic is duplicated (server/client, CJS/ESM), inviting drift.
- No codec interface to swap or test serialization modes uniformly.

### API design weaknesses
- Dynamic `addMethod` is flexible but weakly typed.
- No typed introspection schema for method contracts.
- Introspection returns limited metadata (no result/error schema).

---

## 4) Improved Architecture Design (Backward Compatible)

### A. Introduce typed RPC contract
```ts
type RpcContract = {
  getUser: {
    params: { id: string }
    result: { id: string; name: string }
    errorData?: { reason: string }
  }
}
```

### B. Introduce `TypedRpcClient<C extends RpcContract>`
```ts
class TypedRpcClient<C extends RpcContract> extends RpcClient {
  call<M extends keyof C & string>(
    method: M,
    params: C[M]['params'],
    id?: string | number | null,
    headers?: Record<string, string>
  ): Promise<C[M]['result']>;
}
```

### C. Add typed method registration on server
```ts
rpc.addMethod<'getUser'>('getUser', {
  schema: getUserParamsSchema,
  resultSchema: getUserResultSchema,
  errorSchema: getUserErrorSchema,
  handler: async (_req, ctx, params) => ({ id: params.id, name: 'Ada' }),
});
```

### D. Add client-side `RpcError`
```ts
class RpcError<TData = unknown> extends Error {
  code: number;
  data?: TData;
  remote: boolean;
  cause?: unknown;
}
```
All client remote errors should become `throw new RpcError(...)`.

### E. Add output validation
- Optional per-method `resultSchema` validated after handler return.
- On failure, return `-32603` with structured internal validation reason (or dedicated server error code).

### F. Add `error.data` validation
- Optional per-method `errorSchema` to validate thrown `err.data` before transport.
- Invalid `error.data` should be sanitized/fallback-wrapped.

### G. Extract codec abstraction
```ts
interface RpcCodec {
  serialize(value: unknown): unknown;
  deserialize(value: unknown, opts?: { safeEnabled?: boolean }): unknown;
}
```
Default implementations:
- `StandardJsonRpcCodec`
- `SafeJsonRpcCodec`

### H. Remove global BigInt patch
- Eliminate `BigInt.prototype.toJSON` mutation from ESM client.
- Use explicit recursive serializer / JSON replacer strategy.

---

## 5) Concrete Code Patch Proposals

## Proposal 1: Introduce `RpcError` and normalize client throws

**Files to modify:**
- `src/errors/rpc-error.js` (new)
- `src/clients/rpc-client.js`
- `src/clients/rpc-client.mjs`
- `src/index.js` exports
- `src/index.d.ts`

**Patch sketch:**
```js
// src/errors/rpc-error.js
class RpcError extends Error {
  constructor({ code, message, data, remote = true, cause }) {
    super(message || 'RPC error');
    this.name = 'RpcError';
    this.code = code ?? -32603;
    this.data = data;
    this.remote = remote;
    if (cause !== undefined) this.cause = cause;
  }

  static fromPayload(payload) {
    return new RpcError({
      code: payload?.code,
      message: payload?.message,
      data: payload?.data,
      remote: true,
      cause: payload,
    });
  }
}
module.exports = RpcError;
```

```js
// src/clients/rpc-client.js
if (responseBody.error) {
  throw RpcError.fromPayload(responseBody.error);
}
```

```ts
// src/index.d.ts
declare class RpcError<TData = unknown> extends Error {
  code: number;
  data?: TData;
  remote: boolean;
}
```

---

## Proposal 2: Add result and error-data schema support

**Files to modify:**
- `src/index.js`
- `src/batch.js`
- `src/index.d.ts`

**Method config extension:**
```ts
interface MethodConfig<C, P = any, R = any, E = any> {
  handler: (req: Request, context: C, params: P) => R | Promise<R>;
  schema?: object;        // params
  resultSchema?: object;  // result
  errorSchema?: object;   // error.data
}
```

**Server-side check (single + batch):**
```js
const resultValidation = resultSchema
  ? this.#validator.validate(result, resultSchema)
  : { valid: true, data: result };
if (!resultValidation.valid) {
  const e = new Error('Invalid method result');
  e.code = -32603;
  e.data = { validationErrors: resultValidation.errors };
  throw e;
}
```

**Thrown error.data check:**
```js
if (errorSchema && err.data !== undefined) {
  const errValidation = this.#validator.validate(err.data, errorSchema);
  if (!errValidation.valid) {
    err.data = { message: 'Invalid error data schema', original: undefined };
  }
}
```

---

## Proposal 3: Add codec abstraction and remove serialization duplication

**Files to modify:**
- `src/codecs/rpc-codec.js` (new interface-like base)
- `src/codecs/standard-json-rpc-codec.js` (new)
- `src/codecs/safe-json-rpc-codec.js` (new)
- `src/index.js`
- `src/clients/rpc-client.js`
- `src/clients/rpc-client.mjs`
- `src/index.d.ts`

**Codec API:**
```js
class StandardJsonRpcCodec {
  serialize(value) { /* BigInt=>"123n", Date=>ISO */ }
  deserialize(value) { /* "123n"=>BigInt, ISO=>Date heuristic */ }
}

class SafeJsonRpcCodec {
  serialize(value) { /* BigInt=>"123n", Date=>"D:...", String=>"S:..." */ }
  deserialize(value) { /* prefixes first, then bigint */ }
}
```

**RpcClient constructor addition:**
```js
constructor(endpoint, headers = {}, options = {}) {
  this.#codec = options.codec || (options.safeEnabled
    ? new SafeJsonRpcCodec()
    : new StandardJsonRpcCodec());
}
```

---

## Proposal 4: Introduce typed contracts without breaking existing API

**Files to modify:**
- `src/index.d.ts`
- `src/typed-client.d.ts` (new type-only entry)
- `src/index.js` (runtime alias class optional)

**Type additions:**
```ts
export type RpcContract = Record<string, {
  params: unknown;
  result: unknown;
  errorData?: unknown;
}>;

export class TypedRpcClient<C extends RpcContract> extends RpcClient {
  call<M extends keyof C & string>(
    method: M,
    params: C[M]['params'],
    id?: string | number | null,
    overrideHeaders?: Record<string, string>
  ): Promise<C[M]['result']>;
}
```

**Server typed overloads (types-first evolution):**
```ts
addMethod<M extends keyof CContract & string>(
  name: M,
  config: {
    schema?: object;
    resultSchema?: object;
    errorSchema?: object;
    handler: (
      req: Request,
      context: C,
      params: CContract[M]['params']
    ) => Promise<CContract[M]['result']> | CContract[M]['result'];
  }
): void;
```

---

## Proposal 5: Remove global BigInt prototype patch in ESM client

**Files to modify:**
- `src/clients/rpc-client.mjs`

**Change:**
- Delete `BigInt.prototype.toJSON` mutation block.
- Reuse same explicit `serializeBigIntsAndDates` path as CommonJS client.

This avoids global side-effects and aligns behavior across bundles.

---

## 6) Migration / Refactor Roadmap

### Phase 1 — Error abstraction (low risk)
- Add `RpcError` and switch client throw behavior.
- Preserve backward compatibility by exposing original payload in `cause`.

### Phase 2 — Validation hardening (medium risk)
- Add optional `resultSchema` and `errorSchema`.
- Apply in both single and batch handlers.
- Keep default behavior unchanged when schemas are absent.

### Phase 3 — Codec extraction (medium risk)
- Introduce codec classes while preserving `safeEnabled` option as shorthand.
- Mark direct serialize/deserialize helpers as delegating wrappers.

### Phase 4 — Typed contracts (types-only first, low runtime risk)
- Add TypeScript contract types and typed client wrappers.
- Keep existing dynamic API operational.

### Phase 5 — Introspection enrichment (optional)
- Extend introspection metadata to include `resultSchema`, `errorSchema`, and safe/codec capabilities.

### Compatibility and risk notes
- **Breaking-risk hotspots:** error envelope shape changes, stricter output validation, and batch behavior alignment.
- **Mitigation:** behind options flags, staged rollout, and dual payload compatibility for one major version.
- **Testing focus:** single/batch parity, schema validation paths, safe header negotiation, and ESM/CJS behavior equivalence.
