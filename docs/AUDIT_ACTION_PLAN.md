# RPC Express Toolkit — Correctness & Protocol Action Plan

## 1) Verified findings table

| # | Finding | Status | Evidence (file/function) |
|---|---|---|---|
| 1 | Single-request notifications incorrectly produce a response | VERIFIED | `RpcEndpoint.#processSingleRequest()` always calls `reply()`; `reply()` maps `id === undefined` to `null`, so notification emits response. (`src/index.js`: `#processSingleRequest`, `reply`) |
| 2 | Batch treats `id: null` as notification | VERIFIED | `BatchHandler.processSingleRequest()` sets `isNotification = id === undefined || id === null`. (`src/batch.js`) |
| 3 | `id` type is not validated | VERIFIED | Single and batch envelope checks validate only `jsonrpc` + `method`; no `id` type guard in `#processSingleRequest` or `processSingleRequest`. (`src/index.js`, `src/batch.js`) |
| 4 | `params` type is not validated at envelope level | VERIFIED | No guard that `params` is object/array when present in either path. (`src/index.js`, `src/batch.js`) |
| 5 | Duplicate-id rejection in batch is non-spec behavior | VERIFIED | `validateBatch()` rejects duplicate ids (`Invalid Request: Duplicate IDs in batch`). (`src/batch.js`) |
| 6 | Empty batch path is unreachable | VERIFIED | Route classifies batch only via `isBatchRequest(body)` where body must be array and `length > 0`; empty array falls through single handler. (`src/index.js`, `src/batch.js`) |
| 7 | Batch skips schema validation | VERIFIED | Batch executes middleware + handler but never reads method schema nor calls validator hooks. (`src/batch.js`) |
| 8 | Batch skips strict safe-mode enforcement | VERIFIED | Strict-mode/header enforcement exists only in single path (`#processSingleRequest`); absent in batch path. (`src/index.js`, `src/batch.js`) |
| 9 | Batch error payload drops original `err.data` | VERIFIED | Batch catch emits `data: { batchIndex }` and overwrites method error data. (`src/batch.js`) |
| 10 | Unsafe-mode deserialization ambiguously converts strings into BigInt/Date | VERIFIED | `deserializeBigIntsAndDates()` converts `/^-?\d+n$/` always and ISO datetime when unsafe mode. (`src/index.js`) |
| 11 | Serializer/deserializer has no cycle protection | VERIFIED | Recursive traversal for arrays/objects in `#serializeValue()` and `deserializeBigIntsAndDates()` without `WeakSet`/depth limit. (`src/index.js`) |
| 12 | Serializer vulnerable to prototype pollution assignment | VERIFIED | Serializer builds `{}` and assigns entries directly; `__proto__` key assignment can mutate prototype of result object. (`src/index.js`) |
| 13 | Logging/sanitization may expose too much internal data | PARTIALLY VERIFIED | Error logs include stack traces (`Logger.rpcError()`, endpoint catch). Param sanitization is heuristic key matching; non-matching sensitive fields may leak. (`src/logger.js`, `src/index.js`) |

## 2) Severity triage table

| # | Priority | Type | Rationale |
|---|---|---|---|
| 1 | P0 | spec compliance, runtime correctness | Notification response violates JSON-RPC and can break interoperable clients. |
| 2 | P0 | spec compliance | `id:null` must receive response if present as id member. |
| 3 | P0 | spec compliance, validation coverage | Invalid envelope ids should be `-32600`; current behavior echoes invalid ids. |
| 4 | P0 | spec compliance, validation coverage | Invalid `params` type should be rejected at protocol envelope boundary. |
| 5 | P1 | spec compliance, DX | Duplicate-id rejection is avoidable behavior divergence; not a critical exploit. |
| 6 | P1 | runtime correctness | Empty batch should follow batch error semantics; current branch is dead. |
| 7 | P0 | runtime correctness, validation coverage | Batch bypasses schema constraints applied to single requests. |
| 8 | P0 | runtime correctness, spec compliance | Strict safety contract inconsistently enforced between single and batch. |
| 9 | P1 | runtime correctness, DX | Error payload inconsistency and information loss in batch path. |
| 10 | P2 | serialization correctness, DX | Ambiguous coercion in unsafe mode is documented risk but compatibility-sensitive. |
| 11 | P0 | security, runtime correctness | Cycles can cause recursion failure/DoS risk. |
| 12 | P0 | security | Prototype pollution vector in serializer output object creation. |
| 13 | P1 | security, DX | Log redaction is best-effort and may leak internals in logs. |

## 3) Recommended implementation order

### Step 1 — Introduce shared envelope validation + notification detection
- **Files**: `src/index.js`, `src/batch.js` (or new helper `src/protocol.js`)
- **Why first**: Fixes core JSON-RPC correctness (`id`, `params`, notification semantics) with minimal API surface changes.
- **Risk**: Medium (can alter responses for formerly accepted malformed requests).

### Step 2 — Unify execution pipeline for single and batch calls
- **Files**: `src/index.js`, `src/batch.js`
- **Why**: Ensures parity (strict mode, schema validation, middleware hooks, error shape).
- **Risk**: Medium/High (touches central request execution path).

### Step 3 — Remove non-spec batch duplicate-id rejection + make empty batch reachable
- **Files**: `src/batch.js`, `src/index.js`
- **Why**: Aligns batch behavior with spec and removes dead validation branch.
- **Risk**: Low/Medium.

### Step 4 — Normalize batch/single error payload behavior
- **Files**: `src/index.js`, `src/batch.js`
- **Why**: Prevent data loss and reduce client branching.
- **Risk**: Low.

### Step 5 — Serialization hardening (cycles, depth, prototype pollution)
- **Files**: `src/index.js` (serializer/deserializer), optionally `src/logger.js` safe stringify guard reuse
- **Why**: Security and stability hardening once protocol correctness is in place.
- **Risk**: Medium (could reject previously accepted deep/cyclic structures).

### Step 6 — Logging hardening pass
- **Files**: `src/logger.js`, `src/index.js`
- **Why**: Reduce information leakage in logs without affecting wire protocol.
- **Risk**: Low.

## 4) Test plan

### A. JSON-RPC correctness
1. **Single notification => no response body**
   - **Purpose**: enforce notification semantics for non-batch call.
   - **Expected**: HTTP 204 (or empty body + no JSON-RPC payload).
   - **Files**: `__tests__/index.test.js`.

2. **Batch notification behavior**
   - **Purpose**: mixed batch should exclude notification items from response array.
   - **Expected**: only entries with explicit `id` member appear.
   - **Files**: `__tests__/batch-behavior.test.js`.

3. **`id:null` must respond**
   - **Purpose**: confirm `id:null` is request, not notification.
   - **Expected**: response item with `id:null` and result/error.
   - **Files**: `__tests__/batch-behavior.test.js`, `__tests__/index.test.js`.

4. **Invalid id types => `-32600`**
   - **Purpose**: protocol envelope validation.
   - **Expected**: object/array/boolean ids rejected with Invalid Request.
   - **Files**: `__tests__/index.test.js`, `__tests__/batch-behavior.test.js`.

5. **Invalid params type => `-32600`**
   - **Purpose**: params must be object/array if present.
   - **Expected**: scalar/string/bool params rejected at envelope layer.
   - **Files**: `__tests__/index.test.js`, `__tests__/batch-behavior.test.js`.

6. **Empty batch => invalid request response**
   - **Purpose**: ensure route reaches batch validator behavior.
   - **Expected**: single error object with `id:null` and `-32600`.
   - **Files**: `__tests__/batch-behavior.test.js`.

### B. Batch/single parity
1. **Schema parity**
   - **Purpose**: same schema-protected method validates identically single vs batch.
   - **Expected**: same code/message/data validation errors.
   - **Files**: `__tests__/validation.test.js`, `__tests__/batch-behavior.test.js`.

2. **Strict safe mode parity**
   - **Purpose**: strict header missing should fail identically in single and batch.
   - **Expected**: both emit compatibility error (`-32600`).
   - **Files**: `__tests__/string-coercion.test.js`, `__tests__/batch-behavior.test.js`.

3. **Domain error parity**
   - **Purpose**: thrown error with `code/message/data` yields consistent structure.
   - **Expected**: batch includes original `err.data` (+ optional batch metadata).
   - **Files**: `__tests__/batch-behavior.test.js`, `__tests__/index.test.js`.

### C. Serialization safety
1. **Unsafe mode `"123n"` coercion explicitly tested**
   - **Purpose**: lock in current behavior/document risk.
   - **Expected**: unsafe -> BigInt, safe -> string.
   - **Files**: `__tests__/string-coercion.test.js`.

2. **Safe mode exact string preservation**
   - **Purpose**: ensure safe-prefix roundtrip symmetry.
   - **Expected**: `S:...` decodes to exact original string.
   - **Files**: `__tests__/string-coercion.test.js`.

3. **Circular structures fail safely**
   - **Purpose**: avoid stack overflow / uncontrolled recursion.
   - **Expected**: deterministic controlled error (e.g. `Serialization error: Circular reference`).
   - **Files**: `__tests__/safe-classes.test.js` or new `__tests__/serialization-safety.test.js`.

4. **`__proto__` key does not pollute prototype**
   - **Purpose**: verify serializer hardening.
   - **Expected**: serialized object keeps inert key without mutating `Object.prototype`.
   - **Files**: new `__tests__/serialization-safety.test.js`.

### D. Regression tests
1. **Existing API compatibility**
   - **Purpose**: preserve public registration/call behavior.
   - **Expected**: `index.test.js`, `endpoint-compat.test.js` stay green.

2. **Batch API compatibility**
   - **Purpose**: existing successful batch semantics remain.
   - **Expected**: prior batch tests green + new correctness tests pass.

3. **Safe mode compatibility**
   - **Purpose**: no regression in safe serialization client/server path.
   - **Expected**: existing safe mode tests plus parity tests pass.

## 5) Patch proposals for P0/P1 issues

### Fix 1 — Notification semantics correctness
- **Files**: `src/index.js`, `src/batch.js`
- **Functions**: `#processSingleRequest`, `reply`, `processSingleRequest`
- **Patch sketch**:
  - Detect notification by **presence** check:
    - `const hasId = Object.prototype.hasOwnProperty.call(requestBody, 'id')`
    - notification iff `!hasId`.
  - In single path: if notification, execute call but return `res.status(204).end()` with no JSON body.
  - In batch path: treat `id:null` as response-bearing request.
- **Compatibility impact**: Behavior change for notification calls (spec-aligned, breaking only for non-compliant clients that expected response).

### Fix 2 — Envelope validation helper
- **Files**: new `src/protocol.js` (preferred), wire into `src/index.js` and `src/batch.js`
- **Functions**: `validateEnvelope(request)`
- **Patch sketch**:
  ```js
  function validateEnvelope(req) {
    if (!req || typeof req !== 'object' || Array.isArray(req)) return invalid(-32600, ...);
    if (req.jsonrpc !== '2.0') return invalid(...);
    if (typeof req.method !== 'string' || req.method.length === 0) return invalid(...);
    if (Object.hasOwn(req, 'params') && !(Array.isArray(req.params) || (req.params && typeof req.params === 'object'))) return invalid(...);
    if (Object.hasOwn(req, 'id')) {
      const t = typeof req.id;
      if (!(req.id === null || t === 'string' || t === 'number')) return invalid(...);
    }
    return { valid: true, hasId: Object.hasOwn(req, 'id') };
  }
  ```
- **Compatibility impact**: malformed envelopes now rejected early with `-32600`.

### Fix 3 — Unify single/batch execution pipeline
- **Files**: `src/index.js`, `src/batch.js`
- **Functions**: add `#executeRpcCall({request, req, res, context, batchIndex})` in endpoint; batch delegates to it.
- **Patch sketch**:
  - Centralize sequence: envelope validation -> strict safe check -> deserialize -> `beforeCall` -> schema hooks -> handler -> serialize -> `afterCall` -> normalize response/error.
  - Return structured result `{ kind: 'response'|'notification', payload? }`.
- **Compatibility impact**: minimal API break; internal refactor with behavior alignment.

### Fix 4 — Apply schema validation to batch
- **Files**: `src/index.js` (shared execution), optionally remove batch-only execution branches in `src/batch.js`
- **Functions**: shared pipeline uses same `schema` + validator and middleware hooks.
- **Compatibility impact**: batch calls that previously bypassed schema may now fail (desired correctness fix).

### Fix 5 — Preserve batch error payload parity
- **Files**: `src/index.js`, `src/batch.js`
- **Functions**: batch error mapping
- **Patch sketch**:
  - Build error with same shape as single:
    - `code`, `message`, optional `data` from `err.data`, optional serialized metadata.
  - If adding `batchIndex`, merge non-destructively:
    - `data: err.data ? { ...err.data, batchIndex } : { batchIndex }`
- **Compatibility impact**: additive/less lossy; likely non-breaking.

### Fix 6 — Cycle detection + max depth in serializer/deserializer
- **Files**: `src/index.js`
- **Functions**: `#serializeValue`, `deserializeBigIntsAndDates`
- **Patch sketch**:
  - Add options: `maxSerializationDepth` (default e.g. 100), `maxDeserializationDepth`.
  - Maintain `WeakSet visited` through recursion.
  - Throw controlled `Error('Circular reference detected during serialization')` and map to `-32603` or `-32600` (prefer -32603 internal).
- **Compatibility impact**: cyclic/deep payloads now fail deterministically instead of crashing.

### Fix 7 — Prototype pollution hardening
- **Files**: `src/index.js`, optionally `src/logger.js` sanitize clone helpers
- **Functions**: object serialization/deserialization object construction
- **Patch sketch**:
  - Use `Object.create(null)` for intermediate maps.
  - Skip/escape dangerous keys: `__proto__`, `prototype`, `constructor`.
  - If preserving exact keys is necessary, use `Object.defineProperty(result, key, { value: ..., enumerable: true, configurable: true, writable: true })` for safe key handling.
- **Compatibility impact**: edge-case key behavior may differ but security improved.

### Fix 8 — Strict safe-mode parity for batch
- **Files**: shared execution in `src/index.js`; remove split behavior in `src/batch.js`
- **Functions**: strict safe-mode check path
- **Patch sketch**:
  - Perform same `strictMode + safeEnabled + missing header` gate for every request item in batch.
  - For notifications, still no response.
- **Compatibility impact**: batch calls from legacy clients may now fail under strict mode (consistent with single behavior).

## 6) Optional phase-2 improvements (post P0/P1)

1. **RpcError canonical class**
   - Single source for `code/message/data/meta`; simplifies normalization and typing.

2. **`resultSchema` support**
   - Add output validation hook to catch handler return shape regressions.

3. **`errorSchema` support**
   - Optional per-method contract validation for `error.data` payloads.

4. **Codec abstraction**
   - Replace hard-coded BigInt/Date with pluggable codecs (`safe`, `json`, custom).

5. **Typed RPC contract generation**
   - Generate TS types from method registry + schema to improve DX and client safety.
