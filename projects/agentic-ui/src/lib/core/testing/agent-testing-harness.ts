import { inject, Injectable } from '@angular/core';
import { AgentWorldService } from '../world/agent-world.service';
import { AgentActionResult } from '../world/agent-action.model';
import { WorldEntry, WorldSnapshot } from '../world/world-entry.interface';

@Injectable({ providedIn: 'root' })
export class AgentTestingHarness {
  private readonly world = inject(AgentWorldService);

  snapshot(): WorldSnapshot {
    return this.world.snapshot();
  }

  async execute(
    entryId: string,
    actionName: string,
    params?: Record<string, unknown>,
  ): Promise<AgentActionResult> {
    return this.world.executeAction(entryId, actionName, params);
  }

  listEntries(): WorldEntry[] {
    return [...this.world.entries().values()];
  }
}
