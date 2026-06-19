/**
 * MCP Tool Adapter — bridges World Registry to MCP tool definitions and execution.
 * Converts AgentActions and AgentReadables into MCP-compatible tools.
 * Dispatches tool calls back to the World Registry.
 */
import { Injectable, inject } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { AgentAction } from '../world/agent-action.model';
import { AgentReadable } from '../state/agent-readable.model';
import { AgentJsonSchema, JsonSchemaProperty } from '../schema/agent-json-schema.model';
import { ToolNameCodec } from '../events/tool-name-codec';

/** MCP Tool definition (compatible with OpenAI tools format). */
export interface McpTool {
  name: string;
  description: string;
  input_schema?: AgentJsonSchema;
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
   * Dispatches through the World Registry so MCP callers get the same
   * approval gate and schema validation as the LLM path.
   */
  async executeTool(
    toolName: string,
    params?: Record<string, unknown>,
  ): Promise<McpToolExecutionResult> {
    try {
      const kind = this.codec.kind(toolName);

      if (kind === 'action') {
        const { entryId, actionName } = this.codec.decodeAction(toolName);
        const result = await this.world.executeAction(entryId, actionName, params);
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          ...(result.success ? {} : { error: result.message }),
        };
      }

      if (kind === 'read') {
        const { entryId, readableName } = this.codec.decodeReadable(toolName);
        return this.executeReadTool(entryId, readableName);
      }

      if (kind === 'write') {
        const { entryId, readableName } = this.codec.decodeReadable(toolName);
        const value = params?.['value'];
        const result = await this.world.updateReadable(entryId, readableName, value);
        return {
          success: result.success,
          message: result.message,
          ...(result.success ? {} : { error: result.message }),
        };
      }

      return {
        success: false,
        message: `Tool not found: ${toolName}`,
        error: 'TOOL_NOT_FOUND',
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

  private composeReadableToolName(
    entryId: string,
    readableName: string,
    mode: 'read' | 'write',
  ): string {
    return this.codec.encodeReadable(entryId, readableName, mode);
  }

  /** Find readable in a specific entry by name. */
  private findReadable(entryId: string, name: string): AgentReadable | null {
    const entry = this.world.entries().get(entryId);
    if (!entry) return null;
    return entry.readables?.find((r) => r.name === name) ?? null;
  }

  /** Execute a read pseudo-tool. Reads are non-mutating and bypass the gate. */
  private async executeReadTool(
    entryId: string,
    readableName: string,
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
