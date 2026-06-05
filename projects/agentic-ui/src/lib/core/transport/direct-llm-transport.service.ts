import { Injectable, inject } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { LLMProvider, LLMMessage, ToolCall } from '../harness/llm-provider.interface';
import { LLM_PROVIDER } from '../providers/llm-provider.token';
import { ToolNameCodec } from '../events/tool-name-codec';
import {
  AgentEvent,
  runStarted,
  runFinished,
  runError,
  stepStarted,
  stepFinished,
  textMessageStart,
  textMessageContent,
  textMessageEnd,
  toolCallStart,
  toolCallArgs,
  toolCallEnd,
  toolCallResult,
  stateSnapshot,
  stateDelta,
} from '../events/agent-event.model';
import { StateSnapshotService } from '../snapshot/state-snapshot.service';
import { AgentTransport } from './agent-transport.interface';
import type { AgentRunInput } from '../events/agent-run.model';

/**
 * DirectLLMTransport — the default AgentTransport implementation.
 *
 * Drives a ReAct-style loop locally against an LLMProvider, yielding
 * AG-UI-shaped events for each step. Does NOT push events to any external
 * log; the caller (AgentHarness in Task 5.3) wires the event stream into
 * the timeline reducer and persists messages.
 *
 * Approval/interrupt flow is intentionally out of scope here: actions are
 * executed directly via `world.executeAction`. The harness layer is
 * responsible for translating `RUN_FINISHED(outcome='interrupt')` into
 * the resumable approval protocol.
 */
@Injectable({ providedIn: 'root' })
export class DirectLLMTransport implements AgentTransport {
  private readonly llm = inject(LLM_PROVIDER);
  private readonly world = inject(AgentWorldService);
  private readonly codec = new ToolNameCodec();
  private readonly snapshotService = inject(StateSnapshotService);

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const { threadId, runId, messages: inputMessages, systemPrompt } = input;
    const messages: LLMMessage[] = inputMessages.map((m) => {
      const msg: LLMMessage = { role: m.role, content: m.content };
      if (m.toolCallId !== undefined) msg.tool_call_id = m.toolCallId;
      return msg;
    });

    yield runStarted({ threadId, runId });

    let previousState: Record<string, unknown> = {};
    const initial = await this.snapshotService.snapshot();
    previousState = initial.state;
    yield stateSnapshot({ state: initial.state, truncated: initial.truncated });

    const stepName = 'reasoning';
    try {
      yield stepStarted({ stepName });

      const snapshot = this.world.snapshot();
      const stream = this.llm.getStream(
        messages,
        snapshot.tools,
        systemPrompt ?? '',
        undefined,
      );

      const textDeltas: string[] = [];
      const toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        if ((chunk.type === 'content' || chunk.type === 'thought') && chunk.text) {
          textDeltas.push(chunk.text);
        } else if (chunk.type === 'tool_call' && chunk.data) {
          toolCalls.push(chunk.data);
        }
      }

      yield stepFinished({ stepName });

      if (textDeltas.length > 0) {
        const messageId = crypto.randomUUID();
        yield textMessageStart({ messageId, role: 'assistant' });
        for (const delta of textDeltas) {
          yield textMessageContent({ messageId, delta });
        }
        yield textMessageEnd({ messageId });
      }

      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          yield toolCallStart({
            toolCallId: toolCall.id,
            toolCallName: toolCall.function.name,
          });
          yield toolCallArgs({
            toolCallId: toolCall.id,
            delta: toolCall.function.arguments,
          });
          yield toolCallEnd({ toolCallId: toolCall.id });

          const { entryId, actionName } = this.codec.decodeAction(toolCall.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            /* arguments may be malformed */
          }

          const result = await this.world.executeAction(entryId, actionName, args);

          yield toolCallResult({
            toolCallId: toolCall.id,
            content: result.message,
            role: 'tool',
          });

          const diff = await this.snapshotService.snapshotAndDiff(previousState);
          previousState = diff.state;
          yield stateDelta({ deltas: diff.deltas });
        }
      }

      yield runFinished({ threadId, runId, outcome: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield stepFinished({ stepName });
      yield runError({ threadId, runId, message });
      yield runFinished({ threadId, runId, outcome: 'error' });
    }
  }
}
