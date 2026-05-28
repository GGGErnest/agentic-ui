/**
 * AgentApprovalService — human-in-the-loop gate for destructive actions.
 *
 * When the harness dispatches an action marked `requiresApproval: true`,
 * the World pauses execution and pushes an ApprovalTicket to this service.
 * A UI component renders it. User approves or rejects. Execution resumes.
 *
 * Only one ticket at a time — sequential approval queue.
 */
import { Injectable, signal, computed } from '@angular/core';

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
  /** Internal queue array tracking sequential tickets */
  private readonly queue = signal<ApprovalTicket[]>([]);

  /** Current active pending approval target at front of queue */
  readonly pending = computed(() => this.queue()[0] || null);

  /** True when any authorization payload is unresolved */
  readonly isPending = computed(() => this.queue().length > 0);

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
      this.queue.update(items => [...items, ticket]);
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
    const items = this.queue();
    if (items.length === 0) return;
    
    const ticket = items[0];
    ticket.resolve(approved);
    
    // Shift queue forward to resolve memory leakage and blockages
    this.queue.update(list => list.slice(1));
  }
}
