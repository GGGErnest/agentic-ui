import type { AgentEvent } from '../events/agent-event.model';

/**
 * SSE frame boundary: events are separated by a blank line (\n\n).
 * Per the SSE spec, a single event can have multiple `data:` lines
 * (concatenated with \n) plus optional `event:`, `id:`, `retry:` lines.
 * For AG-UI we only consume `data:` lines.
 */

/**
 * Drains all complete SSE frames from the buffer, yielding events.
 * Returns the remainder (incomplete trailing frame) to be re-fed on the
 * next call. Performs runtime validation: only yields parsed objects
 * that have a string `type` field.
 *
 * Mutates `buffer` is NOT done — the caller owns the buffer.
 */
export function* drainSseFrames(buffer: string): Generator<AgentEvent, string> {
  let idx = buffer.indexOf('\n\n');
  let cursor = 0;
  while (idx !== -1) {
    const frame = buffer.slice(cursor, idx);
    cursor = idx + 2;
    const line = frame.split('\n').find((l) => l.startsWith('data: '));
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
        // skip malformed
      }
    }
    idx = buffer.indexOf('\n\n', cursor);
  }
  return buffer.slice(cursor);
}
