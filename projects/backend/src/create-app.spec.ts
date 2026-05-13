import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from './create-app';
import { BackendConfig } from './config';

describe('Backend App', () => {
  let app: Express;
  let config: BackendConfig;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      port: 3000,
      corsOrigin: 'http://localhost:4200',
      clientToken: 'agentic-ui-demo',
      litellmBaseUrl: 'http://localhost:8000/v1',
      litellmApiKey: 'litellm-local-key',
      litellmModel: 'agentic-demo',
    };
    mockFetch = vi.fn();
    app = createApp(config, mockFetch as unknown as typeof fetch);
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      litellmBaseUrl: 'http://localhost:8000/v1',
      litellmModel: 'agentic-demo',
    });
  });

  it('POST /api/chat/completions without bearer token returns 401', async () => {
    const res = await request(app).post('/api/chat/completions').send({
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('Authorized request passes client model through to LiteLLM', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'response' } }] })),
      body: null,
    });

    const res = await request(app)
      .post('/api/chat/completions')
      .set('Authorization', `Bearer ${config.clientToken}`)
      .set('Content-Type', 'application/json')
      .send({
        model: 'openrouter/gemini-flash-lite',
        messages: [{ role: 'user', content: 'test' }],
      });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.litellmApiKey}`,
        }),
        body: expect.stringContaining('"model":"openrouter/gemini-flash-lite"'),
      }),
    );
  });

  it('Authorized request falls back to configured model when client sends agentic-demo', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'response' } }] })),
      body: null,
    });

    const res = await request(app)
      .post('/api/chat/completions')
      .set('Authorization', `Bearer ${config.clientToken}`)
      .set('Content-Type', 'application/json')
      .send({
        model: 'agentic-demo',
        messages: [{ role: 'user', content: 'test' }],
      });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"agentic-demo"'),
      }),
    );
  });

  it('Authorized streaming request preserves text/event-stream response', async () => {
    const encoder = new TextEncoder();
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const readableStream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/event-stream']]),
      body: readableStream,
    });

    const res = await request(app)
      .post('/api/chat/completions')
      .set('Authorization', `Bearer ${config.clientToken}`)
      .set('Content-Type', 'application/json')
      .send({
        model: 'any',
        stream: true,
        messages: [{ role: 'user', content: 'test' }],
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.text).toContain('data:');
  });
});
