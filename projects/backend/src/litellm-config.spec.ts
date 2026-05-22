import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('litellm config', () => {
  it('uses LiteLLM os.environ syntax for upstream env variables', () => {
    const configPath = path.resolve(__dirname, '../../../litellm.config.yaml');
    const config = fs.readFileSync(configPath, 'utf8');

    expect(config).toContain('model: os.environ/LITELLM_UPSTREAM_LITELLM_MODEL');
    expect(config).toContain('api_base: os.environ/LITELLM_UPSTREAM_API_BASE');
    expect(config).toContain('api_key: os.environ/LITELLM_UPSTREAM_API_KEY');
    expect(config).toContain('master_key: os.environ/LITELLM_API_KEY');
  });
});
