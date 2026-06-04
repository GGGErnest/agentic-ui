import { describe, it, expect } from 'vitest';
import { AgentRunInput } from './agent-run.model';

describe('AgentRunInput', () => {
  it('requires threadId, runId, and messages', () => {
    const input: AgentRunInput = {
      threadId: 't1',
      runId: 'r1',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    };
    expect(input.threadId).toBe('t1');
  });

  it('accepts optional parentRunId and resume map', () => {
    const input: AgentRunInput = {
      threadId: 't1',
      runId: 'r2',
      parentRunId: 'r1',
      messages: [],
      resume: { i1: { decision: 'approved' } },
    };
    expect(input.parentRunId).toBe('r1');
  });
});
