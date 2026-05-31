import { TestBed } from '@angular/core/testing';
import { ProfilePreferences, UserPreferences } from './profile-preferences';
import { ActivityService } from '../../../services/activity.service';
import { vi } from 'vitest';

describe('ProfilePreferences', () => {
  let component: ProfilePreferences;
  let activityService: ActivityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [ProfilePreferences, ActivityService],
    }).compileComponents();

    component = TestBed.inject(ProfilePreferences);
    activityService = TestBed.inject(ActivityService);
  });

  it('getPreferences should return all current values with correct types', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'getPreferences')
      ?.execute({});

    expect(result?.success).toBe(true);
    const data = result?.data as UserPreferences;
    expect(typeof data.emailNotifications).toBe('boolean');
    expect(typeof data.pushNotifications).toBe('boolean');
    expect(typeof data.compactView).toBe('boolean');
    expect(['dark', 'light']).toContain(data.theme);
    expect(['en', 'es', 'fr']).toContain(data.language);
  });

  it('setPreference should update a boolean preference (emailNotifications → false)', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'emailNotifications', value: false });

    expect(result?.success).toBe(true);
    expect(component.prefs().emailNotifications).toBe(false);
  });

  it('setPreference should update a string preference (language → es)', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'language', value: 'es' });

    expect(result?.success).toBe(true);
    expect(component.prefs().language).toBe('es');
  });

  it('setPreference should fail for unknown key', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'unknownKey', value: 'someValue' });

    expect(result?.success).toBe(false);
    expect(result?.message).toContain('Unknown');
  });

  it('setPreference should log a preference_changed ActivityEvent', async () => {
    const logSpy = vi.spyOn(activityService, 'log');

    await component.agenticActions
      .find((a) => a.name === 'setPreference')
      ?.execute({ key: 'theme', value: 'light' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'preference_changed',
        description: expect.any(String),
      })
    );
  });
});

