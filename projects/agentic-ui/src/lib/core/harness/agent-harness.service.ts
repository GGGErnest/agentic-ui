import { Injectable, signal, inject, DestroyRef } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { LLMProvider, LLMMessage, ToolCall, LLMStreamChunk } from './llm-provider.interface';
import { LLM_PROVIDER } from '../providers/llm-provider.token';

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
const DEFAULT_MAX_STEPS = 10;

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
@Injectable()
export class AgentHarness {
  private readonly world = inject(AgentWorldService);
  private readonly llm = inject(LLM_PROVIDER);
  private readonly destroyRef = inject(DestroyRef);

  /** Transparent thought stream exposed to the UI. */
  readonly thought = signal<string>('');

  /** History of completed steps for the UI. */
  readonly steps = signal<AgentStep[]>([]);

  /** Chat turns (user message + agent steps) for the UI. */
  readonly chatTurns = signal<ChatTurn[]>([]);

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
    this.world.blur();
  }

  // ---- Conversation Export / Import ----

  /** Export the full conversation state for persistence. */
  exportConversation(): ConversationHistory {
    const BOUNDARY_LIMIT = 15;
    let slicedMessages = this.messages.slice(-BOUNDARY_LIMIT);

    // Safeguard for strict alternating providers (like DeepSeek): If the truncation
    // slice cuts mid-turn and leaves an orphaned 'tool' role response at the front
    // of the history without its preceding 'tool_calls', shift the boundary past it.
    while (slicedMessages.length > 0 && slicedMessages[0].role === 'tool') {
      slicedMessages.shift();
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
        } finally {
          clearTimeout(timer);
        }

        // If aborted externally (by signal, not timeout)
        if (abort.signal.aborted && config.signal?.aborted) {
          this.steps.update((s) => [
            ...s,
            {
              thought: this.thought(),
              action: null,
              result: 'Cycle aborted by user.',
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        const thoughtText = this.thought();
        if (thoughtText) {
          this.messages.push({ role: 'assistant', content: thoughtText });
        }

        // Dispatch tool calls (capped by maxSteps)
        const dispatchable = toolCalls.slice(0, maxSteps);
        for (const toolCall of dispatchable) {
          // Optimized check timeout threshold from 5s down to 500ms to ignore websocket / polling blocks
          await this.waitForStableWithTimeout(500);

          const { entryId, actionName } = this.parseToolName(toolCall.function.name);
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
          this.steps.update((s) => [
            ...s,
            {
              thought: thoughtText,
              action: `${actionName}(${JSON.stringify(args)})`,
              result: result.message,
              timestamp: Date.now(),
            },
          ]);

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
          this.steps.update((s) => [
            ...s,
            {
              thought: thoughtText,
              action: null,
              result: 'No action taken.',
              timestamp: Date.now(),
            },
          ]);
          break;
        } else {
          // Tools were executed, continue loop to let LLM observe observation results
          hasNextStep = true;
          this.thought.set(''); // Reset temporary string buffer for the next iteration turn
        }
      } // <-- END OF REACT WHILE LOOP
    } catch (error) {
      this.steps.update((s) => [
        ...s,
        {
          thought: '',
          action: null,
          result: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      this.isRunning.set(false);
    }
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

  // ---- Tool Name Parsing ----

  /** Parse "entryId__actionName" back into components. */
  private parseToolName(fullName: string): { entryId: string; actionName: string } {
    const lastSep = fullName.lastIndexOf('__');
    if (lastSep === -1) {
      return { entryId: 'unknown', actionName: fullName };
    }
    return {
      entryId: fullName.substring(0, lastSep),
      actionName: fullName.substring(lastSep + 2),
    };
  }
}
