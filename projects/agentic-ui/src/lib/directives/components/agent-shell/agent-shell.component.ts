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
  viewChild,
} from '@angular/core';

declare global {
  interface Window {
    Agent?: Record<string, () => unknown>;
  }
}
import { AgentHarness } from '../../../core/harness/agent-harness.service';
import { AgentWorldService } from '../../../core/world/agent-world.service';
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
  imports: [AgentApprovalDialogComponent, TelemetryOverlayComponent],
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

  constructor() {
    // Reactive Auto-Scrolling Effect tracking step history logs and thought streams
    effect(() => {
      this.harness.chatTurns();
      this.harness.steps();
      this.harness.thought();
      this.scrollToBottom();
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
