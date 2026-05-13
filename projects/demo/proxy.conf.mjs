/**
 * Angular dev-server proxy — forwards /api/* → OpenRouter.
 *
 * Reads OPENROUTER_API_KEY from projects/demo/.env (gitignored).
 * The key is injected server-side by the proxy — NEVER exposed to the browser.
 *
 * Start:  npm start
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenvConfig({ path: resolve(__dirname, '.env') });

const KEY = process.env.OPENROUTER_API_KEY;

if (!KEY) {
  console.warn('\n⚠  OPENROUTER_API_KEY not set — create projects/demo/.env with your key.\n');
} else {
  console.log(`\n✓ OpenRouter proxy ready (key: ${KEY.slice(0, 12)}...)\n`);
}

export default {
  '/api': {
    target: 'https://openrouter.ai',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/api': '/api/v1' },
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        if (KEY) {
          proxyReq.setHeader('Authorization', `Bearer ${KEY}`);
          proxyReq.setHeader('HTTP-Referer', 'http://localhost:4200');
          proxyReq.setHeader('X-Title', 'agentic-ui-demo');
        }
      });
      proxy.on('error', (err) => console.error('[Proxy Error]', err.message));
    },
  },
};
