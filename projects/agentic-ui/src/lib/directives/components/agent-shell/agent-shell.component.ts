import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  isDevMode,
  signal,
  Type,
  viewChild,
  WritableSignal,
} from '@angular/core';

declare global {
  interface Window {
    Agent?: Record<string, () => unknown>;
  }
}
import { AgentHarness } from '../../../core/harness/agent-harness.service';
import { AgentWorldService } from '../../../core/world/agent-world.service';
import { ToolNameCodec } from '../../../core/events/tool-name-codec';
import { ToolRenderContext } from '../../../core/world/agent-action.model';
import { AgentToolRendererComponent } from '../../../core/generative/agent-tool-renderer.component';
import { AgentApprovalDialogComponent } from '../../../components/approval-dialog/agent-approval-dialog.component';
import { TelemetryOverlayComponent } from '../telemetry-overlay/telemetry-overlay.component';

/**
 * AgentShellComponent — the floating UI window for agent interaction.
 *
 * Renders:
 * - Chat input for user prompts.
 * - Transparent thought stream.
 * - Step history with success/failure status.
 * - Approval dialog overlay (when agent requests destructive action).
 * - Shadow mode indicator + toggle.
 * - Exit button.
 */
@Component({
  selector: 'agui-agent-shell',
  standalone: true,
  imports: [AgentApprovalDialogComponent, TelemetryOverlayComponent, AgentToolRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-shell.component.html',
  styleUrl: './agent-shell.component.scss',
})
export class AgentShellComponent {
  readonly harness = inject(AgentHarness);
  readonly world = inject(AgentWorldService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stepsContainer = viewChild<ElementRef<HTMLElement>>('stepsContainer');

  userInput = signal<string>('');
  isExpanded = signal<boolean>(false);
  private abortController: AbortController | null = null;

  private readonly codec = new ToolNameCodec();
  private readonly renderContexts = new Map<string, WritableSignal<ToolRenderContext>>();

  readonly shadowActive = this.world.shadowMode;
  readonly focusedId = this.world.focusedEntryId;
  readonly visibleCount = computed(() => this.world.activeEntries().size);

  /** Context-aware prompt suggestions computed reactively based on visible components */
  readonly suggestions = computed(() => {
    const activeComponents = this.world.activeEntries();
    const prompts: string[] = [];

    for (const [id, entry] of activeComponents) {
      if (entry.role === 'DataTable') {
        prompts.push(`Summarize the ${id} table`);
        prompts.push(`Clear filter on ${id}`);
      } else if (entry.role === 'Toolbar Action') {
        prompts.push(`Add a high priority task for Alice`);
      }
    }
    if (prompts.length === 0) {
      prompts.push('Show me what actions are available');
    }
    return prompts.slice(0, 3);
  });

  readonly renderedToolCalls = computed(() => {
    return this.harness
      .state()
      .toolCalls.map((tc) => {
        const { entryId, actionName } = this.codec.decodeAction(tc.name);
        const entry = this.world.entries().get(entryId);
        const action = entry?.actions.find((a) => a.name === actionName);
        if (!action?.renderComponent) return null;

        let ctxSignal = this.renderContexts.get(tc.id);
        if (!ctxSignal) {
          ctxSignal = signal<ToolRenderContext>(this.buildRenderContext(tc, entryId, actionName));
          this.renderContexts.set(tc.id, ctxSignal);
        } else {
          ctxSignal.set(this.buildRenderContext(tc, entryId, actionName));
        }
        return {
          id: tc.id,
          componentType: action.renderComponent as Type<unknown>,
          renderInputs: action.renderInputs,
          contextSignal: ctxSignal,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });

  private buildRenderContext(
    tc: {
      args: string;
      status: 'pending' | 'executing' | 'complete' | 'error';
      result?: string;
      error?: string;
    },
    entryId: string,
    actionName: string,
  ): ToolRenderContext {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.args);
    } catch {
      /* malformed */
    }
    return {
      entryId,
      actionName,
      args,
      status: tc.status,
      result: tc.result,
      error: tc.error,
    };
  }

  constructor() {
    // Reactive Auto-Scrolling Effect tracking step history logs, thought streams,
    // and the reducer-projected shell state.
    effect(() => {
      this.harness.chatTurns();
      this.harness.steps();
      this.harness.thought();
      this.harness.state();
      this.scrollToBottom();
    });

    effect(() => {
      const liveIds = new Set(this.harness.state().toolCalls.map((tc) => tc.id));
      for (const id of [...this.renderContexts.keys()]) {
        if (!liveIds.has(id)) this.renderContexts.delete(id);
      }
    });

    // Dev-only: expose window.Agent debugger after first render.
    afterNextRender(() => {
      if (isDevMode() && typeof (globalThis as { vi?: unknown }).vi === 'undefined') {
        window.Agent = {
          snapshot: () => this.world.snapshot(),
          world: () => this.world.entries(),
          visible: () => this.world.activeEntries(),
          messages: () => this.harness.exportConversation().messages,
          system: () => this.harness.exportConversation().systemPrompt,
          steps: () => this.harness.steps(),
          state: () => this.harness.state(),
          status: () => ({
            isRunning: this.harness.isRunning(),
            isStable: this.world.isStable(),
            shadowMode: this.world.shadowMode(),
            focusedEntryId: this.world.focusedEntryId(),
            visibleCount: this.world.activeEntries().size,
          }),
        };
      }
    });
  }

  private readonly destroyEffect = this.destroyRef.onDestroy(() => {
    delete window.Agent;
  });

  get label(): string {
    if (this.harness.isRunning()) return 'Agent is thinking...';
    if (this.shadowActive()) return 'Agent (Shadow Mode)';
    return 'Agent';
  }

  async sendPrompt(): Promise<void> {
    const prompt = this.userInput().trim();
    if (!prompt || this.harness.isRunning()) return;

    this.userInput.set('');
    this.isExpanded.set(true);

    this.abortController = new AbortController();
    await this.harness.runCycle(prompt, { signal: this.abortController.signal });
  }

  /** Force stop agent execution loops instantly */
  interruptAgent(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  applySuggestion(prompt: string): void {
    this.userInput.set(prompt);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const ref = this.stepsContainer();
      if (ref) {
        const el = ref.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  toggleShadowMode(): void {
    this.world.shadowMode.update((v) => !v);
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
    if (!this.isExpanded()) {
      this.world.blur();
    }
  }

  reset(): void {
    this.harness.reset();
    this.isExpanded.set(false);
  }
}
