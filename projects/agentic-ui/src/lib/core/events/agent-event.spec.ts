import { describe, it, expect } from 'vitest';
import {
  AgentEvent,
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
  stepStarted,
  stepFinished,
  messagesSnapshot,
  isRunTerminal,
  isTextEvent,
  isToolEvent,
} from './agent-event.model';

describe('agent-event factories', () => {
  it('runStarted creates RUN_STARTED event with timestamps', () => {
    const e = runStarted({ threadId: 't1', runId: 'r1' });
    expect(e.type).toBe('RUN_STARTED');
    expect(e.threadId).toBe('t1');
    expect(e.runId).toBe('r1');
    expect(typeof e.timestamp).toBe('number');
  });

  it('runFinished accepts success outcome', () => {
    const e = runFinished({ threadId: 't1', runId: 'r1', outcome: 'success' });
    expect(e.type).toBe('RUN_FINISHED');
    expect(e.outcome).toBe('success');
  });

  it('runFinished accepts interrupt outcome with interrupts[]', () => {
    const e = runFinished({
      threadId: 't1',
      runId: 'r1',
      outcome: 'interrupt',
      interrupts: [{ id: 'i1', toolCallId: 'c1', reason: 'approval_required' }],
    });
    expect(e.outcome).toBe('interrupt');
    expect(e.interrupts).toHaveLength(1);
  });

  it('runError captures message and code', () => {
    const e = runError({ threadId: 't1', runId: 'r1', message: 'boom', code: 'EBOOM' });
    expect(e.type).toBe('RUN_ERROR');
    expect(e.message).toBe('boom');
    expect(e.code).toBe('EBOOM');
  });

  it('textMessageStart/Content/End share a messageId', () => {
    const start = textMessageStart({ messageId: 'm1', role: 'assistant' });
    const content = textMessageContent({ messageId: 'm1', delta: 'hello' });
    const end = textMessageEnd({ messageId: 'm1' });
    expect(start.messageId).toBe('m1');
    expect(content.messageId).toBe('m1');
    expect(end.messageId).toBe('m1');
  });

  it('toolCallStart/Args/End/Result share a toolCallId', () => {
    const start = toolCallStart({ toolCallId: 'c1', toolCallName: 'tbl__action__del' });
    const args = toolCallArgs({ toolCallId: 'c1', delta: '{"id":1}' });
    const end = toolCallEnd({ toolCallId: 'c1' });
    const result = toolCallResult({ toolCallId: 'c1', content: 'deleted', role: 'tool' });
    expect(start.toolCallId).toBe('c1');
    expect(args.toolCallId).toBe('c1');
    expect(end.toolCallId).toBe('c1');
    expect(result.toolCallId).toBe('c1');
  });

  it('toolCallResult carries content and role', () => {
    const e = toolCallResult({ toolCallId: 'c1', content: 'ok', role: 'tool' });
    expect(e.type).toBe('TOOL_CALL_RESULT');
    expect(e.content).toBe('ok');
    expect(e.role).toBe('tool');
  });

  it('stepStarted/Finished share a stepName', () => {
    const start = stepStarted({ stepName: 'reasoning' });
    const fin = stepFinished({ stepName: 'reasoning' });
    expect(start.stepName).toBe('reasoning');
    expect(fin.stepName).toBe('reasoning');
  });

  it('messagesSnapshot carries message array', () => {
    const e = messagesSnapshot({ messages: [{ id: 'm1', role: 'assistant', content: 'hi' }] });
    expect(e.messages).toHaveLength(1);
  });
});

describe('agent-event guards', () => {
  it('isRunTerminal true for RUN_FINISHED and RUN_ERROR', () => {
    expect(isRunTerminal(runFinished({ threadId: 't', runId: 'r', outcome: 'success' }))).toBe(true);
    expect(isRunTerminal(runError({ threadId: 't', runId: 'r', message: 'x' }))).toBe(true);
    expect(isRunTerminal(runStarted({ threadId: 't', runId: 'r' }))).toBe(false);
  });

  it('isTextEvent true for text message events', () => {
    expect(isTextEvent(textMessageStart({ messageId: 'm', role: 'assistant' }))).toBe(true);
    expect(isTextEvent(toolCallStart({ toolCallId: 'c', toolCallName: 'x' }))).toBe(false);
  });

  it('isToolEvent true for tool call and result events', () => {
    expect(isToolEvent(toolCallStart({ toolCallId: 'c', toolCallName: 'x' }))).toBe(true);
    expect(isToolEvent(toolCallResult({ toolCallId: 'c', content: 'x', role: 'tool' }))).toBe(true);
    expect(isToolEvent(textMessageStart({ messageId: 'm', role: 'assistant' }))).toBe(false);
  });

  it('guards narrow the union (compile-time check)', () => {
    const e: AgentEvent = textMessageContent({ messageId: 'm', delta: 'x' });
    if (isTextEvent(e)) {
      expect(e.messageId).toBe('m');
    } else {
      throw new Error('expected text event');
    }
    const e2: AgentEvent = toolCallResult({ toolCallId: 'c', content: 'x', role: 'tool' });
    if (isToolEvent(e2)) {
      expect(e2.content).toBe('x');
    } else {
      throw new Error('expected tool event');
    }
    const e3: AgentEvent = runFinished({ threadId: 't', runId: 'r', outcome: 'success' });
    if (isRunTerminal(e3)) {
      expect(e3.runId).toBe('r');
    } else {
      throw new Error('expected terminal event');
    }
  });
});
