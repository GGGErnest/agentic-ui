import { Injectable, signal, inject } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { LLMProvider, LLMMessage, ToolCall, LLMStreamChunk } from './llm-provider.interface';
import { LLM_PROVIDER } from '../providers/llm-provider.token';
import { ToolNameCodec } from '../events/tool-name-codec';
import {
  AgentEvent,
  runStarted,
  runFinished,
  textMessageStart,
  textMessageContent,
  textMessageEnd,
} from '../events/agent-event.model';

/** Single step result in the agent's reasoning chain. */
export interface AgentStep {
  thought: string;
  action: string | null;
  result: string | null;
  timestamp: number;
}

export interface ChatTurn {
  userMessage: string;
  steps: AgentStep[];
  timestamp: number;
}

/** Per-cycle configuration overrides. */
export interface RunCycleConfig {
  /** Max milliseconds before the cycle is aborted. Default: 60_000. */
  timeoutMs?: number;
  /** External AbortSignal (e.g., from a "stop" button). */
  signal?: AbortSignal;
  /** Maximum tool call dispatches in a single cycle. Default: 10. */
  maxSteps?: number;
}

/** Serializable conversation state for export/import. */
export interface ConversationHistory {
  systemPrompt: string;
  messages: LLMMessage[];
  steps: AgentStep[];
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_STEPS = 20;

/**
 * AgentHarness — the "Brain" of the Agentic-UI framework.
 *
 * Manages the ReAct (Reasoning + Acting) loop:
 * 1. Sends world snapshot + user prompt to LLM.
 * 2. Streams thought tokens for transparency.
 * 3. Dispatches tool calls to the World Registry.
 * 4. Waits for Angular stability before each observation.
 * 5. Maintains conversation history.
 */
@Injectable({ providedIn: 'root' })
export class AgentHarness {
  private readonly world = inject(AgentWorldService);
  private readonly llm = inject(LLM_PROVIDER);
  private readonly codec = new ToolNameCodec();

  /** Transparent thought stream exposed to the UI. */
  readonly thought = signal<string>('');

  /** History of completed steps for the UI. */
  readonly steps = signal<AgentStep[]>([]);

  /** Chat turns (user message + agent steps) for the UI. */
  readonly chatTurns = signal<ChatTurn[]>([]);

  private appendStepToCurrentTurn(step: AgentStep): void {
    this.steps.update((s) => [...s, step]);
    this.chatTurns.update((turns) => {
      if (turns.length === 0) return turns;
      const last = turns[turns.length - 1];
      return [...turns.slice(0, -1), { ...last, steps: [...last.steps, step] }];
    });
  }

  /** Whether the agent is currently running a cycle. */
  readonly isRunning = signal<boolean>(false);

  /** Full conversation history sent to the LLM. */
  private messages: LLMMessage[] = [];

  /** System prompt that establishes agent behavior. */
  private systemPrompt = '';

  // ---- Configuration ----

  /** Configure the system prompt for the agent. */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /** Reset the conversation history. */
  reset(): void {
    this.messages = [];
    this.thought.set('');
    this.steps.set([]);
    this.chatTurns.set([]);
    this.world.blur();
  }

  // ---- Conversation Export / Import ----

  /** Export the full conversation state for persistence. */
  exportConversation(): ConversationHistory {
    const BOUNDARY_LIMIT = 15;
    let slicedMessages = this.messages.slice(-BOUNDARY_LIMIT);

    // Repair loop: repeatedly strip invalid leading messages until the slice starts
    // with a valid turn boundary.  Two cases:
    //   1. Leading 'tool' message — its assistant-with-tool_calls was sliced away.
    //   2. Leading 'assistant' message with tool_calls — one or more of its 'tool'
    //      result messages were sliced away (occurs after importing pre-fix state).
    let repaired = true;
    while (repaired && slicedMessages.length > 0) {
      repaired = false;

      // Case 1: orphaned tool response
      if (slicedMessages[0].role === 'tool') {
        slicedMessages.shift();
        repaired = true;
        continue;
      }

      // Case 2: assistant with unsatisfied tool_calls
      const first = slicedMessages[0];
      if (first.role === 'assistant' && first.tool_calls && first.tool_calls.length > 0) {
        const satisfiedIds = new Set(
          slicedMessages
            .filter((m): m is LLMMessage & { tool_call_id: string } =>
              Boolean(m.role === 'tool' && m.tool_call_id),
            )
            .map((m) => m.tool_call_id),
        );
        const allSatisfied = first.tool_calls.every((tc) => satisfiedIds.has(tc.id));
        if (!allSatisfied) {
          slicedMessages.shift();
          repaired = true;
        }
      }
    }

    return {
      systemPrompt: this.systemPrompt,
      messages: slicedMessages,
      steps: this.steps().slice(-BOUNDARY_LIMIT),
    };
  }

  /** Import a previously exported conversation (replaces current state). */
  importConversation(history: ConversationHistory): void {
    this.systemPrompt = history.systemPrompt;
    this.messages = [...history.messages];
    this.steps.set([...history.steps]);
    this.thought.set('');
  }

  // ---- ReAct Cycle ----

  /**
   * Run one ReAct cycle: Perception → Reasoning → Action → Observation.
   * May execute multiple tool calls in a single LLM response.
   *
   * @throws If a cycle is already running (concurrency guard).
   */
  async runCycle(userPrompt: string, config: RunCycleConfig = {}): Promise<void> {
    // ---- Concurrency guard ----
    if (this.isRunning()) {
      return; // Silently ignore — UI should disable input while running
    }

    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxSteps = config.maxSteps ?? DEFAULT_MAX_STEPS;

    this.isRunning.set(true);
    this.thought.set('');

    try {
      // Add user message to history
      this.messages.push({ role: 'user', content: userPrompt });
      this.chatTurns.update((turns) => [
        ...turns,
        { userMessage: userPrompt, steps: [], timestamp: Date.now() },
      ]);

      let cycleCount = 0;
      const MAX_CYCLES = 5;
      let hasNextStep = true;

      while (hasNextStep && cycleCount < MAX_CYCLES) {
        cycleCount++;
        hasNextStep = false; // Loop terminates unless new tool dispatches occur

        // Get world snapshot for perception
        const snapshot = this.world.snapshot();

        // Per-call AbortController (merged with external signal if provided)
        const abort = new AbortController();
        if (config.signal) {
          config.signal.addEventListener('abort', () => abort.abort());
        }
        const timer = setTimeout(() => abort.abort(), timeoutMs);

        let toolCalls: ToolCall[] = [];

        try {
          const stream = this.llm.getStream(
            this.messages,
            snapshot.tools,
            this.systemPrompt,
            abort.signal,
          );

          for await (const chunk of stream) {
            // Accumulate both internal thought tokens and general text content tokens
            // to ensure conversational steps are preserved correctly across turns
            if ((chunk.type === 'thought' || chunk.type === 'content') && chunk.text) {
              this.thought.update((t) => t + chunk.text);
            }
            if (chunk.type === 'tool_call' && chunk.data) {
              toolCalls.push(chunk.data);
            }
          }
        } catch (error) {
          if ((error as Error)?.name !== 'AbortError') {
            throw error;
          }
        } finally {
          clearTimeout(timer);
        }

        if (abort.signal.aborted) {
          this.appendStepToCurrentTurn({
            thought: this.thought(),
            action: null,
            result: config.signal?.aborted
              ? 'Cycle aborted by user.'
              : `Cycle timed out after ${timeoutMs}ms waiting for LLM response.`,
            timestamp: Date.now(),
          });
          return;
        }

        // Cap dispatched tool calls first — assistant message must mirror exactly what is executed
        const dispatchable = toolCalls.slice(0, maxSteps);

        const thoughtText = this.thought();
        const assistantMessage: LLMMessage = { role: 'assistant', content: thoughtText };
        if (dispatchable.length > 0) {
          assistantMessage.tool_calls = dispatchable.map((tc) => ({
            ...tc,
            type: 'function' as const,
          }));
        }
        if (thoughtText || dispatchable.length > 0) {
          this.messages.push(assistantMessage);
        }
        for (const toolCall of dispatchable) {
          // Optimized check timeout threshold from 5s down to 500ms to ignore websocket / polling blocks
          await this.waitForStableWithTimeout(500);

          const { entryId, actionName } = this.codec.decodeAction(toolCall.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            /* arguments may be malformed */
          }

          let result = await this.world.executeAction(entryId, actionName, args);

          // Self-correcting reflective parsing logic: if the component action failed,
          // format the content payload to demand correction from the model on the next turn
          if (!result.success) {
            result = {
              ...result,
              message: `[EXECUTION CRITICAL FAILURE] Action failed validation rules. Reason: "${result.message}". Correction Guidance: Inspect your parameters layout, verify object identifiers match existing dataset snapshots exactly, and invoke the corrected call structure during the next action turn.`,
            };
          }

          // Record the step
          this.appendStepToCurrentTurn({
            thought: thoughtText,
            action: `${actionName}(${JSON.stringify(args)})`,
            result: result.message,
            timestamp: Date.now(),
          });

          // Trim payload payload length down to a maximum threshold limit before sending across to prompt buffer
          let serializedResult = JSON.stringify(result);
          if (serializedResult.length > 2500) {
            serializedResult =
              serializedResult.substring(0, 2500) +
              '... [OUTPUT TRUNCATED FOR TOKEN CONTEXT SAFETY]';
          }

          // Add tool result to conversation
          this.messages.push({
            role: 'tool',
            content: serializedResult,
            tool_call_id: toolCall.id,
          });

          // Short tracking validation buffer to maintain speed velocity
          await this.waitForStableWithTimeout(500);
        }

        // If no tool calls, the agent is done, break the while loop
        if (dispatchable.length === 0) {
          this.appendStepToCurrentTurn({
            thought: thoughtText,
            action: null,
            result: 'No action taken.',
            timestamp: Date.now(),
          });
          break;
        } else {
          // Tools were executed, continue loop to let LLM observe observation results
          hasNextStep = true;
          this.thought.set(''); // Reset temporary string buffer for the next iteration turn
        }
      } // <-- END OF REACT WHILE LOOP
    } catch (error) {
      this.appendStepToCurrentTurn({
        thought: '',
        action: null,
        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      });
    } finally {
      this.isRunning.set(false);
    }
  }

  // ---- AG-UI Event Stream ----

  /**
   * Run one LLM turn and return the AG-UI-shaped event stream for it.
   *
   * Minimum-viable text-only implementation: emits `RUN_STARTED`, streams
   * `TEXT_MESSAGE_*` events for `content` and `thought` chunks, and emits
   * `RUN_FINISHED` once the LLM produces no tool calls. Tool-dispatch event
   * emission is intentionally deferred to Task 1.4.
   *
   * @returns A flat array of emitted events. The first event is `RUN_STARTED`
   *          and, for a text-only run, the last is `RUN_FINISHED`.
   */
  async runWithEvents(userPrompt: string): Promise<AgentEvent[]> {
    const events: AgentEvent[] = [];
    const threadId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    events.push(runStarted({ threadId, runId }));

    const snapshot = this.world.snapshot();
    const stream = this.llm.getStream(this.messages, snapshot.tools, this.systemPrompt, undefined);

    const textDeltas: string[] = [];
    const toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      if ((chunk.type === 'content' || chunk.type === 'thought') && chunk.text) {
        textDeltas.push(chunk.text);
      } else if (chunk.type === 'tool_call' && chunk.data) {
        toolCalls.push(chunk.data);
      }
    }

    if (textDeltas.length > 0) {
      const messageId = crypto.randomUUID();
      events.push(textMessageStart({ messageId, role: 'assistant' }));
      for (const delta of textDeltas) {
        events.push(textMessageContent({ messageId, delta }));
      }
      events.push(textMessageEnd({ messageId }));
    }

    if (toolCalls.length === 0) {
      events.push(runFinished({ threadId, runId, outcome: 'success' }));
    }

    return events;
  }

  // ---- Stability (with timeout) ----

  private async waitForStableWithTimeout(timeoutMs: number): Promise<void> {
    try {
      await Promise.race([
        this.world.waitForStable(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stability timeout')), timeoutMs),
        ),
      ]);
    } catch {
      // Stability timeout is non-fatal — proceed anyway
    }
  }
}
