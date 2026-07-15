import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgenticComponent,
  AgentAction,
  AgentActionResult,
  AGENTIC_COMPONENT,
  AgentTool,
  collectAgentTools,
} from 'agentic-ui';
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
  templateUrl: './profile-preferences.component.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfilePreferences }],
  styleUrl: './profile-preferences.component.scss',
})
export class ProfilePreferences implements AgenticComponent {
  readonly agenticId = 'profile-preferences';
  readonly agenticRole = 'User Preferences';

  private activityService = inject(ActivityService);

  readonly prefs = signal<UserPreferences>({ ...DEFAULT_PREFS });

  private _agenticActions?: AgentAction[];

  get agenticActions(): AgentAction[] {
    return (this._agenticActions ??= collectAgentTools(this));
  }

  @AgentTool({
    name: 'getPreferences',
    description: 'Retrieve all current user preferences.',
  })
  private async doGetPreferences(): Promise<AgentActionResult> {
    return {
      success: true,
      data: { ...this.prefs() },
      message: 'Preferences retrieved successfully.',
    };
  }

  @AgentTool({
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
  })
  private async doSetPreference(params?: Record<string, unknown>): Promise<AgentActionResult> {
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
  }

  private setPref(key: keyof UserPreferences, value: unknown): void {
    this.doSetPreference({ key, value });
  }

  onEmailNotificationsChange(event: Event): void {
    this.setPref('emailNotifications', (event.target as HTMLInputElement).checked);
  }

  onPushNotificationsChange(event: Event): void {
    this.setPref('pushNotifications', (event.target as HTMLInputElement).checked);
  }

  onCompactViewChange(event: Event): void {
    this.setPref('compactView', (event.target as HTMLInputElement).checked);
  }

  onThemeChange(event: Event): void {
    this.setPref('theme', (event.target as HTMLSelectElement).value);
  }

  onLanguageChange(event: Event): void {
    this.setPref('language', (event.target as HTMLSelectElement).value);
  }
}
