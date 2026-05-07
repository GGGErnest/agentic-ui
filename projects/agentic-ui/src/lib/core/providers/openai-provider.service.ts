import {
  LLMProvider,
  LLMMessage,
  LLMStreamChunk,
  ToolCall,
} from '../../core/harness/llm-provider.interface';
import { ToolDefinition } from '../../core/world/world-entry.interface';

/**
 * Configuration for the OpenAI-compatible provider.
 */
export interface OpenAiProviderConfig {
  /** API endpoint (default: https://api.openai.com/v1) */
  apiUrl?: string;
  /** API key */
  apiKey: string;
  /** Model name (default: gpt-4o) */
  model?: string;
  /** Max tokens per response (default: 4096) */
  maxTokens?: number;
  /** Temperature (default: 0.1 — keep low for reliable tool use) */
  temperature?: number;
}

/**
 * OpenAI-compatible LLM Provider.
 *
 * Works with:
 * - OpenAI (GPT-4, GPT-4o, o1, o3)
 * - Anthropic via proxy (Claude models)
 * - Local models via Ollama/LM Studio
 * - Nous Portal, OpenRouter, etc.
 *
 * Implements the LLMProvider interface for the Agentic-UI harness.
 *
 * Not an Angular service — create via provideOpenAi() factory:
 * ```typescript
 * providers: [
 *   { provide: LLM_PROVIDER, useFactory: () => provideOpenAi({ apiKey: 'sk-...' }) }
 * ]
 * ```
 */
export class OpenAiProvider implements LLMProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(config: OpenAiProviderConfig) {
    this.apiUrl = (config.apiUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o';
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0.1;
  }

  async *getStream(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string,
    signal?: AbortSignal,
  ): AsyncIterable<LLMStreamChunk> {
    const systemMessages: LLMMessage[] = [];
    if (systemPrompt) {
      systemMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add default agentic behavior prompt if no system prompt provided
    if (!systemPrompt) {
      systemMessages.push({
        role: 'system',
        content: `You are an AI agent controlling a web application. You have access to tools that represent UI actions.
Think step by step about what action to take next. Always explain your reasoning before calling a tool.
If no action is needed, explain why. Be precise with tool arguments.`,
      });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [...systemMessages, ...messages],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      stream: true,
      stream_options: { include_usage: true },
    };

    // Only include tools if there are any
    if (tools.length > 0) {
      body['tools'] = tools;
      body['tool_choice'] = 'auto';
    }

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let thoughtText = '';
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (!delta) continue;

            // Tool call streaming
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    arguments: '',
                  });
                }

                const existing = toolCalls.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }

            // Text content: treat as thought (transparent reasoning)
            if (delta.content) {
              thoughtText += delta.content;
              yield { type: 'thought', text: delta.content };
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Emit accumulated tool calls
    for (const [, tc] of toolCalls) {
      yield {
        type: 'tool_call',
        data: {
          id: tc.id,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        },
      };
    }
  }
}

/**
 * Factory function to create an OpenAiProvider with config.
 * Use with Angular DI:
 *
 * ```typescript
 * providers: [
 *   {
 *     provide: LLM_PROVIDER,
 *     useFactory: () => new OpenAiProvider({
 *       apiKey: 'sk-...',
 *       model: 'gpt-4o',
 *     }),
 *   },
 * ]
 * ```
 */
export function provideOpenAi(config: OpenAiProviderConfig): OpenAiProvider {
  return new OpenAiProvider(config);
}
