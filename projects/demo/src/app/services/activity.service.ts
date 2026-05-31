import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'task_created' | 'task_edited' | 'task_deleted' | 'profile_updated' | 'preference_changed';
  description: string;
  metadata?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private _events = signal<ActivityEvent[]>([]);

  readonly events = this._events.asReadonly();

  log(event: Omit<ActivityEvent, 'id' | 'timestamp'>): void {
    const newEvent: ActivityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    this._events.update(current => [newEvent, ...current]);
  }

  clear(): void {
    this._events.set([]);
  }
}
