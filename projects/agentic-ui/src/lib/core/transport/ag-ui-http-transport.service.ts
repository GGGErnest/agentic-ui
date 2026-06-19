import { AgentEvent, runError, runFinished } from '../events/agent-event.model';
import { AgentRunInput } from '../events/agent-run.model';
import { AgentTransport } from './agent-transport.interface';
import { drainSseFrames } from './sse-parser';

export interface AgUiHttpTransportConfig {
  endpoint: string;
  headers?: () => Record<string, string>;
}

/**
 * AgUiHttpTransport — AgentTransport that POSTs the run input to a
 * remote AG-UI compatible HTTP endpoint and parses the SSE response
 * stream into AgentEvent objects.
 *
 * The server is responsible for driving the agent loop; this transport
 * is a thin client that translates the wire format into the framework's
 * event model. `run` and `resume` are equivalent on the wire — the
 * server inspects the input (e.g. presence of `resume`) to decide
 * whether to start a new run or continue an interrupted one.
 */
export class AgUiHttpTransport implements AgentTransport {
  constructor(private readonly config: AgUiHttpTransportConfig) {}

  run(input: AgentRunInput, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    return this.postAndStream(input, signal);
  }

  resume(input: AgentRunInput, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    return this.postAndStream(input, signal);
  }

  private async *postAndStream(
    input: AgentRunInput,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const { threadId, runId } = input;

    let response: Response;
    try {
      response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.config.headers?.(),
        },
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

    if (!response.ok) {
      yield runError({
        threadId,
        runId,
        message: `HTTP ${response.status}: ${response.statusText}`,
      });
      yield runFinished({ threadId, runId, outcome: 'error' });
      return;
    }

    if (!response.body) {
      yield runError({ threadId, runId, message: 'No response body' });
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
      // Cancel the underlying body so the connection is released promptly.
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
