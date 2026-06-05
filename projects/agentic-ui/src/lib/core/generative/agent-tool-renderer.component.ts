import {
  Component,
  ViewContainerRef,
  ViewChild,
  effect,
  signal,
  inject,
  ComponentRef,
  Type,
  Injector,
  runInInjectionContext,
  EnvironmentInjector,
} from '@angular/core';
import { ToolRenderContext } from '../world/agent-action.model';

/**
 * AgentToolRendererComponent — dynamically mounts an Angular component
 * to render a tool call's progress and result.
 *
 * Inputs are plain property setters (not Angular `input()` signals),
 * set by the renderer's effect when the context changes.
 */
@Component({
  selector: 'agui-tool-renderer',
  standalone: true,
  template: `<ng-container #host></ng-container>`,
})
export class AgentToolRendererComponent {
  @ViewChild('host', { read: ViewContainerRef, static: true })
  host!: ViewContainerRef;

  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private ref: ComponentRef<unknown> | null = null;

  componentType: Type<unknown> | null = null;
  context = signal<ToolRenderContext>({
    entryId: '',
    actionName: '',
    args: {},
    status: 'pending',
  });
  renderInputs?: (ctx: ToolRenderContext) => Record<string, unknown>;

  constructor() {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const ctx = this.context();
        const t = this.componentType;
        if (!t) {
          this.ref?.destroy();
          this.ref = null;
          return;
        }
        if (!this.ref) {
          this.ref = this.host.createComponent(t, { injector: this.envInjector });
        }
        const inputs = (this.renderInputs ?? defaultRenderInputs)(ctx);
        for (const [key, value] of Object.entries(inputs)) {
          (this.ref.instance as Record<string, unknown>)[key] = value;
        }
        (this.ref.changeDetectorRef as { detectChanges: () => void }).detectChanges();
      });
    });
  }
}

function defaultRenderInputs(ctx: ToolRenderContext): Record<string, unknown> {
  return { context: ctx };
}
