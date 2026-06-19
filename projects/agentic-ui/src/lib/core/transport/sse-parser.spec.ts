import { drainSseFrames } from './sse-parser';
import type { AgentEvent } from '../events/agent-event.model';

function collect(buffer: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  const gen = drainSseFrames(buffer);
  let next = gen.next();
  while (!next.done) {
    events.push(next.value);
    next = gen.next();
  }
  return { events, rest: next.value };
}

describe('drainSseFrames', () => {
  it('parses a data: line with a leading space', () => {
    const { events } = collect('data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('RUN_STARTED');
  });

  it('parses a data: line without a leading space (#K1)', () => {
    const { events } = collect('data:{"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('RUN_STARTED');
  });

  it('concatenates multiple data: lines within one frame (#K1)', () => {
    // JSON split across two data lines, joined with "\n".
    const frame = 'data: {"type":"TEXT_MESSAGE_CONTENT",\ndata: "messageId":"m","delta":"hi"}\n\n';
    const { events } = collect(frame);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
    expect((events[0] as { delta: string }).delta).toBe('hi');
  });

  it('returns the incomplete trailing frame as the remainder', () => {
    const { events, rest } = collect(
      'data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\ndata: {"type":"RUN',
    );
    expect(events).toHaveLength(1);
    expect(rest).toBe('data: {"type":"RUN');
  });

  it('skips malformed JSON frames', () => {
    const { events } = collect('data: not json\n\n');
    expect(events).toHaveLength(0);
  });

  it('ignores non-data lines (event:, id:, retry:)', () => {
    const frame =
      'event: message\nid: 1\ndata: {"type":"RUN_FINISHED","threadId":"t","runId":"r","outcome":"success"}\n\n';
    const { events } = collect(frame);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('RUN_FINISHED');
  });
});
