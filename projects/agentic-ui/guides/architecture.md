## Agentic-UI Architecture

Agentic-UI is an Angular-first framework for building interfaces that an agent can reason about safely. Instead of asking an LLM to scrape raw DOM and guess what to click, the application publishes structured capabilities through a World Registry. The agent then works with typed actions, typed state, and AG-UI-shaped runtime events.

### World Registry

`AgentWorldService` is runtime source of truth for what the agent can see and do. Components register through the `agentic` directive or the `AGENTIC_COMPONENT` token. Each registered entry contributes:

- an `id` and human-readable `role`
- `actions` the agent can call
- `readables` the agent can inspect or update
- optional `metadata`
- an optional DOM element used for viewport scoping

The world stores entries in a signal-backed `Map`, computes the currently visible subset, and exposes tool definitions plus readable state through `snapshot()`. This keeps prompts grounded and compact.

### Harness And Event Reduction

`AgentHarness` coordinates conversation state, event collection, and reducer-projected UI state. It owns:

- conversation history (`messages`)
- system prompt
- append-only `AgentEvent[]` log
- computed shell state reduced from that log

The harness does not mutate shell state directly. Instead, it feeds the event log through `reduceAgentTimeline`, producing `AgentTimelineState`. That split gives you replayable runs, transport independence, and a single place to project UI state.

`runCycle()` is the older local ReAct loop still used by the current shell. The newer `runWithEvents()` and `resume()` paths delegate execution to an `AgentTransport`, then reduce the emitted AG-UI events into shell state.

### Transport Abstraction

`AgentTransport` is execution boundary:

```ts
interface AgentTransport {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
  resume(input: AgentRunInput): AsyncIterable<AgentEvent>;
}
```

Current implementations:

- `DirectLLMTransport` for in-process LLM execution
- `AgUiHttpTransport` for remote HTTP + SSE execution
- `RuntimeProxyService` as a browser-safe SSE helper for server proxy setups

The harness and reducer do not care which transport produced the events. That is what lets the same UI work against a local dev model or a remote runtime backend.

### Interrupt And Resume Flow

Actions can opt into approval with `requiresApproval`. In the direct transport path, `DirectLLMTransport` checks that flag before execution. If approval is required, it:

1. creates an approval ticket through `AgentApprovalService`
2. stores a pending interrupt in `InterruptRegistryService`
3. emits `RUN_FINISHED` with `outcome: 'interrupt'`
4. stops the run

Resumption is explicit. The caller sends a new `AgentRunInput` with `parentRunId` plus a `resume` map keyed by interrupt id. Each decision is one of:

- `approved`
- `rejected`
- `value`

The transport replays the tool-call events, executes approved actions when needed, and emits a new terminal `RUN_FINISHED` event.

### Generative UI Philosophy

Agentic-UI does not ask the model to generate arbitrary HTML. Instead, actions can declare Angular-native rendering metadata:

- `renderComponent`
- `renderInputs`
- `renderMode`

When a matching tool call appears in the reduced timeline, the shell looks up the action metadata from the world registry and mounts `AgentToolRendererComponent`. That renderer creates a real Angular component and feeds it typed inputs with `ComponentRef.setInput()`.

The model chooses *which tool to run*. Angular owns *how the UI is rendered*.

### Mental Model

Think in layers:

1. World Registry defines capabilities.
2. Transport executes a run and emits AG-UI events.
3. Harness stores the event log and reduces it into state.
4. Shell and custom renderer components project that state into Angular UI.

That separation is what makes Agentic-UI portable across local transports, remote transports, approval workflows, and Angular-native generative UI.
