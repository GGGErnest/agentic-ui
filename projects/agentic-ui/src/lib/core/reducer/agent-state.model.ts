import { AgentEvent } from '../events/agent-event.model';

export type RunStatus = 'idle' | 'running' | 'finished' | 'errored' | 'interrupted';

export interface AgentMessageState {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  streaming: boolean;
}

export interface AgentToolCallState {
  id: string;
  name: string;
  args: string;
  status: 'pending' | 'executing' | 'complete' | 'error';
  result?: string;
  success?: boolean;
  error?: string;
}

export interface AgentRunState {
  threadId: string | null;
  runId: string | null;
  parentRunId: string | null;
  status: RunStatus;
  startedAt: number | null;
  finishedAt: number | null;
  errorMessage: string | null;
  interrupts: { id: string; toolCallId: string; reason: string }[];
}

export interface AgentTimelineState {
  run: AgentRunState;
  messages: AgentMessageState[];
  toolCalls: AgentToolCallState[];
  timeline: Array<{ kind: 'message' | 'tool'; id: string }>;
}

export const initialAgentTimelineState: AgentTimelineState = {
  run: {
    threadId: null,
    runId: null,
    parentRunId: null,
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    interrupts: [],
  },
  messages: [],
  toolCalls: [],
  timeline: [],
};

export type AgentEventReducer = (state: AgentTimelineState, event: AgentEvent) => AgentTimelineState;
