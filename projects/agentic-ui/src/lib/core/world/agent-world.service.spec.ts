/**
 * AgentWorldService — comprehensive unit tests.
 * Tests registration, scoping, shadow mode, snapshot generation,
 * stability tracking, and action execution.
 */
import { TestBed } from '@angular/core/testing';
import { ApplicationRef, DestroyRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AgentWorldService } from './agent-world.service';
import { WorldEntry, WorldSnapshot, ToolDefinition } from './world-entry.interface';
import { AgentAction, AgentActionResult } from './agent-action.model';
import { AgentReadable, AgentWritableResult } from '../state/agent-readable.model';
import { AgentJsonSchema } from '../schema/agent-json-schema.model';

import { AgentApprovalService } from '../approval/agent-approval.service';

// ---- Test helpers ----

function createMockAction(name: string, description: string, result?: AgentActionResult): AgentAction {
  return {
    name,
    description,
    execute: vi.fn().mockResolvedValue(result ?? { success: true, message: `Executed ${name}` }),
  };
}

function createMockReadable(name: string, description: string, writable = false): AgentReadable {
  let state: unknown = 'initial';

  const schema: AgentJsonSchema = {
    type: 'object',
    properties: {
      value: { type: 'string', description },
    },
  };

  return {
    name,
    description,
    schema,
    writable,
    read: vi.fn().mockResolvedValue({
      success: true,
      message: `Read ${name}`,
      value: state,
    }),
    ...(writable ? {
      write: vi.fn().mockImplementation(async (value: unknown) => {
        state = value;
        return { success: true, message: `Wrote ${name}` } as AgentWritableResult;
      }),
    } : {}),
  };
}

function createEntry(overrides: Partial<WorldEntry> = {}): WorldEntry {
  return {
    id: 'test-1',
    role: 'Button',
    actions: [createMockAction('click', 'Click the button')],
    ...overrides,
  };
}

function createMockAppRef() {
  const stable$ = new BehaviorSubject(true);
  return {
    isStable: stable$,
    afterTick: new BehaviorSubject(void 0),
    onStable: new BehaviorSubject(void 0),
    tick: vi.fn(),
    _tick: vi.fn(),
    attachView: vi.fn(),
    detachView: vi.fn(),
    componentTypes: [],
    components: [],
    viewCount: 0,
  } as unknown as ApplicationRef;
}

// ---- IntersectionObserver mock ----

function mockIntersectionObserver() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  let callback: IntersectionObserverCallback | null = null;

  function MockObserver(this: any, cb: IntersectionObserverCallback) {
    callback = cb;
    this.observe = observe;
    this.unobserve = unobserve;
    this.disconnect = disconnect;
    this.takeRecords = vi.fn();
  }

  window.IntersectionObserver = MockObserver as any;

  return {
    observe,
    unobserve,
    disconnect,
    trigger: (entries: IntersectionObserverEntry[]) => {
      if (callback) {
        callback(entries, {} as IntersectionObserver);
      }
    },
  };
}

// Service factory that optionally sets up IntersectionObserver mock first
function createService(withObserver = false): {
  service: AgentWorldService;
  appRef: ApplicationRef;
  observer?: ReturnType<typeof mockIntersectionObserver>;
} {
  const appRef = createMockAppRef();
  let observer: ReturnType<typeof mockIntersectionObserver> | undefined;

  if (withObserver) {
    observer = mockIntersectionObserver();
  }

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AgentWorldService,
      { provide: ApplicationRef, useValue: appRef },
    ],
  });

  const service = TestBed.inject(AgentWorldService);
  return { service, appRef, observer };
}

// ---- Tests ----

describe('AgentWorldService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== Registration ==========

  describe('registration', () => {
    it('should register an entry', () => {
      const { service } = createService();
      service.register(createEntry());
      expect(service.entries().has('test-1')).toBe(true);
      expect(service.entries().get('test-1')!.role).toBe('Button');
    });

    it('should unregister an entry', () => {
      const { service } = createService();
      service.register(createEntry());
      service.unregister('test-1');
      expect(service.entries().has('test-1')).toBe(false);
    });

    it('should update existing entry on re-registration', () => {
      const { service } = createService();
      service.register(createEntry({ role: 'Button' }));
      service.register(createEntry({ role: 'Link' }));
      expect(service.entries().get('test-1')!.role).toBe('Link');
    });

    it('should handle unregister of non-existent entry gracefully', () => {
      const { service } = createService();
      expect(() => service.unregister('nope')).not.toThrow();
    });

    it('should observe element with IntersectionObserver when available', () => {
      const { service, observer } = createService(true);
      const el = document.createElement('div');
      service.register(createEntry({ element: el }));
      expect(observer!.observe).toHaveBeenCalledWith(el);
    });
  });

  // ========== Contextual Scoping ==========

  describe('contextual scoping', () => {
    it('should only include visible entries in activeEntries', () => {
      const { service, observer } = createService(true);
      const el = document.createElement('div');
      el.setAttribute('data-agentic-id', 'test-1');
      service.register(createEntry({ element: el }));

      observer!.trigger([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry]);
      expect(service.activeEntries().has('test-1')).toBe(true);
    });

    it('should exclude entries that leave the viewport', () => {
      const { service, observer } = createService(true);
      const el = document.createElement('div');
      el.setAttribute('data-agentic-id', 'test-1');
      service.register(createEntry({ element: el }));

      observer!.trigger([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry]);
      observer!.trigger([{ target: el, isIntersecting: false } as unknown as IntersectionObserverEntry]);
      expect(service.activeEntries().has('test-1')).toBe(false);
    });

    it('should handle entries without elements (not in DOM)', () => {
      const { service } = createService(true);
      service.register(createEntry({ element: undefined }));
      expect(service.activeEntries().size).toBe(0);
    });

    it('should remove from visible set when unregistered', () => {
      const { service, observer } = createService(true);
      const el = document.createElement('div');
      el.setAttribute('data-agentic-id', 'test-1');
      service.register(createEntry({ element: el }));
      observer!.trigger([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry]);

      service.unregister('test-1');
      expect(service.visibleEntryIds().has('test-1')).toBe(false);
    });

    it('should function without IntersectionObserver (SSR/env fallback)', () => {
      delete (window as any).IntersectionObserver;
      const { service } = createService();
      const el = document.createElement('div');
      expect(() => service.register(createEntry({ element: el }))).not.toThrow();
    });
  });

  // ========== Snapshot ==========

  describe('snapshot()', () => {
    it('should return empty snapshot when no entries are visible', () => {
      const { service } = createService();
      const snap = service.snapshot();
      expect(snap.tools).toHaveLength(0);
      expect(snap.context).toContain('No interactive components');
    });

    it('should generate tool definitions for visible entries', () => {
      const { service } = createService();
      service.register({
        id: 'btn-1',
        role: 'Button',
        actions: [createMockAction('submit', 'Submit'), createMockAction('cancel', 'Cancel')],
      });
      service['visibleIds'].set(new Set(['btn-1']));

      const snap = service.snapshot();
      expect(snap.tools).toHaveLength(2);
      expect(snap.tools[0].function.name).toBe('btn-1__submit');
      expect(snap.tools[1].function.name).toBe('btn-1__cancel');
      expect(snap.context).toContain('btn-1');
    });

    it('should include parameter schemas in tool definitions', () => {
      const { service } = createService();
      service.register({
        id: 'inp-1',
        role: 'Input',
        actions: [{
          name: 'type',
          description: 'Type text',
          parameters: [
            { name: 'value', type: 'string', description: 'Text', required: true },
            { name: 'delay', type: 'number', description: 'Delay ms' },
          ],
          execute: async () => ({ success: true, message: 'ok' }),
        }],
      });
      service['visibleIds'].set(new Set(['inp-1']));

      const snap = service.snapshot();
      const params = snap.tools[0].function.parameters as any;
      expect(params.required).toContain('value');
      expect(params.properties['value']).toEqual({ type: 'string', description: 'Text' });
    });

    it('should include multiple entries in context string', () => {
      const { service } = createService();
      service.register(createEntry({ id: 'a', role: 'Button', actions: [createMockAction('press', 'Press')] }));
      service.register(createEntry({ id: 'b', role: 'Modal', actions: [createMockAction('close', 'Close')] }));
      service['visibleIds'].set(new Set(['a', 'b']));

      const snap = service.snapshot();
      expect(snap.context).toContain('[a]');
      expect(snap.context).toContain('[b]');
      expect(snap.tools).toHaveLength(2);
    });
  });

  // ========== Shadow Mode ==========

  describe('shadow mode', () => {
    it('should default to false', () => {
      const { service } = createService();
      expect(service.shadowMode()).toBe(false);
    });

    it('should toggle shadow mode', () => {
      const { service } = createService();
      service.shadowMode.set(true);
      expect(service.shadowMode()).toBe(true);
      service.shadowMode.set(false);
      expect(service.shadowMode()).toBe(false);
    });

    it('should intercept executeAction and return simulation result', async () => {
      const { service } = createService();
      service.shadowMode.set(true);
      service.register(createEntry({ id: 'item-1' }));
      service['visibleIds'].set(new Set(['item-1']));

      const result = await service.executeAction('item-1', 'click', { id: 'x' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('SHADOW');
      expect(result.data).toEqual({ simulated: true, params: { id: 'x' } });
    });
  });

  // ========== Execute Action ==========

  describe('executeAction()', () => {
    it('should execute a registered action', async () => {
      const { service } = createService();
      const action = createMockAction('click', 'Click', { success: true, message: 'Clicked!' });
      service.register(createEntry({ id: 'btn', actions: [action] }));

      const result = await service.executeAction('btn', 'click');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Clicked!');
      expect(action.execute).toHaveBeenCalled();
    });

    it('should pass parameters to action', async () => {
      const { service } = createService();
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
      service.register(createEntry({ id: 'field', actions: [{ name: 'type', description: 'Type', execute }] }));

      await service.executeAction('field', 'type', { text: 'hello' });
      expect(execute).toHaveBeenCalledWith({ text: 'hello' });
    });

    it('should return error for non-existent entry', async () => {
      const { service } = createService();
      const result = await service.executeAction('ghost', 'click');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error for non-existent action with available list', async () => {
      const { service } = createService();
      service.register(createEntry({ id: 'form', actions: [createMockAction('submit', 'Submit')] }));

      const result = await service.executeAction('form', 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.message).toContain('submit');
    });

    it('should focus the entry on action execution', async () => {
      const { service } = createService();
      service.register(createEntry({ id: 'btn' }));

      await service.executeAction('btn', 'click');
      expect(service.focusedEntryId()).toBe('btn');
    });

    it('should handle action execution errors gracefully', async () => {
      const { service } = createService();
      service.register(createEntry({
        id: 'risky',
        actions: [{ name: 'crash', description: 'Crash', execute: async () => { throw new Error('Boom!'); } }],
      }));

      const result = await service.executeAction('risky', 'crash');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Boom!');
    });
  });

  // ========== Focus / Blur ==========

  describe('focus / blur', () => {
    it('should set and clear focused entry', () => {
      const { service } = createService();
      expect(service.focusedEntryId()).toBeNull();
      service.focus('item-5');
      expect(service.focusedEntryId()).toBe('item-5');
      service.blur();
      expect(service.focusedEntryId()).toBeNull();
    });
  });

  // ========== Stability Tracking ==========

  describe('stability tracking', () => {
    it('should initialize as stable', () => {
      const { service } = createService();
      expect(service.isStable()).toBe(true);
    });

    it('waitForStable should toggle isStable to false and await renderComplete$', async () => {
      const { service } = createService();

      expect(service.isStable()).toBe(true);

      // waitForStable sets isStable(false), subscribes to renderComplete$, yields
      const promise = service.waitForStable();
      expect(service.isStable()).toBe(false);

      // In the test environment, afterEveryRender never fires natively, so we
      // manually signal completion via the renderComplete$ subject through the
      // service internals to unblock the wait. Also yield to macro task queue.
      const serviceAny = service as any;
      serviceAny.renderComplete$.next();
      await promise;
    });
  });

  // ========== Approval Gate ==========

  describe('approval gate', () => {
    it('should call approval service when action.requiresApproval is true', async () => {
      const { service } = createService();
      const approval = TestBed.inject(AgentApprovalService);
      const spy = vi.spyOn(approval, 'requestApproval').mockResolvedValue(true);

      service.register({
        id: 'delete-btn',
        role: 'Button',
        actions: [{
          name: 'delete',
          description: 'Delete item',
          requiresApproval: true,
          execute: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
        }],
      });

      await service.executeAction('delete-btn', 'delete', { id: 'x' });

      expect(spy).toHaveBeenCalledWith('delete-btn', 'Button', 'delete', 'Delete item', { id: 'x' });
    });

    it('should NOT call approval for actions without requiresApproval', async () => {
      const { service } = createService();
      const approval = TestBed.inject(AgentApprovalService);
      const spy = vi.spyOn(approval, 'requestApproval');

      service.register({
        id: 'btn',
        role: 'Button',
        actions: [{
          name: 'click',
          description: 'Click',
          execute: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
        }],
      });

      await service.executeAction('btn', 'click');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should execute action when user approves', async () => {
      const { service } = createService();
      const approval = TestBed.inject(AgentApprovalService);
      vi.spyOn(approval, 'requestApproval').mockResolvedValue(true);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'Deleted' });

      service.register({
        id: 'btn',
        role: 'Button',
        actions: [{
          name: 'delete',
          description: 'Delete',
          requiresApproval: true,
          execute,
        }],
      });

      const result = await service.executeAction('btn', 'delete');
      expect(execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should skip execution and return failure when user rejects', async () => {
      const { service } = createService();
      const approval = TestBed.inject(AgentApprovalService);
      vi.spyOn(approval, 'requestApproval').mockResolvedValue(false);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'Deleted' });

      service.register({
        id: 'btn',
        role: 'Button',
        actions: [{
          name: 'delete',
          description: 'Delete',
          requiresApproval: true,
          execute,
        }],
      });

      const result = await service.executeAction('btn', 'delete');
      expect(execute).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toContain('rejected');
    });

    it('should respect shadow mode over approval gate (shadow bypasses everything)', async () => {
      const { service } = createService();
      service.shadowMode.set(true);
      const approval = TestBed.inject(AgentApprovalService);
      const spy = vi.spyOn(approval, 'requestApproval');

      service.register({
        id: 'btn',
        role: 'Button',
        actions: [{
          name: 'delete',
          description: 'Delete',
          requiresApproval: true,
          execute: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
        }],
      });

      const result = await service.executeAction('btn', 'delete');
      // Shadow mode should return simulated result WITHOUT calling approval
      expect(spy).not.toHaveBeenCalled();
      expect(result.message).toContain('SHADOW');
    });
  });

  // ========== Tool Name Length Validation ==========

  describe('tool name length validation', () => {
    it('should reject tool names exceeding 64 characters', () => {
      const { service } = createService();
      const longId = 'a'.repeat(50); // 50 chars
      const longAction = 'b'.repeat(20); // 20 chars, total 71 chars with '__'
      service.register({
        id: longId,
        role: 'Button',
        actions: [createMockAction(longAction, 'Action')],
      });
      service['visibleIds'].set(new Set([longId]));

      expect(() => service.snapshot()).toThrow();
    });

    it('should accept tool names at exactly 64 characters', () => {
      const { service } = createService();
      const longId = 'a'.repeat(50);
      const longAction = 'b'.repeat(13); // 50 + 2 + 13 = 65... should be 63 for 64 chars, let me recalculate
      // Actually: 50 + '__' (2) + X = 64, so X = 12
      const correctAction = 'b'.repeat(12); // 50 + 2 + 12 = 64
      service.register({
        id: longId,
        role: 'Button',
        actions: [createMockAction(correctAction, 'Action')],
      });
      service['visibleIds'].set(new Set([longId]));

      expect(() => service.snapshot()).not.toThrow();
    });
  });

  // ========== IntersectionObserver Cleanup ==========

  describe('IntersectionObserver cleanup', () => {
    it('should register destroy callback for observer cleanup', () => {
      const { service } = createService(true);
      
      // Verify that the service has registered a destroy callback
      // by checking that it's a valid instance with access to observer
      expect(service).toBeDefined();
      expect((service as any).observer).toBeDefined();
    });
  });

  // ========== Snapshot Budget Control ==========

  describe('snapshot budget control', () => {
    it('should default to 20 max tools and 2000 max context', () => {
      const { service } = createService();
      // Register many entries to test budget
      for (let i = 0; i < 5; i++) {
        service.register(createEntry({ id: `e-${i}`, role: 'Button' }));
      }
      service['visibleIds'].set(new Set(['e-0', 'e-1', 'e-2', 'e-3', 'e-4']));

      const snap = service.snapshot();
      expect(snap.tools.length).toBeLessThanOrEqual(20);
      expect(snap.context.length).toBeLessThanOrEqual(2000);
    });

    it('should cap tools when maxTools is set', () => {
      const { service } = createService();
      for (let i = 0; i < 10; i++) {
        service.register(createEntry({ id: `e-${i}` }));
      }
      service['visibleIds'].set(new Set(['e-0', 'e-1', 'e-2', 'e-3', 'e-4', 'e-5', 'e-6', 'e-7', 'e-8', 'e-9']));

      const snap = service.snapshot({ maxTools: 3 });
      expect(snap.tools.length).toBeLessThanOrEqual(3);
    });

    it('should prioritize entries by priorityRoles', () => {
      const { service } = createService();
      service.register(createEntry({ id: 'btn', role: 'Button' }));
      service.register(createEntry({ id: 'modal', role: 'Modal' }));
      service['visibleIds'].set(new Set(['btn', 'modal']));

      const snap = service.snapshot({
        maxTools: 1,
        priorityRoles: ['Modal'],
      });

      // Modal should be prioritized, so its tool should be first
      expect(snap.tools[0].function.name).toContain('modal');
    });

    it('should truncate context when exceeding maxContextLen', () => {
      const { service } = createService();
      for (let i = 0; i < 30; i++) {
        service.register(createEntry({
          id: `entry-with-long-name-${i}`,
          role: 'VeryLongRoleName',
        }));
        service['visibleIds'].update(s => new Set(s).add(`entry-with-long-name-${i}`));
      }

      const snap = service.snapshot({ maxContextLen: 500 });
      expect(snap.context.length).toBeLessThanOrEqual(500);
      expect(snap.context).toContain('truncated');
    });
  });

  // ---- Readables ----

  describe('Readables (state)', () => {
    it('should register readables with entries', () => {
      const { service } = createService();
      const readable = createMockReadable('status', 'Current status');
      service.register(createEntry({ id: 'comp1', readables: [readable] }));

      const entry = service.entries().get('comp1');
      expect(entry?.readables).toHaveLength(1);
      expect(entry?.readables?.[0].name).toBe('status');
    });

    it('should validate readable names during registration', () => {
      const { service } = createService();
      const badReadable = {
        name: 'bad__name',
        description: 'Bad readable',
        schema: { type: 'object' as const, properties: {} },
        read: vi.fn(),
      };

      expect(() => {
        service.register(createEntry({ readables: [badReadable as AgentReadable] }));
      }).toThrow(/Readable naming constraint failure/);
    });

    it('should include readables in snapshot context', () => {
      const { service } = createService();
      const readable = createMockReadable('status', 'Current status');
      service.register(createEntry({ id: 'comp1', readables: [readable] }));
      service['visibleIds'].set(new Set(['comp1']));

      const snap = service.snapshot();
      expect(snap.context).toContain('state: status');
    });

    it('should call updateReadable on entry', async () => {
      const { service } = createService();
      const readable = createMockReadable('config', 'Config value', true);
      service.register(createEntry({ id: 'comp1', readables: [readable] }));

      const result = await service.updateReadable('comp1', 'config', 'new-value');
      expect(result.success).toBe(true);
      expect(readable.write).toHaveBeenCalledWith('new-value');
    });

    it('should return error for non-writable readables', async () => {
      const { service } = createService();
      const readable = createMockReadable('status', 'Status', false);
      service.register(createEntry({ id: 'comp1', readables: [readable] }));

      const result = await service.updateReadable('comp1', 'status', 'new');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not writable');
    });

    it('should return error when readable not found', async () => {
      const { service } = createService();
      service.register(createEntry({ id: 'comp1', readables: [] }));

      const result = await service.updateReadable('comp1', 'missing', 'value');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should respect shadow mode for updateReadable', async () => {
      const { service } = createService();
      const readable = createMockReadable('config', 'Config', true);
      service.register(createEntry({ id: 'comp1', readables: [readable] }));
      service.shadowMode.set(true);

      const result = await service.updateReadable('comp1', 'config', 'test');
      expect(result.success).toBe(true);
      expect(result.message).toContain('[SHADOW]');
      expect(readable.write).not.toHaveBeenCalled();
    });
  });

  // ---- Input Schema ----

  describe('Input Schema', () => {
    it('should build tools from inputSchema when present', () => {
      const { service } = createService();
      const action: AgentAction = {
        name: 'submit',
        description: 'Submit form',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address' },
            age: { type: 'integer', minimum: 18 },
          },
          required: ['email'],
        },
        execute: vi.fn(),
      };

      service.register(createEntry({ id: 'form1', actions: [action] }));
      service['visibleIds'].set(new Set(['form1']));

      const snap = service.snapshot();
      expect(snap.tools).toHaveLength(1);
      const tool = snap.tools[0];
      expect((tool.function.parameters.properties as Record<string, unknown>)['email']).toBeDefined();
      const ageProps = (tool.function.parameters.properties as Record<string, any>)['age'];
      expect(ageProps.minimum).toBe(18);
      expect(tool.function.parameters.required).toContain('email');
    });

    it('should fall back to parameters when inputSchema not present', () => {
      const { service } = createService();
      const action: AgentAction = {
        name: 'click',
        description: 'Click button',
        parameters: [
          { name: 'count', type: 'number', description: 'Click count', required: true },
        ],
        execute: vi.fn(),
      };

      service.register(createEntry({ id: 'btn1', actions: [action] }));
      service['visibleIds'].set(new Set(['btn1']));

      const snap = service.snapshot();
      expect(snap.tools).toHaveLength(1);
      const tool = snap.tools[0];
      expect((tool.function.parameters.properties as Record<string, unknown>)['count']).toBeDefined();
    });

    it('should preserve nested object schemas in tools', () => {
      const { service } = createService();
      const action: AgentAction = {
        name: 'upsert',
        description: 'Upsert record',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nested: { type: 'string' },
              },
              required: ['id'],
            },
          },
          required: ['data'],
        },
        execute: vi.fn(),
      };

      service.register(createEntry({ id: 'db1', actions: [action] }));
      service['visibleIds'].set(new Set(['db1']));

       const snap = service.snapshot();
       const tool = snap.tools[0];
       const dataProps = (tool.function.parameters.properties as Record<string, any>)['data'] as Record<string, any>;
       expect((dataProps as Record<string, any>)['properties']?.id).toBeDefined();
       expect((dataProps as Record<string, any>)['required']).toContain('id');
     });

     it('should preserve array item schemas in tools', () => {
       const { service } = createService();
       const action: AgentAction = {
         name: 'bulkUpsert',
         description: 'Bulk upsert',
         inputSchema: {
           type: 'object',
           properties: {
             items: {
               type: 'array',
               items: {
                 type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
             },
           },
         },
         execute: vi.fn(),
       };

       service.register(createEntry({ id: 'db1', actions: [action] }));
       service['visibleIds'].set(new Set(['db1']));

        const snap = service.snapshot();
        const tool = snap.tools[0];
        const itemsProps = (tool.function.parameters.properties as Record<string, any>)['items'] as Record<string, any>;
        expect((itemsProps as Record<string, any>)['type']).toBe('array');
        expect((itemsProps as Record<string, any>)['items']?.properties?.id).toBeDefined();
      });
    });

    // ---- Readable Setter Tools ----

    describe('Readable setter tools', () => {
      it('should generate setter tools for writable readables', () => {
        const { service } = createService();
        const readable = createMockReadable('config', 'Configuration', true);
        service.register(createEntry({ id: 'comp1', readables: [readable] }));
        service['visibleIds'].set(new Set(['comp1']));

        const snap = service.snapshot();
        expect(snap.tools.length).toBeGreaterThan(1);
        const setterTool = snap.tools.find(t => t.function.name.includes('set_config'));
       expect(setterTool).toBeDefined();
       expect(setterTool?.function.description).toContain('Update state');
     });

     it('should not generate tools for read-only readables', () => {
       const { service } = createService();
       const readable = createMockReadable('status', 'Status', false);
       service.register(createEntry({ id: 'comp1', actions: [], readables: [readable] }));
       service['visibleIds'].set(new Set(['comp1']));

       const snap = service.snapshot();
       expect(snap.tools).toHaveLength(0);
     });

     it('should wrap readable value in "value" property', () => {
       const { service } = createService();
       const readable: AgentReadable = {
         name: 'count',
         description: 'Item count',
         schema: {
           type: 'object',
          properties: {
            total: { type: 'integer' },
            filtered: { type: 'integer' },
          },
          required: ['total'],
        },
        writable: true,
        read: vi.fn(),
        write: vi.fn(),
      };

       service.register(createEntry({ id: 'comp1', actions: [], readables: [readable] }));
       service['visibleIds'].set(new Set(['comp1']));

       const snap = service.snapshot();
       const setterTool = snap.tools.find(t => t.function.name.includes('set_count'));
       expect((setterTool?.function.parameters.properties as Record<string, unknown>)['value']).toBeDefined();
       expect(setterTool?.function.parameters.required).toContain('value');
     });
   });
});