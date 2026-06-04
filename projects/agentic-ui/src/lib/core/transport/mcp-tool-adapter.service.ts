/**
 * MCP Tool Adapter — bridges World Registry to MCP tool definitions and execution.
 * Converts AgentActions and AgentReadables into MCP-compatible tools.
 * Dispatches tool calls back to the World Registry.
 */
import { Injectable, inject } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { AgentAction, AgentActionResult } from '../world/agent-action.model';
import { AgentReadable, AgentReadableResult, AgentWritableResult } from '../state/agent-readable.model';
import { AgentJsonSchema, JsonSchemaProperty } from '../schema/agent-json-schema.model';
import { ToolNameCodec } from '../events/tool-name-codec';

/** MCP Tool definition (compatible with OpenAI tools format). */
export interface McpTool {
  name: string;
  description: string;
  input_schema?: AgentJsonSchema;
}

interface ResolvedToolTarget {
  entryId: string;
  toolName: string;
}

/** Result from executing an MCP tool. */
export interface McpToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/**
 * McpToolAdapterService — manages conversion of World Registry
 * actions and readables to MCP tools and back.
 */
@Injectable({ providedIn: 'root' })
export class McpToolAdapterService {
  private readonly world = inject(AgentWorldService);
  private readonly codec = new ToolNameCodec();

  /**
   * Get all MCP tools from the active World entries.
   * Includes action tools and read/write pseudo-tools for readables.
   */
  getToolDefinitions(): McpTool[] {
    const tools: McpTool[] = [];
    const entries = this.world.entries();

    // Convert actions to tools
    for (const entry of entries.values()) {
      for (const action of entry.actions) {
        tools.push({
          name: this.composeActionToolName(entry.id, action.name),
          description: `[${entry.role}] ${action.description}`,
          input_schema: action.inputSchema || this.buildParameterSchema(action),
        });
      }

      // Convert readables to read/write tools
      for (const readable of entry.readables ?? []) {
        // Read tool
        tools.push({
          name: this.composeReadableToolName(entry.id, readable.name, 'read'),
          description: `[${entry.role}] Read state: ${readable.description}`,
          input_schema: {
            type: 'object',
            properties: {},
            required: [],
          },
        });

        // Write tool (only if writable)
        if (readable.writable) {
          tools.push({
            name: this.composeReadableToolName(entry.id, readable.name, 'write'),
            description: `[${entry.role}] Update state: ${readable.description}`,
            input_schema: {
              type: 'object',
              properties: {
                value: readable.schema,
              },
              required: ['value'],
            },
          });
        }
      }
    }

    return tools;
  }

  /**
   * Execute an MCP tool by name with parameters.
   * Dispatches to World actions or readables.
   */
  async executeTool(toolName: string, params?: Record<string, unknown>): Promise<McpToolExecutionResult> {
    try {
      const target = this.resolveToolTarget(toolName);
      if (!target) {
        return {
          success: false,
          message: `Tool not found: ${toolName}`,
          error: 'TOOL_NOT_FOUND',
        };
      }

      if (target.toolName.startsWith('read__')) {
        return this.executeReadTool(target.entryId, target.toolName.substring('read__'.length), params);
      }

      if (target.toolName.startsWith('write__')) {
        return this.executeWriteTool(target.entryId, target.toolName.substring('write__'.length), params);
      }

      const action = this.findAction(target.entryId, target.toolName);
      if (!action) {
        return {
          success: false,
          message: `Tool not found: ${toolName}`,
          error: 'TOOL_NOT_FOUND',
        };
      }

      const result = await action.execute(params);
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Execution error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  private composeActionToolName(entryId: string, actionName: string): string {
    return this.codec.encodeAction(entryId, actionName);
  }

  private composeReadableToolName(entryId: string, readableName: string, mode: 'read' | 'write'): string {
    return this.codec.encodeReadable(entryId, readableName, mode);
  }

  private resolveToolTarget(toolName: string): ResolvedToolTarget | null {
    const k = this.codec.kind(toolName);
    if (k === 'action') {
      const d = this.codec.decodeAction(toolName);
      return { entryId: d.entryId, toolName: d.actionName };
    }
    if (k === 'read' || k === 'write') {
      const d = this.codec.decodeReadable(toolName);
      return { entryId: d.entryId, toolName: `${k}__${d.readableName}` };
    }
    return null;
  }

  /** Find action in a specific entry by name. */
  private findAction(entryId: string, name: string): AgentAction | null {
    const entry = this.world.entries().get(entryId);
    if (!entry) return null;
    return entry.actions.find((a) => a.name === name) ?? null;
  }

  /** Find readable in a specific entry by name. */
  private findReadable(entryId: string, name: string): AgentReadable | null {
    const entry = this.world.entries().get(entryId);
    if (!entry) return null;
    return entry.readables?.find((r) => r.name === name) ?? null;
  }

  /** Execute a read pseudo-tool. */
  private async executeReadTool(
    entryId: string,
    readableName: string,
    _params?: Record<string, unknown>
  ): Promise<McpToolExecutionResult> {
    const readable = this.findReadable(entryId, readableName);
    if (!readable) {
      return {
        success: false,
        message: `Readable not found: ${readableName}`,
        error: 'READABLE_NOT_FOUND',
      };
    }

    const result = await readable.read();
    return {
      success: result.success,
      message: result.message,
      data: result.value,
    };
  }

  /** Execute a write pseudo-tool. */
  private async executeWriteTool(
    entryId: string,
    readableName: string,
    params?: Record<string, unknown>
  ): Promise<McpToolExecutionResult> {
    const readable = this.findReadable(entryId, readableName);
    if (!readable) {
      return {
        success: false,
        message: `Readable not found: ${readableName}`,
        error: 'READABLE_NOT_FOUND',
      };
    }

    if (!readable.writable) {
      return {
        success: false,
        message: `Readable is not writable: ${readableName}`,
        error: 'NOT_WRITABLE',
      };
    }

    const value = params?.['value'];
    const result = await readable.write?.(value);

    if (!result) {
      return {
        success: false,
        message: `Write method not implemented`,
        error: 'NOT_IMPLEMENTED',
      };
    }

    return {
      success: result.success,
      message: result.message,
    };
  }

  /**
   * Build a JSON Schema from ActionParameter definitions.
   * Used when action doesn't have explicit inputSchema.
   */
  private buildParameterSchema(action: AgentAction): AgentJsonSchema {
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const param of action.parameters ?? []) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        enum: param.enum,
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
}
