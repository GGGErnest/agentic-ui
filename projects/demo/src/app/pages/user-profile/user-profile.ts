import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AgenticDirective, AgentAction, AgenticComponent, AGENTIC_COMPONENT } from 'agentic-ui';
import { ProfileIdentity } from './profile-identity/profile-identity';
import { ProfilePreferences } from './profile-preferences/profile-preferences';
import { ProfileActivity } from './profile-activity/profile-activity';

export type ProfileTab = 'identity' | 'preferences' | 'activity';

@Component({
  selector: 'app-user-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective, ProfileIdentity, ProfilePreferences, ProfileActivity],
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: UserProfile }],
  templateUrl: './user-profile.html',
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .profile-tabs {
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid #30363d;
        margin-bottom: 24px;
      }

      .tab-btn {
        padding: 10px 20px;
        background: none;
        border: none;
        color: #8b949e;
        font-size: 14px;
        cursor: pointer;
      }

      .tab-btn:hover {
        color: #e6edf3;
      }

      .tab-btn:focus-visible {
        outline: 2px solid #58a6ff;
        outline-offset: -2px;
      }

      .tab-btn.active {
        color: #e6edf3;
        border-bottom: 2px solid #58a6ff;
      }
    `,
  ],
})
export class UserProfile implements AgenticComponent {
  readonly agenticId = 'user-profile';
  readonly agenticRole = 'User Profile Page';

  readonly activeTab = signal<ProfileTab>('identity');

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
          this.activeTab.set(tab);
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
