import { AgentEvent } from '../events/agent-event.model';
import { AgentRunInput } from '../events/agent-run.model';

export interface AgentTransport {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}
