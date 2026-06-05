## Agentic-UI API Reference Index

Source of truth: `projects/agentic-ui/src/public-api.ts`.

### World

- `AgentWorldService`
- `AgentAction`
- `AgentActionDef`
- `AgentActionResult`
- `ActionParameter`
- `ToolRenderContext`
- `ToolRenderMode`
- `WorldEntry`
- `WorldSnapshot`
- `ToolDefinition`
- `SnapshotConfig`

### Schema

- `AgentJsonSchema`
- `JsonSchemaProperty`

### State / Readables

- `AgentReadable`
- `AgentReadableDef`
- `AgentReadableResult`
- `AgentWritableResult`

### Harness

- `AgentHarness`
- `LLM_PROVIDER`
- `AgentStep`
- `RunCycleConfig`
- `ConversationHistory`
- `LLMProvider`
- `LLMMessage`
- `LLMStreamChunk`
- `ToolCall`

### Events

- full events barrel from `./lib/core/events`
- includes AG-UI event factories, event types, guards, and run models

### Approval And Interrupts

- `AgentApprovalService`
- `ApprovalTicket`
- `InterruptRegistryService`
- `PendingInterrupt`

### Transport

- `AGENT_TRANSPORT`
- `DirectLLMTransport`
- `AgUiHttpTransport`
- `AgUiHttpTransportConfig`
- `AgentTransport`
- `McpToolAdapterService`
- `McpTool`
- `McpToolExecutionResult`
- `WebsocketTransportService`
- `WebSocketState`
- `ReconnectState`
- JSON-RPC transport types:
  - `JsonRpcRequest`
  - `JsonRpcSuccessResponse`
  - `JsonRpcErrorResponse`
  - `JsonRpcNotification`
  - `JsonRpcError`
  - `JsonRpcMessage`
  - `JSON_RPC_ERROR_CODES`

### Runtime

- `RuntimeProxyService`

### Generative

- `AgentToolRendererComponent`

### Component Contract

- `AgenticComponent`
- `AGENTIC_COMPONENT`

### Directives

- `AgenticDirective`

### Dropzone

- `DropzoneDirective`
- `ComponentRegistry`
- `RenderMode`
- `RenderConfig`
- `RenderResult`
- `ComponentMetadata`

### Providers

- `OpenAiProvider`
- `provideOpenAi`
- `OpenAiProviderConfig`

### Components

Shell:
- `AgentShellComponent`
- `TelemetryOverlayComponent`

Facade / table:
- `DataTableComponent`
- `DataRow`
- `RowQuery`
- `BulkEditOp`
- `DataTableResult`

Approval:
- `AgentApprovalDialogComponent`

### Notes

- `ToolRenderMode` is generative-UI render placement metadata.
- `RenderMode` is dropzone render behavior metadata. They are different types.
- Prefer importing from the public barrel instead of deep internal paths.
