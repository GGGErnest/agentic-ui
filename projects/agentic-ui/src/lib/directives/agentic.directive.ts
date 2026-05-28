import { Directive, effect, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { AgentWorldService } from '../core/world/agent-world.service';
import { AgentAction } from '../core/world/agent-action.model';

/**
 * AgenticDirective — bridges UI components to the World Registry.
 *
 * Usage:
 * ```html
 * <button [agentic] agenticId="submit-btn" role="Form Action"
 *         [actions]="[{ name: 'submit', description: 'Submit the form', execute: () => this.onSubmit() }]">
 *   Submit
 * </button>
 * ```
 *
 * The directive:
 * - Registers the component on init.
 * - Unregisters on destroy.
 * - Sets a data attribute for IntersectionObserver tracking.
 */
@Directive({
  selector: '[agentic]',
  standalone: true,
})
export class AgenticDirective implements OnDestroy {
  private readonly world = inject(AgentWorldService);
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Unique identifier for this component instance. Required. */
  readonly agenticId = input.required<string>();

  /** Semantic role of the component (e.g., 'DataTable', 'Modal', 'Button'). */
  readonly role = input('UI Component');

  /** Actions this component exposes to the AI agent. */
  readonly actions = input<AgentAction[]>([]);

  /** Arbitrary metadata for facade components. */
  readonly metadata = input<Record<string, unknown>>({});

  private registeredId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.agenticId();
      const role = this.role();
      const actions = this.actions();
      const metadata = this.metadata();

      this.el.nativeElement.setAttribute('data-agentic-id', id);

      if (this.registeredId && this.registeredId !== id) {
        this.world.unregister(this.registeredId);
      }

      this.world.register({
        id,
        role,
        actions,
        element: this.el.nativeElement,
        metadata,
      });

      this.registeredId = id;
    });
  }

  ngOnDestroy(): void {
    if (this.registeredId) {
      this.world.unregister(this.registeredId);
    }
  }
}
