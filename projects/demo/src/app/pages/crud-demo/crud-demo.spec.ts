import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentWorldService } from 'agentic-ui';
import { ActivityService } from '../../services/activity.service';

import { CrudDemo } from './crud-demo';

describe('CrudDemo', () => {
  let component: CrudDemo;
  let fixture: ComponentFixture<CrudDemo>;
  let world: AgentWorldService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrudDemo],
    }).compileComponents();

    fixture = TestBed.createComponent(CrudDemo);
    component = fixture.componentInstance;
    world = TestBed.inject(AgentWorldService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('opens the chooser when delete criteria matches multiple rows', async () => {
    const executeSpy = vi.spyOn(world, 'executeAction').mockResolvedValue({
      success: true,
      message: 'Deleted 0 row(s).',
    });

    const result = await component.taskResolverActions[0].execute({
      column: 'assignee',
      value: 'Alice',
    });
    fixture.detectChanges();

    expect(result.message).toContain('Multiple rows matched');
    expect(component.pendingMatchRequest()?.matches.map((row) => row.id)).toEqual(['1', '4']);
    expect(executeSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.match-chooser')).toBeTruthy();
  });

  it('delegates a single match directly to table bulkDelete', async () => {
    const executeSpy = vi.spyOn(world, 'executeAction').mockResolvedValue({
      success: true,
      message: 'Deleted 1 row(s).',
    });

    await component.taskResolverActions[0].execute({
      column: 'title',
      value: 'dark mode',
    });

    expect(component.pendingMatchRequest()).toBeNull();
    expect(executeSpy).toHaveBeenCalledWith('task-table', 'bulkDelete', { ids: ['2'] });
  });

  it('searches the full dataset even when the table is filtered', async () => {
    component.taskTable!.filterColumn.set('status');
    component.taskTable!.filterText.set('done');

    await component.taskResolverActions[0].execute({
      column: 'assignee',
      value: 'Alice',
    });

    expect(component.pendingMatchRequest()?.matches.map((row) => row.id)).toEqual(['1', '4']);
  });

  it('returns validation error when params lack required fields', async () => {
    const result = await component.taskResolverActions[0].execute({});

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid parameters: column and value are required strings.');
  });

  it('returns validation error when column is missing', async () => {
    const result = await component.taskResolverActions[0].execute({
      value: 'Alice',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid parameters: column and value are required strings.');
  });

  it('returns validation error when value is missing', async () => {
    const result = await component.taskResolverActions[0].execute({
      column: 'assignee',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid parameters: column and value are required strings.');
  });

  it('confirms chosen rows and delegates deletion through the table action', async () => {
    const executeSpy = vi.spyOn(world, 'executeAction').mockResolvedValue({
      success: true,
      message: 'Deleted 2 row(s).',
    });

    component.pendingMatchRequest.set({
      intent: 'delete',
      column: 'assignee',
      value: 'Alice',
      matches: component.tasks().filter((task) => task.assignee === 'Alice'),
    });
    component.pendingChoiceIds.set(new Set(['1', '4']));

    await component.confirmPendingMatch();

    expect(component.pendingMatchRequest()).toBeNull();
    expect(executeSpy).toHaveBeenCalledWith('task-table', 'bulkDelete', { ids: ['1', '4'] });
  });

  it('clears pending chooser state on cancel', () => {
    component.pendingMatchRequest.set({
      intent: 'delete',
      column: 'assignee',
      value: 'Alice',
      matches: component.tasks().filter((task) => task.assignee === 'Alice'),
    });
    component.pendingChoiceIds.set(new Set(['1']));

    component.cancelPendingMatch();

    expect(component.pendingMatchRequest()).toBeNull();
    expect([...component.pendingChoiceIds()]).toEqual([]);
  });

  it('deletes the currently selected rows from the toolbar action', async () => {
    const executeSpy = vi.spyOn(world, 'executeAction').mockResolvedValue({
      success: true,
      message: 'Deleted 2 row(s).',
    });

    component.onTableSelectionChange(['2', '5']);

    await component.deleteSelectedAction[0].execute();

    expect(executeSpy).toHaveBeenCalledWith('task-table', 'bulkDelete', { ids: ['2', '5'] });
  });

  it('updates tasks signal when rows are deleted from the table', () => {
    const initialCount = component.tasks().length;
    component.onRowsDeleted(['1', '3']);

    expect(component.tasks().length).toBe(initialCount - 2);
    expect(component.tasks().some((t) => t.id === '1')).toBe(false);
    expect(component.tasks().some((t) => t.id === '3')).toBe(false);
    expect(component.tasks().some((t) => t.id === '2')).toBe(true);
  });

  it('openEditModal populates form signals and opens the modal', () => {
    const task = component.tasks()[0];
    component.openEditModal(task);

    expect(component.showModal()).toBe(true);
    expect(component.editId()).toBe('1');
    expect(component.formTitle()).toBe('Fix login bug');
    expect(component.formPriority()).toBe('high');
    expect(component.formAssignee()).toBe('Alice');
    expect(component.formStatus()).toBe('in-progress');
  });

  it('openEditModal does not open the modal when the row id is not found', () => {
    component.openEditModal({ id: 'does-not-exist', title: 'Ghost' });
    expect(component.showModal()).toBe(false);
  });

  it('openAddModal resets formStatus to todo', () => {
    component.formStatus.set('done');
    component.openAddModal();
    expect(component.formStatus()).toBe('todo');
  });

  it('onFormSaved updates status on the edited task', () => {
    component.editId.set('3');
    component.onFormSaved({
      title: 'Update docs v2',
      priority: 'low',
      assignee: 'Charlie',
      status: 'in-progress',
    });
    const updated = component.tasks().find((t) => t.id === '3');
    expect(updated?.title).toBe('Update docs v2');
    expect(updated?.status).toBe('in-progress');
  });

  it('logs a task_created event when a task is added via onFormSaved', () => {
    const activity = TestBed.inject(ActivityService);
    component.editId.set(null); // add mode
    component.onFormSaved({ title: 'New Task', priority: 'low', assignee: 'Bob', status: 'todo' });
    expect(activity.events()[0].type).toBe('task_created');
    expect(activity.events()[0].description).toContain('New Task');
  });

  it('logs a task_edited event when a task is updated via onFormSaved', () => {
    const activity = TestBed.inject(ActivityService);
    component.editId.set('1');
    component.onFormSaved({ title: 'Fix login bug v2', priority: 'high', assignee: 'Alice', status: 'done' });
    expect(activity.events()[0].type).toBe('task_edited');
    expect(activity.events()[0].description).toContain('Fix login bug v2');
  });

  it('logs a task_deleted event when rows are deleted', () => {
    const activity = TestBed.inject(ActivityService);
    component.onRowsDeleted(['1', '2']);
    expect(activity.events()[0].type).toBe('task_deleted');
  });
});
