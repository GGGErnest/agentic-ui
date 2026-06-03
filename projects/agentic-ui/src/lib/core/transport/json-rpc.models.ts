/**
 * JSON-RPC 2.0 specification models.
 * Defines request, response, error, and message types for MCP communication over WebSocket.
 * Reference: https://www.jsonrpc.org/specification
 */

/** JSON-RPC Request object. */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown; // Can be object, array, or any value per spec
  id?: string | number | null;
}

/** JSON-RPC Response object (result). */
export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  result: unknown;
  id: string | number | null;
}

/** JSON-RPC Response object (error). */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  error: JsonRpcError;
  id: string | number | null;
}

/** JSON-RPC Notification (request without id). */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/** JSON-RPC Error object. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown; // Additional error data
}

/** Union of all JSON-RPC message types (for parsing). */
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse
  | JsonRpcNotification;

/** Standard JSON-RPC error codes. */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const;
