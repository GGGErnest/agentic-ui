import { Injectable, signal, computed, ApplicationRef, inject, DestroyRef, afterEveryRender } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { AgentApprovalService } from '../approval/agent-approval.service';
import { ActionParameter, AgentActionResult, AgentAction } from './agent-action.model';
import { SnapshotConfig, ToolDefinition, WorldEntry, WorldSnapshot } from './world-entry.interface';
import { AgentJsonSchema, JsonSchemaProperty } from '../schema/agent-json-schema.model';
import { AgentReadable, AgentWritableResult } from '../state/agent-readable.model';
import { validateAgentJsonSchema } from '../schema/agent-json-schema.validator';

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
  private readonly renderComplete$ = new Subject<void>();

  constructor() {
    this.setupIntersectionObserver();
    this.setupStabilityTracking();
    
    // Cleanup: disconnect IntersectionObserver when service is destroyed
    this.destroyRef.onDestroy(() => {
      if (this.observer) {
        this.observer.disconnect();
      }
    });
  }

  // ---- Registration ----

  /** Register a component in the world. Called by [agentic] directive on init. */
  register(entry: WorldEntry): void {
    // Assert OpenAI schema specifications ^[a-zA-Z0-9_-]{1,64}$ and block custom nested namespace errors
    const SCHEMA_RULE = /^[a-zA-Z0-9_-]{1,64}$/;
    
    if (!SCHEMA_RULE.test(entry.id) || entry.id.includes('__')) {
      throw new Error(`[Agentic-UI Verification Error] component structural mismatch: ID "${entry.id}" must match strict naming conventions: alphanumeric, dashes, underscores only up to 64 chars, and cannot contain double underscores "__".`);
    }
    
    for (const item of entry.actions) {
      if (!SCHEMA_RULE.test(item.name) || item.name.includes('__')) {
        throw new Error(`[Agentic-UI Verification Error] Action naming constraint failure: Action key "${item.name}" bound to "${entry.id}" contains illegal tokens.`);
      }
    }

    for (const readable of entry.readables ?? []) {
      if (!SCHEMA_RULE.test(readable.name) || readable.name.includes('__')) {
        throw new Error(`[Agentic-UI Verification Error] Readable naming constraint failure: Readable key "${readable.name}" bound to "${entry.id}" contains illegal tokens.`);
      }
    }

    this._entries.update((map) => {
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
    this._entries.update((map) => {
      const next = new Map(map);
      const entry = next.get(id);
      if (entry?.element && this.observer) {
        this.observer.unobserve(entry.element);
      }
      next.delete(id);
      return next;
    });
    this.visibleIds.update((s) => {
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
    params?: Record<string, unknown>,
  ): Promise<AgentActionResult> {
    const entry = this._entries().get(entryId);
    if (!entry) {
      return { success: false, message: `Entry "${entryId}" not found in world registry.` };
    }

    const action = entry.actions.find((a) => a.name === actionName);
    if (!action) {
      return {
        success: false,
        message: `Action "${actionName}" not found on entry "${entryId}". Available: ${entry.actions.map((a) => a.name).join(', ')}`,
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

    if (action.inputSchema) {
      const validation = validateAgentJsonSchema(action.inputSchema, params ?? {});
      if (!validation.valid) {
        return { success: false, message: `Invalid params: ${validation.message ?? 'unknown error'}` };
      }
    }

    if (!action.inputSchema && action.parameters) {
      const schema = this.paramsToLegacySchema(action.parameters);
      const validation = validateAgentJsonSchema(schema, params ?? {});
      if (!validation.valid) {
        return { success: false, message: `Invalid params: ${validation.message ?? 'unknown error'}` };
      }
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
      this.appRef.tick();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Action "${actionName}" failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** Update a readable (writable state) on a registered entry. */
  async updateReadable(
    entryId: string,
    readableName: string,
    value: unknown,
  ): Promise<AgentWritableResult> {
    const entry = this._entries().get(entryId);
    if (!entry) {
      return { success: false, message: `Entry "${entryId}" not found in world registry.` };
    }

    const readable = (entry.readables ?? []).find((r) => r.name === readableName);
    if (!readable) {
      return {
        success: false,
        message: `Readable "${readableName}" not found on entry "${entryId}".`,
      };
    }

    if (!readable.write) {
      return {
        success: false,
        message: `Readable "${readableName}" on entry "${entryId}" is not writable.`,
      };
    }

    this.focus(entryId);

    if (this.shadowMode()) {
      return {
        success: true,
        message: `[SHADOW] Simulated update of "${readableName}" on "${entryId}" to ${JSON.stringify(value)}`,
      };
    }

    const validation = validateAgentJsonSchema(readable.schema, { value });
    if (!validation.valid) {
      return { success: false, message: `Invalid readable value: ${validation.message ?? 'unknown error'}` };
    }

    try {
      const result = await readable.write(value);
      this.appRef.tick();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Update of "${readableName}" failed: ${error instanceof Error ? error.message : String(error)}`,
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


    // Expose all items to prevent the LLM from missing out-of-view targets
    const allEntries = this._entries();
    const visibleIds = this.visibleIds();

    // Sort: priority roles first, then rest
    const sorted = [...allEntries.entries()].sort(([, a], [, b]) => {
      const aPrio = prioritySet.has(a.role) ? 1 : 0;
      const bPrio = prioritySet.has(b.role) ? 1 : 0;
      return bPrio - aPrio;
    });

    // Scan for any active modal or overlay that is currently visible in the viewport
    const activeModalEntry = sorted.find(([, entry]) =>
      (entry.role === 'Modal' || entry.role === 'Overlay' || entry.role === 'Dialog') && visibleIds.has(entry.id)
    );

     const entries: { id: string; role: string; isVisible: boolean; isOccluded: boolean; actions: string[]; readables: string[] }[] = [];
     const interactiveEntriesMap = new Map<string, WorldEntry>();

     for (const [id, entry] of sorted) {
       let isOccluded = false;

       // If a modal layer exists, evaluate whether this element is trapped behind it
       if (activeModalEntry && activeModalEntry[1].id !== id) {
         const modalElement = activeModalEntry[1].element;
         const targetElement = entry.element;

         if (modalElement && targetElement) {
           // If the element is NOT part of the modal's DOM tree, it is occluded by the backdrop
           isOccluded = !modalElement.contains(targetElement);
         } else if (modalElement) {
           // Modal has an element but target doesn't — treat target as occluded
           isOccluded = true;
         }
         // If neither has an element (no DOM), skip occlusion — can't verify
       }

       const isVisible = visibleIds.has(id);
       entries.push({
         id,
         role: entry.role,
         isVisible: isVisible,
         isOccluded: isOccluded,
         actions: entry.actions.map((a) => a.name),
         readables: (entry.readables ?? []).map((r) => r.name),
       });

       // Only allow tool generation if the component is visible AND not blocked by an overlay
       if (isVisible && !isOccluded) {
         interactiveEntriesMap.set(id, entry);
       }
     }

     let context =
       entries.length === 0
         ? 'No interactive components exist on this page.'
         : 'Interactive components on the page:\n' +
           entries.map((e) => {
             const status = e.isOccluded
               ? 'Occluded/Inert - Blocked by Modal Overlay'
               : `Visible In Viewport: ${e.isVisible}`;
             const stateStr = e.readables.length > 0 ? ` — state: ${e.readables.join(', ')}` : '';
             return `  [${e.id}] ${e.role} (${status}) — actions: ${e.actions.join(', ')}${stateStr}`;
           }).join('\n');

    // Truncate context if over budget
    const truncationSuffix = '\n... (additional entries truncated)';
    if (context.length > maxContextLen) {
      const truncated = context.substring(0, maxContextLen - truncationSuffix.length);
      context = truncated + truncationSuffix;
    }

    // Build tools using only the accessible, unoccluded components
    const tools = this.buildToolDefinitions(
      interactiveEntriesMap,
      maxTools,
    );

    return { context, tools };
  }

  async snapshotAsync(config: SnapshotConfig = {}): Promise<WorldSnapshot> {
    const snapshot = this.snapshot(config);
    const allEntries = this._entries();

    const readableValues: string[] = [];
    for (const entry of allEntries.values()) {
      for (const readable of entry.readables ?? []) {
        try {
          const result = await readable.read();
          readableValues.push(`${readable.name}: ${JSON.stringify(result.value)}`);
        } catch (error) {
          readableValues.push(`${readable.name}: [error: ${error instanceof Error ? error.message : String(error)}]`);
        }
      }
    }

    return {
      ...snapshot,
      context: readableValues.length > 0 ? `${snapshot.context}\nState:\n${readableValues.join('\n')}` : snapshot.context,
    };
  }

  // ---- Internal ----

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        this.visibleIds.update((current) => {
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
      { threshold: 0.1 }, // Component is "visible" when 10% is in viewport
    );
  }

  private setupStabilityTracking(): void {
    // Register Angular's modern post-render hook to capture the exact moment 
    // that layout change detection updates finish painting to the browser DOM tree.
    // Executing inside the constructor establishes the correct injection context natively.
    afterEveryRender(() => {
      this.isStable.set(true);
      this.renderComplete$.next();
    });
  }

  /** Wait until the next global Angular rendering wave finishes committing and painting to the DOM. */
  async waitForStable(): Promise<void> {
    this.isStable.set(false);
    
    // Wait for the next framework paint loop iteration to finalize
    await firstValueFrom(this.renderComplete$);
    
    // Crucial: Yield control to the browser macro-task queue once. This guarantees that 
    // asynchronous IntersectionObserver callbacks execute and update visibility states 
    // immediately after the element is painted on screen.
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  private buildToolDefinitions(
    entries: Map<string, WorldEntry>,
    maxTools?: number,
  ): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const MAX_TOOL_NAME_LENGTH = 64; // OpenAI schema constraint

    for (const [entryId, entry] of entries) {
      if (maxTools !== undefined && tools.length >= maxTools) break;
      
      // Build tools for actions
      for (const action of entry.actions) {
        if (maxTools !== undefined && tools.length >= maxTools) break;
        
        const toolName = `${entryId}__${action.name}`;
        if (toolName.length > MAX_TOOL_NAME_LENGTH) {
          throw new Error(
            `[Agentic-UI Tool Name Error] Combined tool name "${toolName}" exceeds ${MAX_TOOL_NAME_LENGTH} character limit. ` +
            `Entry: "${entryId}" (${entryId.length} chars), Action: "${action.name}" (${action.name.length} chars), ` +
            `Total: ${toolName.length} chars (including "__" separator).`
          );
        }
        
        // Use inputSchema if available, otherwise fall back to legacy parameters
        const parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] } = action.inputSchema
          ? this.jsonSchemaToToolParameters(action.inputSchema)
          : (action.parameters
              ? this.paramsToLegacySchema(action.parameters)
              : { type: 'object', properties: {} });
        
        tools.push({
          type: 'function',
          function: {
            name: toolName,
            description: `[${entry.role}] ${action.description}`,
            parameters,
          },
        });
      }

      // Build tools for writable readables (setter tools)
      for (const readable of entry.readables ?? []) {
        if (maxTools !== undefined && tools.length >= maxTools) break;
        if (!readable.writable) continue; // Skip read-only readables

        const toolName = `${entryId}__set_${readable.name}`;
        if (toolName.length > MAX_TOOL_NAME_LENGTH) {
          throw new Error(
            `[Agentic-UI Tool Name Error] Combined tool name "${toolName}" exceeds ${MAX_TOOL_NAME_LENGTH} character limit.`
          );
        }

        tools.push({
          type: 'function',
          function: {
            name: toolName,
            description: `[${entry.role}] Update state: ${readable.description}`,
            parameters: this.jsonSchemaToToolParameters(readable.schema, 'value'),
          },
        });
      }
    }

    return tools;
  }

  /** Convert JSON Schema to OpenAI tool parameters format. */
  private jsonSchemaToToolParameters(
    schema: AgentJsonSchema,
    wrapperProp?: string,
  ): {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  } {
    if (wrapperProp) {
      // For readable setters, wrap the schema value in a property
      return {
        type: 'object',
        properties: {
          [wrapperProp]: this.schemaPropertyToToolProperty(schema),
        },
        required: [wrapperProp],
      };
    }

    // Direct schema-to-parameters conversion
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [propName, prop] of Object.entries(schema.properties ?? {})) {
      properties[propName] = this.schemaPropertyToToolProperty(prop);
      if (schema.required?.includes(propName)) {
        required.push(propName);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  /** Convert a JSON Schema property to OpenAI tool property format. */
  private schemaPropertyToToolProperty(prop: JsonSchemaProperty): Record<string, unknown> {
    const toolProp: Record<string, unknown> = {
      type: prop.type,
    };

    if (prop.description) toolProp['description'] = prop.description;
    if (prop.enum) toolProp['enum'] = prop.enum;
    if (prop.default !== undefined) toolProp['default'] = prop.default;
    if (prop.minimum !== undefined) toolProp['minimum'] = prop.minimum;
    if (prop.maximum !== undefined) toolProp['maximum'] = prop.maximum;
    if (prop.minLength !== undefined) toolProp['minLength'] = prop.minLength;
    if (prop.maxLength !== undefined) toolProp['maxLength'] = prop.maxLength;
    if (prop.pattern !== undefined) toolProp['pattern'] = prop.pattern;

    // For arrays, preserve items schema
    if (prop.type === 'array' && prop.items) {
      toolProp['items'] = this.schemaPropertyToToolProperty(prop.items);
    }

    // For objects, preserve nested properties
    if (prop.type === 'object' && prop.properties) {
      const nestedProps: Record<string, unknown> = {};
      const nestedRequired: string[] = [];

      for (const [nestedName, nestedProp] of Object.entries(prop.properties)) {
        nestedProps[nestedName] = this.schemaPropertyToToolProperty(nestedProp);
        if (prop.required?.includes(nestedName)) {
          nestedRequired.push(nestedName);
        }
      }

      toolProp['properties'] = nestedProps;
      if (nestedRequired.length > 0) toolProp['required'] = nestedRequired;
    }

    return toolProp;
  }

  private paramsToLegacySchema(params: ActionParameter[]): AgentJsonSchema {
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const p of params) {
      const fieldSchema: JsonSchemaProperty = {
        type: p.type,
        description: p.description,
      };

      if (p.enum) {
        fieldSchema['enum'] = p.enum;
      }

      // If type is an array, explicitly specify string items for high-performance extraction compliance
      if (p.type === 'array') {
        fieldSchema.items = { type: 'string' };
      }

      properties[p.name] = fieldSchema;
      if (p.required) required.push(p.name);
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
}
