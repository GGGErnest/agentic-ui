import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AgentApprovalDialogComponent } from './agent-approval-dialog.component';
import { AgentApprovalService } from '../../core/approval/agent-approval.service';

describe('AgentApprovalDialogComponent', () => {
  let fixture: ComponentFixture<AgentApprovalDialogComponent>;
  let component: AgentApprovalDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentApprovalDialogComponent],
      providers: [AgentApprovalService],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentApprovalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is not visible when no ticket is pending', () => {
    expect(component.isVisible()).toBe(false);
    expect(fixture.nativeElement.querySelector('.approval-backdrop')).toBeNull();
  });

  it('formats params as JSON', () => {
    const formatted = component.formatParams({ a: 1, b: 'x' });
    expect(formatted).toContain('"a": 1');
    expect(formatted).toContain('"b": "x"');
  });

  it('returns param keys', () => {
    expect(component.paramKeys({ a: 1, b: 2 })).toEqual(['a', 'b']);
  });
});
