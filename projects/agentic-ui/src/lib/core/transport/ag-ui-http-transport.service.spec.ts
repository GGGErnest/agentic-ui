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
});
