import { describe, expect, it } from 'vitest';
import { loadBackendConfig } from './config';

describe('loadBackendConfig', () => {
  it('loads backend config with OpenAI-compatible LiteLLM upstream settings', () => {
    const config = loadBackendConfig({
      DEMO_CLIENT_TOKEN: 'agentic-ui-demo',
      LITELLM_BASE_URL: 'http://localhost:8000/v1/',
      LITELLM_API_KEY: 'litellm-local-key',
      LITELLM_MODEL: 'agentic-demo',
      LITELLM_UPSTREAM_API_BASE: 'https://opencode.ai/zen/go/v1',
      LITELLM_UPSTREAM_API_KEY: 'go-key',
      LITELLM_UPSTREAM_LITELLM_MODEL: 'openai/deepseek-v4-pro',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      port: 3000,
      corsOrigin: 'http://localhost:4200',
      clientToken: 'agentic-ui-demo',
      litellmBaseUrl: 'http://localhost:8000/v1',
      litellmApiKey: 'litellm-local-key',
      litellmModel: 'agentic-demo',
      litellmUpstreamApiBase: 'https://opencode.ai/zen/go/v1',
      litellmUpstreamApiKey: 'go-key',
      litellmUpstreamLitellmModel: 'openai/deepseek-v4-pro',
    });
  });

  it('throws when required upstream LiteLLM settings are missing', () => {
    expect(() =>
      loadBackendConfig({
        DEMO_CLIENT_TOKEN: 'agentic-ui-demo',
        LITELLM_BASE_URL: 'http://localhost:8000/v1',
        LITELLM_API_KEY: 'litellm-local-key',
        LITELLM_MODEL: 'agentic-demo',
      } as NodeJS.ProcessEnv)
    ).toThrow(
      'Missing required environment variables: LITELLM_UPSTREAM_API_BASE, LITELLM_UPSTREAM_API_KEY, LITELLM_UPSTREAM_LITELLM_MODEL'
    );
  });
});
