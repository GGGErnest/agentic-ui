import { AgentAction } from './agent-action.model';

/**
 * An entry in the World Registry — represents a UI component's
 * agent-facing API. Registered by the [agentic] directive.
 */
export interface WorldEntry {
  /** Unique identifier for this component instance. */
  id: string;
  /** Semantic role of the component (e.g., 'DataTable', 'Modal', 'Form'). */
  role: string;
  /** Actions this component exposes to the agent. */
  actions: AgentAction[];
  /** The DOM element (used for telemetry bounding box). */
  element?: HTMLElement;
  /** Arbitrary metadata for facade components. */
  metadata?: Record<string, unknown>;
}

/**
 * The snapshot of the world sent to the LLM as context.
 * Compact, LLM-friendly representation — not the full entries.
 */
export interface WorldSnapshot {
  /** Human-readable description of the current UI state. */
  context: string;
  /** Tool definitions for all visible actions. */
  tools: ToolDefinition[];
}

/** OpenAI-compatible tool definition sent to the LLM. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** Configuration for snapshot generation — controls token budget. */
export interface SnapshotConfig {
  /** Maximum number of tool definitions to include. Default: 20. */
  maxTools?: number;
  /** Maximum context string length in characters. Default: 2000. */
  maxContextLen?: number;
  /** Roles to prioritize when budget is exceeded (e.g., ['DataTable', 'Modal']). */
  priorityRoles?: string[];
}
