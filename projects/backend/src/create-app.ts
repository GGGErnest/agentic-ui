/**
 * Express app factory with core middleware and routes.
 */
import express, { Express } from 'express';
import cors from 'cors';
import { BackendConfig } from './config';
import { registerChatCompletionsRoute } from './routes/chat-completions';

export function createApp(config: BackendConfig, fetchImpl: typeof fetch = fetch): Express {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      litellmBaseUrl: config.litellmBaseUrl,
      litellmModel: config.litellmModel,
    });
  });

  // Register routes
  registerChatCompletionsRoute(app, config, fetchImpl);

  return app;
}
