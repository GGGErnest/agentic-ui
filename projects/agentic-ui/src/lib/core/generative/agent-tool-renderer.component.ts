import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
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
  private readonly destroyRef = inject(DestroyRef);
  private ref: ComponentRef<unknown> | null = null;
  /** The component type currently mounted, so we can detect a type swap. */
  private currentType: Type<unknown> | null = null;

  readonly componentType = input<Type<unknown> | null>(null);
  readonly context = input.required<Signal<ToolRenderContext>>();
  readonly renderInputs = input<((ctx: ToolRenderContext) => Record<string, unknown>) | undefined>(
    undefined,
  );

  constructor() {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const ctx = this.context()();
        const t = this.componentType();

        // Tear down when there is no component, or when the type changed.
        if (!t || t !== this.currentType) {
          this.ref?.destroy();
          this.ref = null;
          this.currentType = null;
        }

        if (!t) {
          return;
        }

        if (!this.ref) {
          this.ref = this.host.createComponent(t, { injector: this.envInjector });
          this.currentType = t;
        }

        const inputs = (this.renderInputs() ?? defaultRenderInputs)(ctx);
        for (const [key, value] of Object.entries(inputs)) {
          this.ref.setInput(key, value);
        }
        this.ref.changeDetectorRef.detectChanges();
      });
    });

    // Ensure the dynamically created component is destroyed with the host.
    this.destroyRef.onDestroy(() => {
      this.ref?.destroy();
      this.ref = null;
      this.currentType = null;
    });
  }
}

function defaultRenderInputs(ctx: ToolRenderContext): Record<string, unknown> {
  return { context: ctx };
}
