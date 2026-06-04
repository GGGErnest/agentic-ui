import { MessagesSnapshotMessage } from './agent-event.model';

export type ResumeDecision =
  | { decision: 'approved' }
  | { decision: 'rejected'; reason?: string }
  | { decision: 'value'; value: unknown };

export interface AgentRunInput {
  threadId: string;
  runId: string;
  parentRunId?: string;
  messages: MessagesSnapshotMessage[];
  /** Map of interrupt id -> decision when resuming an interrupted run. */
  resume?: Record<string, ResumeDecision>;
  /** Optional system prompt override. */
  systemPrompt?: string;
}
