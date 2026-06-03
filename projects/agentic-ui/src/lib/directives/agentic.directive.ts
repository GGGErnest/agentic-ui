import { Directive, effect, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { AgentWorldService } from '../core/world/agent-world.service';
import { AgentAction } from '../core/world/agent-action.model';
import { AgentReadable } from '../core/state/agent-readable.model';
import { AGENTIC_COMPONENT } from '../core/world/agentic-component.token';

/**
 * AgenticDirective — bridges UI components to the World Registry.
 *
 * Two registration modes:
 *
 * 1. Token mode (Angular components): The host component provides AGENTIC_COMPONENT
 *    and implements AgenticComponent. No template inputs are required.
 *    ```html
 *    <div agentic></div>
 *    ```
 *
 * 2. Input mode (native elements, third-party components): Pass agenticId, role,
 *    actions, readables, and metadata as template inputs.
 *    ```html
 *    <button agentic agenticId="submit-btn" [actions]="btnActions">Submit</button>
 *    ```
 *
 * ID resolution: agenticId input → token agenticId → element id → UUID
 */
@Directive({
  selector: '[agentic]',
  standalone: true,
})
export class AgenticDirective implements OnDestroy {
  private readonly world = inject(AgentWorldService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly host = inject(AGENTIC_COMPONENT, { optional: true });

  private readonly fallbackId = crypto.randomUUID();

  readonly agenticId = input<string | undefined>(undefined);

  readonly agenticElement = input<HTMLElement | undefined>(undefined);

  readonly role = input('UI Component');

  readonly actions = input<AgentAction[]>([]);

  readonly readables = input<AgentReadable[]>([]);

  readonly metadata = input<Record<string, unknown>>({});

  private registeredId: string | null = null;

  constructor() {
    effect(() => {
      const inputId = this.agenticId();
      const host = this.host;
      const hostId = typeof host?.agenticId === 'function' ? host.agenticId() : host?.agenticId;

      const id = inputId ?? hostId ?? (this.el.nativeElement.id || undefined) ?? this.fallbackId;

      const role = host ? (host.agenticRole ?? 'UI Component') : this.role();
      const actions = host ? host.agenticActions : this.actions();
      const readables = host ? (host.agenticReadables ?? []) : this.readables();
      const metadata = host ? (host.agenticMetadata ?? {}) : this.metadata();

      const elementToRegister = this.agenticElement() ?? this.el.nativeElement;
      this.el.nativeElement.setAttribute('data-agentic-id', id);
      if (elementToRegister !== this.el.nativeElement) {
        elementToRegister.setAttribute('data-agentic-id', id);
      }

      if (this.registeredId && this.registeredId !== id) {
        this.world.unregister(this.registeredId);
      }

      this.world.register({ id, role, actions, readables, element: elementToRegister, metadata });

      this.registeredId = id;
    });
  }

  ngOnDestroy(): void {
    if (this.registeredId) {
      this.world.unregister(this.registeredId);
    }
  }
}
