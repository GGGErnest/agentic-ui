import { InjectionToken, Signal } from '@angular/core';
import { AgentAction } from './agent-action.model';
import { AgentReadable } from '../state/agent-readable.model';

export interface AgenticComponent {
  agenticId: string | Signal<string>;
  agenticRole?: string;
  agenticActions: AgentAction[];
  agenticReadables?: AgentReadable[];
  agenticMetadata?: Record<string, unknown>;
}

export const AGENTIC_COMPONENT = new InjectionToken<AgenticComponent>('AGENTIC_COMPONENT');
