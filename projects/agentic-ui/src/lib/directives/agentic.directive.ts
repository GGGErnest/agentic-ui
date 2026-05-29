import { Directive, effect, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { AgentWorldService } from '../core/world/agent-world.service';
import { AgentAction } from '../core/world/agent-action.model';
import { AGENTIC_COMPONENT } from '../core/world/agentic-component.token';

@Directive({
  selector: '[agentic]',
  standalone: true,
})
export class AgenticDirective implements OnDestroy {
  private readonly world = inject(AgentWorldService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly host = inject(AGENTIC_COMPONENT, { optional: true });

  readonly agenticId = input<string | undefined>(undefined);

  readonly role = input('UI Component');

  readonly actions = input<AgentAction[]>([]);

  readonly metadata = input<Record<string, unknown>>({});

  private registeredId: string | null = null;

  constructor() {
    effect(() => {
      const inputId = this.agenticId();
      const host = this.host;

      const id =
        inputId ??
        host?.agenticId ??
        (this.el.nativeElement.id || undefined) ??
        crypto.randomUUID();

      const role = host ? (host.agenticRole ?? 'UI Component') : this.role();
      const actions = host ? host.agenticActions : this.actions();
      const metadata = host ? (host.agenticMetadata ?? {}) : this.metadata();

      this.el.nativeElement.setAttribute('data-agentic-id', id);

      if (this.registeredId && this.registeredId !== id) {
        this.world.unregister(this.registeredId);
      }

      this.world.register({ id, role, actions, element: this.el.nativeElement, metadata });

      this.registeredId = id;
    });
  }

  ngOnDestroy(): void {
    if (this.registeredId) {
      this.world.unregister(this.registeredId);
    }
  }
}
