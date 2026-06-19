import { TestBed } from '@angular/core/testing';
import { AgentShellComponent } from './agent-shell.component';
import { AgentHarness } from '../../../core/harness/agent-harness.service';
import { LLM_PROVIDER } from '../../../core/providers/llm-provider.token';

describe('AgentShellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AgentShellComponent],
      providers: [
        AgentHarness,
        {
          provide: LLM_PROVIDER,
          useValue: {
            getStream: async function* () {},
          },
        },
      ],
    });
  });

  afterEach(() => {
    delete window.Agent;
  });

  it('renders telemetry overlay with the shell', () => {
    const fixture = TestBed.createComponent(AgentShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('agui-telemetry-overlay')).not.toBeNull();
  });

  it('does not expose window.Agent by default in test mode', () => {
    const fixture = TestBed.createComponent(AgentShellComponent);
    fixture.detectChanges();

    expect(window.Agent).toBeUndefined();
    fixture.destroy();
  });

  it('aborts the in-flight run controller on destroy (#I1)', () => {
    const fixture = TestBed.createComponent(AgentShellComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Simulate an active run with an AbortController.
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');
    (component as unknown as { abortController: AbortController | null }).abortController =
      controller;

    fixture.destroy();
    expect(abortSpy).toHaveBeenCalled();
  });
});
