/**
 * Angular dev-server proxy — forwards /api/* → local Express backend.
 *
 * This keeps the browser on same-origin /api requests, so LAN devices can hit
 * the Angular dev server without hard-coding localhost:3000 into the bundle.
 * The backend still owns auth and forwards to LiteLLM.
 *
 * Start:
 *   BACKEND_PORT=3100 npm run backend:dev
 *   npm start
 */

const BACKEND_TARGET = process.env.AGENTIC_UI_BACKEND_URL ?? 'http://127.0.0.1:3100';

console.log(`\n✓ agentic-ui dev proxy → ${BACKEND_TARGET}\n`);

export default {
  '/api': {
    target: BACKEND_TARGET,
    secure: false,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (err) => console.error('[Proxy Error]', err.message));
    },
  },
};
