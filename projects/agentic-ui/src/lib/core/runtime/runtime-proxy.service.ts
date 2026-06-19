import { Injectable } from '@angular/core';
import { runError, runFinished } from '../events/agent-event.model';
import type { AgentEvent } from '../events/agent-event.model';
import type { AgentRunInput } from '../events/agent-run.model';
import { drainSseFrames } from '../transport/sse-parser';

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
  private headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  setEndpoint(url: string): void {
    this.endpoint = url;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  async *streamEvents(input: AgentRunInput, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const { threadId, runId } = input;

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(input),
        signal,
      });
    } catch (err) {
      const aborted = isAbortError(err);
      const message = aborted ? 'aborted' : err instanceof Error ? err.message : String(err);
      yield runError({ threadId, runId, message });
      yield runFinished({ threadId, runId, outcome: 'error' });
      return;
    }

    if (!response.ok || !response.body) {
      yield runError({
        threadId,
        runId,
        message: `Proxy error ${response.status}`,
      });
      yield runFinished({ threadId, runId, outcome: 'error' });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aborted = false;
    try {
      while (true) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = yield* drainSseFrames(buffer);
      }
      if (!aborted) {
        buffer += decoder.decode();
        buffer = yield* drainSseFrames(buffer);
      }
    } catch (err) {
      if (isAbortError(err)) {
        aborted = true;
      } else {
        throw err;
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }

    if (aborted) {
      yield runError({ threadId, runId, message: 'aborted' });
      yield runFinished({ threadId, runId, outcome: 'error' });
    }
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}
