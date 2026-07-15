import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AgenticComponent,
  AgentAction,
  AgentActionResult,
  AGENTIC_COMPONENT,
  AgentTool,
  collectAgentTools,
} from 'agentic-ui';
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

  private _agenticActions?: AgentAction[];

  get agenticActions(): AgentAction[] {
    return (this._agenticActions ??= collectAgentTools(this));
  }

  @AgentTool({
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
  })
  private async doGetRecentActivity(
    params?: Record<string, unknown>,
  ): Promise<AgentActionResult> {
    const limit = typeof params?.['limit'] === 'number' ? params['limit'] : 10;
    const recent = this.events().slice(0, limit);
    return { success: true, data: recent, message: 'Recent activity retrieved.' };
  }

  @AgentTool({
    name: 'clearActivity',
    description: 'Clear all activity events.',
    requiresApproval: true,
  })
  private async doClearActivity(): Promise<AgentActionResult> {
    this.activityService.clear();
    return { success: true, message: 'Activity cleared.' };
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
