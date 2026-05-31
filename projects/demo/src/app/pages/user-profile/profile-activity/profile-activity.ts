import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';
import { ActivityService } from '../../../services/activity.service';

@Component({
  selector: 'app-profile-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-activity.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileActivity }],
  styles: [
    `
      .activity-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
      }
      .activity-heading {
        margin: 0 0 20px;
        font-size: 18px;
        font-weight: 600;
        color: #e6edf3;
      }
      .activity-empty {
        font-size: 14px;
        color: #8b949e;
      }
      .activity-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .activity-item {
        padding: 12px 0;
        border-bottom: 1px solid #21262d;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .activity-item:last-child {
        border-bottom: none;
      }
      .activity-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #238636;
        margin-top: 6px;
        flex-shrink: 0;
      }
      .activity-content {
        flex: 1;
      }
      .activity-description {
        font-size: 14px;
        color: #e6edf3;
        margin: 0 0 4px;
      }
      .activity-time {
        font-size: 12px;
        color: #8b949e;
      }
    `,
  ],
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
