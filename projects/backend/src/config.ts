/**
 * Backend configuration loader and validator.
 */

export interface BackendConfig {
  port: number;
  corsOrigin: string;
  clientToken: string;
  litellmBaseUrl: string;
  litellmApiKey: string;
  litellmModel: string;
}

export function loadBackendConfig(env: NodeJS.ProcessEnv): BackendConfig {
  const requiredVars = ['DEMO_CLIENT_TOKEN', 'LITELLM_BASE_URL', 'LITELLM_API_KEY', 'LITELLM_MODEL'];
  const missing = requiredVars.filter((v) => !env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const litellmBaseUrl = env['LITELLM_BASE_URL']!.endsWith('/') ? env['LITELLM_BASE_URL']!.slice(0, -1) : env['LITELLM_BASE_URL']!;

  return {
    port: parseInt(env['BACKEND_PORT'] || '3000', 10),
    corsOrigin: env['DEMO_CORS_ORIGIN'] || 'http://localhost:4200',
    clientToken: env['DEMO_CLIENT_TOKEN']!,
    litellmBaseUrl,
    litellmApiKey: env['LITELLM_API_KEY']!,
    litellmModel: env['LITELLM_MODEL']!,
  };
}
