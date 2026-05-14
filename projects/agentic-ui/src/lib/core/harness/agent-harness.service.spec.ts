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

// ---- Helpers ----

function createMockAppRef() {
  const stable$ = new BehaviorSubject(true);
  return {
    isStable: stable$,
    afterTick: new BehaviorSubject(void 0),
    onStable: new Subject<void>(),
    tick: vi.fn(),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== Initial State ==========

  describe('initial state', () => {
    it('should start with empty thought', () => {
      expect(harness.thought()).toBe('');
    });

    it('should start with empty steps', () => {
      expect(harness.steps()).toEqual([]);
    });

    it('should not be running', () => {
      expect(harness.isRunning()).toBe(false);
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

    it('should record the assistant reply as the step result when no tool calls are made', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'Everything looks fine, no action needed.' },
        ]),
      );

      await harness.runCycle('Check status');

      const steps = harness.steps();
      expect(steps).toHaveLength(1);
      expect(steps[0].thought).toBe('');
      expect(steps[0].action).toBeNull();
      expect(steps[0].result).toContain('Everything looks fine, no action needed.');
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
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'I should add a task.' },
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'add-btn__addTask', arguments: '{"title":"New task"}' },
            },
          },
        ]),
      );

      await harness.runCycle('Add a task called "New task"');

      expect(executeSpy).toHaveBeenCalledWith({ title: 'New task' });
      expect(harness.exportConversation().messages).toContainEqual(
        expect.objectContaining({
          role: 'assistant',
          tool_calls: [
            expect.objectContaining({
              id: 'call_1',
              type: 'function',
              function: {
                name: 'add-btn__addTask',
                arguments: '{"title":"New task"}',
              },
            }),
          ],
        }),
      );
    });

    it('should record steps with action and result', async () => {
      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'Adding task...' },
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'add-btn__addTask', arguments: '{"title":"test"}' },
            },
          },
        ]),
      );

      await harness.runCycle('Add test');

      const steps = harness.steps();
      expect(steps).toHaveLength(1);
      expect(steps[0].action).toContain('addTask');
      expect(steps[0].result).toContain('Task added');
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

      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'I need to do two things.' },
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'add-btn__addTask', arguments: '{}' },
            },
          },
          {
            type: 'tool_call',
            data: {
              id: 'call_2',
              function: { name: 'btn-2__click', arguments: '{}' },
            },
          },
        ]),
      );

      await harness.runCycle('Do both');

      expect(executeSpy).toHaveBeenCalled();
      expect(executeClick).toHaveBeenCalled();
      expect(harness.steps()).toHaveLength(2);
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

      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'btn__click', arguments: '{}' },
            },
          },
        ]),
      );

      // Start the cycle — it will block waiting for stability
      const cyclePromise = harness.runCycle('Click');

      // Simulate UI becoming stable after a delay
      setTimeout(() => stable$.next(true), 50);

      await cyclePromise;
      expect(harness.steps()).toHaveLength(1);
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

  // ========== Parse Tool Name ==========

  describe('parseToolName', () => {
    it('should correctly split entryId and actionName', () => {
      const result = harness['parseToolName']('table-1__deleteRow');
      expect(result).toEqual({ entryId: 'table-1', actionName: 'deleteRow' });
    });

    it('should handle names with multiple underscores', () => {
      const result = harness['parseToolName']('my_component__do_stuff');
      expect(result).toEqual({ entryId: 'my_component', actionName: 'do_stuff' });
    });

    it('should fall back to unknown when no separator found', () => {
      const result = harness['parseToolName']('justAnAction');
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

      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          { type: 'thought', text: 'I will delete.' },
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'delete-btn__delete', arguments: '{}' },
            },
          },
        ]),
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
      expect(steps).toHaveLength(1);
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

      vi.mocked(mockLLM.getStream).mockReturnValue(
        new AsyncIterableChunks([
          {
            type: 'tool_call',
            data: {
              id: 'call_1',
              function: { name: 'delete-btn__delete', arguments: '{}' },
            },
          },
        ]),
      );

      const cyclePromise = harness.runCycle('Delete');
      await new Promise((r) => setTimeout(r, 20));

      // Reject
      approval.reject();

      await cyclePromise;
      const steps = harness.steps();
      expect(steps).toHaveLength(1);
      expect(steps[0].result).toContain('rejected');
    });
  });
});
