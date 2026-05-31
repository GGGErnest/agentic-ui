import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';

@Component({
  selector: 'app-profile-preferences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div>Preferences stub</div>',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfilePreferences }],
})
export class ProfilePreferences implements AgenticComponent {
  readonly agenticId = 'profile-preferences';
  readonly agenticRole = 'User Preferences';
  readonly agenticActions: AgentAction[] = [];
}
