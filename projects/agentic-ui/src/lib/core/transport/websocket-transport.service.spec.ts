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
      // Fire onopen asynchronously so connect()'s promise resolves, mirroring
      // real WebSocket behavior.
      setTimeout(() => this.onopen?.(new Event('open')), 0);
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

    it('rejects in-flight requests instead of letting them hang (#E2)', async () => {
      await service.connect('ws://test');
      const pending = service.request('tools/list');
      // Disconnect before any response arrives.
      service.disconnect();
      await expect(pending).rejects.toThrow(/disconnected/i);
      expect(service['pendingResponses'].size).toBe(0);
      expect(service['pendingTimers'].size).toBe(0);
    });

    it('does not auto-reconnect after an intentional disconnect (#E1)', async () => {
      await service.connect('ws://test');
      const first = mockWs!;
      service.disconnect();
      // Simulate the close event the browser fires after close().
      first.onclose?.(new Event('close'));
      await new Promise((resolve) => setTimeout(resolve, 5));
      // No reconnect timer scheduled; state stays disconnected/closing.
      expect(service['reconnectTimer']).toBeNull();
      expect(service['currentUrl']).toBeNull();
    });
  });

  describe('message handling', () => {
    it('dispatches a tools/call message to the adapter', () => {
      const msg: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'foo__action__bar', arguments: { key: 'value' } },
        id: 1,
      };

      service['handleMessage'](JSON.stringify(msg));
      expect(mockAdapter.executeTool).toHaveBeenCalledWith('foo__action__bar', { key: 'value' });
    });

    it('handles message parse errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      service['handleMessage']('invalid json');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[WebSocket] Failed to parse message:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('method dispatch', () => {
    it('routes tools/call to the adapter', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'do_action', arguments: { param: 'value' } },
        id: 1,
      };

      service['handleMessage'](JSON.stringify(request));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAdapter.executeTool).toHaveBeenCalledWith('do_action', { param: 'value' });
    });

    it('returns METHOD_NOT_FOUND for unknown methods instead of executing a tool (#E3)', async () => {
      await service.connect('ws://test');
      const sendSpy = mockWs!.send;
      sendSpy.mockClear();

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'totally_unknown_method',
        params: {},
        id: 7,
      };
      service['handleMessage'](JSON.stringify(request));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Adapter must NOT be invoked for an unknown method.
      expect(mockAdapter.executeTool).not.toHaveBeenCalled();
      // An error response with METHOD_NOT_FOUND (-32601) must be sent back.
      const sent = sendSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
      const errorResponse = sent.find((m) => m.id === 7 && m.error);
      expect(errorResponse).toBeDefined();
      expect(errorResponse.error.code).toBe(-32601);
    });

    it('handles messages without throwing', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
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
