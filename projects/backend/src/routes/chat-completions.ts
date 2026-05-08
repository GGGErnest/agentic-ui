/**
 * LiteLLM chat completions proxy route.
 */
import { Express, Request, Response } from 'express';
import { Readable } from 'stream';
import { BackendConfig } from '../config';

export function registerChatCompletionsRoute(app: Express, config: BackendConfig, fetchImpl: typeof fetch = fetch) {
  app.post('/api/chat/completions', async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization || '';
    const expectedAuth = `Bearer ${config.clientToken}`;

    if (authHeader !== expectedAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text();
        res.status(upstreamRes.status).send(errorText);
        return;
      }

      if (contentType.includes('text/event-stream')) {
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
        const responseText = await upstreamRes.text();
        res.setHeader('Content-Type', contentType);
        res.send(responseText);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });
}
