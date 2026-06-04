import { describe, it, expect } from 'vitest';
import {
  initialAgentTimelineState,
  type AgentTimelineState,
} from './agent-state.model';
import { reduceAgentTimeline } from './agent-timeline-reducer';
import {
  runStarted,
  runFinished,
  runError,
  textMessageStart,
  textMessageContent,
  textMessageEnd,
  toolCallStart,
  toolCallArgs,
  toolCallEnd,
  toolCallResult,
} from '../events/agent-event.model';

describe('reduceAgentTimeline', () => {
  it('RUN_STARTED initializes run state', () => {
    const state = reduceAgentTimeline(
      initialAgentTimelineState,
      runStarted({ threadId: 't1', runId: 'r1' }),
    );
    expect(state.run.threadId).toBe('t1');
    expect(state.run.runId).toBe('r1');
    expect(state.run.status).toBe('running');
    expect(state.run.startedAt).toBeGreaterThan(0);
  });

  it('streams text content into a single message', () => {
    let s: AgentTimelineState = initialAgentTimelineState;
    s = reduceAgentTimeline(s, runStarted({ threadId: 't1', runId: 'r1' }));
    s = reduceAgentTimeline(s, textMessageStart({ messageId: 'm1', role: 'assistant' }));
    s = reduceAgentTimeline(s, textMessageContent({ messageId: 'm1', delta: 'Hello' }));
    s = reduceAgentTimeline(s, textMessageContent({ messageId: 'm1', delta: ' world' }));
    s = reduceAgentTimeline(s, textMessageEnd({ messageId: 'm1' }));
    const msg = s.messages.find((m) => m.id === 'm1')!;
    expect(msg.content).toBe('Hello world');
    expect(msg.streaming).toBe(false);
  });

  it('tracks tool call states through to result', () => {
    let s: AgentTimelineState = initialAgentTimelineState;
    s = reduceAgentTimeline(s, toolCallStart({ toolCallId: 'c1', toolCallName: 'tbl__action__del' }));
    s = reduceAgentTimeline(s, toolCallArgs({ toolCallId: 'c1', delta: '{"id":1}' }));
    s = reduceAgentTimeline(s, toolCallEnd({ toolCallId: 'c1' }));
    expect(s.toolCalls[0].status).toBe('executing');
    s = reduceAgentTimeline(
      s,
      toolCallResult({ toolCallId: 'c1', content: 'deleted', role: 'tool' }),
    );
    expect(s.toolCalls[0].status).toBe('complete');
    expect(s.toolCalls[0].result).toBe('deleted');
  });

  it('RUN_FINISHED outcome=interrupt populates interrupts and sets status=interrupted', () => {
    let s: AgentTimelineState = initialAgentTimelineState;
    s = reduceAgentTimeline(s, runStarted({ threadId: 't', runId: 'r' }));
    s = reduceAgentTimeline(
      s,
      runFinished({
        threadId: 't',
        runId: 'r',
        outcome: 'interrupt',
        interrupts: [{ id: 'i1', toolCallId: 'c1', reason: 'approval_required' }],
      }),
    );
    expect(s.run.status).toBe('interrupted');
    expect(s.run.interrupts).toHaveLength(1);
  });

  it('RUN_ERROR sets status=errored and stores message', () => {
    let s: AgentTimelineState = initialAgentTimelineState;
    s = reduceAgentTimeline(s, runStarted({ threadId: 't', runId: 'r' }));
    s = reduceAgentTimeline(s, runError({ threadId: 't', runId: 'r', message: 'boom' }));
    expect(s.run.status).toBe('errored');
    expect(s.run.errorMessage).toBe('boom');
  });

  it('does not mutate the input state', () => {
    const before = initialAgentTimelineState;
    const after = reduceAgentTimeline(before, runStarted({ threadId: 't', runId: 'r' }));
    expect(before.run.status).toBe('idle');
    expect(after.run.status).toBe('running');
    expect(after).not.toBe(before);
  });

  it('appends to timeline on TEXT_MESSAGE_END and TOOL_CALL_RESULT', () => {
    let s: AgentTimelineState = initialAgentTimelineState;
    s = reduceAgentTimeline(s, runStarted({ threadId: 't', runId: 'r' }));
    s = reduceAgentTimeline(s, textMessageStart({ messageId: 'm1', role: 'assistant' }));
    s = reduceAgentTimeline(s, textMessageContent({ messageId: 'm1', delta: 'hi' }));
    s = reduceAgentTimeline(s, textMessageEnd({ messageId: 'm1' }));
    expect(s.timeline).toEqual([{ kind: 'message', id: 'm1' }]);
  });
});
