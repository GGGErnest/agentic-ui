import { Injectable, signal, computed, ApplicationRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { WorldEntry, WorldSnapshot, ToolDefinition, SnapshotConfig } from './world-entry.interface';
import { AgentAction, AgentActionResult, ActionParameter } from './agent-action.model';
import { AgentApprovalService } from '../approval/agent-approval.service';

/**
 * AgentWorldService — the "Sensory Cortex" of the Agentic-UI framework.
 *
 * Maintains a Signal-based map of all registered UI components.
 * Uses IntersectionObserver for contextual scoping — only components
 * in the active viewport are reported to the LLM, preventing token bloat.
 *
 * Implements Shadow Mode: when enabled, actions are intercepted and
 * simulated instead of executed.
 */
@Injectable({ providedIn: 'root' })
export class AgentWorldService {
  // ---- Internal state ----
  private readonly _entries = signal<Map<string, WorldEntry>>(new Map());
  private readonly visibleIds = signal<Set<string>>(new Set());
  private observer: IntersectionObserver | null = null;
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly approval = inject(AgentApprovalService);

  // ---- Public signals ----

  /** All registered entries (even invisible ones). */
  readonly entries = this._entries.asReadonly();

  /** IDs of entries currently in the viewport. */
  readonly visibleEntryIds = this.visibleIds.asReadonly();

  /** Only entries visible in the viewport (contextual scoping). */
  readonly activeEntries = computed(() => {
    const all = this._entries();
    const visible = this.visibleIds();
    const result = new Map<string, WorldEntry>();
    for (const id of visible) {
      const entry = all.get(id);
      if (entry) result.set(id, entry);
    }
    return result;
  });

  /** Shadow Mode: when true, execute() is intercepted and simulated. */
  readonly shadowMode = signal<boolean>(false);

  /** Currently focused entry (for telemetry highlighting). */
  readonly focusedEntryId = signal<string | null>(null);

  /** Whether the Angular application is stable. */
  readonly isStable = signal<boolean>(true);

  // ---- Stability tracking ----
  private readonly stable$ = new BehaviorSubject<boolean>(true);

  constructor() {
    this.setupIntersectionObserver();
    this.setupStabilityTracking();
  }

  // ---- Registration ----

  /** Register a component in the world. Called by [agentic] directive on init. */
  register(entry: WorldEntry): void {
    this._entries.update(map => {
      const next = new Map(map);
      next.set(entry.id, entry);
      return next;
    });

    if (entry.element && this.observer) {
      this.observer.observe(entry.element);
    }
  }

  /** Unregister a component. Called by [agentic] directive on destroy. */
  unregister(id: string): void {
    this._entries.update(map => {
      const next = new Map(map);
      const entry = next.get(id);
      if (entry?.element && this.observer) {
        this.observer.unobserve(entry.element);
      }
      next.delete(id);
      return next;
    });
    this.visibleIds.update(s => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  // ---- Actions ----

  /** Focus the agent's attention on a specific entry (triggers telemetry highlight). */
  focus(id: string): void {
    this.focusedEntryId.set(id);
  }

  /** Clear focus. */
  blur(): void {
    this.focusedEntryId.set(null);
  }

  /** Execute an action on a registered entry. Respects shadow mode and approval gates. */
  async executeAction(
    entryId: string,
    actionName: string,
    params?: Record<string, unknown>
  ): Promise<AgentActionResult> {
    const entry = this._entries().get(entryId);
    if (!entry) {
      return { success: false, message: `Entry "${entryId}" not found in world registry.` };
    }

    const action = entry.actions.find(a => a.name === actionName);
    if (!action) {
      return {
        success: false,
        message: `Action "${actionName}" not found on entry "${entryId}". Available: ${entry.actions.map(a => a.name).join(', ')}`,
      };
    }

    this.focus(entryId);

    if (this.shadowMode()) {
      return {
        success: true,
        message: `[SHADOW] Simulated execution of "${actionName}" on "${entryId}"`,
        data: { simulated: true, params },
      };
    }

    // Approval gate — pause for human confirmation on destructive actions
    if (action.requiresApproval) {
      const approved = await this.approval.requestApproval(
        entryId,
        entry.role,
        actionName,
        action.description,
        params,
      );
      if (!approved) {
        return {
          success: false,
          message: `User rejected action "${actionName}" on "${entryId}".`,
        };
      }
    }

    try {
      const result = await action.execute(params);
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Action "${actionName}" failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ---- LLM Snapshot ----

  /**
   * Generate the LLM-friendly world snapshot.
   * Only includes visible entries (contextual scoping) to control token usage.
   *
   * @param config — optional budget controls (maxTools, maxContextLen, priorityRoles).
   */
  snapshot(config: SnapshotConfig = {}): WorldSnapshot {
    const maxTools = config.maxTools ?? 20;
    const maxContextLen = config.maxContextLen ?? 2000;
    const prioritySet = new Set(config.priorityRoles ?? []);

    const active = this.activeEntries();

    // Sort: priority roles first, then rest
    const sorted = [...active.entries()].sort(([, a], [, b]) => {
      const aPrio = prioritySet.has(a.role) ? 1 : 0;
      const bPrio = prioritySet.has(b.role) ? 1 : 0;
      return bPrio - aPrio;
    });

    const entries: { id: string; role: string; actions: string[] }[] = [];
    for (const [id, entry] of sorted) {
      entries.push({
        id,
        role: entry.role,
        actions: entry.actions.map(a => a.name),
      });
    }

    let context = entries.length === 0
      ? 'No interactive components are currently visible.'
      : 'Visible interactive components:\n' + entries
          .map(e => `  [${e.id}] ${e.role} — actions: ${e.actions.join(', ')}`)
          .join('\n');

    // Truncate context if over budget
    const truncationSuffix = '\n... (additional entries truncated)';
    if (context.length > maxContextLen) {
      const truncated = context.substring(0, maxContextLen - truncationSuffix.length);
      context = truncated + truncationSuffix;
    }

    // Build tools with budget cap (respecting priority order)
    const tools = this.buildToolDefinitions(
      new Map(sorted),
      maxTools,
    );

    return { context, tools };
  }

  // ---- Internal ----

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        this.visibleIds.update(current => {
          const next = new Set(current);
          for (const obs of entries) {
            const el = obs.target as HTMLElement;
            const id = el.getAttribute('data-agentic-id');
            if (!id) continue;

            if (obs.isIntersecting) {
              next.add(id);
            } else {
              next.delete(id);
            }
          }
          return next;
        });
      },
      { threshold: 0.1 } // Component is "visible" when 10% is in viewport
    );
  }

  private setupStabilityTracking(): void {
    this.appRef.isStable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(stable => {
        this.isStable.set(stable);
        this.stable$.next(stable);
      });
  }

  /** Wait until the Angular application is stable. Used by the harness. */
  async waitForStable(): Promise<void> {
    if (this.appRef.isStable) return;
    await firstValueFrom(this.stable$.pipe(filter(s => s)));
  }

  private buildToolDefinitions(entries: Map<string, WorldEntry>, maxTools?: number): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const [entryId, entry] of entries) {
      if (maxTools !== undefined && tools.length >= maxTools) break;
      for (const action of entry.actions) {
        if (maxTools !== undefined && tools.length >= maxTools) break;
        tools.push({
          type: 'function',
          function: {
            name: `${entryId}__${action.name}`,
            description: `[${entry.role}] ${action.description}`,
            parameters: action.parameters
              ? this.paramsToSchema(action.parameters)
              : { type: 'object', properties: {} },
          },
        });
      }
    }

    return tools;
  }

  private paramsToSchema(params: ActionParameter[]): {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  } {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const p of params) {
      properties[p.name] = {
        type: p.type,
        description: p.description,
        ...(p.enum ? { enum: p.enum } : {}),
      };
      if (p.required) required.push(p.name);
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
}
