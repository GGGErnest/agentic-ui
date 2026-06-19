# Agentic-UI

A framework for building **agent-instrumentable Angular SPAs**.

Instead of an LLM agent scraping the DOM to figure out what it can do, your
components **register their capabilities** into a central _World Registry_.
The agent perceives a clean, structured snapshot of the page (visible
components, their actions, and their readable state) and acts through
explicit, validated tool calls — not brittle DOM selectors.

- **Angular:** `^21.2.0` (standalone, signals-first)
- **Library selector prefix:** `agui-`
- **Core directive:** `[agentic]`

---

## Table of Contents

1. [Concepts](#concepts)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Instrumenting Components](#instrumenting-components)
   - [Token mode](#token-mode-angular-components)
   - [Input mode](#input-mode-native-elements--third-party)
   - [Actions](#actions)
   - [Readables (state)](#readables-state)
5. [The Agent Harness](#the-agent-harness)
6. [LLM Providers](#llm-providers)
7. [Transports](#transports)
8. [Human-in-the-Loop (Approval & Interrupts)](#human-in-the-loop-approval--interrupts)
9. [Generative UI (Dropzone)](#generative-ui-dropzone)
10. [Facade Components](#facade-components)
11. [UI Components](#ui-components)
12. [Events](#events)
13. [API Reference](#api-reference)
14. [Building & Publishing](#building--publishing)

---

## Concepts

| Piece                                    | Role                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **World Registry** (`AgentWorldService`) | The "sensory cortex." Holds every instrumented component and produces an LLM snapshot of _only what is currently visible and unoccluded_. |
| **`[agentic]` directive**                | Bridges any element/component into the World Registry.                                                                                    |
| **Actions**                              | High-level, semantic operations a component exposes (e.g. `deleteSelected`) instead of per-click DOM events.                              |
| **Readables**                            | Component state the agent can read (and optionally write).                                                                                |
| **Agent Harness**                        | The "brain." Runs the ReAct loop: perceive → reason → act → observe.                                                                      |
| **LLM Provider**                         | Pluggable model backend (OpenAI-compatible, mock, etc.).                                                                                  |
| **Transport**                            | How the loop runs: locally (`DirectLLMTransport`), over HTTP/SSE, or over a WebSocket MCP server.                                         |
| **Approval / Interrupt**                 | Human-in-the-loop gate for destructive actions.                                                                                           |
| **Dropzone**                             | Generative UI: the agent mounts registered components into the page at runtime.                                                           |

**Why visibility-scoped?** `AgentWorldService` uses an `IntersectionObserver`
and modal/overlay occlusion detection. The agent only sees tools for
components actually on screen, which keeps the tool list small and relevant.

---

## Installation

```bash
npm install agentic-ui
```

Peer dependencies: `@angular/common` and `@angular/core` `^21.2.0`.

---

## Quick Start

### 1. Wire the harness, transport, and an LLM provider

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  AgentHarness,
  DirectLLMTransport,
  AGENT_TRANSPORT,
  LLM_PROVIDER,
  provideOpenAi,
} from 'agentic-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    AgentHarness,
    DirectLLMTransport,
    { provide: AGENT_TRANSPORT, useExisting: DirectLLMTransport },
    {
      provide: LLM_PROVIDER,
      useFactory: () => provideOpenAi({ apiKey: 'sk-...', model: 'gpt-4o' }),
    },
  ],
};
```

> **Security:** never ship a real API key to the browser. For production, use
> a server proxy with `AgUiHttpTransport` or `RuntimeProxyService` (see
> [Transports](#transports)).

### 2. Mount the agent shell

```ts
// app.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentShellComponent } from 'agentic-ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AgentShellComponent],
  template: `
    <router-outlet />
    <agui-agent-shell />
  `,
})
export class App {}
```

### 3. Instrument a component

```html
<app-profile-identity agentic />
```

That's it. The agent can now see and operate the component when it's on screen.

---

## Instrumenting Components

There are two ways to register a component with the World Registry through the
`[agentic]` directive.

### Token mode (Angular components)

The component implements `AgenticComponent` and self-provides the
`AGENTIC_COMPONENT` token. No template inputs are required — just add `agentic`.

```ts
import { Component, signal } from '@angular/core';
import { AGENTIC_COMPONENT, AgenticComponent, AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-profile-identity',
  templateUrl: './profile-identity.component.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileIdentity }],
})
export class ProfileIdentity implements AgenticComponent {
  readonly agenticId = 'profile-identity';
  readonly agenticRole = 'User Identity';

  private readonly profile = signal({ name: 'Ada', email: 'ada@x.com' });

  readonly agenticActions: AgentAction[] = [
    {
      name: 'getProfile',
      description: 'Retrieve the current user profile data.',
      execute: async () => ({
        success: true,
        message: 'Profile retrieved.',
        data: { ...this.profile() },
      }),
    },
    {
      name: 'updateField',
      description: 'Update a profile field while editing.',
      parameters: [
        {
          name: 'field',
          type: 'string',
          required: true,
          description: 'Which field to update',
          enum: ['name', 'email'],
        },
        { name: 'value', type: 'string', required: true, description: 'New value' },
      ],
      execute: async (params) => {
        // ...apply the change
        return { success: true, message: 'Field updated.' };
      },
    },
  ];
}
```

```html
<!-- In the parent template — zero inputs needed in token mode -->
<app-profile-identity agentic />
```

### Input mode (native elements & third-party)

For plain DOM elements or components you don't control, pass capabilities via
directive inputs.

```html
<div
  agentic
  agenticId="task-ops"
  role="Task Operations"
  [actions]="pageActions"
  [readables]="pageReadables"
>
  ...
</div>
```

`AgenticDirective` inputs:

| Input            | Type                       | Default          | Purpose                                                                                       |
| ---------------- | -------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `agenticId`      | `string \| undefined`      | auto (UUID)      | Stable id. Falls back to the token id, then the element `id`, then a random UUID.             |
| `agenticElement` | `HTMLElement \| undefined` | host             | Register a _different_ element (e.g. a modal card while the directive lives on the backdrop). |
| `role`           | `string`                   | `'UI Component'` | Human-readable role shown in the snapshot.                                                    |
| `actions`        | `AgentAction[]`            | `[]`             | Actions (input mode).                                                                         |
| `readables`      | `AgentReadable[]`          | `[]`             | Readables (input mode).                                                                       |
| `metadata`       | `Record<string, unknown>`  | `{}`             | Extra context for the snapshot.                                                               |

> Ids are validated against `/^[a-zA-Z0-9_-]{1,64}$/` and may not contain `__`
> (reserved for tool-name encoding).

### Actions

An action is a semantic operation. Parameters can be declared with the simple
`parameters` array **or** a full JSON Schema via `inputSchema`.

```ts
import { AgentAction, AgentJsonSchema } from 'agentic-ui';

const schema: AgentJsonSchema = {
  type: 'object',
  properties: {
    column: { type: 'string', description: 'Column to match' },
    value: { type: 'string', description: 'Value to match' },
  },
  required: ['column', 'value'],
  additionalProperties: false,
};

const action: AgentAction = {
  name: 'deleteRowsByCriteria',
  description: 'Delete rows whose column matches a value.',
  inputSchema: schema,
  requiresApproval: true, // gates behind human approval
  execute: async (params) => {
    const { column, value } = params as { column: string; value: string };
    // ...
    return { success: true, message: `Deleted rows where ${column}=${value}` };
  },
};
```

`AgentActionResult` is always `{ success: boolean; message: string; data?: unknown }`.
The `message` is fed back to the LLM so it can self-correct on failure.

### Readables (state)

Readables expose component state to the agent as read (and optional write) tools.

```ts
import { AgentReadable } from 'agentic-ui';

const activeFilter: AgentReadable = {
  name: 'activeFilter',
  description: 'Current priority filter.',
  schema: {
    type: 'object',
    properties: { value: { type: 'string', enum: ['high', 'medium', 'low'] } },
    required: ['value'],
    additionalProperties: false,
  },
  writable: true,
  read: async () => ({ success: true, message: 'ok', value: this.filter() }),
  write: async (v) => {
    this.filter.set(v as string);
    return { success: true, message: 'updated' };
  },
};
```

---

## The Agent Harness

`AgentHarness` is the brain. The most common entry point is `runCycle`, which
runs a ReAct loop (default max 5 cycles, 20 tool steps, 60s timeout):

1. **Perception** — `AgentWorldService.snapshot()` builds `{ context, tools }`
   from visible, unoccluded components.
2. **Reasoning** — streams from the `LLM_PROVIDER`, accumulating thoughts and
   tool calls.
3. **Action** — decodes each tool name and dispatches to
   `world.executeAction()` / `world.updateReadable()`.
4. **Observation** — feeds results back so the model can continue or finish.

```ts
import { Component, inject } from '@angular/core';
import { AgentHarness } from 'agentic-ui';

@Component({
  /* ... */
})
export class MyComponent {
  private readonly harness = inject(AgentHarness);

  async ask() {
    await this.harness.runCycle('Delete all low-priority tasks', {
      timeoutMs: 60_000,
      maxSteps: 20,
    });
  }
}
```

Reactive state exposed as signals: `thought`, `steps`, `chatTurns`,
`isRunning`, and `state` (a projection of the AG-UI event stream).

Other methods: `setSystemPrompt(prompt)`, `reset()`,
`exportConversation()` / `importConversation(history)`,
`runWithEvents(prompt)` (event/transport path), and `resume(input)`
(continue an interrupted run).

Both `runCycle` and `runWithEvents` perform a **multi-turn** ReAct loop: the
agent reasons, dispatches tool calls, observes the results, and loops until the
model emits no further tool calls (or a cycle cap is hit). `runWithEvents`
delegates this loop to the configured `AgentTransport` (the default
`DirectLLMTransport` multi-turns locally); `runCycle` runs it inline. When an
action `requiresApproval`, the loop pauses and emits an interrupt — call
`resume(input)` with the original run's id as `parentRunId` to continue:

```ts
await harness.resume({
  threadId,
  runId, // a fresh id for the resumed run
  parentRunId, // MUST be the interrupted run's id, or resume errors out
  messages,
  resume: { [interruptId]: { decision: 'approved' } },
});
```

> In most apps you don't call the harness directly — `AgentShellComponent`
> does it for you.

---

## LLM Providers

Implement `LLMProvider` or use the built-in OpenAI-compatible one. It works
with OpenAI, Ollama, OpenRouter, Anthropic proxies, etc.

```ts
import { provideOpenAi, LLM_PROVIDER } from 'agentic-ui';

{
  provide: LLM_PROVIDER,
  useFactory: () => provideOpenAi({
    apiUrl: 'https://api.openai.com/v1', // default
    apiKey: 'sk-...',
    model: 'gpt-4o',                     // default
    maxTokens: 4096,                     // default
    temperature: 0.1,                    // default
  }),
}
```

> `OpenAiProvider` logs a one-time dev-mode warning if it is constructed with an
> `apiKey` in a browser context, since the key would be exposed to end users.
> For production, keep the key server-side behind `AgUiHttpTransport` or
> `RuntimeProxyService`.

Custom provider:

```ts
import { LLMProvider, LLMMessage, LLMStreamChunk, ToolDefinition } from 'agentic-ui';

class MyProvider implements LLMProvider {
  async *getStream(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string,
    signal?: AbortSignal,
  ): AsyncIterable<LLMStreamChunk> {
    yield { type: 'thought', text: 'thinking...' };
    yield { type: 'content', text: 'Done.' };
    // yield { type: 'tool_call', data: { id, function: { name, arguments } } };
  }
}
```

---

## Transports

A transport decides _where and how_ the agent loop runs. Provide one via
`AGENT_TRANSPORT`.

| Transport                   | Use case                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `DirectLLMTransport`        | Default. Runs the ReAct loop in the browser against `LLM_PROVIDER`.           |
| `AgUiHttpTransport`         | Streams AG-UI events from a remote endpoint over SSE (keys stay server-side). |
| `RuntimeProxyService`       | Lower-level browser-safe SSE proxy (`/api/agent/run` by default).             |
| `WebsocketTransportService` | JSON-RPC 2.0 over WebSocket to a local MCP server.                            |

### Remote HTTP/SSE

```ts
import { AGENT_TRANSPORT, AgUiHttpTransport } from 'agentic-ui';

{
  provide: AGENT_TRANSPORT,
  useFactory: () => new AgUiHttpTransport({
    endpoint: 'https://api.example.com/agent/run',
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
  }),
}
```

#### Cancellation

`AgentTransport.run`/`resume` accept an optional `AbortSignal`, threaded from
`AgentHarness.runWithEvents(prompt, signal)` / `resume(input, signal)`. The HTTP
and runtime-proxy transports forward it to `fetch` and cancel the response
reader; on abort they emit `RUN_ERROR` (message `"aborted"`) followed by
`RUN_FINISHED(outcome:'error')`. This lets a "stop" button actually cancel the
underlying network stream.

### Local MCP server (WebSocket)

`McpToolAdapterService` converts the World Registry into MCP tool definitions
and executes incoming `tools/call` requests. Tool execution is routed through
`AgentWorldService`, so MCP callers get the **same approval gate and schema
validation** as the LLM path — an `requiresApproval` action invoked over MCP
still pauses for human confirmation. Unknown JSON-RPC methods return a proper
`METHOD_NOT_FOUND` error rather than being treated as tool calls.
`WebsocketTransportService` exposes the registry to a local MCP server:

```ts
import { WebsocketTransportService } from 'agentic-ui';

const ws = inject(WebsocketTransportService);
await ws.connect('ws://localhost:8765');
// ws.reconnectState() -> { state: WebSocketState, ... } with exponential backoff
// ws.disconnect() stops auto-reconnect and rejects any in-flight requests.
```

---

## Human-in-the-Loop (Approval & Interrupts)

Mark any action `requiresApproval: true` to gate it behind a human decision.

**Synchronous (DirectLLMTransport / `runCycle`):** `AgentApprovalService`
queues an `ApprovalTicket`; the `AgentApprovalDialogComponent` (rendered inside
`AgentShellComponent`) shows it. The action's promise resolves when the user
approves or rejects.

**Resumable (event path):** the transport registers a `PendingInterrupt` via
`InterruptRegistryService`, emits `RUN_FINISHED` with `outcome: 'interrupt'`,
and stops. Resume later:

```ts
await harness.resume({
  threadId,
  runId,
  messages,
  resume: { [interruptId]: { decision: 'approved' } },
});
```

`ResumeDecision` is `{ decision: 'approved' }`,
`{ decision: 'rejected'; reason? }`, or `{ decision: 'value'; value }`.

---

## Generative UI (Dropzone)

The agent can mount registered Angular components into the page at runtime.

1. Register components:

```ts
import { ComponentRegistry } from 'agentic-ui';

const registry = inject(ComponentRegistry);
registry.register('statusCard', AgentStatusCardComponent);
```

`ComponentRegistry` is application-scoped (root) and registrations persist
until removed. When you register from a component that comes and goes, use
`registerScoped` from within its injection context to auto-unregister on
destroy:

```ts
constructor() {
  inject(ComponentRegistry).registerScoped('statusCard', AgentStatusCardComponent);
}
```

2. Add a dropzone host:

```html
<div aguiDropzone></div>
```

3. Render into it:

```ts
import { DropzoneDirective } from 'agentic-ui';
import { viewChild } from '@angular/core';

private readonly zone = viewChild(DropzoneDirective);

show() {
  this.zone()?.render('statusCard', { title: 'Done' }, 'replace');
}
```

`render(componentId, inputs?, mode?)` where `mode` is
`'append' | 'replace' | 'clear'`.

Alternatively, attach a `renderComponent` (and `renderInputs`) directly to an
action; `AgentShellComponent` renders it via `AgentToolRendererComponent` as
the tool call progresses.

```ts
{
  name: 'previewTask',
  description: 'Preview a task card.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => ({ success: true, message: 'Preview rendered.' }),
  renderComponent: AgentStatusCardComponent,
  renderInputs: (ctx) => ({ context: ctx }),
}
```

---

## Facade Components

`DataTableComponent` is the reference facade: instead of exposing raw DOM, it
exposes high-level semantic actions (`findRow`, `bulkEdit`, `bulkDelete`,
`sortBy`, `filterBy`, `selectRow`, `getSnapshot`, ...). It self-registers via
the `AGENTIC_COMPONENT` token.

```html
<agui-data-table
  agenticId="task-table"
  title="Tasks"
  [columns]="['title', 'priority', 'status', 'assignee']"
  [data]="tasks()"
  idField="id"
  (rowsDeleted)="onRowsDeleted($event)"
  (bulkEdited)="onRowsEdited($event)"
/>
```

Outputs: `selectionChange`, `rowsDeleted`, `bulkEdited`, `rowEdit`.
Destructive actions (`bulkEdit`, `bulkDelete`) require approval.

Data models: `DataRow`, `RowQuery`, `BulkEditOp`, `DataTableResult`.

---

## UI Components

| Component                      | Selector                 | Purpose                                                                                                               |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `AgentShellComponent`          | `agui-agent-shell`       | The floating agent window: prompt input, suggestions, shadow-mode toggle, approval dialog, generative tool rendering. |
| `TelemetryOverlayComponent`    | `agui-telemetry-overlay` | Highlights the component the agent is currently acting on (green = live, purple = shadow mode).                       |
| `AgentApprovalDialogComponent` | `agui-approval-dialog`   | The approval prompt (rendered inside the shell).                                                                      |
| `AgentToolRendererComponent`   | `agui-tool-renderer`     | Dynamically mounts a component to render a tool call's progress/result.                                               |
| `DataTableComponent`           | `agui-data-table`        | Reference agent-instrumentable data table facade.                                                                     |

**Shadow Mode:** toggle `AgentWorldService.shadowMode` to have the agent
_simulate_ actions (no real execution) — useful for safe demos and dry runs.

---

## Events

The harness reduces an [AG-UI](https://github.com/ag-ui-protocol)-shaped event
stream (mirrors `@ag-ui/core` v0.0.55). Exported from `agentic-ui`:

- **Event types:** `RunStartedEvent`, `RunFinishedEvent`, `RunErrorEvent`,
  `StepStartedEvent`/`StepFinishedEvent`, `TextMessage*Event`,
  `ToolCall*Event`, `StateSnapshotEvent`, `StateDeltaEvent`,
  `MessagesSnapshotEvent`, and the union `AgentEvent`.
- **Factories:** `runStarted`, `runFinished`, `toolCallStart`, `stateDelta`, ...
- **Guards:** `isRunTerminal`, `isTextEvent`, `isToolEvent`, `isStateEvent`.
- **Run input:** `AgentRunInput`, `ResumeDecision`.
- **Tool-name codec:** `ToolNameCodec` encodes `entryId__action__name` /
  `entryId__write__name` (kept within OpenAI's 64-char tool-name limit).

---

## API Reference

### Values

| Export                                                                                                                                 | Kind                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `AgentWorldService`                                                                                                                    | Service (root) — World Registry              |
| `AgentHarness`                                                                                                                         | Service (root) — agent loop                  |
| `LLM_PROVIDER`                                                                                                                         | InjectionToken — your LLM backend            |
| `AGENT_TRANSPORT`                                                                                                                      | InjectionToken — run strategy                |
| `DirectLLMTransport`                                                                                                                   | Service — default transport                  |
| `AgUiHttpTransport`                                                                                                                    | Class — remote SSE transport                 |
| `WebsocketTransportService` / `WebSocketState`                                                                                         | Service / enum — MCP over WS                 |
| `McpToolAdapterService`                                                                                                                | Service — World ⇄ MCP bridge                 |
| `RuntimeProxyService`                                                                                                                  | Service — browser-safe SSE proxy             |
| `AgentApprovalService`                                                                                                                 | Service — approval queue                     |
| `InterruptRegistryService`                                                                                                             | Service — resumable interrupts               |
| `OpenAiProvider` / `provideOpenAi`                                                                                                     | Class / factory — OpenAI-compatible provider |
| `AgenticDirective`                                                                                                                     | Directive `[agentic]`                        |
| `DropzoneDirective` / `ComponentRegistry`                                                                                              | Directive `[aguiDropzone]` / registry        |
| `AGENTIC_COMPONENT`                                                                                                                    | InjectionToken — component contract          |
| `JSON_RPC_ERROR_CODES`                                                                                                                 | Constant                                     |
| `AgentShellComponent`, `TelemetryOverlayComponent`, `AgentApprovalDialogComponent`, `AgentToolRendererComponent`, `DataTableComponent` | Components                                   |

### Types

`AgentAction`, `AgentActionDef`, `AgentActionResult`, `ActionParameter`,
`ToolRenderContext`, `ToolRenderMode`, `WorldEntry`, `WorldSnapshot`,
`ToolDefinition`, `SnapshotConfig`, `AgentJsonSchema`, `JsonSchemaProperty`,
`AgentReadable`, `AgentReadableDef`, `AgentReadableResult`,
`AgentWritableResult`, `AgentStep`, `RunCycleConfig`, `ConversationHistory`,
`LLMProvider`, `LLMMessage`, `LLMStreamChunk`, `ToolCall`, `AgentTransport`,
`AgUiHttpTransportConfig`, `McpTool`, `McpToolExecutionResult`,
`ReconnectState`, `ApprovalTicket`, `PendingInterrupt`, `AgenticComponent`,
`RenderMode`, `RenderConfig`, `RenderResult`, `ComponentMetadata`,
`OpenAiProviderConfig`, `DataRow`, `RowQuery`, `BulkEditOp`, `DataTableResult`,
plus the JSON-RPC and event models.

---

## Building & Publishing

Build the library (output to `dist/agentic-ui`):

```bash
ng build agentic-ui
```

Publish:

```bash
cd dist/agentic-ui
npm publish
```

Run library unit tests (Vitest + jsdom):

```bash
ng test agentic-ui --watch=false
```
