import { Injectable } from '@angular/core';

export interface PendingInterrupt {
  id: string;
  toolCallId: string;
  reason: string;
  entryId: string;
  actionName: string;
  params: Record<string, unknown> | undefined;
}

/**
 * InterruptRegistryService — holds pending human-input gates keyed by runId.
 *
 * Phase 4 introduces a resumable interrupt flow: when the harness encounters
 * an approval-required action, it registers a `PendingInterrupt` here, emits
 * a `RUN_FINISHED` with `outcome: 'interrupt'`, and stops the run. A UI
 * component (or a future programmatic caller) resolves the interrupt by
 * calling `consume(runId, [interruptId])` and the harness's `resume(...)`
 * picks it up.
 */
@Injectable({ providedIn: 'root' })
export class InterruptRegistryService {
  private readonly store = new Map<string, PendingInterrupt[]>();

  register(input: { runId: string; interrupt: PendingInterrupt }): void {
    const list = this.store.get(input.runId) ?? [];
    list.push(input.interrupt);
    this.store.set(input.runId, list);
  }

  pending(runId: string): PendingInterrupt[] {
    return this.store.get(runId) ?? [];
  }

  consume(runId: string, interruptIds: string[]): PendingInterrupt[] {
    const list = this.store.get(runId) ?? [];
    const idSet = new Set(interruptIds);
    const matched: PendingInterrupt[] = [];
    const remaining: PendingInterrupt[] = [];
    for (const interrupt of list) {
      if (idSet.has(interrupt.id)) {
        matched.push(interrupt);
      } else {
        remaining.push(interrupt);
      }
    }
    if (remaining.length === 0) {
      this.store.delete(runId);
    } else {
      this.store.set(runId, remaining);
    }
    return matched;
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }
}
