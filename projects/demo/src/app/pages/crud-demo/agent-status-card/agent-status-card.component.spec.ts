import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AgentStatusCardComponent } from './agent-status-card.component';

describe('AgentStatusCardComponent', () => {
  let fixture: ComponentFixture<AgentStatusCardComponent>;
  let component: AgentStatusCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentStatusCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentStatusCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activeFilter', 'high');
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.componentRef.setInput('selectedIdsLabel', '1, 2, 3');
    fixture.componentRef.setInput('showModal', false);
    fixture.componentRef.setInput('editId', null);
    fixture.componentRef.setInput('pendingMatchLabel', 'none');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the active filter', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('high');
  });

  it('renders selected count', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('3');
  });
});
