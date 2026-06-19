import { AgentEvent } from '../events/agent-event.model';
import {
  initialAgentTimelineState,
  type AgentMessageState,
  type AgentTimelineState,
  type AgentToolCallState,
} from './agent-state.model';

export function reduceAgentTimeline(
  state: AgentTimelineState,
  event: AgentEvent,
): AgentTimelineState {
  switch (event.type) {
    case 'RUN_STARTED': {
      return {
        ...state,
        run: {
          ...state.run,
          threadId: event.threadId,
          runId: event.runId,
          parentRunId: event.parentRunId ?? null,
          status: 'running',
          startedAt: event.timestamp,
          finishedAt: null,
          errorMessage: null,
          interrupts: [],
        },
      };
    }

    case 'RUN_FINISHED': {
      const nextStatus: AgentTimelineState['run']['status'] =
        event.outcome === 'success'
          ? 'finished'
          : event.outcome === 'interrupt'
            ? 'interrupted'
            : 'errored';
      return {
        ...state,
        run: {
          ...state.run,
          status: nextStatus,
          finishedAt: event.timestamp,
          interrupts: event.interrupts ?? state.run.interrupts,
        },
      };
    }

    case 'RUN_ERROR': {
      return {
        ...state,
        run: {
          ...state.run,
          status: 'errored',
          finishedAt: event.timestamp,
          errorMessage: event.message,
        },
      };
    }

    case 'TEXT_MESSAGE_START': {
      const existing = state.messages.find((m) => m.id === event.messageId);
      const newMessage: AgentMessageState = existing
        ? { ...existing, streaming: true }
        : {
            id: event.messageId,
            role: event.role,
            content: '',
            streaming: true,
          };
      const messages = existing
        ? state.messages.map((m) => (m.id === event.messageId ? newMessage : m))
        : [...state.messages, newMessage];
      return { ...state, messages };
    }

    case 'TEXT_MESSAGE_CONTENT': {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === event.messageId ? { ...m, content: m.content + event.delta } : m,
        ),
      };
    }

    case 'TEXT_MESSAGE_END': {
      const messages = state.messages.map((m) =>
        m.id === event.messageId ? { ...m, streaming: false } : m,
      );
      const hasMessage = state.timeline.some(
        (t) => t.kind === 'message' && t.id === event.messageId,
      );
      const timeline = hasMessage
        ? state.timeline
        : [...state.timeline, { kind: 'message' as const, id: event.messageId }];
      return { ...state, messages, timeline };
    }

    case 'TOOL_CALL_START': {
      const existing = state.toolCalls.find((t) => t.id === event.toolCallId);
      const newCall: AgentToolCallState = existing
        ? { ...existing, status: 'pending' }
        : {
            id: event.toolCallId,
            name: event.toolCallName,
            args: '',
            status: 'pending',
          };
      const toolCalls = existing
        ? state.toolCalls.map((t) => (t.id === event.toolCallId ? newCall : t))
        : [...state.toolCalls, newCall];
      return { ...state, toolCalls };
    }

    case 'TOOL_CALL_ARGS': {
      return {
        ...state,
        toolCalls: state.toolCalls.map((t) =>
          t.id === event.toolCallId ? { ...t, args: t.args + event.delta } : t,
        ),
      };
    }

    case 'TOOL_CALL_END': {
      return {
        ...state,
        toolCalls: state.toolCalls.map((t) =>
          t.id === event.toolCallId ? { ...t, status: 'executing' } : t,
        ),
      };
    }

    case 'TOOL_CALL_RESULT': {
      const failed = event.success === false;
      const toolCalls = state.toolCalls.map((t) =>
        t.id === event.toolCallId
          ? {
              ...t,
              status: (failed ? 'error' : 'complete') as AgentToolCallState['status'],
              result: event.content,
              success: !failed,
              ...(failed ? { error: event.content } : {}),
            }
          : t,
      );
      const hasTool = state.timeline.some((t) => t.kind === 'tool' && t.id === event.toolCallId);
      const timeline = hasTool
        ? state.timeline
        : [...state.timeline, { kind: 'tool' as const, id: event.toolCallId }];
      return { ...state, toolCalls, timeline };
    }

    case 'STEP_STARTED':
    case 'STEP_FINISHED':
    case 'MESSAGES_SNAPSHOT':
    case 'STATE_SNAPSHOT':
    case 'STATE_DELTA': {
      return state;
    }

    default: {
      // Exhaustiveness guard: if a new event type is added to the union without
      // a case here, this assignment fails to compile.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

export { initialAgentTimelineState };
