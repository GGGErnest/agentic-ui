import { describe, expect, it } from 'vitest';
import { ensureBackendEnv, getRequiredBootstrapVars } from './demo-full';

describe('demo full bootstrap helpers', () => {
  it('returns all required bootstrap env vars', () => {
    expect(getRequiredBootstrapVars()).toEqual([
      'DEMO_CLIENT_TOKEN',
      'LITELLM_BASE_URL',
      'LITELLM_API_KEY',
      'LITELLM_MODEL',
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
});
