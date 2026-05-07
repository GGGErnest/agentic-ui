import { InjectionToken } from '@angular/core';
import { LLMProvider } from '../harness/llm-provider.interface';

/**
 * Injection token for the LLM Provider.
 * Applications must provide an implementation to use the harness.
 *
 * @example
 * ```typescript
 * providers: [
 *   { provide: LLM_PROVIDER, useClass: OpenAiProvider }
 * ]
 * ```
 */
export const LLM_PROVIDER = new InjectionToken<LLMProvider>('AGENTIC_UI_LLM_PROVIDER');
