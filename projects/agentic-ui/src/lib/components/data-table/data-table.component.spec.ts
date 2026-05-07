/**
 * DataTableComponent — facade pattern tests.
 * Tests all agentic actions: findRow, bulkEdit, bulkDelete,
 * sortBy, filterBy, selectRow, getSnapshot.
 */
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DataTableComponent } from './data-table.component';
import { AgentWorldService } from '../../core/world/agent-world.service';

function createService(): AgentWorldService {
  const appRef = {
    isStable: new BehaviorSubject(true),
    afterTick: new BehaviorSubject(void 0),
    onStable: new BehaviorSubject(void 0),
  } as unknown as ApplicationRef;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AgentWorldService,
      { provide: ApplicationRef, useValue: appRef },
    ],
  });
  return TestBed.inject(AgentWorldService);
}

function createComponent(overrides: any = {}) {
  const world = createService();
  const comp = new DataTableComponent(world);

  (comp as any)['agenticId'] = overrides['agenticId'] ?? 'test-table';
  (comp as any)['columns'] = overrides['columns'] ?? ['name', 'role', 'team'];
  (comp as any)['idField'] = overrides['idField'] ?? 'id';
  (comp as any)['data'] = overrides['data'] ?? [
    { id: '1', name: 'Alice', role: 'Engineer', team: 'Frontend' },
    { id: '2', name: 'Bob', role: 'Designer', team: 'Frontend' },
    { id: '3', name: 'Charlie', role: 'Manager', team: 'Backend' },
    { id: '4', name: 'Diana', role: 'Engineer', team: 'Backend' },
    { id: '5', name: 'Eve', role: 'Engineer', team: 'Platform' },
  ];
  (comp as any)['title'] = overrides['title'] ?? 'Tasks';

  comp.ngOnInit();
  return { comp, world };
}

function getAction(comp: DataTableComponent, name: string) {
  return comp['agenticActions'].find((a: any) => a.name === name)!;
}

describe('DataTableComponent', () => {
  it('registers in World Registry', () => {
    const { world } = createComponent();
    expect(world.entries().get('test-table')!.role).toBe('DataTable');
    expect(world.entries().get('test-table')!.actions.find(a => a.name === 'findRow')).toBeDefined();
  });

  it('unregisters on destroy', () => {
    const { comp, world } = createComponent();
    comp.ngOnDestroy();
    expect(world.entries().has('test-table')).toBe(false);
  });

  it('findRow: matches by column', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'findRow').execute({ column: 'role', value: 'Engineer' });
    expect(r.message).toContain('3 row(s)');
  });

  it('findRow: empty on no match', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'findRow').execute({ column: 'name', value: 'Zorro' });
    expect(r.message).toContain('No rows');
  });

  it('findRow: defaults to first column', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'findRow').execute({ value: 'Alice' });
    expect(r.message).toContain('1 row(s)');
  });

  it('bulkEdit: edits multiple rows', async () => {
    const { comp } = createComponent();
    await getAction(comp, 'bulkEdit').execute({ ids: ['1', '2'], changes: { team: 'Mobile' } });
    expect(comp['data'].find((r: any) => r['id'] === '1')!['team']).toBe('Mobile');
  });

  it('bulkEdit: rejects empty IDs', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'bulkEdit').execute({ ids: [], changes: { x: 'y' } });
    expect(r.success).toBe(false);
  });

  it('bulkEdit: rejects empty changes', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'bulkEdit').execute({ ids: ['1'], changes: {} });
    expect(r.success).toBe(false);
  });

  it('bulkDelete: removes rows', async () => {
    const { comp } = createComponent();
    const before = comp['data'].length;
    await getAction(comp, 'bulkDelete').execute({ ids: ['1', '3'] });
    expect(comp['data'].length).toBe(before - 2);
  });

  it('bulkDelete: clears selections', async () => {
    const { comp } = createComponent();
    comp['selectedIds'].set(new Set(['1', '2']));
    await getAction(comp, 'bulkDelete').execute({ ids: ['1'] });
    expect(comp['selectedIds']().has('1')).toBe(false);
    expect(comp['selectedIds']().has('2')).toBe(true);
  });

  it('sortBy: sorts ascending', async () => {
    const { comp } = createComponent();
    await getAction(comp, 'sortBy').execute({ column: 'name', direction: 'asc' });
    expect(comp['sortColumn']()).toBe('name');
  });

  it('sortBy: rejects invalid column', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'sortBy').execute({ column: 'nope' });
    expect(r.success).toBe(false);
  });

  it('filterBy: filters rows', async () => {
    const { comp } = createComponent();
    await getAction(comp, 'filterBy').execute({ column: 'team', value: 'Frontend' });
    expect(comp['filteredData']().length).toBe(2);
  });

  it('selectRow: selects by ID', async () => {
    const { comp } = createComponent();
    await getAction(comp, 'selectRow').execute({ id: '3' });
    expect(comp['selectedIds']().has('3')).toBe(true);
  });

  it('selectRow: rejects unknown ID', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'selectRow').execute({ id: '999' });
    expect(r.success).toBe(false);
  });

  it('getSnapshot: returns table state', async () => {
    const { comp } = createComponent();
    const r = await getAction(comp, 'getSnapshot').execute({});
    expect((r.data as any).totalRows).toBe(5);
  });

  it('getSnapshot: reports selections', async () => {
    const { comp } = createComponent();
    comp['selectedIds'].set(new Set(['1', '2']));
    const r = await getAction(comp, 'getSnapshot').execute({});
    expect((r.data as any).selectedIds).toEqual(['1', '2']);
  });

  it('requires approval for destructive actions', () => {
    const { comp } = createComponent();
    expect(getAction(comp, 'bulkEdit').requiresApproval).toBe(true);
    expect(getAction(comp, 'bulkDelete').requiresApproval).toBe(true);
    expect(getAction(comp, 'findRow').requiresApproval).toBeFalsy();
  });
});