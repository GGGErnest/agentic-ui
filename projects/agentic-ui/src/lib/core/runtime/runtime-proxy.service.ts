import { Injectable } from '@angular/core';
import { runError } from '../events/agent-event.model';
import type { AgentEvent } from '../events/agent-event.model';
import type { AgentRunInput } from '../events/agent-run.model';

/**
 * RuntimeProxyService — browser-safe SSE proxy for AG-UI events.
 *
 * Streams AG-UI-shaped events from a server-side proxy endpoint. The
 * browser never holds LLM API keys; the proxy holds them server-side.
 *
 * For the lower-level AG-UI HTTP+SSE transport that implements the
 * `AgentTransport` interface, see `AgUiHttpTransport`.
 */
@Injectable({ providedIn: 'root' })
export class RuntimeProxyService {
  private endpoint = '/api/agent/run';
  private headers: Record<string, string> = { 'Content-Type': 'application/json' };

  setEndpoint(url: string): void {
    this.endpoint = url;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  async *streamEvents(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(input),
    });
    if (!response.ok || !response.body) {
      yield runError({
        threadId: input.threadId,
        runId: input.runId,
        message: `Proxy error ${response.status}`,
      });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const parsed: unknown = JSON.parse(line.slice(6));
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              'type' in parsed &&
              typeof (parsed as { type: unknown }).type === 'string'
            ) {
              yield parsed as AgentEvent;
            }
          } catch {
            // skip malformed
          }
        }
      }
      buffer += decoder.decode();
      if (buffer.trim().length > 0) {
        const line = buffer.split('\n').find((l) => l.startsWith('data: '));
        if (line) {
          try {
            const parsed: unknown = JSON.parse(line.slice(6));
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              'type' in parsed &&
              typeof (parsed as { type: unknown }).type === 'string'
            ) {
              yield parsed as AgentEvent;
            }
          } catch {
            // skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
