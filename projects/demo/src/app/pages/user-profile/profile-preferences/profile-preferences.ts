import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';
import { ActivityService } from '../../../services/activity.service';

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: 'dark' | 'light';
  language: 'en' | 'es' | 'fr';
  compactView: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  emailNotifications: true,
  pushNotifications: false,
  theme: 'dark',
  language: 'en',
  compactView: false,
};

@Component({
  selector: 'app-profile-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './profile-preferences.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfilePreferences }],
  styles: [
    `
      .preferences-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
      }
      .section-heading {
        margin: 0 0 20px;
        font-size: 18px;
        font-weight: 600;
        color: #e6edf3;
      }
      .pref-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #30363d;
      }
      .pref-row:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      .pref-label {
        font-size: 14px;
        font-weight: 500;
        color: #e6edf3;
      }
      .pref-description {
        font-size: 12px;
        color: #8b949e;
        margin-top: 2px;
      }
      .toggle {
        position: relative;
        width: 36px;
        height: 20px;
      }
      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        inset: 0;
        background: #30363d;
        border-radius: 20px;
        cursor: pointer;
        transition: 0.2s;
      }
      .slider::before {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.2s;
      }
      input:checked + .slider {
        background: #238636;
      }
      input:checked + .slider::before {
        transform: translateX(16px);
      }
      select {
        padding: 6px 10px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: #e6edf3;
        font-size: 13px;
        cursor: pointer;
      }
      select option {
        background: #161b22;
        color: #e6edf3;
      }
    `,
  ],
})
export class ProfilePreferences implements AgenticComponent {
  readonly agenticId = 'profile-preferences';
  readonly agenticRole = 'User Preferences';

  private activityService = inject(ActivityService);

  readonly prefs = signal<UserPreferences>({ ...DEFAULT_PREFS });

  readonly agenticActions: AgentAction[] = [
    {
      name: 'getPreferences',
      description: 'Retrieve all current user preferences.',
      execute: async () => ({
        success: true,
        data: { ...this.prefs() },
        message: 'Preferences retrieved successfully.',
      }),
    } satisfies AgentAction,
    {
      name: 'setPreference',
      description: 'Update a specific user preference.',
      parameters: [
        {
          name: 'key',
          type: 'string',
          description:
            'Preference key: emailNotifications, pushNotifications, theme, language, or compactView',
          required: true,
          enum: ['emailNotifications', 'pushNotifications', 'theme', 'language', 'compactView'],
        },
        { name: 'value', type: 'string', description: 'New preference value', required: true },
      ],
      execute: async (params) => {
        const key = typeof params?.['key'] === 'string' ? params['key'] : null;
        const rawValue = params?.['value'];

        if (!key) {
          return { success: false, message: 'Invalid parameters.' };
        }

        const current = this.prefs();
        if (!(key in current)) {
          return { success: false, message: `Unknown preference key: ${key}` };
        }

        const currentValue = current[key as keyof UserPreferences];
        let coercedValue: unknown;

        if (typeof currentValue === 'boolean') {
          coercedValue = rawValue === true || rawValue === 'true';
        } else {
          coercedValue = String(rawValue);
        }

        this.prefs.set({
          ...current,
          [key]: coercedValue,
        });

        this.activityService.log({
          type: 'preference_changed',
          description: `Preference ${key} updated to ${coercedValue}`,
        });

        return { success: true, message: `Preference ${key} updated.` };
      },
    } satisfies AgentAction,
  ];

  onEmailNotificationsChange(value: boolean): void {
    this.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'emailNotifications', value });
  }

  onPushNotificationsChange(value: boolean): void {
    this.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'pushNotifications', value });
  }

  onCompactViewChange(value: boolean): void {
    this.agenticActions.find((a) => a.name === 'setPreference')?.execute({ key: 'compactView', value });
  }

  onThemeChange(value: string): void {
    this.agenticActions.find((a) => a.name === 'setPreference')?.execute({ key: 'theme', value });
  }

  onLanguageChange(value: string): void {
    this.agenticActions.find((a) => a.name === 'setPreference')?.execute({ key: 'language', value });
  }
}
