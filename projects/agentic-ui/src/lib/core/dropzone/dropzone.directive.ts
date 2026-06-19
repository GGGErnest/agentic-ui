import { Directive, ViewContainerRef, OnDestroy, inject, ComponentRef } from '@angular/core';
import { ComponentRegistry } from './component-registry.service';
import { RenderMode } from './dropzone.models';

/**
 * Dropzone directive: renders registered components into a host container.
 * Manages lifecycle and cleanup of all rendered components.
 * Supports append (default), replace, and clear modes.
 */
@Directive({
  selector: '[aguiDropzone]',
  standalone: true,
})
export class DropzoneDirective implements OnDestroy {
  private vcr = inject(ViewContainerRef);
  private registry = inject(ComponentRegistry);
  private renderedRefs: ComponentRef<unknown>[] = [];

  /**
   * Render a component into this dropzone.
   * @param componentId Registered component id
   * @param inputs Optional component input values
   * @param mode Render mode: 'append' (default), 'replace', or 'clear'
   * @returns ComponentRef or null if component not registered
   */
  render(
    componentId: string,
    inputs: Record<string, unknown> = {},
    mode: RenderMode = 'append',
  ): ComponentRef<unknown> | null {
    const component = this.registry.get(componentId);
    if (!component) {
      return null;
    }

    // Handle clear mode: remove all rendered components
    if (mode === 'clear') {
      this.renderedRefs.forEach((ref) => {
        ref.destroy();
      });
      this.renderedRefs = [];
      return null;
    }

    // Handle replace mode: clear before rendering
    if (mode === 'replace') {
      this.renderedRefs.forEach((ref) => {
        ref.destroy();
      });
      this.renderedRefs = [];
    }

    // Create and render component
    const componentRef = this.vcr.createComponent(component);

    // Set inputs on component instance. Guard against unknown input keys so a
    // mismatched inputs object doesn't throw and abort the whole render.
    Object.entries(inputs).forEach(([key, value]) => {
      try {
        componentRef.setInput(key, value);
      } catch {
        // Unknown input on the target component — skip it.
      }
    });

    componentRef.changeDetectorRef.detectChanges();

    this.renderedRefs.push(componentRef);
    return componentRef;
  }

  /**
   * Clean up all rendered components.
   */
  ngOnDestroy(): void {
    this.renderedRefs.forEach((ref) => {
      ref.destroy();
    });
    this.renderedRefs = [];
  }
}
