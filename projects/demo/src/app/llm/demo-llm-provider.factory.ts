import { OpenAiProvider, LLMProvider } from 'agentic-ui';
import { MockLLMProvider } from './mock-llm-provider';

export interface DemoLlmProviderConfig {
  mode: 'mock' | 'backend';
  apiUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Pure factory that returns either MockLLMProvider or OpenAiProvider
 * based on the provided configuration.
 */
export function createDemoLlmProvider(
  config: DemoLlmProviderConfig
): LLMProvider {
  if (config.mode === 'mock') {
    return new MockLLMProvider();
  }

  return new OpenAiProvider({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0.1,
  });
}
