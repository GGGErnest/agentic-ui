## Migration Notes: Standalone Agentic-UI

These notes help if you previously depended on older module-based or pre-standalone patterns.

### `AgenticUiModule` Is Gone

There is no module wrapper to import anymore. Configure the library directly in `bootstrapApplication`.

```ts
bootstrapApplication(AppComponent, {
  providers: [
    AgentHarness,
    DirectLLMTransport,
    { provide: AGENT_TRANSPORT, useExisting: DirectLLMTransport },
    { provide: LLM_PROVIDER, useFactory: () => provideOpenAi({ apiKey: 'local-only' }) },
  ],
});
```

`AgentWorldService` is `providedIn: 'root'`, so you usually do not need to list it explicitly. If you prefer making all runtime services visible in one place, adding it to `providers` is harmless.

### Import Directives And Components Explicitly

Instead of importing a shared module, import standalone pieces where you use them:

- `AgenticDirective`
- `AgentShellComponent`
- `DropzoneDirective`
- `DataTableComponent`
- `AgentApprovalDialogComponent`

### Outputs And View Queries

If your app code still uses older Angular patterns around Agentic-UI integrations, move with Angular's standalone-era APIs:

- prefer `output()` over new `EventEmitter`-based wrappers
- prefer `viewChild()` / `viewChildren()` over decorator-based query patterns when writing new components

Agentic-UI's current standalone surface is designed to fit naturally into signal-first Angular code.

### `CommonModule` Is Not Re-Exported

Do not rely on a library module to re-export Angular core directives or pipes. Import the Angular features you use directly in each standalone component, for example:

- `NgIf`
- `NgFor`
- `DatePipe`

### Transport Setup Is Explicit Now

Choose your transport in app bootstrap:

- `DirectLLMTransport` for local or trusted development
- `AgUiHttpTransport` for remote runtime execution
- `RuntimeProxyService` as a browser-safe helper around a server SSE endpoint

That explicit setup replaces the old expectation that a single module import would wire runtime behavior for you.

### Suggested Migration Order

1. Remove any old module import.
2. Add explicit providers in `bootstrapApplication`.
3. Import standalone directives/components where used.
4. Swap any old wrapper patterns to signal-era Angular APIs.
5. Move production browser usage to `AgUiHttpTransport` or a proxy-backed runtime flow.
