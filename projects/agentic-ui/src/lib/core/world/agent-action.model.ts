/**
 * Core data models for the Agentic-UI World Registry.
 * These define the contract between UI components and AI agents.
 */
import { Type } from '@angular/core';
import { AgentJsonSchema } from '../schema/agent-json-schema.model';

/** Parameters schema for an action (sent to the LLM as tool definitions). */
export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

/** Runtime context passed to a tool's `renderInputs` for generative UI. */
export interface ToolRenderContext {
  entryId: string;
  actionName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'executing' | 'complete' | 'error';
  result?: unknown;
  error?: string;
}

/** Where the renderer mounts the tool component in the shell. */
export type RenderMode = 'inline' | 'dropzone' | 'modal';

/** Definition of an action a component exposes to the agent. */
export interface AgentActionDef {
  name: string;
  description: string;
  parameters?: ActionParameter[];
  /** If true, the agent must request human approval before execution. */
  requiresApproval?: boolean;
  /** Optional JSON Schema for richer input validation and documentation. */
  inputSchema?: AgentJsonSchema;
  /** Optional Angular component rendered to display the tool call inline. */
  renderComponent?: Type<unknown>;
  /** Maps the render context to component inputs. Default: passes the full context. */
  renderInputs?: (ctx: ToolRenderContext) => Record<string, unknown>;
  /** How the shell should mount the renderer. Default: 'inline'. */
  renderMode?: RenderMode;
}

/** Result returned after executing an action. */
export interface AgentActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/** Runtime action with its executor, derived from AgentActionDef. */
export interface AgentAction extends AgentActionDef {
  execute: (params?: Record<string, unknown>) => Promise<AgentActionResult>;
}
