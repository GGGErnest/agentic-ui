import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AgenticDirective, AgentAction, AgenticComponent, AGENTIC_COMPONENT } from 'agentic-ui';
import { ProfileIdentity } from './profile-identity/profile-identity.component';
import { ProfilePreferences } from './profile-preferences/profile-preferences.component';
import { ProfileActivity } from './profile-activity/profile-activity.component';

export type ProfileTab = 'identity' | 'preferences' | 'activity';

@Component({
  selector: 'app-user-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective, ProfileIdentity, ProfilePreferences, ProfileActivity],
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: UserProfile }],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfile implements AgenticComponent {
  readonly agenticId = 'user-profile';
  readonly agenticRole = 'User Profile Page';

  readonly activeTab = signal<ProfileTab>('identity');

  switchTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  get agenticActions(): AgentAction[] {
    return [
      {
        name: 'switchTab',
        description: 'Switch to a different profile tab.',
        parameters: [
          {
            name: 'tab',
            type: 'string',
            description: 'The tab to switch to',
            enum: ['identity', 'preferences', 'activity'],
            required: true,
          },
        ],
        execute: async (params) => {
          const raw = params?.['tab'];
          if (typeof raw !== 'string') {
            return { success: false, message: 'Tab must be a string.' };
          }
          const validTabs: ProfileTab[] = ['identity', 'preferences', 'activity'];
          const tab = validTabs.find((t) => t === raw);
          if (!tab) {
            return { success: false, message: 'Invalid tab value.' };
          }
          this.switchTab(tab);
          return { success: true, message: `Switched to ${tab} tab.` };
        },
      } satisfies AgentAction,
      {
        name: 'getCurrentTab',
        description: 'Get the currently active tab name.',
        execute: async () => {
          return { success: true, message: 'Current tab retrieved.', data: this.activeTab() };
        },
      } satisfies AgentAction,
    ];
  }
}
