import { describe, it, expect } from 'vitest';
import { createDemoLlmProvider } from './demo-llm-provider.factory';
import { MockLLMProvider } from './mock-llm-provider';
import { OpenAiProvider } from 'agentic-ui';

describe('createDemoLlmProvider', () => {
  it('returns MockLLMProvider when mode is mock', () => {
    const provider = createDemoLlmProvider({
      mode: 'mock',
      apiUrl: 'http://localhost:3000/api',
      apiKey: 'agentic-ui-demo',
      model: 'agentic-demo',
    });

    expect(provider).toBeInstanceOf(MockLLMProvider);
  });

  it('returns OpenAiProvider when mode is backend', () => {
    const provider = createDemoLlmProvider({
      mode: 'backend',
      apiUrl: 'http://localhost:3000/api',
      apiKey: 'agentic-ui-demo',
      model: 'agentic-demo',
    });

    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it('configures backend provider with normalized apiUrl, apiKey, and model', () => {
    const provider = createDemoLlmProvider({
      mode: 'backend',
      apiUrl: 'http://localhost:3000/api/',
      apiKey: 'test-key',
      model: 'test-model',
    }) as OpenAiProvider;

    // Access private fields through the provider to verify configuration
    // OpenAiProvider normalizes URLs by stripping trailing slash
    expect((provider as any)['apiUrl']).toBe('http://localhost:3000/api');
    expect((provider as any)['apiKey']).toBe('test-key');
    expect((provider as any)['model']).toBe('test-model');
  });
});
