import { TestBed } from '@angular/core/testing';
import { ProfileIdentity } from './profile-identity';
import { ActivityService } from '../../../services/activity.service';
import { vi } from 'vitest';

describe('ProfileIdentity', () => {
  let component: ProfileIdentity;
  let activityService: ActivityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [ProfileIdentity, ActivityService],
    }).compileComponents();

    component = TestBed.inject(ProfileIdentity);
    activityService = TestBed.inject(ActivityService);
  });

  it('should start in view mode', () => {
    expect(component.isEditing()).toBe(false);
  });

  it('getProfile should return current field values', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'getProfile')
      ?.execute({});
    expect(result?.success).toBe(true);
    expect(result?.data).toEqual(component.profile());
  });

  it('startEdit should switch to edit mode and copy values', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'startEdit')
      ?.execute({});
    expect(result?.success).toBe(true);
    expect(component.isEditing()).toBe(true);
    expect(component.editName()).toBe(component.profile().name);
    expect(component.editEmail()).toBe(component.profile().email);
    expect(component.editBio()).toBe(component.profile().bio);
    expect(component.editRole()).toBe(component.profile().role);
    expect(component.editDepartment()).toBe(component.profile().department);
  });

  it('updateField should update a field while in edit mode', async () => {
    component.isEditing.set(true);
    component.editName.set('John Doe');

    const result = await component.agenticActions
      .find((a) => a.name === 'updateField')
      ?.execute({ field: 'name', value: 'Jane Doe' });

    expect(result?.success).toBe(true);
    expect(component.editName()).toBe('Jane Doe');
  });

  it('updateField should fail when not in edit mode', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'updateField')
      ?.execute({ field: 'name', value: 'Jane Doe' });

    expect(result?.success).toBe(false);
    expect(result?.message).toContain('edit mode');
  });

  it('updateField should fail for unknown field', async () => {
    component.isEditing.set(true);

    const result = await component.agenticActions
      .find((a) => a.name === 'updateField')
      ?.execute({ field: 'unknown', value: 'value' });

    expect(result?.success).toBe(false);
    expect(result?.message).toContain('Unknown field');
  });

  it('saveProfile should save changes and exit edit mode', async () => {
    component.isEditing.set(true);
    component.editName.set('Jane Doe');
    component.editEmail.set('jane@example.com');
    component.editBio.set('New bio');
    component.editRole.set('Lead Engineer');
    component.editDepartment.set('Engineering');

    const result = await component.agenticActions
      .find((a) => a.name === 'saveProfile')
      ?.execute({});

    expect(result?.success).toBe(true);
    expect(component.isEditing()).toBe(false);
    expect(component.profile().name).toBe('Jane Doe');
    expect(component.profile().email).toBe('jane@example.com');
    expect(component.profile().bio).toBe('New bio');
    expect(component.profile().role).toBe('Lead Engineer');
    expect(component.profile().department).toBe('Engineering');
  });

  it('saveProfile should fail when name is empty', async () => {
    component.isEditing.set(true);
    component.editName.set('');

    const result = await component.agenticActions
      .find((a) => a.name === 'saveProfile')
      ?.execute({});

    expect(result?.success).toBe(false);
    expect(result?.message).toContain('Name');
  });

  it('saveProfile should log profile_updated event', async () => {
    const logSpy = vi.spyOn(activityService, 'log');
    component.isEditing.set(true);
    component.editName.set('Jane Doe');

    await component.agenticActions.find((a) => a.name === 'saveProfile')?.execute({});

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'profile_updated',
        description: expect.any(String),
      })
    );
  });

  it('cancelEdit should discard changes and exit edit mode', async () => {
    const originalName = component.profile().name;
    component.isEditing.set(true);
    component.editName.set('Jane Doe');

    const result = await component.agenticActions
      .find((a) => a.name === 'cancelEdit')
      ?.execute({});

    expect(result?.success).toBe(true);
    expect(component.isEditing()).toBe(false);
    expect(component.profile().name).toBe(originalName);
  });

  it('initials should return max 2 uppercase characters from name', () => {
    component.profile.set({
      ...component.profile(),
      name: 'Alex Rivera',
    });
    expect(component.initials).toBe('AR');

    component.profile.set({
      ...component.profile(),
      name: 'J',
    });
    expect(component.initials).toBe('J');
  });
});
