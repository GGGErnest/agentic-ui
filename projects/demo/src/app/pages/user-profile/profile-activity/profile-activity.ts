import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';

@Component({
  selector: 'app-profile-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div>Activity stub</div>',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileActivity }],
})
export class ProfileActivity implements AgenticComponent {
  readonly agenticId = 'profile-activity';
  readonly agenticRole = 'Activity Feed';
  readonly agenticActions: AgentAction[] = [];
}
