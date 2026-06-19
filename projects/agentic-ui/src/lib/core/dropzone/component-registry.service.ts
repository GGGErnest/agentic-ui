import { DestroyRef, inject, Injectable, Signal, Type, signal } from '@angular/core';

export interface ComponentMetadata {
  [key: string]: unknown;
}

export interface ComponentEntry {
  component: Type<unknown>;
  metadata: ComponentMetadata;
}

/**
 * Registry for dynamically renderable components.
 * Stores component classes and minimal metadata for use by dropzone directive.
 */
@Injectable({ providedIn: 'root' })
export class ComponentRegistry {
  private readonly registry = signal(new Map<string, ComponentEntry>());

  /** Readonly signal exposing a read-only view of the current registry entries. */
  readonly entries: Signal<ReadonlyMap<string, ComponentEntry>> = this.registry.asReadonly();

  /**
   * Register a component by id.
   * @param id Unique identifier
   * @param component Angular component class
   * @param metadata Optional metadata
   */
  register(id: string, component: Type<unknown>, metadata: ComponentMetadata = {}): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Component id must be a non-empty string');
    }
    if (!component) {
      throw new Error('Component must be defined');
    }
    this.registry.update((m) => {
      const next = new Map(m);
      next.set(id, { component, metadata });
      return next;
    });
  }

  /**
   * Get registered component by id.
   * @param id Component id
   * @returns Component class or null
   */
  get(id: string): Type<unknown> | null {
    const entry = this.registry().get(id);
    return entry?.component || null;
  }

  /**
   * Get metadata for registered component.
   * @param id Component id
   * @returns Metadata object or null
   */
  getMetadata(id: string): ComponentMetadata | null {
    const entry = this.registry().get(id);
    return entry?.metadata || null;
  }

  /**
   * List all registered component ids.
   * @returns Array of ids
   */
  list(): string[] {
    return Array.from(this.registry().keys());
  }

  /**
   * Unregister a component.
   * @param id Component id
   */
  unregister(id: string): void {
    this.registry.update((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registry.update(() => new Map());
  }

  /**
   * Register a component and automatically unregister it when the current
   * injection context (component/directive) is destroyed. Must be called from
   * within an injection context (e.g. a component constructor or field
   * initializer) because it uses `inject(DestroyRef)`.
   *
   * @returns A manual teardown function (also invoked automatically on destroy).
   */
  registerScoped(
    id: string,
    component: Type<unknown>,
    metadata: ComponentMetadata = {},
  ): () => void {
    this.register(id, component, metadata);
    const destroyRef = inject(DestroyRef);
    let cleaned = false;
    const teardown = () => {
      if (cleaned) return;
      cleaned = true;
      this.unregister(id);
    };
    destroyRef.onDestroy(teardown);
    return teardown;
  }
}
