import { Injectable, Type } from '@angular/core';

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
  private registry = new Map<string, ComponentEntry>();

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
    this.registry.set(id, { component, metadata });
  }

  /**
   * Get registered component by id.
   * @param id Component id
   * @returns Component class or null
   */
  get(id: string): Type<unknown> | null {
    const entry = this.registry.get(id);
    return entry?.component || null;
  }

  /**
   * Get metadata for registered component.
   * @param id Component id
   * @returns Metadata object or null
   */
  getMetadata(id: string): ComponentMetadata | null {
    const entry = this.registry.get(id);
    return entry?.metadata || null;
  }

  /**
   * List all registered component ids.
   * @returns Array of ids
   */
  list(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Unregister a component.
   * @param id Component id
   */
  unregister(id: string): void {
    this.registry.delete(id);
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registry.clear();
  }
}
