import {
  LLMProvider,
  LLMMessage,
  LLMStreamChunk,
  ToolDefinition,
} from 'agentic-ui';

/**
 * A mock LLM provider for demo purposes.
 * Logs agent intention to console instead of calling a real API.
 * Replace with OpenAiProvider({ apiKey: 'sk-...' }) for real usage.
 */
export class MockLLMProvider implements LLMProvider {
  async *getStream(
    messages: LLMMessage[],
    tools: ToolDefinition[]
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    // Simulate a thinking delay
    yield { type: 'thought', text: 'Analyzing the current UI state...' };
    yield { type: 'thought', text: ` Found ${tools.length} available actions.` };

    // In a real app, this would call an LLM API
    if (tools.length > 0) {
      yield {
        type: 'thought',
        text: `\nI can help with: ${tools.map((t) => t.function.name).join(', ')}`,
      };
    } else {
      yield {
        type: 'thought',
        text: ' No interactive components are currently visible.',
      };
    }

    console.log('[MockLLM] Messages:', messages);
    console.log(
      '[MockLLM] Available tools:',
      tools.map((t) => t.function.name)
    );
  }
}
