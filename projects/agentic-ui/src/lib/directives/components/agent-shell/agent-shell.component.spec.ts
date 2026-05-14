import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentShellComponent } from './agent-shell.component';
import { AgentHarness } from '../../../core/harness/agent-harness.service';
import { AgentWorldService } from '../../../core/world/agent-world.service';
import { AgentApprovalService } from '../../../core/approval/agent-approval.service';

describe('AgentShellComponent', () => {
  it('does not render private thought text in the UI', async () => {
    const harness = {
      thought: signal('Private reasoning that should stay internal.'),
      steps: signal([
        {
          thought: 'Private reasoning that should stay internal.',
          action: null,
          result: 'Created task "Ship release notes".',
          timestamp: 1,
        },
      ]),
      isRunning: signal(false),
      runCycle: vi.fn(),
      reset: vi.fn(),
    } as Partial<AgentHarness>;

    const world = {
      shadowMode: signal(false),
      focusedEntryId: signal<string | null>(null),
      activeEntries: signal(new Map<string, any>([['task-table', {}]])),
    } as unknown as Partial<AgentWorldService>;

    const approval = {
      pending: signal(null),
      isPending: signal(false),
      approve: vi.fn(),
      reject: vi.fn(),
    } as Partial<AgentApprovalService>;

    await TestBed.configureTestingModule({
      imports: [AgentShellComponent],
      providers: [
        { provide: AgentHarness, useValue: harness },
        { provide: AgentWorldService, useValue: world },
        { provide: AgentApprovalService, useValue: approval },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AgentShellComponent);
    fixture.componentInstance.isExpanded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('💭 Thinking');
    expect(text).not.toContain('Private reasoning that should stay internal.');
    expect(text).toContain('Created task "Ship release notes".');
  });
});
