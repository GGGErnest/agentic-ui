import { AgUiHttpTransport } from './ag-ui-http-transport.service';
import type { AgentEvent } from '../events/agent-event.model';

describe('AgUiHttpTransport', () => {
  let transport: AgUiHttpTransport;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    transport = new AgUiHttpTransport({ endpoint: '/api/agent' });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses SSE data lines into AgentEvent objects', async () => {
    const sse =
      'data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n' +
      'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m","delta":"hi"}\n\n' +
      'data: {"type":"RUN_FINISHED","threadId":"t","runId":"r","outcome":"success"}\n\n';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn(
      async () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    ) as unknown as typeof fetch;

    const events: AgentEvent[] = [];
    for await (const e of transport.run({ threadId: 't', runId: 'r', messages: [] })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_CONTENT',
      'RUN_FINISHED',
    ]);
  });

  it('emits RUN_ERROR on HTTP failure', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('nope', { status: 500 }),
    ) as unknown as typeof fetch;
    const events: AgentEvent[] = [];
    for await (const e of transport.run({ threadId: 't', runId: 'r', messages: [] })) {
      events.push(e);
    }
    const err = events.find((e) => e.type === 'RUN_ERROR');
    expect(err).toBeDefined();
  });

  it('forwards the AbortSignal to fetch and emits aborted error when fetch rejects (#G1)', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const controller = new AbortController();
    const events: AgentEvent[] = [];
    for await (const e of transport.run(
      { threadId: 't', runId: 'r', messages: [] },
      controller.signal,
    )) {
      events.push(e);
    }

    // The signal must be passed to fetch.
    const callArgs = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[1].signal).toBe(controller.signal);
    const err = events.find((e) => e.type === 'RUN_ERROR') as { message?: string } | undefined;
    expect(err?.message).toBe('aborted');
    expect(events.at(-1)?.type).toBe('RUN_FINISHED');
  });

  it('stops draining and emits aborted when the signal is already aborted mid-stream (#G1)', async () => {
    const controller = new AbortController();
    const cancelSpy = vi.fn(async () => {});
    const stream = new ReadableStream<Uint8Array>({
      start(controller2) {
        controller2.enqueue(
          new TextEncoder().encode('data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n'),
        );
        // Do not close — simulate an open stream.
      },
      cancel: cancelSpy,
    });
    globalThis.fetch = vi.fn(
      async () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    ) as unknown as typeof fetch;

    // Abort before consuming.
    controller.abort();
    const events: AgentEvent[] = [];
    for await (const e of transport.run(
      { threadId: 't', runId: 'r', messages: [] },
      controller.signal,
    )) {
      events.push(e);
    }
    expect(events.some((e) => e.type === 'RUN_ERROR')).toBe(true);
    expect(events.at(-1)?.type).toBe('RUN_FINISHED');
  });
});
