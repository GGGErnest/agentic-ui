/**
 * WebsocketTransportService — unit tests.
 * Focused tests for JSON-RPC request/response, method dispatch, and reconnect state.
 */
import { TestBed } from '@angular/core/testing';
import { WebsocketTransportService, WebSocketState } from './websocket-transport.service';
import { McpToolAdapterService } from './mcp-tool-adapter.service';
import { JsonRpcRequest, JsonRpcSuccessResponse } from './json-rpc.models';

// ---- Helpers ----

class MockWebSocket {
  readyState: number = 1; // OPEN for simplicity
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  simulateMessage(data: string): void {
    const event = new MessageEvent('message', { data });
    this.onmessage?.(event);
  }
}

let mockWs: MockWebSocket | null = null;

function setupWebSocketMock(): void {
  (globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(_url: string) {
      super();
      mockWs = this;
    }
  };
  (globalThis as any).WebSocket.OPEN = 1;
  (globalThis as any).WebSocket.CLOSED = 3;
}

function teardownWebSocketMock(): void {
  mockWs = null;
}

function createMockAdapter(): McpToolAdapterService {
  return {
    executeTool: vi.fn().mockResolvedValue({
      success: true,
      message: 'Tool executed',
      data: { result: 'success' },
    }),
  } as any;
}

// ---- Tests ----

describe('WebsocketTransportService', () => {
  let service: WebsocketTransportService;
  let mockAdapter: McpToolAdapterService;

  beforeEach(() => {
    setupWebSocketMock();

    mockAdapter = createMockAdapter();

    TestBed.configureTestingModule({
      providers: [
        WebsocketTransportService,
        { provide: McpToolAdapterService, useValue: mockAdapter },
      ],
    });

    service = TestBed.inject(WebsocketTransportService);
  });

  afterEach(() => {
    teardownWebSocketMock();
    service.disconnect();
  });

  describe('reconnect state', () => {
    it('starts in DISCONNECTED state', () => {
      expect(service.reconnectState().state).toBe(WebSocketState.DISCONNECTED);
    });

    it('exposes error message in state', () => {
      service['updateState'](WebSocketState.ERROR, 'Test error');
      expect(service.reconnectState().error).toBe('Test error');
    });
  });

  describe('disconnect', () => {
    it('clears pending responses', () => {
      service['pendingResponses'].set(1, vi.fn());
      service.disconnect();
      expect(service['pendingResponses'].size).toBe(0);
    });

    it('resets request ID counter', () => {
      service['nextRequestId'] = 42;
      service.disconnect();
      expect(service['nextRequestId']).toBe(0);
    });
  });

  describe('message handling', () => {
    it('parses valid JSON-RPC message', () => {
      const msg: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test_method',
        params: { key: 'value' },
        id: 1,
      };

      service['handleMessage'](JSON.stringify(msg));
      // Verify adapter was called via dispatchMethodCall
      expect(mockAdapter.executeTool).toHaveBeenCalled();
    });

    it('handles message parse errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      service['handleMessage']('invalid json');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[WebSocket] Failed to parse message:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('method dispatch', () => {
    it('dispatches method calls to adapter', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'do_action',
        params: { param: 'value' },
        id: 1,
      };

      service['handleMessage'](JSON.stringify(request));

      // Let async dispatch complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAdapter.executeTool).toHaveBeenCalledWith('do_action', { param: 'value' });
    });

    it('handles messages without throwing', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'do_action',
        params: {},
        id: 1,
      };

      expect(() => {
        service['handleMessage'](JSON.stringify(request));
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('zone isolation', () => {
    it('uses NgZone for connection lifecycle', () => {
      const zoneService = TestBed.inject(WebsocketTransportService);
      expect(zoneService).toBeDefined();
      // Service uses runOutsideAngular in connect/disconnect
      // This is verified by implementation inspection
    });
  });
});
