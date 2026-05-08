import { DemoLlmProviderConfig } from '../app/llm/demo-llm-provider.factory';

export const environment = {
  production: false,
  llm: {
    mode: 'backend',
    apiUrl: 'http://localhost:3000/api',
    apiKey: 'agentic-ui-demo',
    model: 'agentic-demo',
  } as DemoLlmProviderConfig,
};
