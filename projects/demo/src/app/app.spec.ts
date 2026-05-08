import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AgentHarness, LLM_PROVIDER } from 'agentic-ui';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        AgentHarness,
        {
          provide: LLM_PROVIDER,
          useFactory: () => new MockLLMProvider(),
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render agent shell and router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('agui-agent-shell')).toBeTruthy();
  });
});

/**
 * Minimal mock LLM provider for testing.
 */
class MockLLMProvider {
  async *getStream() {
    yield { type: 'thought' as const, text: 'Mock response' };
  }
}
