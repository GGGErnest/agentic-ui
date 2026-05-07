import { ToolDefinition } from '../world/world-entry.interface';

/**
 * LLM Provider interface — the contract for connecting the Agentic-UI
 * harness to any LLM backend (OpenAI, Anthropic, local, etc.).
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/** Streaming chunk emitted by the LLM. */
export interface LLMStreamChunk {
  type: 'thought' | 'tool_call' | 'content';
  /** Text content (for 'thought' and 'content' chunks). */
  text?: string;
  /** Tool call data (for 'tool_call' chunks). */
  data?: ToolCall;
}

/**
 * The LLM Provider is responsible for:
 * 1. Streaming thought tokens to the harness (transparent agent reasoning).
 * 2. Streaming tool call tokens for action dispatch.
 * 3. Managing conversation context.
 */
export interface LLMProvider {
  /**
   * Get a streaming completion from the LLM.
   * @param messages — conversation history.
   * @param tools — current world snapshot tools.
   * @param systemPrompt — optional system-level instructions.
   */
  getStream(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string,
    signal?: AbortSignal,
  ): AsyncIterable<LLMStreamChunk>;
}
