/**
 * OpenAiProvider — unit tests.
 * Tests streaming SSE parsing, tool call accumulation,
 * error handling, and provider configuration.
 */
import { OpenAiProvider, OpenAiProviderConfig } from './openai-provider.service';
import { LLMMessage, LLMStreamChunk, ToolCall } from '../../core/harness/llm-provider.interface';
import { ToolDefinition } from '../../core/world/world-entry.interface';

// ---- Helpers ----

function createMockFetch(streamChunks: string[], status = 200) {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const readableStream = new ReadableStream({
    start(controller) {
      for (const chunk of streamChunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(streamChunks.join('')),
    body: readableStream,
    headers: new Headers(),
  } as unknown as Response);
}

function createConfig(overrides: Partial<OpenAiProviderConfig> = {}): OpenAiProviderConfig {
  return {
    apiKey: 'test-key-123',
    model: 'gpt-4o',
    ...overrides,
  };
}

function sampleTools(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'btn__click',
        description: 'Click the button',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];
}

function sampleMessages(): LLMMessage[] {
  return [{ role: 'user', content: 'Click the button' }];
}

// ---- Tests ----

describe('OpenAiProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== Configuration ==========

  describe('configuration', () => {
    it('should use defaults when only apiKey provided', () => {
      const provider = new OpenAiProvider({ apiKey: 'sk-123' });
      // Access private fields via cast to any for testing
      const internal = provider as any;
      expect(internal.apiKey).toBe('sk-123');
      expect(internal.model).toBe('gpt-4o');
      expect(internal.maxTokens).toBe(4096);
      expect(internal.temperature).toBe(0.1);
      expect(internal.apiUrl).toBe('https://api.openai.com/v1');
    });

    it('should strip trailing slash from apiUrl', () => {
      const provider = new OpenAiProvider({
        apiKey: 'sk-123',
        apiUrl: 'https://custom.ai/v1/',
      });
      expect((provider as any).apiUrl).toBe('https://custom.ai/v1');
    });

    it('should accept full custom config', () => {
      const provider = new OpenAiProvider({
        apiKey: 'sk-custom',
        model: 'gpt-3.5-turbo',
        maxTokens: 1024,
        temperature: 0.5,
        apiUrl: 'https://api.anthropic.com/v1',
      });
      const internal = provider as any;
      expect(internal.model).toBe('gpt-3.5-turbo');
      expect(internal.maxTokens).toBe(1024);
      expect(internal.temperature).toBe(0.5);
    });
  });

  // ========== Streaming ==========

  describe('getStream', () => {
    it('should yield thought chunks for text content', async () => {
      createMockFetch([
        'data: {"choices":[{"delta":{"content":"Let"}}]}\n',
        'data: {"choices":[{"delta":{"content":" me think"}}]}\n',
        'data: [DONE]\n',
      ]);

      const provider = new OpenAiProvider(createConfig());
      const chunks: LLMStreamChunk[] = [];

      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'thought', text: 'Let' });
      expect(chunks[1]).toEqual({ type: 'thought', text: ' me think' });
    });

    it('should yield tool call chunks', async () => {
      createMockFetch([
        'data: {"choices":[{"delta":{"content":"I will click","tool_calls":[{"index":0,"function":{"name":"btn__click","arguments":"{}"}}]}}]}\n',
        'data: [DONE]\n',
      ]);

      const provider = new OpenAiProvider(createConfig());
      const chunks: LLMStreamChunk[] = [];

      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      // Should get 2 chunks: thought + tool_call
      expect(chunks.length).toBe(2);
      expect(chunks.find(c => c.type === 'thought')).toBeDefined();
      expect(chunks.find(c => c.type === 'tool_call')).toBeDefined();
    });

    it('should accumulate tool call arguments across stream chunks', async () => {
      createMockFetch([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"btn__click","arguments":"{\\"x\\":1"}}]}}]}\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":",\\"y\\":2}"}}]}}]}\n',
        'data: [DONE]\n',
      ]);

      const provider = new OpenAiProvider(createConfig());
      const chunks: LLMStreamChunk[] = [];

      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      const toolCalls = chunks.filter(c => c.type === 'tool_call');
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].data!.function.arguments).toBe('{"x":1,"y":2}');
    });

    it('should handle multiple tool calls', async () => {
      createMockFetch([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a__action1","arguments":"{}"}},{"index":1,"id":"c2","function":{"name":"b__action2","arguments":"{\\"k\\":\\"v\\"}"}}]}}]}\n',
        'data: [DONE]\n',
      ]);

      const provider = new OpenAiProvider(createConfig());
      const chunks: LLMStreamChunk[] = [];

      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      const toolCalls = chunks.filter(c => c.type === 'tool_call');
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].data!.function.name).toBe('a__action1');
      expect(toolCalls[1].data!.function.name).toBe('b__action2');
    });

    it('should send correct HTTP request', async () => {
      createMockFetch(['data: [DONE]\n']);

      const provider = new OpenAiProvider(createConfig());
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const tools = sampleTools();

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of provider.getStream(messages, tools)) {
        chunks.push(chunk);
      }

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (fetch as any).mock.calls[0];

      expect(url).toContain('/chat/completions');
      expect(init.headers['Authorization']).toBe('Bearer test-key-123');
      expect(init.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.stream).toBe(true);
      expect(body.messages[1].content).toBe('Hello'); // + system message
    });

    it('should include system prompt when provided', async () => {
      createMockFetch(['data: [DONE]\n']);

      const provider = new OpenAiProvider(createConfig());

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of provider.getStream(
        sampleMessages(),
        sampleTools(),
        'You are a test bot.'
      )) {
        chunks.push(chunk);
      }

      const [, init] = (fetch as any).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('You are a test bot.');
    });

    it('should use default agentic system prompt when none provided', async () => {
      createMockFetch(['data: [DONE]\n']);

      const provider = new OpenAiProvider(createConfig());

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      const [, init] = (fetch as any).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.messages[0].content).toContain('AI agent controlling a web application');
    });

    it('should omit tools from body when no tools provided', async () => {
      createMockFetch(['data: [DONE]\n']);

      const provider = new OpenAiProvider(createConfig());

      for await (const _ of provider.getStream(sampleMessages(), [])) {
        // consume
      }

      const [, init] = (fetch as any).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
    });
  });

  // ========== Error Handling ==========

  describe('error handling', () => {
    it('should throw on non-200 HTTP response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      });

      const provider = new OpenAiProvider(createConfig());

      await expect(async () => {
        for await (const _ of provider.getStream(sampleMessages(), sampleTools())) {
          // consume
        }
      }).rejects.toThrow('401');
    });

    it('should handle malformed SSE chunks gracefully', async () => {
      createMockFetch([
        'data: {this is not json}\n',
        'data: {"choices":[{"delta":{"content":"good"}}]}\n',
        'data: [DONE]\n',
      ]);

      const provider = new OpenAiProvider(createConfig());
      const chunks: LLMStreamChunk[] = [];

      for await (const chunk of provider.getStream(sampleMessages(), sampleTools())) {
        chunks.push(chunk);
      }

      // Should skip the malformed chunk and continue
      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('thought');
    });
  });

  // ========== provideOpenAi factory ==========

  describe('provideOpenAi factory', () => {
    it('should create an OpenAiProvider instance', async () => {
      const { provideOpenAi } = await import('./openai-provider.service');
      const provider = provideOpenAi({ apiKey: 'sk-42' });
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });
  });
});
