import { DemoLlmProviderConfig } from '../app/llm/demo-llm-provider.factory';

/**
 * Production environment — uses mock LLM provider by default.
 *
 * For a real deployment, override with a backend proxy (like the included
 * projects/backend Express server) that injects the API key server-side.
 * Never put real API keys in this file — they get compiled into the JS bundle.
 */
export const environment = {
  production: true,
  llm: {
    mode: 'mock',
    apiUrl: '/api',
    apiKey: 'production-proxy-key',
    model: 'google/gemini-2.5-flash-lite',
  } as DemoLlmProviderConfig,
};
