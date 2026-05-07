import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentWorldService } from './core/world/agent-world.service';
import { AgentHarness } from './core/harness/agent-harness.service';
import { LLMProvider } from './core/harness/llm-provider.interface';
import { LLM_PROVIDER } from './core/providers/llm-provider.token';
import { AgenticDirective } from './directives/agentic.directive';
import { AgentShellComponent } from './directives/components/agent-shell/agent-shell.component';
import { TelemetryOverlayComponent } from './directives/components/telemetry-overlay/telemetry-overlay.component';

/**
 * AgenticUiModule — the core module of the Agentic-UI framework.
 *
 * Import this in your AppModule and provide an LLM implementation:
 *
 * ```typescript
 * @NgModule({
 *   imports: [AgenticUiModule.forRoot(llmProvider)],
 * })
 * export class AppModule {}
 * ```
 *
 * Or use standalone components:
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     { provide: LLM_PROVIDER, useClass: MyLLMProvider },
 *     AgentHarness,
 *   ]
 * });
 * ```
 */
@NgModule({
  imports: [
    CommonModule,
    AgenticDirective,
    AgentShellComponent,
    TelemetryOverlayComponent,
  ],
  exports: [
    AgenticDirective,
    AgentShellComponent,
    TelemetryOverlayComponent,
  ],
})
export class AgenticUiModule {
  /**
   * Configure the module with an LLM provider.
   * The harness service must also be provided.
   */
  static forRoot(llmProvider: new (...args: any[]) => LLMProvider): ModuleWithProviders<AgenticUiModule> {
    return {
      ngModule: AgenticUiModule,
      providers: [
        AgentWorldService,
        AgentHarness,
        { provide: LLM_PROVIDER, useClass: llmProvider },
      ],
    };
  }
}
