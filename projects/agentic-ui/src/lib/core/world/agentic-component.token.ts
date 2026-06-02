import { InjectionToken, Signal } from '@angular/core';
import { AgentAction } from './agent-action.model';

export interface AgenticComponent {
  agenticId: string | Signal<string>;
  agenticRole?: string;
  agenticActions: AgentAction[];
  agenticMetadata?: Record<string, unknown>;
}

export const AGENTIC_COMPONENT = new InjectionToken<AgenticComponent>('AGENTIC_COMPONENT');
