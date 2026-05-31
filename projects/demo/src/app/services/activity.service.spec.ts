import { TestBed } from '@angular/core/testing';
import { ActivityService, ActivityEvent } from './activity.service';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActivityService);
  });

  it('starts with empty events list', () => {
    expect(service.events().length).toBe(0);
  });

  it('log() prepends event with id and timestamp', () => {
    service.log({
      type: 'task_created',
      description: 'Task created'
    });

    const events = service.events();
    expect(events.length).toBe(1);
    expect(events[0].id).toBeDefined();
    expect(events[0].timestamp).toBeDefined();
    expect(events[0].type).toBe('task_created');
    expect(events[0].description).toBe('Task created');
  });

  it('log() prepends — newest first', () => {
    service.log({
      type: 'task_created',
      description: 'First event'
    });

    service.log({
      type: 'task_edited',
      description: 'Second event'
    });

    const events = service.events();
    expect(events.length).toBe(2);
    expect(events[0].description).toBe('Second event');
    expect(events[1].description).toBe('First event');
  });

  it('clear() empties events', () => {
    service.log({
      type: 'task_created',
      description: 'Event'
    });

    expect(service.events().length).toBe(1);

    service.clear();

    expect(service.events().length).toBe(0);
  });
});
