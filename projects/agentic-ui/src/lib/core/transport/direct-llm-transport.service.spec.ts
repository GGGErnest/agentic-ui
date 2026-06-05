import { TestBed } from '@angular/core/testing';
import { DirectLLMTransport } from './direct-llm-transport.service';
import { LLMProvider, LLMStreamChunk } from '../harness/llm-provider.interface';
import { AgentWorldService } from '../world/agent-world.service';
import { LLM_PROVIDER } from '../providers/llm-provider.token';
import { AgentApprovalService } from '../approval/agent-approval.service';
import type { AgentEvent } from '../events/agent-event.model';

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

  describe('resume()', () => {
    it('emits TOOL_CALL_START/ARGS/END/RESULT and RUN_FINISHED success on decision=approved', async () => {
      const approval = TestBed.inject(AgentApprovalService);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
      world.register({
        id: 'btn',
        role: 'B',
        actions: [{ name: 'click', description: 'c', requiresApproval: true, execute }],
      });

      vi.mocked(mockLLM.getStream).mockReturnValueOnce(
        new AsyncChunks([
          {
            type: 'tool_call',
            data: { id: 'c1', function: { name: 'btn__action__click', arguments: '{}' } },
          },
        ]),
      );

      const runEvents: AgentEvent[] = [];
      for await (const e of transport.run({
        threadId: 't',
        runId: 'r1',
        messages: [{ id: 'm1', role: 'user', content: 'go' }],
      })) {
        runEvents.push(e);
      }
      const fin = runEvents.find((e) => e.type === 'RUN_FINISHED') as
        | { runId: string; interrupts?: { id: string }[] }
        | undefined;
      const interruptId = fin?.interrupts?.[0]?.id;
      expect(interruptId).toBeDefined();

      queueMicrotask(() => approval.approve());

      const resumeEvents: string[] = [];
      let toolResult: { toolCallId: string; content: string } | undefined;
      for await (const e of transport.resume({
        threadId: 't',
        runId: 'r2',
        parentRunId: fin!.runId,
        messages: [],
        resume: { [interruptId!]: { decision: 'approved' } },
      })) {
        resumeEvents.push(e.type);
        if (e.type === 'TOOL_CALL_RESULT') {
          toolResult = e as { toolCallId: string; content: string };
        }
      }
      expect(execute).toHaveBeenCalled();
      expect(toolResult?.content).toBe('ok');
      expect(resumeEvents).toContain('TOOL_CALL_START');
      expect(resumeEvents).toContain('TOOL_CALL_RESULT');
      expect(resumeEvents[resumeEvents.length - 1]).toBe('RUN_FINISHED');
    });

    it('emits TOOL_CALL_RESULT with rejection reason and does not call execute on decision=rejected', async () => {
      const approval = TestBed.inject(AgentApprovalService);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'should not run' });
      world.register({
        id: 'btn',
        role: 'B',
        actions: [{ name: 'click', description: 'c', requiresApproval: true, execute }],
      });

      vi.mocked(mockLLM.getStream).mockReturnValueOnce(
        new AsyncChunks([
          {
            type: 'tool_call',
            data: { id: 'c1', function: { name: 'btn__action__click', arguments: '{}' } },
          },
        ]),
      );

      const runEvents: AgentEvent[] = [];
      for await (const e of transport.run({
        threadId: 't',
        runId: 'r1',
        messages: [{ id: 'm1', role: 'user', content: 'go' }],
      })) {
        runEvents.push(e);
      }
      const fin = runEvents.find((e) => e.type === 'RUN_FINISHED') as
        | { runId: string; interrupts?: { id: string }[] }
        | undefined;
      const interruptId = fin?.interrupts?.[0]?.id;
      expect(interruptId).toBeDefined();

      queueMicrotask(() => approval.reject());

      const resumeEvents: string[] = [];
      let toolResult: { content: string } | undefined;
      for await (const e of transport.resume({
        threadId: 't',
        runId: 'r2',
        parentRunId: fin!.runId,
        messages: [],
        resume: { [interruptId!]: { decision: 'rejected', reason: 'nope' } },
      })) {
        resumeEvents.push(e.type);
        if (e.type === 'TOOL_CALL_RESULT') {
          toolResult = e as { content: string };
        }
      }
      expect(execute).not.toHaveBeenCalled();
      expect(toolResult?.content).toBe('nope');
      expect(resumeEvents).toContain('TOOL_CALL_RESULT');
      expect(resumeEvents[resumeEvents.length - 1]).toBe('RUN_FINISHED');
    });
  });
});
