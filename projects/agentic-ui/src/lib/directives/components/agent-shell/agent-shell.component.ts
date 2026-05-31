import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';

declare global {
  interface Window {
    Agent?: Record<string, () => unknown>;
  }
}
import { CommonModule } from '@angular/common';
import { AgentHarness, AgentStep, ChatTurn } from '../../../core/harness/agent-harness.service';
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
    <agui-approval-dialog />

    <div class="agent-shell" [class.expanded]="isExpanded()">
      @if (!isExpanded()) {
        <button class="agent-shell__toggle" (click)="toggleExpand()" [attr.title]="label">
          🤖
          @if (harness.isRunning()) {
            <span class="pulse"></span>
          }
        </button>
      } @else {
        <div class="agent-shell__panel">
          <div class="agent-shell__header">
            <span class="agent-shell__title">🤖 Agent Timeline Console</span>
            <div class="agent-shell__controls">
              <span class="agent-shell__badge" [class.shadow]="shadowActive()">
                {{ shadowActive() ? '🛡️ Shadow' : '⚡ Live' }}
              </span>
              <button class="agent-shell__btn-icon" (click)="toggleShadowMode()" title="Toggle shadow mode">🛡️</button>
              <button class="agent-shell__btn-icon" (click)="reset()" title="Reset conversation history">↺</button>
              <button class="agent-shell__btn-icon" (click)="toggleExpand()" title="Minimize">✕</button>
            </div>
          </div>

          <div class="agent-shell__steps" #stepsContainer>
            <div class="agent-shell__steps-label">Chat Thread</div>

            @if (!harness.isRunning() && harness.chatTurns().length === 0 && !harness.thought()) {
              <div class="agent-shell__empty-state">
                <p>System idle. Issue a statement or use a suggestion chip below to start.</p>
              </div>
            }

            @if (harness.isRunning() && harness.chatTurns().length === 0 && !harness.thought()) {
              <div class="agent-shell__loading-state">
                <div class="spinner-ring"></div>
                <p>Contacting proxy gateway & compiling structural context...</p>
              </div>
            }

            @for (turn of harness.chatTurns(); track turn.timestamp; let last = $last) {
              <div class="agent-shell__user-message">{{ turn.userMessage }}</div>

              @for (step of turn.steps; track step.timestamp) {
                <div class="agent-shell__step" [class.failed]="step.result && step.result.toLowerCase().includes('error')">
                  <div class="agent-shell__step-header">
                    <span class="agent-shell__step-action">
                      {{ step.action ? '⚙️ ' + step.action : '🧠 General Reasoning Task' }}
                    </span>
                    <span class="agent-shell__step-status" [class.success]="step.result && !step.result.toLowerCase().includes('error')">
                      {{ step.result ? (step.result.includes('Error') || step.result.includes('rejected') ? '✗ Failed' : '✓ Completed') : '' }}
                    </span>
                  </div>
                  @if (step.result) {
                    <div class="agent-shell__step-result">{{ step.result }}</div>
                  }
                </div>
              }

              @if (last && harness.isRunning() && turn.steps.length === 0 && !harness.thought()) {
                <div class="agent-shell__turn-loading">
                  <div class="spinner-ring"></div>
                </div>
              }

              @if (last && harness.thought(); as liveThought) {
                <div class="agent-shell__thought-stream">
                  <div class="agent-shell__thought-stream-header">
                    <span class="pulse-spark"></span>
                    <span class="label">Agent Stream Processing...</span>
                  </div>
                  <div class="agent-shell__thought-stream-body">{{ liveThought }}</div>
                </div>
              }
            }
          </div>

          @if (!harness.isRunning()) {
            <div class="agent-shell__suggestions-container">
              @for (chip of suggestions(); track chip) {
                <button class="agent-shell__suggestion-chip" (click)="applySuggestion(chip)">
                  💡 {{ chip }}
                </button>
              }
            </div>
          }

          <div class="agent-shell__input">
            <input
              #inputEl
              class="agent-shell__input-field"
              [value]="userInput()"
              (input)="userInput.set(inputEl.value)"
              (keydown.enter)="sendPrompt()"
              placeholder="Command the runtime agent..."
              [disabled]="harness.isRunning()"
            />
            
            @if (harness.isRunning()) {
              <button class="agent-shell__btn-interrupt" (click)="interruptAgent()">
                🛑 Stop
              </button>
            } @else {
              <button 
                class="agent-shell__btn-send" 
                (click)="sendPrompt()"
                [disabled]="!userInput().trim()"
              >
                Send
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }

    .agent-shell__toggle {
      width: 48px; height: 48px; border-radius: 50%; border: 1px solid #30363d;
      background: #161b22; color: #e6edf3; font-size: 22px; cursor: pointer;
      position: relative; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      transition: transform 150ms;
    }
    .agent-shell__toggle:hover { transform: scale(1.1); }
    .pulse {
      position: absolute; top: -2px; right: -2px; width: 10px; height: 10px;
      border-radius: 50%; background: #58a6ff; animation: pulse 1s infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    .agent-shell__panel {
      width: 380px; max-height: 520px; background: #0d1117; border: 1px solid #30363d;
      border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      display: flex; flex-direction: column; overflow: hidden;
    }

    .agent-shell__header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #21262d;
    }
    .agent-shell__title { font-weight: 600; color: #e6edf3; font-size: 14px; }
    .agent-shell__controls { display: flex; align-items: center; gap: 6px; }
    .agent-shell__badge {
      font-size: 11px; padding: 2px 8px; border-radius: 10px;
      background: #21262d; color: #8b949e;
    }
    .agent-shell__badge.shadow { background: #3f2900; color: #d29922; }
    .agent-shell__btn-icon {
      background: none; border: none; color: #8b949e; cursor: pointer;
      font-size: 15px; padding: 4px; border-radius: 4px;
    }
    .agent-shell__btn-icon:hover { color: #e6edf3; background: #21262d; }

    .agent-shell__thought {
      padding: 10px 14px; background: #0d2950; border-bottom: 1px solid #21262d;
      max-height: 160px; overflow-y: auto;
    }
    .agent-shell__thought-label { font-size: 11px; color: #58a6ff; margin-bottom: 4px; }
    .agent-shell__thought-text { font-size: 13px; color: #c9d1d9; line-height: 1.5; white-space: pre-wrap; }

    .agent-shell__steps { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; }
    .agent-shell__steps-label { font-size: 11px; color: #8b949e; padding: 4px 8px 8px; }
    .agent-shell__user-message {
      align-self: flex-end;
      background: #1f6feb;
      color: #e6edf3;
      border-radius: 12px 12px 2px 12px;
      padding: 8px 12px;
      font-size: 13px;
      max-width: 85%;
      margin-bottom: 8px;
      word-break: break-word;
    }
    .agent-shell__turn-loading {
      display: flex;
      align-items: center;
      padding: 8px 4px;
    }
    .agent-shell__step {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px;
      padding: 8px 12px; margin-bottom: 8px;
    }
    .agent-shell__step.failed { border-color: #da3633; }
    .agent-shell__step-header {
      display: flex; justify-content: space-between; align-items: center;
    }
    .agent-shell__step-action {
      font-size: 13px; font-weight: 600; color: #e6edf3;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .agent-shell__step-status { font-size: 14px; }
    .agent-shell__step-status.success { color: #3fb950; }
    .agent-shell__step.failed .agent-shell__step-status { color: #da3633; }
    .agent-shell__step-thought {
      font-size: 12px; color: #8b949e; margin-top: 4px; font-style: italic;
    }
    .agent-shell__step-result {
      font-size: 12px; color: #c9d1d9; margin-top: 6px;
      padding: 6px 8px; background: #0d1117; border-radius: 4px;
    }

    .agent-shell__input {
      display: flex; padding: 10px; border-top: 1px solid #21262d; gap: 8px;
    }
    .agent-shell__input-field {
      flex: 1; padding: 8px 12px; font-size: 13px; border: 1px solid #30363d;
      border-radius: 8px; background: #161b22; color: #e6edf3; outline: none;
    }
    .agent-shell__input-field:focus { border-color: #58a6ff; }
    .agent-shell__input-field:disabled { opacity: 0.5; }
    .agent-shell__btn-send {
      padding: 8px 16px; background: #238636; color: #fff; font-weight: 600;
      border: none; border-radius: 8px; cursor: pointer; font-size: 13px;
    }
    .agent-shell__btn-send:hover { background: #2ea043; }
    .agent-shell__btn-send:disabled { opacity: 0.5; cursor: default; }
      .agent-shell__btn-interrupt {
        padding: 8px 16px;
        background: #da3633;
        color: #fff;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
      }
      .agent-shell__btn-interrupt:hover {
        background: #f85149;
      }
      .agent-shell__empty-state {
        padding: 40px 20px;
        text-align: center;
        color: #8b949e;
        font-size: 13px;
      }
      .agent-shell__suggestions-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 12px;
        background: #161b22;
        border-top: 1px solid #21262d;
      }
      .agent-shell__suggestion-chip {
        text-align: left;
        background: #0d1117;
        border: 1px solid #30363d;
        color: #58a6ff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .agent-shell__suggestion-chip:hover {
        background: #21262d;
        border-color: #58a6ff;
        color: #c9d1d9;
      }
      .agent-shell__thought-stream {
        background: rgba(88, 166, 255, 0.05);
        border: 1px dashed #58a6ff;
        border-radius: 8px;
        padding: 10px 12px;
        margin-top: 4px;
      }
      .agent-shell__thought-stream-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .agent-shell__thought-stream-body {
        font-size: 12px;
        font-family: 'SF Mono', monospace;
        color: #8b949e;
        white-space: pre-wrap;
      }
      .pulse-spark {
        width: 6px;
        height: 6px;
        background: #58a6ff;
        border-radius: 50%;
        animation: spark-blink 1s infinite;
      }
      .agent-shell__loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 50px 20px;
        color: #58a6ff;
        font-size: 13px;
        gap: 16px;
        text-align: center;
      }
      .spinner-ring {
        width: 24px;
        height: 24px;
        border: 2.5px solid rgba(88, 166, 255, 0.1);
        border-radius: 50%;
        border-top-color: #58a6ff;
        animation: spin-loader 0.8s linear infinite;
      }
      @keyframes spin-loader {
        to { transform: rotate(360deg); }
      }
      @keyframes spark-blink {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(1.2); }
      }
    `,
  ],
})
export class AgentShellComponent implements OnInit, OnDestroy {
  readonly harness = inject(AgentHarness);
  readonly world = inject(AgentWorldService);

  @ViewChild('stepsContainer') private stepsContainer!: ElementRef<HTMLElement>;

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
        prompts.push(`Clear filters on ${id}`);
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
  }

  ngOnInit(): void {
    window.Agent = {
      snapshot: () => {
        const snap = this.world.snapshot();
        console.group('[Agent] snapshot()');
        console.log('context:\n' + snap.context);
        console.table(snap.tools.map((t) => ({ name: t.function.name, description: t.function.description })));
        console.groupEnd();
        return snap;
      },
      world: () => {
        const entries = this.world.entries();
        console.group('[Agent] world() — all registered entries');
        console.log(entries);
        console.groupEnd();
        return entries;
      },
      visible: () => {
        const active = this.world.activeEntries();
        console.group('[Agent] visible() — viewport-visible entries');
        console.log(active);
        console.groupEnd();
        return active;
      },
      messages: () => {
        const msgs = this.harness.exportConversation().messages;
        console.group('[Agent] messages() — LLM conversation history');
        console.log(msgs);
        console.groupEnd();
        return msgs;
      },
      system: () => {
        const prompt = this.harness.exportConversation().systemPrompt;
        console.group('[Agent] system() — system prompt');
        console.log(prompt);
        console.groupEnd();
        return prompt;
      },
      steps: () => {
        const s = this.harness.steps();
        console.group('[Agent] steps() — ReAct step history');
        console.log(s);
        console.groupEnd();
        return s;
      },
      status: () => {
        const st = {
          isRunning: this.harness.isRunning(),
          isStable: this.world.isStable(),
          shadowMode: this.world.shadowMode(),
          focusedEntryId: this.world.focusedEntryId(),
          visibleCount: this.world.activeEntries().size,
        };
        console.group('[Agent] status()');
        console.table(st);
        console.groupEnd();
        return st;
      },
    };
  }

  ngOnDestroy(): void {
    delete window.Agent;
  }

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
      if (this.stepsContainer) {
        const el = this.stepsContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  toggleShadowMode(): void {
    this.world.shadowMode.update(v => !v);
  }

  toggleExpand(): void {
    this.isExpanded.update(v => !v);
    if (!this.isExpanded()) {
      this.world.blur();
    }
  }

  reset(): void {
    this.harness.reset();
    this.isExpanded.set(false);
  }
}
