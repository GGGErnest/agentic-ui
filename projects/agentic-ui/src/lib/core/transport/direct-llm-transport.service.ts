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
  type RunInterrupt,
} from '../events/agent-event.model';
import { StateSnapshotService } from '../snapshot/state-snapshot.service';
import { AgentTransport } from './agent-transport.interface';
import { AgentApprovalService } from '../approval/agent-approval.service';
import {
  InterruptRegistryService,
  type PendingInterrupt,
} from '../interrupt/interrupt-registry.service';
import type { AgentRunInput, ResumeDecision } from '../events/agent-run.model';

/**
 * DirectLLMTransport — the default AgentTransport implementation.
 *
 * Drives a ReAct-style loop locally against an LLMProvider, yielding
 * AG-UI-shaped events for each step. Does NOT push events to any external
 * log; the caller (AgentHarness) wires the event stream into the timeline
 * reducer and persists messages.
 *
 * `run` performs a multi-turn ReAct loop: it re-snapshots the world each turn,
 * dispatches the model's tool calls, feeds the results back as `tool` messages,
 * and loops until the model emits no tool calls or the cycle cap is reached.
 * This matches `AgentHarness.runCycle` semantics so `runWithEvents` and
 * `runCycle` behave consistently.
 *
 * Handles the full loop including the resumable interrupt flow:
 * - `run` streams LLM output, dispatches tool calls, and emits
 *   `RUN_FINISHED outcome='interrupt'` when an action requires approval,
 *   registering a `PendingInterrupt` for later resolution.
 * - `resume` consumes pending interrupts, executes the matched action for
 *   each `approved` decision, and emits the resulting `TOOL_CALL_RESULT`.
 */
@Injectable({ providedIn: 'root' })
export class DirectLLMTransport implements AgentTransport {
  private readonly llm = inject(LLM_PROVIDER);
  private readonly world = inject(AgentWorldService);
  private readonly codec = new ToolNameCodec();
  private readonly snapshotService = inject(StateSnapshotService);
  private readonly approval = inject(AgentApprovalService);
  private readonly interrupts = inject(InterruptRegistryService);

  /** Maximum reasoning turns in a single `run` before forcing termination. */
  private static readonly MAX_TURNS = 5;

  /**
   * Approval tickets created during `run`, keyed by `runId` then ticket id, so
   * concurrent runs across components never collide on a shared map. Each run's
   * bucket is consumed and removed during `resume`.
   */
  private readonly pendingApprovalPromises = new Map<string, Map<string, Promise<boolean>>>();

  private rememberApprovalPromise(
    runId: string,
    ticketId: string,
    promise: Promise<boolean>,
  ): void {
    let bucket = this.pendingApprovalPromises.get(runId);
    if (!bucket) {
      bucket = new Map<string, Promise<boolean>>();
      this.pendingApprovalPromises.set(runId, bucket);
    }
    bucket.set(ticketId, promise);
  }

  private takeApprovalPromise(runId: string, ticketId: string): Promise<boolean> | undefined {
    const bucket = this.pendingApprovalPromises.get(runId);
    const promise = bucket?.get(ticketId);
    if (bucket) {
      bucket.delete(ticketId);
      if (bucket.size === 0) this.pendingApprovalPromises.delete(runId);
    }
    return promise;
  }

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
      let turn = 0;
      while (turn < DirectLLMTransport.MAX_TURNS) {
        turn++;

        yield stepStarted({ stepName });

        // Re-snapshot tools each turn so the model sees the current world.
        const snapshot = this.world.snapshot();
        const stream = this.llm.getStream(messages, snapshot.tools, systemPrompt ?? '', undefined);

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

        const assistantText = textDeltas.join('');
        if (textDeltas.length > 0) {
          const messageId = crypto.randomUUID();
          yield textMessageStart({ messageId, role: 'assistant' });
          for (const delta of textDeltas) {
            yield textMessageContent({ messageId, delta });
          }
          yield textMessageEnd({ messageId });
        }

        // Mirror the assistant turn into the message history so the next turn
        // (and any tool results) form a valid conversation.
        const assistantMessage: LLMMessage = { role: 'assistant', content: assistantText };
        if (toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls.map((tc) => ({
            ...tc,
            type: 'function' as const,
          }));
        }
        if (assistantText || toolCalls.length > 0) {
          messages.push(assistantMessage);
        }

        // No tool calls -> the model is done.
        if (toolCalls.length === 0) {
          yield runFinished({ threadId, runId, outcome: 'success' });
          return;
        }

        let interrupted = false;
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

          const toolKind = this.codec.kind(toolCall.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            /* arguments may be malformed */
          }

          if (toolKind === 'write') {
            const { entryId, readableName } = this.codec.decodeReadable(toolCall.function.name);
            const result = await this.world.updateReadable(entryId, readableName, args['value']);

            yield toolCallResult({
              toolCallId: toolCall.id,
              content: result.message,
              role: 'tool',
            });
            messages.push({ role: 'tool', content: result.message, tool_call_id: toolCall.id });

            const diff = await this.snapshotService.snapshotAndDiff(previousState);
            previousState = diff.state;
            yield stateDelta({ deltas: diff.deltas });
            continue;
          }

          if (toolKind !== 'action') {
            const message = `Unsupported tool name "${toolCall.function.name}".`;
            yield toolCallResult({ toolCallId: toolCall.id, content: message, role: 'tool' });
            messages.push({ role: 'tool', content: message, tool_call_id: toolCall.id });
            continue;
          }

          const { entryId, actionName } = this.codec.decodeAction(toolCall.function.name);
          const entry = this.world.entries().get(entryId);
          const action = entry?.actions.find((a) => a.name === actionName);

          if (action?.requiresApproval) {
            const { id: ticketId, promise } = this.approval.requestApprovalTicket(
              entryId,
              entry?.role ?? '',
              actionName,
              action.description,
              args,
            );
            this.rememberApprovalPromise(runId, ticketId, promise);
            const pendingInterrupt: PendingInterrupt = {
              id: ticketId,
              toolCallId: toolCall.id,
              reason: 'approval_required',
              entryId,
              actionName,
              params: args,
            };
            this.interrupts.register({ runId, interrupt: pendingInterrupt });
            const runInterrupt: RunInterrupt = {
              id: ticketId,
              toolCallId: toolCall.id,
              reason: 'approval_required',
            };
            yield runFinished({
              threadId,
              runId,
              outcome: 'interrupt',
              interrupts: [runInterrupt],
            });
            interrupted = true;
            break;
          }

          const result = await this.world.executeAction(entryId, actionName, args);

          yield toolCallResult({
            toolCallId: toolCall.id,
            content: result.message,
            role: 'tool',
          });
          messages.push({ role: 'tool', content: result.message, tool_call_id: toolCall.id });

          const diff = await this.snapshotService.snapshotAndDiff(previousState);
          previousState = diff.state;
          yield stateDelta({ deltas: diff.deltas });
        }

        if (interrupted) return;
        // Tools ran; loop again so the model can observe the results.
      }

      // Reached the turn cap without the model settling — finish gracefully.
      yield runFinished({ threadId, runId, outcome: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield stepFinished({ stepName });
      yield runError({ threadId, runId, message });
      yield runFinished({ threadId, runId, outcome: 'error' });
    }
  }

  async *resume(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const { threadId, runId, parentRunId } = input;
    const decisions: Record<string, ResumeDecision> = input.resume ?? {};

    yield runStarted({ threadId, runId, parentRunId });

    const interruptIds = Object.keys(decisions);
    const consumeRunId = parentRunId ?? runId;
    const matched = this.interrupts.consume(consumeRunId, interruptIds);

    // Guard: decisions were supplied but none matched a pending interrupt. This
    // almost always means `parentRunId` was omitted or points at the wrong run.
    // Fail loudly instead of silently finishing "success" with no action taken.
    if (interruptIds.length > 0 && matched.length === 0) {
      yield runError({
        threadId,
        runId,
        message: `No pending interrupts matched for run "${consumeRunId}". Ensure resume() is called with parentRunId set to the interrupted run's id.`,
      });
      yield runFinished({ threadId, runId, parentRunId, outcome: 'error' });
      return;
    }

    let actionFailed = false;
    for (const interrupt of matched) {
      const decision = decisions[interrupt.id];
      if (!decision) continue;

      const toolName = `${interrupt.entryId}__action__${interrupt.actionName}`;
      yield toolCallStart({
        toolCallId: interrupt.toolCallId,
        toolCallName: toolName,
      });
      yield toolCallArgs({
        toolCallId: interrupt.toolCallId,
        delta: JSON.stringify(interrupt.params ?? {}),
      });
      yield toolCallEnd({ toolCallId: interrupt.toolCallId });

      if (decision.decision === 'approved') {
        const approvalPromise =
          this.takeApprovalPromise(consumeRunId, interrupt.id) ?? Promise.resolve(true);
        this.approval.resolveById(interrupt.id, true);
        const approved = await approvalPromise;
        if (approved) {
          const result = await this.executeApprovedAction(
            interrupt.entryId,
            interrupt.actionName,
            interrupt.params,
          );
          yield toolCallResult({
            toolCallId: interrupt.toolCallId,
            content: result.message,
            role: 'tool',
          });
          if (!result.success) actionFailed = true;
        } else {
          yield toolCallResult({
            toolCallId: interrupt.toolCallId,
            content: 'Action rejected by user.',
            role: 'tool',
          });
        }
      } else if (decision.decision === 'rejected') {
        this.takeApprovalPromise(consumeRunId, interrupt.id);
        this.approval.resolveById(interrupt.id, false);
        yield toolCallResult({
          toolCallId: interrupt.toolCallId,
          content: decision.reason ?? 'Action rejected by user.',
          role: 'tool',
        });
      } else {
        this.takeApprovalPromise(consumeRunId, interrupt.id);
        this.approval.resolveById(interrupt.id, false);
        yield toolCallResult({
          toolCallId: interrupt.toolCallId,
          content: JSON.stringify(decision.value ?? null),
          role: 'tool',
        });
      }
    }

    if (actionFailed) {
      yield runFinished({ threadId, runId, parentRunId, outcome: 'error' });
    } else {
      yield runFinished({ threadId, runId, parentRunId, outcome: 'success' });
    }
  }

  /**
   * Execute an action whose approval has already been resolved by the
   * caller (via the `resume` decision). Bypasses the world's approval gate
   * because the resume payload IS the approval.
   */
  private async executeApprovedAction(
    entryId: string,
    actionName: string,
    params: Record<string, unknown> | undefined,
  ): Promise<{ success: boolean; message: string }> {
    const entry = this.world.entries().get(entryId);
    const action = entry?.actions.find((a) => a.name === actionName);
    if (!entry || !action) {
      return {
        success: false,
        message: `Action "${actionName}" not found on entry "${entryId}".`,
      };
    }
    try {
      return await action.execute(params);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
