/**
 * `@AgentTool` — co-locates an agent action's metadata with its
 * implementation method, removing the need for a separate definition
 * array + handler map.
 *
 * Usage:
 * ```ts
 * class MyComponent {
 *   @AgentTool({ name: 'doThing', description: 'Does a thing.' })
 *   private doThing(params: Record<string, unknown>): Promise<AgentActionResult> { ... }
 *
 *   get agenticActions(): AgentAction[] {
 *     return (this._cache ??= collectAgentTools(this));
 *   }
 * }
 * ```
 *
 * The decorator records each annotated method against its declaring class.
 * `collectAgentTools(instance)` walks the prototype chain, builds an
 * `AgentAction[]`, and binds each `execute` to the instance — so the
 * method keeps its own typed signature and no casts leak into call sites.
 */
import { AgentAction, AgentActionDef } from './agent-action.model';

/** Metadata accepted by `@AgentTool`. `name` defaults to the method name. */
export type AgentToolMeta = Omit<AgentActionDef, 'name'> & { name?: string };

interface AgentToolEntry {
  methodKey: string | symbol;
  meta: AgentToolMeta;
}

/** Registry keyed by the class constructor that declared the tool methods. */
const REGISTRY = new Map<object, AgentToolEntry[]>();

/**
 * Method decorator that registers a method as an agent tool.
 * Uses the legacy (experimentalDecorators) signature.
 */
export function AgentTool(meta: AgentToolMeta): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = (target as { constructor: object }).constructor;
    const entries = REGISTRY.get(ctor) ?? [];
    entries.push({ methodKey: propertyKey, meta });
    REGISTRY.set(ctor, entries);
  };
}

/**
 * Build the runtime `AgentAction[]` for an instance by reading every
 * `@AgentTool`-annotated method on its prototype chain. Each `execute`
 * is bound to the instance; the method keeps its own typed signature.
 */
export function collectAgentTools(instance: object): AgentAction[] {
  const actions: AgentAction[] = [];
  const seen = new Set<string>();

  let proto: object | null = Object.getPrototypeOf(instance);
  while (proto && proto !== Object.prototype) {
    const entries = REGISTRY.get(proto.constructor);
    if (entries) {
      for (const { methodKey, meta } of entries) {
        const name = meta.name ?? String(methodKey);
        if (seen.has(name)) continue;
        seen.add(name);

        const { name: _ignored, ...rest } = meta;
        const method = (instance as Record<string | symbol, unknown>)[methodKey] as (
          params?: Record<string, unknown>,
        ) => ReturnType<AgentAction['execute']>;

        actions.push({
          ...rest,
          name,
          execute: (params) => method.call(instance, params),
        });
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return actions;
}
