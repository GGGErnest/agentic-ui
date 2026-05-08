import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AgentHarness, LLM_PROVIDER } from 'agentic-ui';
import { environment } from '../environments/environment';
import { createDemoLlmProvider } from './llm/demo-llm-provider.factory';

/**
 * Demo app configuration.
 * Uses environment-based provider selection to switch between mock and backend LLM.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // Provide the AgentHarness service
    AgentHarness,

    // LLM Provider selected based on environment
    {
      provide: LLM_PROVIDER,
      useFactory: () => createDemoLlmProvider(environment.llm),
    },
  ],
};
