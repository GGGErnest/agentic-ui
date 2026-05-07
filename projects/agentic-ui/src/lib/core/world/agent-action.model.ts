/**
 * Core data models for the Agentic-UI World Registry.
 * These define the contract between UI components and AI agents.
 */

/** Parameters schema for an action (sent to the LLM as tool definitions). */
export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

/** Definition of an action a component exposes to the agent. */
export interface AgentActionDef {
  name: string;
  description: string;
  parameters?: ActionParameter[];
  /** If true, the agent must request human approval before execution. */
  requiresApproval?: boolean;
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
