import {
  Directive,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  inject,
} from '@angular/core';
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
export class AgenticDirective implements OnInit, OnDestroy {
  private readonly world = inject(AgentWorldService);
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Unique identifier for this component instance. Required. */
  @Input({ required: true }) agenticId!: string;

  /** Semantic role of the component (e.g., 'DataTable', 'Modal', 'Button'). */
  @Input() role: string = 'UI Component';

  /** Actions this component exposes to the AI agent. */
  @Input() actions: AgentAction[] = [];

  /** Arbitrary metadata for facade components. */
  @Input() metadata: Record<string, unknown> = {};

  ngOnInit(): void {
    // Tag the element for IntersectionObserver
    this.el.nativeElement.setAttribute('data-agentic-id', this.agenticId);

    this.world.register({
      id: this.agenticId,
      role: this.role,
      actions: this.actions,
      element: this.el.nativeElement,
      metadata: this.metadata,
    });
  }

  ngOnDestroy(): void {
    this.world.unregister(this.agenticId);
  }
}
