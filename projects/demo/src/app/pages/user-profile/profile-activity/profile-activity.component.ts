import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';
import { ActivityService } from '../../../services/activity.service';

@Component({
  selector: 'app-profile-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-activity.component.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileActivity }],
  styleUrl: './profile-activity.component.scss',
})
export class ProfileActivity implements AgenticComponent {
  readonly agenticId = 'profile-activity';
  readonly agenticRole = 'Activity Feed';

  private activityService = inject(ActivityService);
  readonly events = this.activityService.events;

  readonly agenticActions: AgentAction[] = [
    {
      name: 'getRecentActivity',
      description: 'Retrieve recent activity events.',
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of events to return (default: 10)',
          required: false,
        },
      ],
      execute: async (params) => {
        const limit = typeof params?.['limit'] === 'number' ? params['limit'] : 10;
        const recent = this.events().slice(0, limit);
        return { success: true, data: recent, message: 'Recent activity retrieved.' };
      },
    } satisfies AgentAction,
    {
      name: 'clearActivity',
      description: 'Clear all activity events.',
      requiresApproval: true,
      execute: async () => {
        this.activityService.clear();
        return { success: true, message: 'Activity cleared.' };
      },
    } satisfies AgentAction,
  ];

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
