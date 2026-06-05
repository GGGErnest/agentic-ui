import { TestBed } from '@angular/core/testing';
import { RuntimeProxyService } from './runtime-proxy.service';
import type { AgentEvent } from '../events/agent-event.model';

describe('RuntimeProxyService', () => {
  let service: RuntimeProxyService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    TestBed.configureTestingModule({ providers: [RuntimeProxyService] });
    service = TestBed.inject(RuntimeProxyService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('streams events from the configured proxy endpoint', async () => {
    const sse =
      'data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n' +
      'data: {"type":"RUN_FINISHED","threadId":"t","runId":"r","outcome":"success"}\n\n';
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(sse));
        c.close();
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(stream)) as unknown as typeof fetch;
    const events: AgentEvent[] = [];
    for await (const e of service.streamEvents({ threadId: 't', runId: 'r', messages: [] })) {
      events.push(e);
    }
    expect(events[0]?.type).toBe('RUN_STARTED');
    expect(events.at(-1)?.type).toBe('RUN_FINISHED');
  });

  it('never reads API keys from the browser environment', () => {
    expect((service as unknown as { apiKey: unknown }).apiKey).toBeUndefined();
    expect((service as unknown as Record<string, unknown>)['LLM_API_KEY']).toBeUndefined();
  });
});
