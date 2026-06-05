/**
 * Agentic-UI Public API
 *
 * Framework for building agent-instrumentable Angular SPAs.
 * Components register their capabilities through a World Registry
 * instead of the agent scraping the DOM.
 */

// Core — World Registry (values)
export { AgentWorldService } from './lib/core/world/agent-world.service';

// Core — World Registry (types)
export type {
  AgentAction,
  AgentActionDef,
  AgentActionResult,
  ActionParameter,
} from './lib/core/world/agent-action.model';
export type {
  WorldEntry,
  WorldSnapshot,
  ToolDefinition,
  SnapshotConfig,
} from './lib/core/world/world-entry.interface';

// Core — Schema
export type {
  AgentJsonSchema,
  JsonSchemaProperty,
} from './lib/core/schema/agent-json-schema.model';

// Core — State (Readables)
export type {
  AgentReadable,
  AgentReadableDef,
  AgentReadableResult,
  AgentWritableResult,
} from './lib/core/state/agent-readable.model';

// Core — Harness (values)
export { AgentHarness } from './lib/core/harness/agent-harness.service';
export { LLM_PROVIDER } from './lib/core/providers/llm-provider.token';

// Core — Harness (types)
export type {
  AgentStep,
  RunCycleConfig,
  ConversationHistory,
} from './lib/core/harness/agent-harness.service';
export type {
  LLMProvider,
  LLMMessage,
  LLMStreamChunk,
  ToolCall,
} from './lib/core/harness/llm-provider.interface';

// Core — Events
export * from './lib/core/events';

// Core — Approval Gate
export { AgentApprovalService } from './lib/core/approval/agent-approval.service';
export type { ApprovalTicket } from './lib/core/approval/agent-approval.service';

// Core — MCP Transport (types)
export type {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,
} from './lib/core/transport/json-rpc.models';
export { JSON_RPC_ERROR_CODES } from './lib/core/transport/json-rpc.models';

// Core — Agent Transport
export { AGENT_TRANSPORT } from './lib/core/transport/agent-transport.token';
export { DirectLLMTransport } from './lib/core/transport/direct-llm-transport.service';
export type { AgentTransport } from './lib/core/transport/agent-transport.interface';

// Core — MCP Transport (values)
export { McpToolAdapterService } from './lib/core/transport/mcp-tool-adapter.service';
export type { McpTool, McpToolExecutionResult } from './lib/core/transport/mcp-tool-adapter.service';

export { WebsocketTransportService, WebSocketState } from './lib/core/transport/websocket-transport.service';
export type { ReconnectState } from './lib/core/transport/websocket-transport.service';

// Core — Component Contract
export type { AgenticComponent } from './lib/core/world/agentic-component.token';
export { AGENTIC_COMPONENT } from './lib/core/world/agentic-component.token';

// Directives
export { AgenticDirective } from './lib/directives/agentic.directive';

// Directives — Dropzone
export { DropzoneDirective } from './lib/core/dropzone/dropzone.directive';
export { ComponentRegistry } from './lib/core/dropzone/component-registry.service';
export type {
  RenderMode,
  RenderConfig,
  RenderResult,
} from './lib/core/dropzone/dropzone.models';
export type { ComponentMetadata } from './lib/core/dropzone/component-registry.service';

// Providers
export { OpenAiProvider, provideOpenAi } from './lib/core/providers/openai-provider.service';
export type { OpenAiProviderConfig } from './lib/core/providers/openai-provider.service';

// Components — Shell
export { AgentShellComponent } from './lib/directives/components/agent-shell/agent-shell.component';
export { TelemetryOverlayComponent } from './lib/directives/components/telemetry-overlay/telemetry-overlay.component';

// Components — Facades
export { DataTableComponent } from './lib/components/data-table/data-table.component';
export type {
  DataRow,
  RowQuery,
  BulkEditOp,
  DataTableResult,
} from './lib/components/data-table/data-table.models';

// Components — Approval
export { AgentApprovalDialogComponent } from './lib/components/approval-dialog/agent-approval-dialog.component';
