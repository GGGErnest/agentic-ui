import { describe, expect, it } from 'vitest';
import {
  assertDockerDaemonAvailable,
  ensureBackendEnv,
  getDockerComposeCommand,
  getLiteLlmReadinessUrl,
  getRequiredBootstrapVars,
  waitForHealthyLiteLlm,
} from './demo-full';

describe('demo full bootstrap helpers', () => {
  it('returns all required bootstrap env vars', () => {
    expect(getRequiredBootstrapVars()).toEqual([
      'DEMO_CLIENT_TOKEN',
      'LITELLM_BASE_URL',
      'LITELLM_API_KEY',
      'LITELLM_MODEL',
      'LITELLM_UPSTREAM_API_BASE',
      'LITELLM_UPSTREAM_API_KEY',
      'LITELLM_UPSTREAM_LITELLM_MODEL',
    ]);
  });

  it('copies .env.example into .env when missing', async () => {
    const writes: Array<{ destinationPath: string; content: string }> = [];

    const created = await ensureBackendEnv({
      envPath: '/repo/projects/backend/.env',
      examplePath: '/repo/projects/backend/.env.example',
      fileExists: async (filePath) => filePath.endsWith('.env.example'),
      readFile: async () => 'DEMO_CLIENT_TOKEN=agentic-ui-demo\n',
      writeFile: async (destinationPath, content) => {
        writes.push({ destinationPath, content });
      },
    });

    expect(created).toBe(true);
    expect(writes).toEqual([
      {
        destinationPath: '/repo/projects/backend/.env',
        content: 'DEMO_CLIENT_TOKEN=agentic-ui-demo\n',
      },
    ]);
  });

  it('leaves existing .env untouched', async () => {
    let writeCount = 0;

    const created = await ensureBackendEnv({
      envPath: '/repo/projects/backend/.env',
      examplePath: '/repo/projects/backend/.env.example',
      fileExists: async (filePath) => filePath.endsWith('.env'),
      readFile: async () => 'unused',
      writeFile: async () => {
        writeCount++;
      },
    });

    expect(created).toBe(false);
    expect(writeCount).toBe(0);
  });

  it('uses docker compose when the subcommand is available', () => {
    const command = getDockerComposeCommand(() => true);

    expect(command).toEqual({
      command: 'docker',
      args: ['compose'],
    });
  });

  it('falls back to docker-compose when docker compose is unavailable', () => {
    const command = getDockerComposeCommand(() => false);

    expect(command).toEqual({
      command: 'docker-compose',
      args: [],
    });
  });

  it('passes docker daemon preflight when docker info succeeds', async () => {
    await expect(
      assertDockerDaemonAvailable(() => ({
        status: 0,
        stderr: '',
      }))
    ).resolves.toBeUndefined();
  });

  it('throws actionable error when docker daemon is unavailable', async () => {
    await expect(
      assertDockerDaemonAvailable(() => ({
        status: 1,
        stderr: 'failed to connect to the docker API at unix:///var/run/docker.sock',
      }))
    ).rejects.toThrow(
      'Docker daemon is not running. Start Docker Desktop or your Docker service, then rerun `yarn demo:full`.'
    );
  });

  it('uses LiteLLM readiness endpoint instead of the models endpoint', () => {
    expect(getLiteLlmReadinessUrl('http://localhost:8000/v1')).toBe('http://localhost:8000/health/readiness');
  });

  it('accepts LiteLLM readiness success even when db is not connected', async () => {
    const responses = [
      {
        ok: true,
        json: async () => ({ status: 'healthy', db: 'Not connected' }),
      },
    ];

    await expect(
      waitForHealthyLiteLlm('http://localhost:8000/v1', 'litellm-local-key', {
        fetchImpl: async () => responses.shift() as Response,
        sleep: async () => undefined,
        maxAttempts: 1,
      })
    ).resolves.toBeUndefined();
  });
});
