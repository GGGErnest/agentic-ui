import { DemoLlmProviderConfig } from '../app/llm/demo-llm-provider.factory';

/**
 * Development environment — connects to the local Express backend.
 *
 * The backend (projects/backend) authenticates with DEMO_CLIENT_TOKEN,
 * then forwards requests to LiteLLM which handles model routing.
 * No API key ever reaches the browser.
 *
 * Start:
 *   npm run litellm:up      # start LiteLLM proxy
 *   npm run backend:dev     # start Express backend
 *   npm start               # start Angular dev server
 */
export const environment = {
  production: false,
  llm: {
    mode: 'backend',
    apiUrl: '/api',
    apiKey: 'agentic-ui-demo',
    model: 'agentic-demo',
  } as DemoLlmProviderConfig,
};
