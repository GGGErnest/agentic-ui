import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AgentResolutionCardComponent } from './agent-resolution-card.component';

describe('AgentResolutionCardComponent', () => {
  let fixture: ComponentFixture<AgentResolutionCardComponent>;
  let component: AgentResolutionCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentResolutionCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentResolutionCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('column', 'assignee');
    fixture.componentRef.setInput('value', 'Alice');
    fixture.componentRef.setInput('matchCount', 2);
    fixture.componentRef.setInput('matchesSummary', '1:Fix login bug, 4:Refactor auth module');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the column and value', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('assignee');
    expect(text).toContain('Alice');
  });

  it('renders the match count', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2 tasks matched');
  });
});
