# Agentic-UI

**Framework for building AI agent-instrumentable Angular SPAs.**

Instead of the agent scraping the DOM and clicking CSS selectors, components *register their capabilities* through a World Registry. The agent calls semantic tools like `data-table-1__findRow` rather than `document.querySelector('.row:nth-child(5)')`. This architecture survives UI refactors, minification, and framework changes.

## Architecture

```
┌──────────────────────────────────────┐
│           Agent Shell (UI)           │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ Chat UI  │  │ Approval Dialog  │ │
│  └────┬─────┘  └────────┬─────────┘ │
│       │                 │            │
│  ┌────▼─────────────────▼──────────┐ │
│  │        AgentHarness (Brain)     │ │
│  │  ┌──────────┐  ┌─────────────┐  │ │
│  │  │ ReAct    │  │ Step History │  │ │
│  │  │ Loop     │  │ + Telemetry  │  │ │
│  │  └────┬─────┘  └─────────────┘  │ │
│  └───────┼─────────────────────────┘ │
│          │                            │
│  ┌───────▼─────────────────────────┐ │
│  │  AgentWorldService (S. Cortex)  │ │
│  │  ┌────────────┐ ┌────────────┐  │ │
│  │  │ Registry   │ │ Shadow Mode│  │ │
│  │  └────────────┘ └────────────┘  │ │
│  │  ┌────────────┐ ┌────────────┐  │ │
│  │  │ Approval   │ │ Scoping    │  │ │
│  │  │ Gate       │ │ (IObserver)│  │ │
│  │  └────────────┘ └────────────┘  │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  Facade Components              │ │
│  │  ┌──────────┐ ┌──────────────┐  │ │
│  │  │DataTable │ │  More...     │  │ │
│  │  └──────────┘ └──────────────┘  │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
            │
    ┌───────▼────────┐
    │  LLM Provider   │
    │  (OpenAI/Claude/│
    │   local model)  │
    └────────────────┘
```

## Quick Start

### Install

```bash
npm install agentic-ui
```

### Setup

```typescript
// app.config.ts
import { provideOpenAi } from 'agentic-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideOpenAi({
      apiKey: 'sk-...',
      model: 'gpt-4o',       // default
      temperature: 0.1,      // low = reliable tool use
    }),
  ],
};
```

### Add Agent Shell to your app

```html
<!-- app.component.html -->
<agui-agent-shell />

<!-- Your content — components register automatically -->
<agui-data-table 
  agenticId="users-table" 
  [columns]="['name', 'email', 'role']"
  [data]="users"
/>
```

### Instrument any component with [agentic]

```html
<button
  agentic
  agenticId="submit-btn"
  role="Form Action"
  [actions]="[
    { 
      name: 'submit', 
      description: 'Submit the form', 
      execute: () => this.onSubmit() 
    }
  ]"
>
  Submit
</button>
```

## Core Concepts

### World Registry (Sensory Cortex)

Every component with `[agentic]` registers its ID, role, and actions in a Signal-based Map. The World Registry is the single source of truth the agent queries.

### Contextual Scoping (IntersectionObserver)

Only **visible** components are reported to the LLM. When you scroll a component out of the viewport, its tools disappear from the agent's context. This prevents token bloat on large pages.

### Snapshot Budget Control

Control LLM token usage with budget configs:

```typescript
// In AgentWorldService
const snap = world.snapshot({
  maxTools: 10,                          // cap tool definitions
  maxContextLen: 1000,                   // cap context string
  priorityRoles: ['DataTable', 'Modal'],  // these appear first
});
```

### Facade Pattern

Instead of instrumenting every cell/row/button, expose a **high-level API** that turns the agent from a "DOM clicker" into a "power user":

```typescript
// DataTable exposes: findRow, bulkEdit, bulkDelete, sortBy, filterBy
// Agent calls: data-table-1__bulkEdit({ ids: ['1','2'], changes: { status: 'done' } })
```

### ReAct Loop (Brain)

The harness runs a Reason + Act cycle:

1. **Perceive** — generate world snapshot (visible tools only)
2. **Reason** — send to LLM, stream thought tokens
3. **Act** — dispatch tool calls to World Registry
4. **Observe** — wait for UI stability, record results
5. **Repeat** — until no more tool calls

### Approval Gates

Actions marked `requiresApproval: true` pause the harness and show a dialog:

```typescript
actions: [{
  name: 'bulkDelete',
  description: 'Delete multiple rows',
  requiresApproval: true,    // ← user must approve first
  execute: (params) => this.doBulkDelete(params),
}]
```

The harness blocks until user clicks Approve or Reject. Shadow mode bypasses approval (for testing).

### Shadow Mode

Toggle shadow mode to simulate agent actions without executing them:

```typescript
world.shadowMode.set(true);   // All actions return [SHADOW] simulation
world.shadowMode.set(false);  // Back to live execution
```

## API Reference

### Exports

| Export | Type | Description |
|---|---|---|
| `AgentWorldService` | Service | World Registry — register, execute, snapshot |
| `AgentHarness` | Service | ReAct loop — run cycles, manage conversation |
| `AgentApprovalService` | Service | Human-in-the-loop gate for destructive actions |
| `AgenticDirective` | Directive | `[agentic]` — bridge components to registry |
| `DataTableComponent` | Component | Facade reference implementation |
| `AgentShellComponent` | Component | Floating chat UI + telemetry + approval dialog |
| `AgentApprovalDialogComponent` | Component | Modal approve/reject for destructive actions |
| `OpenAiProvider` | Class | OpenAI-compatible LLM provider |
| `LLM_PROVIDER` | Token | DI token for LLM provider injection |

### Types

- `AgentAction` / `AgentActionDef` / `AgentActionResult` / `ActionParameter`
- `WorldEntry` / `WorldSnapshot` / `ToolDefinition` / `SnapshotConfig`
- `AgentStep` / `RunCycleConfig` / `ConversationHistory`
- `LLMProvider` / `LLMMessage` / `LLMStreamChunk` / `ToolCall`
- `ApprovalTicket`
- `DataRow` / `RowQuery` / `BulkEditOp` / `DataTableResult`

### Conversation Export/Import

```typescript
// Save state
const history = harness.exportConversation();
localStorage.setItem('agent-conversation', JSON.stringify(history));

// Restore later
const saved = JSON.parse(localStorage.getItem('agent-conversation'));
harness.importConversation(saved);
```

### Run Cycle Config

```typescript
await harness.runCycle('Delete row 42', {
  timeoutMs: 30_000,     // abort after 30s (default: 60s)
  maxSteps: 5,           // max tool calls per cycle (default: 10)
  signal: abort.signal,  // external AbortSignal
});
```

## Writing a Facade Component

```typescript
@Component({ selector: 'my-chart', ... })
export class MyChartComponent implements OnInit, OnDestroy {
  private readonly world: AgentWorldService;

  constructor(world?: AgentWorldService) {
    this.world = world ?? inject(AgentWorldService);
  }

  @Input({ required: true }) agenticId!: string;

  ngOnInit(): void {
    this.world.register({
      id: this.agenticId,
      role: 'Chart',
      actions: [
        {
          name: 'zoomToRange',
          description: 'Zoom chart to a date range',
          parameters: [
            { name: 'from', type: 'string', description: 'Start date ISO', required: true },
            { name: 'to', type: 'string', description: 'End date ISO', required: true },
          ],
          execute: (params) => this.doZoom(params),
        },
        {
          name: 'exportData',
          description: 'Export chart data as CSV',
          execute: () => this.doExport(),
        },
      ],
      metadata: { type: 'line-chart' },
    });
  }

  ngOnDestroy(): void {
    this.world.unregister(this.agenticId);
  }

  private async doZoom(params?: Record<string, unknown>): Promise<AgentActionResult> {
    // ... implement zoom
    return { success: true, message: 'Zoomed to range.' };
  }
}
```

## License

MIT
