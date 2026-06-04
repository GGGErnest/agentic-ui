import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProfileActivity } from './profile-activity.component';
import { ActivityService } from '../../../services/activity.service';

describe('ProfileActivity', () => {
  let component: ProfileActivity;
  let fixture: ComponentFixture<ProfileActivity>;
  let activityService: ActivityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileActivity],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileActivity);
    component = fixture.componentInstance;
    activityService = TestBed.inject(ActivityService);
  });

  it('getRecentActivity returns empty list when no events exist', async () => {
    const result = await component.agenticActions
      .find((a) => a.name === 'getRecentActivity')
      ?.execute({});

    expect(result?.success).toBe(true);
    expect(result?.data).toEqual([]);
  });

  it('getRecentActivity returns up to default limit of 10 events', async () => {
    // Add 15 events
    for (let i = 0; i < 15; i++) {
      activityService.log({
        type: 'task_created',
        description: `Event ${i}`,
      });
    }

    const result = await component.agenticActions
      .find((a) => a.name === 'getRecentActivity')
      ?.execute({});

    expect(result?.success).toBe(true);
    expect(result?.data).toHaveLength(10);
  });

  it('getRecentActivity respects a custom limit parameter', async () => {
    // Add 15 events
    for (let i = 0; i < 15; i++) {
      activityService.log({
        type: 'task_created',
        description: `Event ${i}`,
      });
    }

    const result = await component.agenticActions
      .find((a) => a.name === 'getRecentActivity')
      ?.execute({ limit: 5 });

    expect(result?.success).toBe(true);
    expect(result?.data).toHaveLength(5);
  });

  it('clearActivity has requiresApproval: true and clears all events', async () => {
    // Add events
    for (let i = 0; i < 5; i++) {
      activityService.log({
        type: 'task_created',
        description: `Event ${i}`,
      });
    }

    const clearAction = component.agenticActions.find((a) => a.name === 'clearActivity');
    expect(clearAction?.requiresApproval).toBe(true);

    const result = await clearAction?.execute({});

    expect(result?.success).toBe(true);
    expect(activityService.events().length).toBe(0);
  });

  it('template renders events from ActivityService', async () => {
    activityService.log({
      type: 'task_created',
      description: 'Test event description',
    });

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Test event description');
  });
});
