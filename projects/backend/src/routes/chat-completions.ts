/**
 * LiteLLM chat completions proxy route.
 */
import { Express, Request, Response } from 'express';
import { Readable } from 'stream';
import { BackendConfig } from '../config';

function log(level: 'info' | 'debug', configLogLevel: 'info' | 'debug', ...args: unknown[]) {
  if (level === 'debug' && configLogLevel !== 'debug') return;
  console.log('[chat]', ...args);
}

export function registerChatCompletionsRoute(app: Express, config: BackendConfig, fetchImpl: typeof fetch = fetch) {
  app.post('/api/chat/completions', async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization || '';
    const expectedAuth = `Bearer ${config.clientToken}`;

    if (authHeader !== expectedAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const startMs = Date.now();
    const bodyBytes = JSON.stringify(req.body).length;
    const messagesLen = req.body.messages?.length ?? 0;
    log('info', config.logLevel, `--> POST /api/chat/completions | messages: ${messagesLen} | model: ${config.litellmModel} | bodyBytes: ${bodyBytes}`);
    log('debug', config.logLevel, 'request body:', JSON.stringify(req.body, null, 2));

    try {
      const body = req.body;
      const forwardedBody = { ...body, model: config.litellmModel };

      const upstreamRes = await fetchImpl(`${config.litellmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.litellmApiKey}`,
        },
        body: JSON.stringify(forwardedBody),
      });

      const contentType = upstreamRes.headers.get('content-type') || '';
      const elapsed = Date.now() - startMs;
      log('debug', config.logLevel, 'upstream response headers:', Object.fromEntries(upstreamRes.headers.entries()));

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text();
        log('info', config.logLevel, `<-- ${upstreamRes.status} upstream error | elapsed: ${elapsed}ms | body: ${errorText}`);
        res.status(upstreamRes.status).send(errorText);
        return;
      }

      if (contentType.includes('text/event-stream')) {
        log('info', config.logLevel, `<-- 200 text/event-stream | upstream: ${config.litellmBaseUrl} | elapsed: ${elapsed}ms`);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        if (upstreamRes.body) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Readable.fromWeb(upstreamRes.body as any).pipe(res);
        } else {
          res.end();
        }
      } else {
        log('info', config.logLevel, `<-- 200 ${contentType} | upstream: ${config.litellmBaseUrl} | elapsed: ${elapsed}ms`);
        const responseText = await upstreamRes.text();
        res.setHeader('Content-Type', contentType);
        res.send(responseText);
      }
    } catch (err) {
      const elapsed = Date.now() - startMs;
      const message = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : '';
      log('info', config.logLevel, `!! ${message} | elapsed: ${elapsed}ms`);
      if (stack) log('debug', config.logLevel, stack);
      res.status(500).json({ error: message });
    }
  });
}
