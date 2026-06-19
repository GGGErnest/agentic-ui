/**
 * WebSocket Transport — manages JSON-RPC communication with a local MCP server.
 * Operates outside Angular zone to avoid triggering change detection.
 * Parses incoming JSON-RPC messages and dispatches to MCP tool adapter.
 * Exposes reconnect state for UI consumption.
 */
import { Injectable, inject, NgZone, signal, DestroyRef } from '@angular/core';
import { McpToolAdapterService } from './mcp-tool-adapter.service';
import {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,
  JSON_RPC_ERROR_CODES,
} from './json-rpc.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** WebSocket connection state. */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CLOSING = 'closing',
  ERROR = 'error',
}

/** Reconnect state exposed to consumers. */
export interface ReconnectState {
  state: WebSocketState;
  error?: string;
  lastConnectTime?: number;
  lastDisconnectTime?: number;
}

/** Internal error carrying a JSON-RPC error code for the dispatch error response. */
class JsonRpcMethodError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'JsonRpcMethodError';
  }
}

/**
 * WebsocketTransportService — JSON-RPC transport over WebSocket.
 * Manages lifecycle outside Angular zone, parses/dispatches messages,
 * exposes reconnect state signal.
 */
@Injectable({ providedIn: 'root' })
export class WebsocketTransportService {
  private readonly zone = inject(NgZone);
  private readonly adapter = inject(McpToolAdapterService);
  private readonly destroyRef = inject(DestroyRef);

  private ws: WebSocket | null = null;
  private currentUrl: string | null = null;
  private pendingResponses = new Map<string | number, (msg: unknown) => void>();
  /** Reject callbacks + timeout ids per pending request id, for cleanup on disconnect. */
  private pendingRejects = new Map<string | number, (err: Error) => void>();
  private pendingTimers = new Map<string | number, ReturnType<typeof setTimeout>>();
  private nextRequestId = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  /** Set during an intentional `disconnect()` so the close handler skips reconnect. */
  private intentionalClose = false;
  private readonly reconnectBaseDelayMs = 250;
  private readonly reconnectMaxDelayMs = 5_000;

  /** Reconnect state signal for UI binding. */
  readonly reconnectState = signal<ReconnectState>({
    state: WebSocketState.DISCONNECTED,
  });

  constructor() {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.disconnect();
    });
  }

  /**
   * Connect to a WebSocket endpoint.
   * Operates outside Angular zone to prevent change detection during I/O.
   */
  connect(url: string): Promise<void> {
    this.currentUrl = url;
    this.intentionalClose = false;
    this.clearReconnectTimer();

    return new Promise((resolve, reject) => {
      this.zone.runOutsideAngular(() => {
        this.updateState(WebSocketState.CONNECTING);

        try {
          this.ws = new WebSocket(url);

          this.ws.onopen = () => {
            this.zone.run(() => {
              this.reconnectAttempts = 0;
              this.updateState(WebSocketState.CONNECTED, undefined, Date.now());
            });
            resolve();
          };

          this.ws.onmessage = (event) => {
            this.zone.runOutsideAngular(() => {
              this.handleMessage(event.data);
            });
          };

          this.ws.onerror = (event) => {
            this.zone.run(() => {
              const errorMsg = event instanceof Event ? event.type : 'Unknown error';
              this.updateState(WebSocketState.ERROR, errorMsg);
            });
            reject(
              new Error(`WebSocket error: ${event instanceof Event ? event.type : 'unknown'}`),
            );
          };

          this.ws.onclose = () => {
            this.zone.run(() => {
              this.updateState(WebSocketState.DISCONNECTED, undefined, undefined, Date.now());
            });
            // Only auto-reconnect on unexpected closes. An intentional disconnect()
            // clears currentUrl / sets the flag so we don't loop forever.
            if (!this.intentionalClose) {
              this.scheduleReconnect();
            }
          };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.zone.run(() => {
            this.updateState(WebSocketState.ERROR, errorMsg);
          });
          reject(err);
        }
      });
    });
  }

  /** Disconnect from WebSocket and clean up. */
  disconnect(): void {
    this.zone.runOutsideAngular(() => {
      this.intentionalClose = true;
      this.currentUrl = null;
      this.clearReconnectTimer();
      if (this.ws) {
        this.updateState(WebSocketState.CLOSING);
        this.ws.close();
        this.ws = null;
      }
      // Reject any in-flight requests so their promises don't hang forever.
      this.rejectAllPending(new Error('WebSocket disconnected'));
      this.nextRequestId = 0;
    });
  }

  /** Reject and clear all in-flight requests and their timeout timers. */
  private rejectAllPending(error: Error): void {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }
    for (const reject of this.pendingRejects.values()) {
      reject(error);
    }
    this.pendingResponses.clear();
    this.pendingRejects.clear();
    this.pendingTimers.clear();
  }

  /**
   * Send a JSON-RPC request and wait for a response.
   * Allocates an ID and stores the response handler.
   */
  async request<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id,
      };

      const cleanup = () => {
        const timer = this.pendingTimers.get(id);
        if (timer) clearTimeout(timer);
        this.pendingResponses.delete(id);
        this.pendingRejects.delete(id);
        this.pendingTimers.delete(id);
      };

      // Store response handler
      this.pendingResponses.set(id, (msg: unknown) => {
        cleanup();
        const response = msg as JsonRpcSuccessResponse | JsonRpcErrorResponse;
        if ('result' in response) {
          resolve(response.result as T);
        } else if ('error' in response) {
          reject(new Error(`JSON-RPC error: ${response.error.message}`));
        } else {
          reject(new Error('Invalid response format'));
        }
      });
      // Store reject so disconnect() can fail the request instead of hanging.
      this.pendingRejects.set(id, (err: Error) => {
        cleanup();
        reject(err);
      });

      // Send outside zone
      this.zone.runOutsideAngular(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(request));
        } else {
          cleanup();
          reject(new Error('WebSocket not connected'));
        }
      });

      // Timeout after 30s
      const timer = setTimeout(() => {
        if (this.pendingResponses.has(id)) {
          cleanup();
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30_000);
      this.pendingTimers.set(id, timer);
    });
  }

  /**
   * Send a JSON-RPC notification (fire-and-forget).
   */
  notify(method: string, params?: unknown): void {
    this.zone.runOutsideAngular(() => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method,
        params,
      };

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(notification));
      }
    });
  }

  /** Handle incoming JSON-RPC message from server. */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data) as JsonRpcMessage;

      // Check if it's a response to one of our requests
      if (
        'id' in msg &&
        msg.id !== undefined &&
        msg.id !== null &&
        this.pendingResponses.has(msg.id)
      ) {
        const handler = this.pendingResponses.get(msg.id)!;
        // The handler runs cleanup() which removes the response/reject/timer entries.
        handler(msg);
        return;
      }

      // Check if it's a method call (server -> client)
      if ('method' in msg && msg.jsonrpc === '2.0') {
        this.dispatchMethodCall(msg as JsonRpcRequest);
        return;
      }

      // Unknown message type
      console.warn('[WebSocket] Unknown message type:', msg);
    } catch (err) {
      console.error('[WebSocket] Failed to parse message:', err);
    }
  }

  /** Dispatch incoming method call to adapter and send response. */
  private async dispatchMethodCall(request: JsonRpcRequest): Promise<void> {
    try {
      const result = await this.executeMethod(
        request.method,
        request.params as Record<string, unknown>,
      );

      // Send response if request has an ID (not a notification)
      if (request.id !== undefined && request.id !== null) {
        const response: JsonRpcSuccessResponse = {
          jsonrpc: '2.0',
          result,
          id: request.id,
        };

        this.zone.runOutsideAngular(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws!.send(JSON.stringify(response));
          }
        });
      }
    } catch (err) {
      // Send error response
      if (request.id !== undefined && request.id !== null) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const code =
          err instanceof JsonRpcMethodError ? err.code : JSON_RPC_ERROR_CODES.INTERNAL_ERROR;
        const errorResponse: JsonRpcErrorResponse = {
          jsonrpc: '2.0',
          error: {
            code,
            message: errorMsg,
          },
          id: request.id,
        };

        this.zone.runOutsideAngular(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws!.send(JSON.stringify(errorResponse));
          }
        });
      }
    }
  }

  private async executeMethod(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (method === 'initialize') {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'agentic-ui',
          version: '0.0.0',
        },
      };
    }

    if (method === 'tools/list') {
      return {
        tools: this.adapter.getToolDefinitions(),
      };
    }

    if (method === 'tools/call') {
      const toolName = String(params?.['name'] ?? '');
      const toolParams = (params?.['arguments'] as Record<string, unknown> | undefined) ?? {};
      return this.adapter.executeTool(toolName, toolParams);
    }

    // Unknown JSON-RPC method — do NOT treat arbitrary method names as tool
    // executions. Surface a proper METHOD_NOT_FOUND error to the caller.
    throw new JsonRpcMethodError(
      JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
      `Method not found: ${method}`,
    );
  }

  private scheduleReconnect(): void {
    if (!this.currentUrl) {
      return;
    }

    this.clearReconnectTimer();
    const delay = Math.min(
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempts,
      this.reconnectMaxDelayMs,
    );

    this.updateState(WebSocketState.CONNECTING);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      if (this.currentUrl) {
        void this.connect(this.currentUrl).catch((error: unknown) => {
          this.updateState(
            WebSocketState.ERROR,
            error instanceof Error ? error.message : String(error),
          );
        });
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Update reconnect state signal. */
  private updateState(
    state: WebSocketState,
    error?: string,
    lastConnectTime?: number,
    lastDisconnectTime?: number,
  ): void {
    const newState: ReconnectState = {
      state,
      error,
      lastConnectTime: lastConnectTime ?? this.reconnectState().lastConnectTime,
      lastDisconnectTime: lastDisconnectTime ?? this.reconnectState().lastDisconnectTime,
    };
    this.reconnectState.set(newState);
  }
}
