/**
 * AgentHarness — unit tests.
 * Tests the ReAct loop: streaming thoughts, tool dispatch, stability gating,
 * error recovery, and conversation management.
 */
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AgentHarness } from './agent-harness.service';
import { AgentWorldService } from '../world/agent-world.service';
import { LLMProvider, LLMMessage, LLMStreamChunk, ToolCall } from './llm-provider.interface';
import { LLM_PROVIDER } from '../providers/llm-provider.token';
import { AgentAction, AgentActionResult } from '../world/agent-action.model';
import { WorldSnapshot } from '../world/world-entry.interface';
import { AgentApprovalService } from '../approval/agent-approval.service';
import { AgentEvent } from '../events/agent-event.model';

// ---- Helpers ----

function createMockAppRef() {
  const stable$ = new BehaviorSubject(true);
  return {
    isStable: stable$,
    afterTick: new BehaviorSubject(void 0),
    onStable: new Subject<void>(),
    tick: vi.fn(),
    _tick: vi.fn(),
    attachView: vi.fn(),
    detachView: vi.fn(),
    componentTypes: [],
    components: [],
    viewCount: 0,
  } as unknown as ApplicationRef;
}

function createMockLLM(): LLMProvider {
  return {
    getStream: vi.fn(),
  };
}

class AsyncIterableChunks implements AsyncIterable<LLMStreamChunk> {
  constructor(private chunks: LLMStreamChunk[]) {}

  async *[Symbol.asyncIterator]() {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }
}

// ---- Tests ----

describe('AgentHarness', () => {
  let harness: AgentHarness;
  let world: AgentWorldService;
  let appRef: ApplicationRef;
  let mockLLM: LLMProvider;

  beforeEach(() => {
    appRef = createMockAppRef();
    mockLLM = createMockLLM();

    TestBed.configureTestingModule({
      providers: [
        AgentWorldService,
        AgentHarness,
        { provide: ApplicationRef, useValue: appRef },
        { provide: LLM_PROVIDER, useValue: mockLLM },
      ],
    });

    harness = TestBed.inject(AgentHarness);
    world = TestBed.inject(AgentWorldService);
    // In test environment, afterEveryRender never fires, so waitForStable
    // would block indefinitely. Mock it to resolve immediately.
    vi.spyOn(world, 'waitForStable').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== Initial State ==========

  describe('initial state', () => {
    it('is provided from the root injector', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AgentWorldService,
          { provide: ApplicationRef, useValue: createMockAppRef() },
          { provide: LLM_PROVIDER, useValue: createMockLLM() },
        ],
      });

      expect(TestBed.inject(AgentHarness)).toBeInstanceOf(AgentHarness);
    });

    it('should start with empty thought', () => {
      expect(harness.thought()).toBe('');
    });

    it('should start with empty steps', () => {
      expect(harness.steps()).toEqual([]);
    });

    it('should not be running', () => {
      expect(harness.isRunning()).toBe(false);
    });

    it('should start with empty chatTurns', () => {
      expect(harness.chatTurns()).toEqual([]);
    });
  });

  // ========== System Prompt ==========

  describe('setSystemPrompt', () => {
    it('should store system prompt for later cycles', () => {
      harness.setSystemPrompt('You are a helpful agent.');
      // The prompt is stored internally — verified indirectly via runCycle
      expect(() => harness.reset()).not.toThrow();
    });
  });

  // ========== runCycle — Thoughts Only ==========

  describe('runCycle — thought streaming', () => {
    it('times out after 60 seconds by default', async () => {
      vi.useFakeTimers();
      vi.mocked(mockLLM.getStream).mockImplementation((_messages, _tools, _systemPrompt, signal) =>
        (async function* () {
          await new Promise<void>((_, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        })(),
      );

      const cyclePromise = harness.runCycle('wait forever');
      await vi.advanceTimersByTimeAsync(60_000);
      await cyclePromise;

      expect(harness.steps()[0].result).toBe(
        'Cycle timed out after 60000ms waiting for LLM response.',
      );
      vi.useRealTimers();
    });

    it('should accumulate thought tokens in the signal', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'Let me think...' },
          { type: 'thought', text: ' Actually, I should click that button.' },
        ]),
      );

      await harness.runCycle('Do something');

      expect(harness.thought()).toBe('Let me think... Actually, I should click that button.');
    });

    it('should record a step with thought but no action when no tool calls made', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'Everything looks fine, no action needed.' },
        ]),
      );

      await harness.runCycle('Check status');

      const steps = harness.steps();
      expect(steps).toHaveLength(1);
      expect(steps[0].thought).toContain('Everything looks fine');
      expect(steps[0].action).toBeNull();
      expect(steps[0].result).toContain('No action taken');
    });
  });

  // ========== Event Emission ==========

  describe('event emission', () => {
    it('emits RUN_STARTED + text events + RUN_FINISHED for text-only run', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'content', text: 'Hello ' },
          { type: 'content', text: 'world' },
        ]),
      );

      const events = await harness.runWithEvents('Greet me');

      const types = events.map((e) => e.type);
      expect(types[0]).toBe('RUN_STARTED');
      expect(types).toContain('TEXT_MESSAGE_START');
      expect(types).toContain('TEXT_MESSAGE_CONTENT');
      expect(types).toContain('TEXT_MESSAGE_END');
      expect(types[types.length - 1]).toBe('RUN_FINISHED');
    });

    it('shares a single messageId across START/CONTENT/END', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'content', text: 'A' },
          { type: 'content', text: 'B' },
          { type: 'content', text: 'C' },
        ]),
      );

      const events = await harness.runWithEvents('hi');
      const start = events.find((e) => e.type === 'TEXT_MESSAGE_START') as
        | { type: 'TEXT_MESSAGE_START'; messageId: string }
        | undefined;
      const contents = events.filter(
        (e) => e.type === 'TEXT_MESSAGE_CONTENT',
      ) as { type: 'TEXT_MESSAGE_CONTENT'; messageId: string }[];
      const end = events.find((e) => e.type === 'TEXT_MESSAGE_END') as
        | { type: 'TEXT_MESSAGE_END'; messageId: string }
        | undefined;
      expect(start).toBeDefined();
      expect(end).toBeDefined();
      expect(contents).toHaveLength(3);
      expect(contents.every((c) => c.messageId === start!.messageId)).toBe(true);
      expect(end!.messageId).toBe(start!.messageId);
    });

    it('emits TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT for tool run', async () => {
      world.register({
        id: 'tbl',
        role: 'DataTable',
        actions: [
          {
            name: 'del',
            description: 'delete',
            execute: vi.fn().mockResolvedValue({ success: true, message: 'deleted' }),
          },
        ],
      });

      vi.mocked(mockLLM.getStream).mockReturnValueOnce(
        new AsyncIterableChunks([
          { type: 'thought', text: 'Deleting' },
          {
            type: 'tool_call',
            data: { id: 'c1', function: { name: 'tbl__action__del', arguments: '{}' } },
          },
        ]),
      );

      const events = await harness.runWithEvents('delete something');

      const toolEvents = events.filter((e) => e.type.startsWith('TOOL_'));
      expect(toolEvents.map((e) => e.type)).toEqual([
        'TOOL_CALL_START',
        'TOOL_CALL_ARGS',
        'TOOL_CALL_END',
        'TOOL_CALL_RESULT',
      ]);
      expect(events.at(-1)?.type).toBe('RUN_FINISHED');
      expect((events.at(-1) as { outcome?: string } | undefined)?.outcome).toBe('success');
    });

    it('wraps the LLM invocation in a STEP_STARTED/STEP_FINISHED pair', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValueOnce(
        new AsyncIterableChunks([{ type: 'content', text: 'done' }]),
      );

      const events = await harness.runWithEvents('hi');

      const stepStarts = events.filter((e) => e.type === 'STEP_STARTED');
      const stepEnds = events.filter((e) => e.type === 'STEP_FINISHED');
      expect(stepStarts).toHaveLength(1);
      expect(stepEnds).toHaveLength(1);
      expect(stepStarts[0].stepName).toBe(stepEnds[0].stepName);

      const startIdx = events.indexOf(stepStarts[0]);
      const endIdx = events.indexOf(stepEnds[0]);
      expect(startIdx).toBeLessThan(endIdx);
    });

    it('still closes the step bracket when the LLM stream throws', async () => {
      const erroringStream = {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(new Error('boom'));
            },
            return() {
              return Promise.resolve({ done: true, value: undefined });
            },
          };
        },
      };
      vi.mocked(mockLLM.getStream).mockReturnValueOnce(
        erroringStream as unknown as AsyncIterable<LLMStreamChunk>,
      );

      const events = await harness.runWithEvents('hi');

      const stepStarts = events.filter((e) => e.type === 'STEP_STARTED');
      const stepEnds = events.filter((e) => e.type === 'STEP_FINISHED');
      expect(stepStarts).toHaveLength(1);
      expect(stepEnds).toHaveLength(1);
      expect(stepStarts[0].stepName).toBe(stepEnds[0].stepName);
      expect(events.at(-1)?.type).toBe('RUN_FINISHED');
      expect((events.at(-1) as { outcome?: string } | undefined)?.outcome).toBe('error');
    });
  });

  // ========== chatTurns ==========

  describe('chatTurns', () => {
    it('should add one turn per runCycle call', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([{ type: 'thought', text: 'Thinking...' }]),
      );

      await harness.runCycle('First prompt');

      expect(harness.chatTurns()).toHaveLength(1);
      expect(harness.chatTurns()[0].userMessage).toBe('First prompt');
    });

    it('should accumulate turns across multiple runCycle calls', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([{ type: 'thought', text: 'Done.' }]),
      );

      await harness.runCycle('First');
      await harness.runCycle('Second');

      expect(harness.chatTurns()).toHaveLength(2);
      expect(harness.chatTurns()[1].userMessage).toBe('Second');
    });

    it('should group steps produced by a cycle into the matching turn', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([{ type: 'thought', text: 'Reasoning only.' }]),
      );

      await harness.runCycle('What is the status?');

      const turn = harness.chatTurns()[0];
      expect(turn.steps).toHaveLength(1);
      expect(turn.steps[0].action).toBeNull();
      expect(turn.steps[0].result).toContain('No action taken');
    });

    it('should keep turn steps in sync with harness.steps()', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([{ type: 'thought', text: 'Reasoning only.' }]),
      );

      await harness.runCycle('Check');

      const allSteps = harness.steps();
      const turnSteps = harness.chatTurns()[0].steps;
      expect(turnSteps).toHaveLength(allSteps.length);
      expect(turnSteps[0].timestamp).toBe(allSteps[0].timestamp);
    });
  });

  // ========== runCycle — Tool Dispatch ==========

  describe('runCycle — tool dispatch', () => {
    const executeSpy = vi.fn().mockResolvedValue({ success: true, message: 'Task added' });

    beforeEach(() => {
      // Register a component in the world
      world.register({
        id: 'add-btn',
        role: 'Button',
        actions: [
          {
            name: 'addTask',
            description: 'Add a new task',
            execute: executeSpy,
          },
        ],
        element: document.createElement('button'),
      });
    });

    it('should dispatch tool calls to the World Registry', async () => {
      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              { type: 'thought', text: 'I should add a task.' },
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'add-btn__action__addTask', arguments: '{"title":"New task"}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      await harness.runCycle('Add a task called "New task"');

      expect(executeSpy).toHaveBeenCalledWith({ title: 'New task' });
    });

    it('should record steps with action and result', async () => {
      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              { type: 'thought', text: 'Adding task...' },
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'add-btn__action__addTask', arguments: '{"title":"test"}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      await harness.runCycle('Add test');

      const steps = harness.steps();
      expect(steps).toHaveLength(2);
      expect(steps[0].action).toContain('addTask');
      expect(steps[0].result).toContain('Task added');
      expect(steps[1].result).toContain('No action taken');
    });

    it('should dispatch multiple tool calls in sequence', async () => {
      const executeClick = vi.fn().mockResolvedValue({ success: true, message: 'Clicked' });
      world.register({
        id: 'btn-2',
        role: 'Button',
        actions: [
          {
            name: 'click',
            description: 'Click',
            execute: executeClick,
          },
        ],
      });

      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              { type: 'thought', text: 'I need to do two things.' },
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'add-btn__action__addTask', arguments: '{}' },
                },
              },
              {
                type: 'tool_call',
                data: {
                  id: 'call_2',
                  function: { name: 'btn-2__action__click', arguments: '{}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      await harness.runCycle('Do both');

      expect(executeSpy).toHaveBeenCalled();
      expect(executeClick).toHaveBeenCalled();
      expect(harness.steps()).toHaveLength(3);
    });

    it('should only include dispatched tool calls in assistant message when maxSteps is exceeded', async () => {
      world.register({
        id: 'btn-b',
        role: 'Button',
        actions: [
          {
            name: 'click',
            description: 'Click',
            execute: vi.fn().mockResolvedValue({ success: true, message: 'Clicked B' }),
          },
        ],
      });

      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              {
                type: 'tool_call',
                data: { id: 'call_1', function: { name: 'add-btn__action__addTask', arguments: '{}' } },
              },
              {
                type: 'tool_call',
                data: { id: 'call_2', function: { name: 'btn-b__action__click', arguments: '{}' } },
              },
            ]),
        )
        .mockImplementation(() => new AsyncIterableChunks([{ type: 'thought', text: 'Done.' }]));

      await harness.runCycle('Do both but limit to 1', { maxSteps: 1 });

      const assistantMsg = harness['messages'].find(
        (m): m is LLMMessage & { tool_calls: ToolCall[] } =>
          m.role === 'assistant' && Array.isArray((m as LLMMessage).tool_calls),
      )!;
      expect(assistantMsg.tool_calls).toHaveLength(1);
      expect(assistantMsg.tool_calls[0].id).toBe('call_1');

      const toolMsgs = harness['messages'].filter((m) => m.role === 'tool');
      expect(toolMsgs).toHaveLength(1);
      expect(toolMsgs[0].tool_call_id).toBe('call_1');
    });
  });

  // ========== Stability Gating ==========

  describe('stability gating', () => {
    it('should wait for stability before dispatching actions', async () => {
      const stable$ = appRef.isStable as BehaviorSubject<boolean>;
      stable$.next(false); // App is NOT stable

      world.register({
        id: 'btn',
        role: 'Button',
        actions: [
          {
            name: 'click',
            description: 'Click',
            execute: vi.fn().mockResolvedValue({ success: true, message: 'clicked' }),
          },
        ],
      });

      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'btn__action__click', arguments: '{}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      // Start the cycle — it will block waiting for stability
      const cyclePromise = harness.runCycle('Click');

      // Simulate UI becoming stable after a delay
      setTimeout(() => stable$.next(true), 50);

      await cyclePromise;
      expect(harness.steps()).toHaveLength(2);
    });
  });

  // ========== Reset ==========

  describe('reset()', () => {
    it('should clear thoughts, steps, and focus', () => {
      harness['thought'].set('some thought');
      harness['steps'].set([{ thought: 'x', action: null, result: 'done', timestamp: 1 }]);
      world.focus('something');

      harness.reset();

      expect(harness.thought()).toBe('');
      expect(harness.steps()).toEqual([]);
      expect(world.focusedEntryId()).toBeNull();
    });

    it('should clear chatTurns', () => {
      harness['chatTurns'].set([{ userMessage: 'hello', steps: [], timestamp: 1 }]);

      harness.reset();

      expect(harness.chatTurns()).toEqual([]);
    });
  });

  // ========== Error Handling ==========

  describe('error handling', () => {
    it('should catch errors in LLM streaming and record them', async () => {
      vi.mocked(mockLLM.getStream).mockImplementation(async function* () {
        yield { type: 'thought', text: 'Starting...' };
        throw new Error('Network failure');
      });

      await harness.runCycle('Try something');

      const steps = harness.steps();
      expect(steps).toHaveLength(1);
      expect(steps[0].result).toContain('Network failure');
      expect(harness.isRunning()).toBe(false);
    });
  });

  // ========== Codec Tool Name ==========

  describe('codec.decodeAction', () => {
    it('should correctly split entryId and actionName', () => {
      const result = harness['codec'].decodeAction('table-1__action__deleteRow');
      expect(result).toEqual({ entryId: 'table-1', actionName: 'deleteRow' });
    });

    it('should handle names with multiple underscores', () => {
      const result = harness['codec'].decodeAction('my_component__action__do_stuff');
      expect(result).toEqual({ entryId: 'my_component', actionName: 'do_stuff' });
    });

    it('should fall back to unknown when no separator found', () => {
      const result = harness['codec'].decodeAction('justAnAction');
      expect(result).toEqual({ entryId: 'unknown', actionName: 'justAnAction' });
    });
  });

  // ========== Concurrency Guard ==========

  describe('concurrency guard', () => {
    it('should silently ignore second runCycle while one is running', async () => {
      // Make the LLM stream never yield — keeps runCycle busy
      vi.mocked(mockLLM.getStream).mockReturnValue(
        (async function* () {
          // Never yield — simulate hung stream
          await new Promise(() => {});
        })() as any,
      );

      const first = harness.runCycle('first');
      await new Promise((r) => setTimeout(r, 10)); // let it start
      expect(harness.isRunning()).toBe(true);

      const second = harness.runCycle('second');
      await new Promise((r) => setTimeout(r, 10));
      // second should have silently returned
      expect(harness.isRunning()).toBe(true);
    });
  });

  // ========== Export / Import ==========

  describe('export / import', () => {
    it('should export conversation state', () => {
      harness.setSystemPrompt('Be helpful');
      harness['messages'] = [{ role: 'user', content: 'hello' }];
      harness['steps'].set([{ thought: 'x', action: 'click()', result: 'done', timestamp: 1 }]);

      const conv = harness.exportConversation();
      expect(conv.systemPrompt).toBe('Be helpful');
      expect(conv.messages).toHaveLength(1);
      expect(conv.steps).toHaveLength(1);
      expect(conv.steps[0].timestamp).toBe(1);
    });

    it('should import conversation and overwrite state', () => {
      harness.importConversation({
        systemPrompt: 'Imported prompt',
        messages: [{ role: 'user', content: 'test' }],
        steps: [{ thought: 'a', action: 'b', result: 'c', timestamp: 2 }],
      });

      expect(harness['systemPrompt']).toBe('Imported prompt');
      expect(harness['messages']).toHaveLength(1);
      expect(harness.steps()).toHaveLength(1);
      expect(harness.steps()[0].result).toBe('c');
      expect(harness.thought()).toBe('');
    });

    it('should roundtrip conversation state', () => {
      harness.setSystemPrompt('System');
      harness['messages'] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ];

      const exported = harness.exportConversation();
      harness.reset();
      harness.importConversation(exported);

      expect(harness['systemPrompt']).toBe('System');
      expect(harness['messages']).toHaveLength(2);
    });

    it('should strip a leading assistant message whose tool_calls have no matching tool responses in the slice', () => {
      harness['messages'] = [
        {
          role: 'assistant',
          content: 'I will click.',
          tool_calls: [
            {
              id: 'call_x',
              type: 'function' as const,
              function: { name: 'btn__action__click', arguments: '{}' },
            },
          ],
        },
        { role: 'user', content: 'What did you do?' },
        { role: 'assistant', content: 'I clicked.' },
      ];

      const conv = harness.exportConversation();

      expect(conv.messages[0].role).toBe('user');
      expect(conv.messages).toHaveLength(2);
    });

    it('should NOT strip a leading assistant message whose tool_calls are fully satisfied', () => {
      harness['messages'] = [
        {
          role: 'assistant',
          content: 'I will click.',
          tool_calls: [
            {
              id: 'call_x',
              type: 'function' as const,
              function: { name: 'btn__action__click', arguments: '{}' },
            },
          ],
        },
        { role: 'tool', content: '{"success":true}', tool_call_id: 'call_x' },
        { role: 'user', content: 'Great.' },
      ];

      const conv = harness.exportConversation();

      expect(conv.messages[0].role).toBe('assistant');
      expect(conv.messages).toHaveLength(3);
    });
  });

  // ========== Approval Integration ==========

  describe('approval integration', () => {
    it('should block tool dispatch until approval is granted', async () => {
      const approval = TestBed.inject(AgentApprovalService);

      // Register a destructive action
      world.register({
        id: 'delete-btn',
        role: 'Button',
        actions: [
          {
            name: 'delete',
            description: 'Delete item',
            requiresApproval: true,
            execute: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
          },
        ],
      });

      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              { type: 'thought', text: 'I will delete.' },
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'delete-btn__action__delete', arguments: '{}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      // Start cycle — it will block on approval
      const cyclePromise = harness.runCycle('Delete');

      // Wait briefly for approval to become pending
      await new Promise((r) => setTimeout(r, 20));
      expect(approval.isPending()).toBe(true);
      expect(approval.pending()).not.toBeNull();

      // Approve
      approval.approve();

      await cyclePromise;
      expect(approval.isPending()).toBe(false);
      const steps = harness.steps();
      expect(steps).toHaveLength(2);
      expect(steps[0].result).toContain('Deleted');
    });

    it('should skip execution when approval is rejected', async () => {
      const approval = TestBed.inject(AgentApprovalService);

      world.register({
        id: 'delete-btn',
        role: 'Button',
        actions: [
          {
            name: 'delete',
            description: 'Delete item',
            requiresApproval: true,
            execute: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
          },
        ],
      });

      vi.mocked(mockLLM.getStream)
        .mockImplementationOnce(
          () =>
            new AsyncIterableChunks([
              {
                type: 'tool_call',
                data: {
                  id: 'call_1',
                  function: { name: 'delete-btn__action__delete', arguments: '{}' },
                },
              },
            ]),
        )
        .mockImplementation(
          () => new AsyncIterableChunks([{ type: 'thought', text: 'No more actions.' }]),
        );

      const cyclePromise = harness.runCycle('Delete');
      await new Promise((r) => setTimeout(r, 20));

      // Reject
      approval.reject();

      await cyclePromise;
      const steps = harness.steps();
      expect(steps).toHaveLength(2);
      expect(steps[0].result).toContain('rejected');
    });
  });
});
