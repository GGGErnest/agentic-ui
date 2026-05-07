import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AgentHarness, LLM_PROVIDER } from 'agentic-ui';

/**
 * Demo app configuration.
 * In production, you'd replace the mock provider with a real LLM (OpenAI, etc.).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // Provide the AgentHarness service
    AgentHarness,

    // Mock LLM Provider for demo (logs to console, returns dummy responses)
    {
      provide: LLM_PROVIDER,
      useFactory: () => new MockLLMProvider(),
    },
  ],
};

/**
 * A mock LLM provider for demo purposes.
 * Logs agent intention to console instead of calling a real API.
 * Replace with OpenAiProvider({ apiKey: 'sk-...' }) for real usage.
 */
class MockLLMProvider {
  async *getStream(messages: any[], tools: any[]) {
    // Simulate a thinking delay
    yield { type: 'thought', text: 'Analyzing the current UI state...' };
    yield { type: 'thought', text: ` Found ${tools.length} available actions.` };

    // In a real app, this would call an LLM API
    if (tools.length > 0) {
      yield {
        type: 'thought',
        text: `\nI can help with: ${tools.map((t: any) => t.function.name).join(', ')}`,
      };
    } else {
      yield { type: 'thought', text: ' No interactive components are currently visible.' };
    }

    console.log('[MockLLM] Messages:', messages);
    console.log('[MockLLM] Available tools:', tools.map((t: any) => t.function.name));
  }
}
