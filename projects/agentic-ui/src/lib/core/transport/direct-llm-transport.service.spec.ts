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

  it('loops multiple turns until the model emits no tool calls (#7)', async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
    world.register({
      id: 'btn',
      role: 'B',
      actions: [{ name: 'click', description: 'c', execute }],
    });

    // Turn 1 and 2 each emit a tool call; turn 3 settles with text only.
    vi.mocked(mockLLM.getStream)
      .mockReturnValueOnce(
        new AsyncChunks([
          {
            type: 'tool_call',
            data: { id: 'c1', function: { name: 'btn__action__click', arguments: '{}' } },
          },
        ]),
      )
      .mockReturnValueOnce(
        new AsyncChunks([
          {
            type: 'tool_call',
            data: { id: 'c2', function: { name: 'btn__action__click', arguments: '{}' } },
          },
        ]),
      )
      .mockReturnValue(new AsyncChunks([{ type: 'content', text: 'all done' }]));

    const events: AgentEvent[] = [];
    for await (const e of transport.run({
      threadId: 't',
      runId: 'r',
      messages: [{ id: 'm1', role: 'user', content: 'go' }],
    })) {
      events.push(e);
    }

    // Executed once per tool-emitting turn.
    expect(execute).toHaveBeenCalledTimes(2);
    // Three reasoning turns -> three STEP_STARTED.
    expect(events.filter((e) => e.type === 'STEP_STARTED')).toHaveLength(3);
    const fin = events.at(-1) as { type: string; outcome?: string };
    expect(fin.type).toBe('RUN_FINISHED');
    expect(fin.outcome).toBe('success');
  });

  it('dispatches writable readable tools through updateReadable', async () => {
    const writeSpy = vi.fn().mockResolvedValue({ success: true, message: 'Config updated' });
    world.register({
      id: 'settings-panel',
      role: 'Panel',
      actions: [],
      readables: [
        {
          name: 'config',
          description: 'Configuration',
          schema: { type: 'object', properties: { value: { type: 'string' } } },
          writable: true,
          read: vi.fn().mockResolvedValue({ success: true, message: 'ok', value: 'old' }),
          write: writeSpy,
        },
      ],
    });
    vi.mocked(mockLLM.getStream)
      .mockImplementationOnce(
        () =>
          new AsyncChunks([
            {
              type: 'tool_call',
              data: {
                id: 'c1',
                function: {
                  name: 'settings-panel__write__config',
                  arguments: '{"value":"new-value"}',
                },
              },
            },
          ]),
      )
      .mockImplementation(() => new AsyncChunks([{ type: 'content', text: 'done' }]));

    const results: string[] = [];
    for await (const e of transport.run({
      threadId: 't',
      runId: 'r',
      messages: [{ id: 'm1', role: 'user', content: 'go' }],
    })) {
      if (e.type === 'TOOL_CALL_RESULT') {
        results.push((e as { content: string }).content);
      }
    }

    expect(writeSpy).toHaveBeenCalledWith('new-value');
    expect(results).toContain('Config updated');
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

    it('emits RUN_ERROR + error RUN_FINISHED when no interrupt matches the decisions (#8)', async () => {
      const events: AgentEvent[] = [];
      for await (const e of transport.resume({
        threadId: 't',
        runId: 'r2',
        parentRunId: 'r-does-not-exist',
        messages: [],
        resume: { 'ticket-missing': { decision: 'approved' } },
      })) {
        events.push(e);
      }

      expect(events.some((e) => e.type === 'RUN_ERROR')).toBe(true);
      const fin = events.at(-1) as { type: string; outcome?: string } | undefined;
      expect(fin?.type).toBe('RUN_FINISHED');
      expect(fin?.outcome).toBe('error');
    });

    it('isolates approval promises per runId so concurrent runs do not collide (#11)', async () => {
      const approval = TestBed.inject(AgentApprovalService);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
      world.register({
        id: 'btn',
        role: 'B',
        actions: [{ name: 'click', description: 'c', requiresApproval: true, execute }],
      });

      // Two independent runs each produce their own interrupt.
      const startRun = async (runId: string) => {
        vi.mocked(mockLLM.getStream).mockReturnValueOnce(
          new AsyncChunks([
            {
              type: 'tool_call',
              data: {
                id: `tc-${runId}`,
                function: { name: 'btn__action__click', arguments: '{}' },
              },
            },
          ]),
        );
        const evs: AgentEvent[] = [];
        for await (const e of transport.run({
          threadId: 't',
          runId,
          messages: [{ id: 'm', role: 'user', content: 'go' }],
        })) {
          evs.push(e);
        }
        const fin = evs.find((e) => e.type === 'RUN_FINISHED') as
          | { interrupts?: { id: string }[] }
          | undefined;
        return fin?.interrupts?.[0]?.id as string;
      };

      const ticketA = await startRun('run-A');
      const ticketB = await startRun('run-B');
      expect(ticketA).toBeDefined();
      expect(ticketB).toBeDefined();

      // Resume run-A only; run-B's pending promise must remain untouched.
      queueMicrotask(() => approval.resolveById(ticketA, true));
      const resumeA: string[] = [];
      for await (const e of transport.resume({
        threadId: 't',
        runId: 'run-A2',
        parentRunId: 'run-A',
        messages: [],
        resume: { [ticketA]: { decision: 'approved' } },
      })) {
        resumeA.push(e.type);
      }
      expect(resumeA.at(-1)).toBe('RUN_FINISHED');
      expect(execute).toHaveBeenCalledTimes(1);

      // run-B still resolvable independently.
      queueMicrotask(() => approval.resolveById(ticketB, true));
      const resumeB: string[] = [];
      for await (const e of transport.resume({
        threadId: 't',
        runId: 'run-B2',
        parentRunId: 'run-B',
        messages: [],
        resume: { [ticketB]: { decision: 'approved' } },
      })) {
        resumeB.push(e.type);
      }
      expect(resumeB.at(-1)).toBe('RUN_FINISHED');
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });
});
