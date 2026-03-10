# Deep Technical Audit — rpc-express-toolkit

This audit focuses only on correctness, edge cases, and protocol consistency. It is based on direct code inspection and local test execution.

## 1) JSON-RPC 2.0 compliance findings

### Confirmed issues

1. **Single-request notifications incorrectly produce a response**
   - In the single-request path, `#processSingleRequest()` always calls `reply()` even when `id` is `undefined`.
   - `reply()` normalizes missing `id` to `null`, so notifications receive a response body, which violates JSON-RPC 2.0 notification semantics.

2. **`id: null` is treated as notification in batch path**
   - Batch logic sets `isNotification = id === undefined || id === null`.
   - JSON-RPC 2.0 defines notification as request **without** `id`; `id: null` is a request id value (discouraged but legal), and should still map to a response.

3. **`id` type is not validated**
   - Neither single nor batch path validates `id` types.
   - Invalid ids (e.g. object/array/boolean) are echoed back instead of generating `-32600 Invalid Request`.

4. **`params` type is not validated at protocol envelope level**
   - JSON-RPC requires `params` to be object or array when present.
   - Current envelope validation accepts any type and forwards it to handlers.

5. **Batch duplicate-id rejection is non-spec behavior**
   - `validateBatch()` rejects duplicate ids in a batch and fails the whole batch.
   - JSON-RPC does not forbid duplicate ids; while discouraged, rejecting whole batch is a protocol-level deviation.

6. **Empty-array batch validator path is unreachable**
   - Endpoint classifies batch only if `Array.isArray(body) && body.length > 0`.
   - As a result, `BatchHandler.validateBatch([])` branch is never used from the normal route path.

### What is compliant

- Per-item envelope checks for `jsonrpc` and `method` exist in both single and batch execution.
- Batch responses retain correlation by returning each item with its own `id`.
- Batch allows partial success/failure (mixed results + errors).

## 2) Batch vs single execution inconsistencies

### Confirmed pipeline gaps in batch

Compared to single-request pipeline, batch currently **skips**:

1. **Strict safe-mode compatibility enforcement**
   - Single path enforces `strictMode` + `safeEnabled` + missing `X-RPC-Safe-Enabled` => error.
   - Batch path does not enforce this.

2. **Schema validation and validation middleware hooks**
   - Single path runs `beforeValidation`, AJV schema validation, and `afterValidation` when method schema exists.
   - Batch path never loads method schema and never performs those steps.

3. **Error data propagation / normalization parity**
   - Single path includes structured error payload (`err.data` when present + serialized error metadata).
   - Batch path replaces error `data` with `{ batchIndex }`, dropping method-level error data.

### Consequences

- Batch can bypass parameter schema constraints enforced for single calls.
- Batch can bypass strict-mode safety negotiation checks required for single calls.
- Clients receive different error payload structures between single and batch calls for the same underlying handler failure.

## 3) Serialization edge cases

### Confirmed behavior risks

1. **Ambiguous conversion in unsafe mode (`safeEnabled=false`)**
   - Any string matching `/^-?\d+n$/` is deserialized as `BigInt`.
   - A user-supplied literal string like `"123n"` is silently retyped.

2. **Date auto-conversion in unsafe mode can retag plain strings**
   - ISO datetime strings are converted to `Date` when `safeEnabled=false`.
   - Some literal user strings can become `Date` objects unexpectedly.

3. **No cycle detection in recursive serializer/deserializer**
   - Recursive traversal over arrays/objects has no visited-set guard.
   - Circular objects can cause stack overflow / runtime failure.

4. **`"2024-01-01"` not converted as Date in unsafe mode**
   - Regex only accepts datetime-like ISO format, not date-only format.
   - This may create inconsistent expectations between date-like strings.

### Symmetry notes for requested test cases

- `"123n"`: converts to `BigInt(123)` in unsafe mode; preserved as string in safe mode (`S:123n` roundtrip).
- `"S:123"`: safe mode roundtrip is symmetric (`S:S:123` -> `S:123`).
- `"D:2024-01-01"`: treated as plain string unless sent as safe-prefixed date from serializer with valid ISO datetime.
- `"2024-01-01"`: remains string (no conversion).
- `"00123"`: remains string.
- Very large bigint string ending in `n`: converts to arbitrary precision `BigInt`.

## 4) Safe mode negotiation weaknesses

1. **Strict mode applies only to single requests**
   - Batch path does not enforce strict header requirement.

2. **Client and server negotiation is per HTTP request, not per call**
   - This is expected for headers, but means mixed-client semantics cannot be represented inside a single batch.

3. **Batch notifications + HTTP 204 may not interoperate with generic clients expecting JSON body**
   - Server sends 204 for all-notification batches.
   - Toolkit client currently always sets ids in `batch()`, so it does not hit this path; third-party clients might.

## 5) Error handling correctness issues

1. **Single-request error object includes non-standard nested `error` field**
   - Error response contains standard fields (`code`, `message`, optional `data`) plus nested `error: serializeError(...)`.
   - Extra fields are allowed, but this payload shape differs from batch path and can surprise strict consumers.

2. **Batch error payload drops original `err.data`**
   - Batch wraps failures with `{ code, message, data: { batchIndex } }` only.
   - Method-specific validation or domain error data is lost.

3. **Potential stack leakage path**
   - Although response sanitization is attempted, logger includes stack traces in `rpcError()` and endpoint catch logging.
   - This is a logging-scope concern (not wire payload) but may still expose internals in logs.

## 6) Validation coverage and bypass risks

1. **Schema validation absent in batch path**
   - Methods with schemas are validated for single calls but not for batch calls.

2. **Result validation not implemented**
   - No output schema checks are applied in either path.

3. **`error.data` validation not implemented**
   - Framework does not validate error payload data shape.

## 7) Security concerns

1. **Prototype pollution vector during object serialization**
   - Serializer creates plain `{}` and assigns keys from untrusted objects.
   - Assigning `__proto__` mutates object prototype of serialized object.

2. **DoS risk via deep/circular structures**
   - Recursive serialization/deserialization and log sanitization lack depth limits and cycle detection.

3. **Sensitive-data logging risk**
   - Parameter sanitization is key-name based and partial; fields not matching heuristic sensitive substrings may be logged.

## 8) Recommended fixes (code-level)

1. **Unify single and batch execution pipeline**
   - Extract a shared `executeRpcCall({ request, req, res, context, batchIndex? })` used by both paths.
   - Ensure identical sequence: envelope validation -> safe negotiation -> param deserialization -> beforeCall -> beforeValidation -> schema validation -> afterValidation -> handler -> result serialization -> afterCall -> normalized response.

2. **Fix notification semantics**
   - Treat as notification only when `id` is **absent** (`!Object.prototype.hasOwnProperty.call(request, 'id')`).
   - Do not send response for single notifications.
   - In batch, respond for `id:null` requests.

3. **Add protocol-level envelope validation helper**
   - Validate:
     - `jsonrpc === '2.0'`
     - `method` is string and non-empty
     - if `params` present: must be object or array
     - if `id` present: string | number | null only
   - Return `-32600` for envelope violations.

4. **Remove non-spec duplicate-id batch rejection**
   - Process each request independently, even with duplicate ids.

5. **Preserve error payload parity**
   - Keep `err.data` in batch responses and optionally append `batchIndex` inside `data` (without overwriting existing data).

6. **Harden serialization against prototype pollution / recursion DoS**
   - Build objects via `Object.create(null)` or guard dangerous keys (`__proto__`, `prototype`, `constructor`).
   - Track visited objects with `WeakSet` and throw controlled error on cycles.
   - Add max-depth guard.

7. **Strengthen safe-mode semantics**
   - Apply strict-mode header enforcement identically for batch and single paths.

8. **Add tests for currently uncovered edge cases**
   - Single notification must return HTTP 204/empty body.
   - Batch with `id:null` must return a response item.
   - Batch request to schema-protected method must validate exactly as single.
   - Invalid `id` types and invalid `params` type must return `-32600`.
   - Circular object serialization must fail safely with deterministic error.
