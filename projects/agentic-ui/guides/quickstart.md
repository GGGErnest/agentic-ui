## Agentic-UI Quick Start

### 1. Install

```bash
npm install agentic-ui
```

### 2. Provide Runtime Services

For local or trusted development, wire the direct transport and an `LLM_PROVIDER` in `bootstrapApplication`.

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import {
  AGENT_TRANSPORT,
  AgentHarness,
  DirectLLMTransport,
  LLM_PROVIDER,
  provideOpenAi,
} from 'agentic-ui';

bootstrapApplication(AppComponent, {
  providers: [
    AgentHarness,
    DirectLLMTransport,
    { provide: AGENT_TRANSPORT, useExisting: DirectLLMTransport },
    {
      provide: LLM_PROVIDER,
      useFactory: () => provideOpenAi({ apiKey: 'server-or-local-dev-only-key' }),
    },
  ],
});
```

`provideOpenAi()` is not browser-safe for production. Use it only in trusted environments.

### 3. Production / Browser-Safe Transport

For production, prefer a server proxy and `AgUiHttpTransport`.

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import {
  AGENT_TRANSPORT,
  AgentHarness,
  AgUiHttpTransport,
  LLM_PROVIDER,
  type LLMProvider,
} from 'agentic-ui';

const noopLlm: LLMProvider = {
  async *getStream() {
    return;
  },
};

bootstrapApplication(AppComponent, {
  providers: [
    AgentHarness,
    {
      provide: AGENT_TRANSPORT,
      useFactory: () => new AgUiHttpTransport({ endpoint: '/api/agent/run' }),
    },
    // Current harness still injects LLM_PROVIDER even when transport is remote.
    { provide: LLM_PROVIDER, useValue: noopLlm },
  ],
});
```

### 4. Register A Component With The `agentic` Directive

Use input mode when you want to expose actions directly from a template.

```ts
import { Component, signal } from '@angular/core';
import { AgenticDirective, type AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-task-page',
  imports: [AgenticDirective],
  template: `
    <section
      agentic
      agenticId="task-ops"
      role="Task Operations"
      [actions]="pageActions"
    >
      <h1>Tasks</h1>
    </section>
  `,
})
export class TaskPageComponent {
  readonly tasks = signal([{ id: '1', title: 'Fix login bug' }]);

  readonly pageActions: AgentAction[] = [
    {
      name: 'createTask',
      description: 'Create a new task.',
      inputSchema: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', description: 'Task title' },
        },
        additionalProperties: false,
      },
      execute: async (params) => {
        const title = String(params?.['title'] ?? '').trim();
        if (!title) return { success: false, message: 'Title is required.' };
        this.tasks.update((items) => [...items, { id: crypto.randomUUID(), title }]);
        return { success: true, message: `Created task \"${title}\".` };
      },
    },
  ];
}
```

### 5. Add The Shell

Mount the shell somewhere near the app root so you can inspect the timeline and send prompts.

```ts
import { Component } from '@angular/core';
import { AgentShellComponent } from 'agentic-ui';

@Component({
  selector: 'app-root',
  imports: [AgentShellComponent],
  template: `
    <router-outlet />
    <agui-agent-shell />
  `,
})
export class AppComponent {}
```

### 6. Next Steps

- Use `readables` to expose structured app state.
- Add `requiresApproval` to destructive actions.
- Use `renderComponent` + `renderInputs` for Angular-native generative UI.
- Move to `AgUiHttpTransport` or `RuntimeProxyService` for browser-safe production setups.
