import { describe, expect, it } from 'vitest';
import { loadBackendConfig } from './config';

describe('loadBackendConfig', () => {
  it('loads backend config with external LiteLLM connection settings', () => {
    const config = loadBackendConfig({
      DEMO_CLIENT_TOKEN: 'agentic-ui-demo',
      LITELLM_BASE_URL: 'http://litellm.example.com/v1/',
      LITELLM_API_KEY: 'external-key',
      LITELLM_MODEL: 'my-model',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      port: 3000,
      corsOrigin: 'http://localhost:4200',
      clientToken: 'agentic-ui-demo',
      litellmBaseUrl: 'http://litellm.example.com/v1',
      litellmApiKey: 'external-key',
      litellmModel: 'my-model',
      logLevel: 'info',
    });
  });

  it('throws when LOG_LEVEL is an invalid value', () => {
    expect(() =>
      loadBackendConfig({
        DEMO_CLIENT_TOKEN: 'agentic-ui-demo',
        LITELLM_BASE_URL: 'http://litellm.example.com/v1',
        LITELLM_API_KEY: 'external-key',
        LITELLM_MODEL: 'my-model',
        LOG_LEVEL: 'trace',
      } as NodeJS.ProcessEnv)
    ).toThrow('Invalid LOG_LEVEL "trace". Must be "info" or "debug".');
  });

  it('throws when required LiteLLM settings are missing', () => {
    expect(() =>
      loadBackendConfig({
        DEMO_CLIENT_TOKEN: 'agentic-ui-demo',
      } as NodeJS.ProcessEnv)
    ).toThrow('Missing required environment variables: LITELLM_BASE_URL, LITELLM_API_KEY, LITELLM_MODEL');
  });
});
