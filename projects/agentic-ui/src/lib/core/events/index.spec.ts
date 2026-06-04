import { runStarted, ToolNameCodec, type AgentRunInput } from './';

describe('events module barrel', () => {
  it('re-exports symbols from each public file', () => {
    expect(typeof runStarted).toBe('function');
    expect(typeof ToolNameCodec).toBe('function');
    const input: AgentRunInput = { threadId: 't1', runId: 'r1', messages: [] };
    expect(input.threadId).toBe('t1');
  });
});
