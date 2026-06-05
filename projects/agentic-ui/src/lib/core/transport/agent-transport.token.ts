import { InjectionToken } from '@angular/core';
import { AgentTransport } from './agent-transport.interface';

export const AGENT_TRANSPORT = new InjectionToken<AgentTransport>('AGENT_TRANSPORT');
