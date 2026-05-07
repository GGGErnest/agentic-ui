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
export type { AgentAction, AgentActionDef, AgentActionResult, ActionParameter } from './lib/core/world/agent-action.model';
export type { WorldEntry, WorldSnapshot, ToolDefinition, SnapshotConfig } from './lib/core/world/world-entry.interface';

// Core — Harness (values)
export { AgentHarness } from './lib/core/harness/agent-harness.service';
export { LLM_PROVIDER } from './lib/core/providers/llm-provider.token';

// Core — Harness (types)
export type { AgentStep, RunCycleConfig, ConversationHistory } from './lib/core/harness/agent-harness.service';
export type { LLMProvider, LLMMessage, LLMStreamChunk, ToolCall } from './lib/core/harness/llm-provider.interface';

// Core — Approval Gate
export { AgentApprovalService } from './lib/core/approval/agent-approval.service';
export type { ApprovalTicket } from './lib/core/approval/agent-approval.service';

// Directives
export { AgenticDirective } from './lib/directives/agentic.directive';

// Providers
export { OpenAiProvider, provideOpenAi } from './lib/core/providers/openai-provider.service';
export type { OpenAiProviderConfig } from './lib/core/providers/openai-provider.service';

// Components — Shell
export { AgentShellComponent } from './lib/directives/components/agent-shell/agent-shell.component';
export { TelemetryOverlayComponent } from './lib/directives/components/telemetry-overlay/telemetry-overlay.component';

// Components — Facades
export { DataTableComponent } from './lib/components/data-table/data-table.component';
export type { DataRow, RowQuery, BulkEditOp, DataTableResult } from './lib/components/data-table/data-table.models';

// Components — Approval
export { AgentApprovalDialogComponent } from './lib/components/approval-dialog/agent-approval-dialog.component';

// Module
export { AgenticUiModule } from './lib/agentic-ui.module';
