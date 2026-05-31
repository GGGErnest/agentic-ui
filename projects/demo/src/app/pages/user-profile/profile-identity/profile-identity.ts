import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';

@Component({
  selector: 'app-profile-identity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div>Identity stub</div>',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileIdentity }],
})
export class ProfileIdentity implements AgenticComponent {
  readonly agenticId = 'profile-identity';
  readonly agenticRole = 'User Identity';
  readonly agenticActions: AgentAction[] = [];
}
