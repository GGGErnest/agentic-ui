import { Component, signal, inject, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentApprovalService, ApprovalTicket } from '../../core/approval/agent-approval.service';

/**
 * AgentApprovalDialog — renders when agent requests user approval
 * for a destructive action (requiresApproval: true).
 *
 * Displays: entry name, action description, parameters.
 * User clicks Approve or Reject. Dialog closes, execution resumes.
 */
@Component({
  selector: 'agui-approval-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="approval-backdrop" (click)="onBackdropClick()">
        <div class="approval-dialog" (click)="$event.stopPropagation()">
          <div class="approval-dialog__header">
            <span class="approval-dialog__icon">⚠️</span>
            <span class="approval-dialog__title">Approval Required</span>
          </div>

          <div class="approval-dialog__body">
            <p class="approval-dialog__intro">
              Agent wants to execute a destructive action:
            </p>

            @if (ticket(); as t) {
              <div class="approval-dialog__detail">
                <div class="approval-dialog__row">
                  <span class="label">Component</span>
                  <span class="value">{{ t.entryRole }}</span>
                </div>
                <div class="approval-dialog__row">
                  <span class="label">Action</span>
                  <span class="value">{{ t.actionDescription }}</span>
                </div>
                @if (t.params && paramKeys(t.params).length > 0) {
                  <div class="approval-dialog__row">
                    <span class="label">Parameters</span>
                    <code class="value">{{ formatParams(t.params) }}</code>
                  </div>
                }
              </div>
            }
          </div>

          <div class="approval-dialog__actions">
            <button class="approval-dialog__btn approve" (click)="approve()">
              ✅ Approve
            </button>
            <button class="approval-dialog__btn reject" (click)="reject()">
              ❌ Reject
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .approval-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 150ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .approval-dialog {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: slideUp 200ms ease;
    }
    @keyframes slideUp {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .approval-dialog__header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 20px;
      border-bottom: 1px solid #30363d;
    }
    .approval-dialog__icon { font-size: 18px; }
    .approval-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #e6edf3;
    }

    .approval-dialog__body {
      padding: 16px 20px;
    }
    .approval-dialog__intro {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: #8b949e;
    }
    .approval-dialog__detail {
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 8px;
      overflow: hidden;
    }
    .approval-dialog__row {
      display: flex;
      padding: 10px 14px;
      border-bottom: 1px solid #21262d;
      gap: 12px;
    }
    .approval-dialog__row:last-child { border-bottom: none; }
    .approval-dialog__row .label {
      color: #8b949e;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      min-width: 80px;
      flex-shrink: 0;
    }
    .approval-dialog__row .value {
      font-size: 13px;
      color: #e6edf3;
      word-break: break-word;
    }
    .approval-dialog__row code.value {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      color: #79c0ff;
      background: none;
    }

    .approval-dialog__actions {
      display: flex;
      gap: 8px;
      padding: 12px 20px 16px;
    }
    .approval-dialog__btn {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid #30363d;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms;
    }
    .approval-dialog__btn.approve {
      background: #238636;
      color: #fff;
      border-color: #238636;
    }
    .approval-dialog__btn.approve:hover { background: #2ea043; }
    .approval-dialog__btn.reject {
      background: #21262d;
      color: #e6edf3;
    }
    .approval-dialog__btn.reject:hover { background: #30363d; }
  `],
})
export class AgentApprovalDialogComponent {
  private readonly approval = inject(AgentApprovalService);

  readonly ticket = this.approval.pending;
  readonly isVisible = this.approval.isPending;

  approve(): void {
    this.approval.approve();
  }

  reject(): void {
    this.approval.reject();
  }

  onBackdropClick(): void {
    // Reject on backdrop click for safety
    this.approval.reject();
  }

  protected paramKeys(params: Record<string, unknown>): string[] {
    return Object.keys(params);
  }

  protected formatParams(params: Record<string, unknown>): string {
    return JSON.stringify(params, null, 2);
  }
}
