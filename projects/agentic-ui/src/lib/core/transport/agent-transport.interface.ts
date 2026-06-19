import { AgentEvent } from '../events/agent-event.model';
import { AgentRunInput } from '../events/agent-run.model';

export interface AgentTransport {
  /**
   * Drive an agent run. An optional `AbortSignal` cancels the underlying
   * request/stream; on abort the transport should emit a terminal
   * `RUN_ERROR` + `RUN_FINISHED(outcome:'error')`.
   */
  run(input: AgentRunInput, signal?: AbortSignal): AsyncIterable<AgentEvent>;
  resume(input: AgentRunInput, signal?: AbortSignal): AsyncIterable<AgentEvent>;
}
