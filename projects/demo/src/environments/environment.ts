import { DemoLlmProviderConfig } from '../app/llm/demo-llm-provider.factory';

export const environment = {
  production: true,
  llm: {
    mode: 'mock',
    apiUrl: 'http://localhost:3000/api',
    apiKey: 'agentic-ui-demo',
    model: 'agentic-demo',
  } as DemoLlmProviderConfig,
};
