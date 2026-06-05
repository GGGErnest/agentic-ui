import { TestBed } from '@angular/core/testing';
import { DirectLLMTransport } from './direct-llm-transport.service';
import { LLMProvider, LLMStreamChunk } from '../harness/llm-provider.interface';
import { AgentWorldService } from '../world/agent-world.service';
import { LLM_PROVIDER } from '../providers/llm-provider.token';

class AsyncChunks implements AsyncIterable<LLMStreamChunk> {
  constructor(private chunks: LLMStreamChunk[]) {}
  async *[Symbol.asyncIterator]() {
    for (const c of this.chunks) yield c;
  }
}

describe('DirectLLMTransport', () => {
  let transport: DirectLLMTransport;
  let mockLLM: LLMProvider;
  let world: AgentWorldService;

  beforeEach(() => {
    mockLLM = { getStream: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AgentWorldService,
        { provide: LLM_PROVIDER, useValue: mockLLM },
        DirectLLMTransport,
      ],
    });
    transport = TestBed.inject(DirectLLMTransport);
    world = TestBed.inject(AgentWorldService);
    vi.spyOn(world, 'waitForStable').mockResolvedValue();
  });

  it('yields RUN_STARTED, text events, and RUN_FINISHED for text-only input', async () => {
    vi.mocked(mockLLM.getStream).mockReturnValue(
      new AsyncChunks([{ type: 'content', text: 'Hello' }]),
    );
    world.register({ id: 'tbl', role: 'Tbl', actions: [] });

    const events: string[] = [];
    for await (const e of transport.run({
      threadId: 't',
      runId: 'r',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    })) {
      events.push(e.type);
    }
    expect(events[0]).toBe('RUN_STARTED');
    expect(events).toContain('TEXT_MESSAGE_CONTENT');
    expect(events[events.length - 1]).toBe('RUN_FINISHED');
  });

  it('emits TOOL_CALL_START and TOOL_CALL_RESULT when action executes', async () => {
    world.register({
      id: 'btn',
      role: 'B',
      actions: [
        {
          name: 'click',
          description: 'c',
          execute: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
        },
      ],
    });
    vi.mocked(mockLLM.getStream)
      .mockImplementationOnce(
        () =>
          new AsyncChunks([
            {
              type: 'tool_call',
              data: { id: 'c1', function: { name: 'btn__action__click', arguments: '{}' } },
            },
          ]),
      )
      .mockImplementation(() => new AsyncChunks([{ type: 'content', text: 'done' }]));

    const events: string[] = [];
    for await (const e of transport.run({
      threadId: 't',
      runId: 'r',
      messages: [{ id: 'm1', role: 'user', content: 'go' }],
    })) {
      events.push(e.type);
    }
    expect(events).toContain('TOOL_CALL_START');
    expect(events).toContain('TOOL_CALL_RESULT');
  });
});
