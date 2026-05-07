/**
 * AgentApprovalService — human-in-the-loop gate for destructive actions.
 *
 * When the harness dispatches an action marked `requiresApproval: true`,
 * the World pauses execution and pushes an ApprovalTicket to this service.
 * A UI component renders it. User approves or rejects. Execution resumes.
 *
 * Only one ticket at a time — sequential approval queue.
 */
import { Injectable, signal } from '@angular/core';

export interface ApprovalTicket {
  id: string;
  entryId: string;
  entryRole: string;
  actionName: string;
  actionDescription: string;
  params: Record<string, unknown> | undefined;
  resolve: (approved: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class AgentApprovalService {
  /** Current pending approval, or null when idle. */
  readonly pending = signal<ApprovalTicket | null>(null);

  /** Whether a ticket is currently awaiting user decision. */
  readonly isPending = signal<boolean>(false);

  /** Internal: request user approval. Returns Promise that resolves true/false. */
  requestApproval(
    entryId: string,
    entryRole: string,
    actionName: string,
    actionDescription: string,
    params?: Record<string, unknown>,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const ticket: ApprovalTicket = {
        id: crypto.randomUUID(),
        entryId,
        entryRole,
        actionName,
        actionDescription,
        params,
        resolve,
      };
      this.pending.set(ticket);
      this.isPending.set(true);
    });
  }

  /** User approved the current ticket. */
  approve(): void {
    this.resolveCurrent(true, 'Action approved by user.');
  }

  /** User rejected the current ticket. */
  reject(): void {
    this.resolveCurrent(false, 'Action rejected by user.');
  }

  private resolveCurrent(approved: boolean, message: string): void {
    const ticket = this.pending();
    if (!ticket) return;
    ticket.resolve(approved);
    this.pending.set(null);
    this.isPending.set(false);
  }
}
