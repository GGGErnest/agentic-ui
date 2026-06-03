/**
 * Dynamic UI Dropzone Module
 *
 * Provides a registry-based system for dynamically rendering components
 * into designated dropzone containers.
 *
 * Components must be registered with ComponentRegistry before rendering.
 * The DropzoneDirective manages lifecycle and cleanup of all rendered components.
 *
 * Usage:
 * ```typescript
 * // Register components
 * registry.register('myComponent', MyComponent);
 * registry.register('anotherComponent', AnotherComponent, { label: 'My Component' });
 *
 * // In template
 * <div aguiDropzone></div>
 *
 * // In component
 * directive.render('myComponent', { inputName: 'value' }, 'append');
 * directive.render('anotherComponent', {}, 'replace');
 * ```
 */

export { ComponentRegistry } from './component-registry.service';
export type { ComponentMetadata } from './component-registry.service';

export { DropzoneDirective } from './dropzone.directive';
export type { RenderMode } from './dropzone.directive';

export type { RenderConfig, RenderResult } from './dropzone.models';
