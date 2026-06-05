/**
 * AgentEvent — internal AG-UI-shaped event union for the agentic-ui framework.
 *
 * Event-type names and field shapes mirror `@ag-ui/core` v0.0.55 verbatim.
 * See `docs/superpowers/decisions/2026-06-04-ag-ui-event-source.md` for the
 * decision record (internal subset, no package dependency).
 */

import type { JsonPatchOp } from '../snapshot/json-patch.model';

export interface BaseEvent {
  type: string;
  timestamp: number;
  rawEvent?: unknown;
}

export interface RunStartedEvent extends BaseEvent {
  type: 'RUN_STARTED';
  threadId: string;
  runId: string;
  parentRunId?: string;
  input?: unknown;
}

export type RunFinishedOutcome = 'success' | 'interrupt' | 'error';

export interface RunInterrupt {
  id: string;
  toolCallId: string;
  reason: string;
}

export interface RunFinishedEvent extends BaseEvent {
  type: 'RUN_FINISHED';
  threadId: string;
  runId: string;
  result?: unknown;
  outcome: RunFinishedOutcome;
  interrupts?: RunInterrupt[];
}

export interface RunErrorEvent extends BaseEvent {
  type: 'RUN_ERROR';
  threadId: string;
  runId: string;
  message: string;
  code?: string;
}

export interface StepStartedEvent extends BaseEvent {
  type: 'STEP_STARTED';
  stepName: string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: 'STEP_FINISHED';
  stepName: string;
}

export interface TextMessageStartEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_START';
  messageId: string;
  role: 'assistant' | 'user' | 'system';
  name?: string;
}

export interface TextMessageContentEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_CONTENT';
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_END';
  messageId: string;
}

export interface ToolCallStartEvent extends BaseEvent {
  type: 'TOOL_CALL_START';
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: 'TOOL_CALL_ARGS';
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: 'TOOL_CALL_END';
  toolCallId: string;
}

export interface ToolCallResultEvent extends BaseEvent {
  type: 'TOOL_CALL_RESULT';
  messageId: string;
  toolCallId: string;
  content: string;
  role: 'tool' | 'assistant';
}

export interface MessagesSnapshotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface MessagesSnapshotEvent extends BaseEvent {
  type: 'MESSAGES_SNAPSHOT';
  messages: MessagesSnapshotMessage[];
}

export interface StateSnapshotEvent extends BaseEvent {
  type: 'STATE_SNAPSHOT';
  state: Record<string, unknown>;
  truncated?: string[];
}

export interface StateDeltaEvent extends BaseEvent {
  type: 'STATE_DELTA';
  deltas: JsonPatchOp[];
}

export type AgentEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | MessagesSnapshotEvent
  | StateSnapshotEvent
  | StateDeltaEvent;

// ---- Factories ----

function now(): number {
  return Date.now();
}

export function runStarted(input: {
  threadId: string;
  runId: string;
  parentRunId?: string;
  input?: unknown;
}): RunStartedEvent {
  return { type: 'RUN_STARTED', timestamp: now(), ...input };
}

export function runFinished(input: {
  threadId: string;
  runId: string;
  outcome: RunFinishedOutcome;
  result?: unknown;
  interrupts?: RunInterrupt[];
}): RunFinishedEvent {
  return { type: 'RUN_FINISHED', timestamp: now(), ...input };
}

export function runError(input: {
  threadId: string;
  runId: string;
  message: string;
  code?: string;
}): RunErrorEvent {
  return { type: 'RUN_ERROR', timestamp: now(), ...input };
}

export function stepStarted(input: { stepName: string }): StepStartedEvent {
  return { type: 'STEP_STARTED', timestamp: now(), ...input };
}

export function stepFinished(input: { stepName: string }): StepFinishedEvent {
  return { type: 'STEP_FINISHED', timestamp: now(), ...input };
}

export function textMessageStart(input: {
  messageId: string;
  role: 'assistant' | 'user' | 'system';
  name?: string;
}): TextMessageStartEvent {
  return { type: 'TEXT_MESSAGE_START', timestamp: now(), ...input };
}

export function textMessageContent(input: {
  messageId: string;
  delta: string;
}): TextMessageContentEvent {
  return { type: 'TEXT_MESSAGE_CONTENT', timestamp: now(), ...input };
}

export function textMessageEnd(input: { messageId: string }): TextMessageEndEvent {
  return { type: 'TEXT_MESSAGE_END', timestamp: now(), ...input };
}

export function toolCallStart(input: {
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}): ToolCallStartEvent {
  return { type: 'TOOL_CALL_START', timestamp: now(), ...input };
}

export function toolCallArgs(input: {
  toolCallId: string;
  delta: string;
}): ToolCallArgsEvent {
  return { type: 'TOOL_CALL_ARGS', timestamp: now(), ...input };
}

export function toolCallEnd(input: { toolCallId: string }): ToolCallEndEvent {
  return { type: 'TOOL_CALL_END', timestamp: now(), ...input };
}

export function toolCallResult(input: {
  toolCallId: string;
  content: string;
  role: 'tool' | 'assistant';
  messageId?: string;
}): ToolCallResultEvent {
  return {
    type: 'TOOL_CALL_RESULT',
    timestamp: now(),
    messageId: input.messageId ?? input.toolCallId,
    toolCallId: input.toolCallId,
    content: input.content,
    role: input.role,
  };
}

export function messagesSnapshot(input: {
  messages: MessagesSnapshotMessage[];
}): MessagesSnapshotEvent {
  return { type: 'MESSAGES_SNAPSHOT', timestamp: now(), ...input };
}

export function stateSnapshot(input: {
  state: Record<string, unknown>;
  truncated?: string[];
}): StateSnapshotEvent {
  return { type: 'STATE_SNAPSHOT', timestamp: now(), ...input };
}

export function stateDelta(input: { deltas: JsonPatchOp[] }): StateDeltaEvent {
  return { type: 'STATE_DELTA', timestamp: now(), ...input };
}

// ---- Guards ----

export function isRunTerminal(
  event: AgentEvent,
): event is RunFinishedEvent | RunErrorEvent {
  return event.type === 'RUN_FINISHED' || event.type === 'RUN_ERROR';
}

export function isTextEvent(
  event: AgentEvent,
): event is TextMessageStartEvent | TextMessageContentEvent | TextMessageEndEvent {
  return (
    event.type === 'TEXT_MESSAGE_START' ||
    event.type === 'TEXT_MESSAGE_CONTENT' ||
    event.type === 'TEXT_MESSAGE_END'
  );
}

export function isToolEvent(
  event: AgentEvent,
): event is ToolCallStartEvent | ToolCallArgsEvent | ToolCallEndEvent | ToolCallResultEvent {
  return (
    event.type === 'TOOL_CALL_START' ||
    event.type === 'TOOL_CALL_ARGS' ||
    event.type === 'TOOL_CALL_END' ||
    event.type === 'TOOL_CALL_RESULT'
  );
}

export function isStateEvent(
  event: AgentEvent,
): event is StateSnapshotEvent | StateDeltaEvent {
  return event.type === 'STATE_SNAPSHOT' || event.type === 'STATE_DELTA';
}
