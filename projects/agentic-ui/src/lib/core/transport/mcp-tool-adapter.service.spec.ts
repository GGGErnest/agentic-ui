/**
 * McpToolAdapterService — unit tests.
 * Tests adapter conversion of World actions/readables to MCP tools
 * and execution dispatch back to the World Registry.
 */
import { TestBed } from '@angular/core/testing';
import { McpToolAdapterService, McpTool } from './mcp-tool-adapter.service';
import { AgentWorldService } from '../world/agent-world.service';
import { WorldEntry, ToolDefinition } from '../world/world-entry.interface';
import { AgentAction, AgentActionResult } from '../world/agent-action.model';
import {
  AgentReadable,
  AgentReadableResult,
  AgentWritableResult,
} from '../state/agent-readable.model';
import { AgentJsonSchema } from '../schema/agent-json-schema.model';
import { AgentApprovalService } from '../approval/agent-approval.service';

// ---- Helpers ----

function createMockAction(name: string, params: string[] = []): AgentAction {
  return {
    name,
    description: `Test action ${name}`,
    parameters: params.map((p) => ({
      name: p,
      type: 'string',
      description: `Param ${p}`,
      required: true,
    })),
    execute: vi.fn().mockResolvedValue({
      success: true,
      message: 'Action executed',
      data: { result: 'success' },
    } as AgentActionResult),
  };
}

function createMockReadable(name: string, writable = false): AgentReadable {
  return {
    name,
    description: `Test readable ${name}`,
    writable,
    schema: {
      type: 'object',
      properties: { value: { type: 'string' } },
    } as AgentJsonSchema,
    read: vi.fn().mockResolvedValue({
      success: true,
      message: 'Value read',
      value: 'test-value',
    } as AgentReadableResult),
    write: vi.fn().mockResolvedValue({
      success: true,
      message: 'Value written',
    } as AgentWritableResult),
  };
}

function createMockWorldEntry(
  id: string,
  actions: AgentAction[],
  readables: AgentReadable[],
): WorldEntry {
  return {
    id,
    role: 'mock-component',
    actions,
    readables,
    element: document.createElement('div'),
  };
}

// ---- Tests ----

describe('McpToolAdapterService', () => {
  let adapter: McpToolAdapterService;
  let world: AgentWorldService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [McpToolAdapterService, AgentWorldService],
    });

    adapter = TestBed.inject(McpToolAdapterService);
    world = TestBed.inject(AgentWorldService);
  });

  describe('getToolDefinitions', () => {
    it('converts actions to MCP tools', () => {
      const action = createMockAction('do_something', ['param1']);
      const entry = createMockWorldEntry('test-comp', [action], []);
      world.register(entry);

      const tools = adapter.getToolDefinitions();
      const tool = tools.find((t) => t.name === 'test-comp__action__do_something');

      expect(tool).toBeDefined();
      expect(tool?.description).toContain('do_something');
      expect(tool?.input_schema?.properties).toHaveProperty('param1');
    });

    it('creates read pseudo-tools for readables', () => {
      const readable = createMockReadable('my_state');
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const tools = adapter.getToolDefinitions();
      const readTool = tools.find((t) => t.name === 'test-comp__read__my_state');

      expect(readTool).toBeDefined();
      expect(readTool?.description).toContain('Read state');
    });

    it('creates write pseudo-tools only for writable readables', () => {
      const readable = createMockReadable('my_state', true);
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const tools = adapter.getToolDefinitions();
      const writeTool = tools.find((t) => t.name === 'test-comp__write__my_state');

      expect(writeTool).toBeDefined();
      expect(writeTool?.input_schema?.properties).toHaveProperty('value');
    });

    it('does not create write tool for read-only readables', () => {
      const readable = createMockReadable('my_state', false);
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const tools = adapter.getToolDefinitions();
      const writeTool = tools.find((t) => t.name === 'test-comp__write__my_state');

      expect(writeTool).toBeUndefined();
    });
  });

  describe('executeTool', () => {
    it('executes action and returns result', async () => {
      const action = createMockAction('do_something', ['param1']);
      const entry = createMockWorldEntry('test-comp', [action], []);
      world.register(entry);

      const result = await adapter.executeTool('test-comp__action__do_something', {
        param1: 'value',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(action.execute).toHaveBeenCalledWith({ param1: 'value' });
    });

    it('handles action execution errors', async () => {
      const action = createMockAction('failing_action');
      action.execute = vi.fn().mockRejectedValue(new Error('Action failed'));
      const entry = createMockWorldEntry('test-comp', [action], []);
      world.register(entry);

      const result = await adapter.executeTool('test-comp__action__failing_action');

      expect(result.success).toBe(false);
      // Routed through the world gate, which wraps the thrown message.
      expect(result.message).toContain('Action failed');
    });

    it('returns error for non-existent tool', async () => {
      const result = await adapter.executeTool('nonexistent_tool');

      expect(result.success).toBe(false);
      expect(result.error).toBe('TOOL_NOT_FOUND');
    });

    it('executes read pseudo-tool', async () => {
      const readable = createMockReadable('my_state');
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const result = await adapter.executeTool('test-comp__read__my_state');

      expect(result.success).toBe(true);
      expect(result.data).toBe('test-value');
      expect(readable.read).toHaveBeenCalled();
    });

    it('executes write pseudo-tool', async () => {
      const readable = createMockReadable('my_state', true);
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const result = await adapter.executeTool('test-comp__write__my_state', {
        value: 'new-value',
      });

      expect(result.success).toBe(true);
      expect(readable.write).toHaveBeenCalledWith('new-value');
    });

    it('returns error for write on read-only readable', async () => {
      const readable = createMockReadable('my_state', false);
      const entry = createMockWorldEntry('test-comp', [], [readable]);
      world.register(entry);

      const result = await adapter.executeTool('test-comp__write__my_state', {
        value: 'new-value',
      });

      expect(result.success).toBe(false);
      // World gate reports a non-writable readable.
      expect(result.message).toMatch(/not writable/i);
    });

    it('routes approval-required actions through the world gate (#J1)', async () => {
      const approval = TestBed.inject(AgentApprovalService);
      const execute = vi.fn().mockResolvedValue({ success: true, message: 'done' });
      const entry = createMockWorldEntry(
        'test-comp',
        [{ name: 'danger', description: 'risky', requiresApproval: true, execute }],
        [],
      );
      world.register(entry);

      const resultPromise = adapter.executeTool('test-comp__action__danger', {});
      // Action must NOT execute until approval is granted.
      expect(execute).not.toHaveBeenCalled();
      expect(approval.isPending()).toBe(true);

      approval.approve();
      const result = await resultPromise;
      expect(execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
