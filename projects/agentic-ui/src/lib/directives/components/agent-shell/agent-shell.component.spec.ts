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
});
