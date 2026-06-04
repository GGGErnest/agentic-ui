import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgentApprovalService } from '../../core/approval/agent-approval.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-approval-dialog.component.html',
  styleUrl: './agent-approval-dialog.component.scss',
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

  paramKeys(params: Record<string, unknown>): string[] {
    return Object.keys(params);
  }

  formatParams(params: Record<string, unknown>): string {
    return JSON.stringify(params, null, 2);
  }
}
