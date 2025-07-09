// Type definitions for rpc-express-toolkit

import type { Router, Request, Response } from "express";

/**
 * Definiamo il tipo della funzione "handler" che aggiungiamo tramite `addMethod`.
 */
type JSONRPCHandler<C> = (req: Request, context: C, params: any) => any | Promise<any>;

interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

interface JSONRPCResponsePayload {
  id?: string | number | null;
  result?: any;
  error?: JSONRPCError;
}

/**
 * The main RpcEndpoint class for JSON-RPC 2.0 endpoints.
 * The generics `<C>` represents the "context" type.
 */
declare class RpcEndpoint<C> {
  /**
   * Constructor.
   * 
   * @param router   - An Express.Router object
   * @param context  - Generic object that will be passed to method handlers
   * @param endpoint - Path on which to respond to JSON-RPC calls (default: "/api")
   */
  constructor(router: Router, context: C, endpoint?: string);

  /**
   * Returns the endpoint path, e.g. "/api".
   */
  get endpoint(): string;

  /**
   * Returns the map of all registered methods.
   */
  get methods(): { [methodName: string]: JSONRPCHandler<C> };

  /**
   * Adds a JSON-RPC method (e.g. "getUserData").
   * 
   * @param name    - Method name
  /**
   * Adds a JSON-RPC method (e.g. "getUserData").
   * 
   * @param name    - Method name
   * @param handler - Handler function that receives (req, context, params)
   */
  addMethod(name: string, handler: JSONRPCHandler<C>): void;

  /**
   * Serve client scripts (for calling JSON-RPC from browser).
   * 
   * @param router - An Express.Router object
   * @param url    - Path from which to serve scripts (default: "/vendor/rpc-client")
   */
  static serveScripts(router: Router, url?: string): void;

  /**
   * Send a JSON-RPC 2.0 response to the client.
   */
  reply(res: Response, responsePayload: JSONRPCResponsePayload): void;

  /**
   * Recursively serialize BigInt and Date to JSON-safe string formats.
   */
  serializeBigIntsAndDates(value: any): any;

  /**
   * Recursively deserialize strings representing BigInt and Date
   * (produced by `serializeBigIntsAndDates`) to reconstruct original types.
   */
  deserializeBigIntsAndDates(value: any): any;
}

/**
 * JSON-RPC 2.0 Client for Node.js environments.
 * Handles BigInt and Date serialization/deserialization automatically.
 */
declare class RpcClient {
  /**
   * Client constructor.
   * 
   * @param endpoint - JSON-RPC endpoint URL
   * @param defaultHeaders - Default headers to include in requests
   * @param options - Configuration options
   * @param options.rejectUnauthorized - Whether to reject unauthorized SSL certificates (default: true). Set to false for development with self-signed certificates.
   */
  constructor(endpoint: string, defaultHeaders?: Record<string, string>, options?: { rejectUnauthorized?: boolean });

  /**
   * Make a JSON-RPC call to the server.
   * 
   * @param method - RPC method name
   * @param params - Parameters to pass to the method
   * @param id - Request ID (optional for notifications)
   * @param overrideHeaders - Headers to override defaults for this request
   * @returns Promise with the RPC call result
   */
  call(method: string, params?: any, id?: string | number | null, overrideHeaders?: Record<string, string>): Promise<any>;

  /**
   * Make a JSON-RPC notification (no response expected).
   * 
   * @param method - RPC method name
   * @param params - Parameters to pass to the method
   * @param overrideHeaders - Headers to override defaults for this request
   */
  notify(method: string, params?: any, overrideHeaders?: Record<string, string>): Promise<void>;

  /**
   * Make a batch JSON-RPC call.
   * 
   * @param requests - Array of request objects
   * @param overrideHeaders - Headers to override defaults for this request
   * @returns Promise with array of results
   */
  batch(requests: Array<{method: string, params?: any, id?: string|number|null, notification?: boolean}>, overrideHeaders?: Record<string, string>): Promise<any[]>;

  /**
   * Recursively serialize BigInt and Date to JSON-safe string formats.
   */
  serializeBigIntsAndDates(value: any): any;

  /**
   * Recursively deserialize strings representing BigInt and Date.
   */
  deserializeBigIntsAndDates(value: any): any;
}

/**
 * Main export structure.
 */
declare const Main: {
  new <C>(router: Router, context: C, endpoint?: string): RpcEndpoint<C>;
  prototype: RpcEndpoint<any>;
  serveScripts(router: Router, url?: string): void;
  RpcEndpoint: typeof RpcEndpoint;
  RpcClient: typeof RpcClient;
};

export = Main;
