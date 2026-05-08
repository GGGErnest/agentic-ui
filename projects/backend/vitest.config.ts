import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [path.join(__dirname, 'src/**/*.spec.ts')]
  }
});
