import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  effect,
  EnvironmentInjector,
  inject,
  Injector,
  input,
  runInInjectionContext,
  Signal,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { ToolRenderContext } from '../world/agent-action.model';

/**
 * AgentToolRendererComponent — dynamically mounts an Angular component
 * to render a tool call's progress and result.
 *
 * Inputs are typed via Angular's `input()` signal API. Inputs are set
 * via `ComponentRef.setInput()` so both `@Input()` and `input()` signal
 * components work correctly.
 */
@Component({
  selector: 'agui-tool-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container #host></ng-container>`,
})
export class AgentToolRendererComponent {
  @ViewChild('host', { read: ViewContainerRef, static: true })
  declare host: ViewContainerRef;

  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private ref: ComponentRef<unknown> | null = null;

  readonly componentType = input<Type<unknown> | null>(null);
  readonly context = input.required<Signal<ToolRenderContext>>();
  readonly renderInputs = input<
    ((ctx: ToolRenderContext) => Record<string, unknown>) | undefined
  >(undefined);

  constructor() {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const ctx = this.context()();
        const t = this.componentType();
        if (!t) {
          this.ref?.destroy();
          this.ref = null;
          return;
        }
        if (!this.ref) {
          this.ref = this.host.createComponent(t, { injector: this.envInjector });
        }
        const inputs = (this.renderInputs() ?? defaultRenderInputs)(ctx);
        for (const [key, value] of Object.entries(inputs)) {
          this.ref.setInput(key, value);
        }
        this.ref.changeDetectorRef.detectChanges();
      });
    });
  }
}

function defaultRenderInputs(ctx: ToolRenderContext): Record<string, unknown> {
  return { context: ctx };
}
