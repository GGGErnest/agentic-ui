import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentHarness, AgentStep } from '../../../core/harness/agent-harness.service';
import { AgentWorldService } from '../../../core/world/agent-world.service';
import { AgentApprovalDialogComponent } from '../../../components/approval-dialog/agent-approval-dialog.component';

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
  imports: [CommonModule, AgentApprovalDialogComponent],
  template: `
    <!-- Approval dialog renders automatically when pending -->
    <agui-approval-dialog />

    <div class="agent-shell" [class.expanded]="isExpanded()">
      @if (!isExpanded()) {
        <!-- Collapsed: circular button -->
        <button class="agent-shell__toggle" (click)="toggleExpand()" [attr.title]="label">
          🤖
          @if (harness.isRunning()) {
            <span class="pulse"></span>
          }
        </button>
      } @else {
        <!-- Expanded: full chat interface -->
        <div class="agent-shell__panel">
          <!-- Header -->
          <div class="agent-shell__header">
            <span class="agent-shell__title">Agent</span>
            <div class="agent-shell__controls">
              <span class="agent-shell__badge" [class.shadow]="shadowActive()">
                {{ shadowActive() ? '🛡️ Shadow' : '⚡ Live' }}
              </span>
              <span class="agent-shell__badge">{{ visibleCount() }} visible</span>
              <button
                class="agent-shell__btn-icon"
                (click)="toggleShadowMode()"
                title="Toggle shadow mode"
              >
                🛡️
              </button>
              <button class="agent-shell__btn-icon" (click)="reset()" title="Reset conversation">
                ↺
              </button>
              <button class="agent-shell__btn-icon" (click)="toggleExpand()" title="Minimize">
                ✕
              </button>
            </div>
          </div>

          <!-- Step history -->
          @if (harness.steps().length > 0) {
            <div class="agent-shell__steps">
              <div class="agent-shell__steps-label">Steps ({{ harness.steps().length }})</div>
              @for (step of harness.steps(); track step.timestamp) {
                <div
                  class="agent-shell__step"
                  [class.failed]="step.result && step.result.toLowerCase().includes('error')"
                >
                  <div class="agent-shell__step-header">
                    <span class="agent-shell__step-action">
                      {{ step.action ?? 'Agent' }}
                    </span>
                    <span
                      class="agent-shell__step-status"
                      [class.success]="step.result && !step.result.toLowerCase().includes('error')"
                    >
                      {{
                        step.result
                          ? step.result.includes('Error') || step.result.includes('rejected')
                            ? '✗'
                            : '✓'
                          : ''
                      }}
                    </span>
                  </div>
                  @if (step.result) {
                    <div class="agent-shell__step-result">{{ step.result }}</div>
                  }
                </div>
              }
            </div>
          }

          <!-- Input area -->
          <div class="agent-shell__input">
            <input
              #inputEl
              class="agent-shell__input-field"
              [value]="userInput()"
              (input)="userInput.set(inputEl.value)"
              (keydown.enter)="sendPrompt()"
              placeholder="Ask the agent..."
              [disabled]="harness.isRunning()"
            />
            <button
              class="agent-shell__btn-send"
              (click)="sendPrompt()"
              [disabled]="!userInput().trim() || harness.isRunning()"
            >
              {{ harness.isRunning() ? '...' : 'Send' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .agent-shell__toggle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 1px solid #30363d;
        background: #161b22;
        color: #e6edf3;
        font-size: 22px;
        cursor: pointer;
        position: relative;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        transition: transform 150ms;
      }
      .agent-shell__toggle:hover {
        transform: scale(1.1);
      }
      .pulse {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #58a6ff;
        animation: pulse 1s infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      .agent-shell__panel {
        width: 380px;
        max-height: 520px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .agent-shell__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #21262d;
      }
      .agent-shell__title {
        font-weight: 600;
        color: #e6edf3;
        font-size: 14px;
      }
      .agent-shell__controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .agent-shell__badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        background: #21262d;
        color: #8b949e;
      }
      .agent-shell__badge.shadow {
        background: #3f2900;
        color: #d29922;
      }
      .agent-shell__btn-icon {
        background: none;
        border: none;
        color: #8b949e;
        cursor: pointer;
        font-size: 15px;
        padding: 4px;
        border-radius: 4px;
      }
      .agent-shell__btn-icon:hover {
        color: #e6edf3;
        background: #21262d;
      }

      .agent-shell__thought {
        padding: 10px 14px;
        background: #0d2950;
        border-bottom: 1px solid #21262d;
        max-height: 160px;
        overflow-y: auto;
      }
      .agent-shell__thought-label {
        font-size: 11px;
        color: #58a6ff;
        margin-bottom: 4px;
      }
      .agent-shell__thought-text {
        font-size: 13px;
        color: #c9d1d9;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .agent-shell__steps {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      .agent-shell__steps-label {
        font-size: 11px;
        color: #8b949e;
        padding: 4px 8px 8px;
      }
      .agent-shell__step {
        background: #161b22;
        border: 1px solid #21262d;
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 8px;
      }
      .agent-shell__step.failed {
        border-color: #da3633;
      }
      .agent-shell__step-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .agent-shell__step-action {
        font-size: 13px;
        font-weight: 600;
        color: #e6edf3;
        font-family: 'SF Mono', 'Fira Code', monospace;
      }
      .agent-shell__step-status {
        font-size: 14px;
      }
      .agent-shell__step-status.success {
        color: #3fb950;
      }
      .agent-shell__step.failed .agent-shell__step-status {
        color: #da3633;
      }
      .agent-shell__step-thought {
        font-size: 12px;
        color: #8b949e;
        margin-top: 4px;
        font-style: italic;
      }
      .agent-shell__step-result {
        font-size: 12px;
        color: #c9d1d9;
        margin-top: 6px;
        padding: 6px 8px;
        background: #0d1117;
        border-radius: 4px;
      }

      .agent-shell__input {
        display: flex;
        padding: 10px;
        border-top: 1px solid #21262d;
        gap: 8px;
      }
      .agent-shell__input-field {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
        border: 1px solid #30363d;
        border-radius: 8px;
        background: #161b22;
        color: #e6edf3;
        outline: none;
      }
      .agent-shell__input-field:focus {
        border-color: #58a6ff;
      }
      .agent-shell__input-field:disabled {
        opacity: 0.5;
      }
      .agent-shell__btn-send {
        padding: 8px 16px;
        background: #238636;
        color: #fff;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
      }
      .agent-shell__btn-send:hover {
        background: #2ea043;
      }
      .agent-shell__btn-send:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class AgentShellComponent {
  readonly harness = inject(AgentHarness);
  readonly world = inject(AgentWorldService);

  userInput = signal<string>('');
  isExpanded = signal<boolean>(false);

  readonly shadowActive = this.world.shadowMode;
  readonly focusedId = this.world.focusedEntryId;
  readonly visibleCount = computed(() => this.world.activeEntries().size);

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
    await this.harness.runCycle(prompt);
  }

  toggleShadowMode(): void {
    this.world.shadowMode.update((v) => !v);
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  reset(): void {
    this.harness.reset();
    this.isExpanded.set(false);
  }
}
