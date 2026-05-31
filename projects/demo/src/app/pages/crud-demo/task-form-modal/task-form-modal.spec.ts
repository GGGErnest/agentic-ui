import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AgentWorldService } from 'agentic-ui';
import { TaskFormModalComponent } from './task-form-modal';

function createComponent(overrides: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TaskFormModalComponent],
    providers: [AgentWorldService],
  });
  const fixture: ComponentFixture<TaskFormModalComponent> = TestBed.createComponent(TaskFormModalComponent);
  const comp = fixture.componentInstance;
  if (overrides['editId'] !== undefined) fixture.componentRef.setInput('editId', overrides['editId']);
  if (overrides['initialTitle'] !== undefined) fixture.componentRef.setInput('initialTitle', overrides['initialTitle']);
  if (overrides['initialPriority'] !== undefined)
    fixture.componentRef.setInput('initialPriority', overrides['initialPriority']);
  if (overrides['initialAssignee'] !== undefined) fixture.componentRef.setInput('initialAssignee', overrides['initialAssignee']);
  if (overrides['initialStatus'] !== undefined) fixture.componentRef.setInput('initialStatus', overrides['initialStatus']);
  fixture.detectChanges();
  return { fixture, comp };
}

describe('TaskFormModalComponent', () => {
  it('emits status in the saved output when submitted', () => {
    const { comp } = createComponent({
      editId: 'abc',
      initialTitle: 'Fix bug',
      initialPriority: 'high',
      initialAssignee: 'Alice',
      initialStatus: 'in-progress',
    });

    const emitted: unknown[] = [];
    comp.saved.subscribe((v: unknown) => emitted.push(v));

    comp.submit();

    expect(emitted.length).toBe(1);
    expect((emitted[0] as any).status).toBe('in-progress');
  });

  it('defaults status to todo when no initialStatus is provided', () => {
    const { comp } = createComponent({ initialTitle: 'Task', initialPriority: 'low', initialAssignee: '' });
    const emitted: unknown[] = [];
    comp.saved.subscribe((v: unknown) => emitted.push(v));
    comp.submit();
    expect((emitted[0] as any).status).toBe('todo');
  });

  it('fillForm action sets status when provided', async () => {
    const { comp } = createComponent({ initialTitle: 'T', initialPriority: 'low', initialAssignee: '' });
    const action = comp.modalActions.find((a) => a.name === 'fillForm')!;
    await action.execute({ status: 'done' });
    expect(comp.formStatus()).toBe('done');
  });

  it('renders a status select in the template', () => {
    const { fixture } = createComponent({ initialTitle: 'T', initialPriority: 'low', initialAssignee: '' });
    const selects: NodeList = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(2);
  });
});
