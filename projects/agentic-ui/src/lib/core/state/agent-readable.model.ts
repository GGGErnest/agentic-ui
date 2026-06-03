/**
 * Readable state — exposes component internal state to the agent.
 * Provides both a getter (read current value) and optional setter (writable).
 */
import { AgentJsonSchema } from '../schema/agent-json-schema.model';

/** Result returned after reading state. */
export interface AgentReadableResult {
  success: boolean;
  message: string;
  value?: unknown;
}

/** Result returned after writing state. */
export interface AgentWritableResult {
  success: boolean;
  message: string;
}

/** Readable state definition — maps a named piece of component state for agent visibility. */
export interface AgentReadableDef {
  name: string;
  description: string;
  /** JSON Schema describing the shape of this readable's value. */
  schema: AgentJsonSchema;
  /** If true, the agent can request updates via a setter tool. */
  writable?: boolean;
}

/** Runtime readable — getter function and optional setter. */
export interface AgentReadable extends AgentReadableDef {
  read: () => Promise<AgentReadableResult>;
  write?: (value: unknown) => Promise<AgentWritableResult>;
}
