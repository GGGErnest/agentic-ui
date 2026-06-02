/**
 * DataTableComponent — facade pattern tests.
 * Tests all agentic actions: findRow, bulkEdit, bulkDelete,
 * sortBy, filterBy, selectRow, getSnapshot.
 */
import { TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { AgentWorldService } from '../../core/world/agent-world.service';

function createService(): AgentWorldService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DataTableComponent],
    providers: [AgentWorldService],
  });
  return TestBed.inject(AgentWorldService);
}

function createComponent(overrides: any = {}) {
  createService();
  const fixture = TestBed.createComponent(DataTableComponent);
  const comp = fixture.componentInstance;
  const world = TestBed.inject(AgentWorldService);

  // Set input values using setInput
  fixture.componentRef.setInput('agenticId', overrides['agenticId'] ?? 'test-table');
  fixture.componentRef.setInput('title', overrides['title'] ?? 'Tasks');
  fixture.componentRef.setInput('columns', overrides['columns'] ?? ['name', 'role', 'team']);
  fixture.componentRef.setInput(
    'data',
    overrides['data'] ?? [
      { id: '1', name: 'Alice', role: 'Engineer', team: 'Frontend' },
      { id: '2', name: 'Bob', role: 'Designer', team: 'Frontend' },
      { id: '3', name: 'Charlie', role: 'Manager', team: 'Backend' },
      { id: '4', name: 'Diana', role: 'Engineer', team: 'Backend' },
      { id: '5', name: 'Eve', role: 'Engineer', team: 'Platform' },
    ],
  );
  fixture.componentRef.setInput('idField', overrides['idField'] ?? 'id');

  fixture.detectChanges();
  return { comp, world, fixture };
}

function getAction(comp: DataTableComponent, name: string) {
  return comp.agenticActions.find((a: any) => a.name === name)!;
}

describe('DataTableComponent', () => {
  it('registers in World Registry via directive', () => {
    const { world } = createComponent();
    const entry = world.entries().get('test-table');
    expect(entry).toBeDefined();
    expect(entry!.role).toBe('DataTable');
    expect(entry!.actions.find((a) => a.name === 'findRow')).toBeDefined();
  });

  it('unregisters on destroy via directive', () => {
    const { fixture, world } = createComponent();
    fixture.destroy();
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

  it('bulkEdit: emits edits without mutating input rows', async () => {
    const { comp } = createComponent();
    const emitSpy = vi.spyOn(comp.bulkEdited, 'emit');

    await getAction(comp, 'bulkEdit').execute({ ids: ['1', '2'], changes: { team: 'Mobile' } });

    expect(emitSpy).toHaveBeenCalledWith({ ids: ['1', '2'], changes: { team: 'Mobile' } });
    expect(comp.data().find((r: any) => r['id'] === '1')!['team']).toBe('Frontend');
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
    const before = comp.data().length;
    await getAction(comp, 'bulkDelete').execute({ ids: ['1', '3'] });
    expect(comp.data().length).toBe(before);
  });

  it('bulkDelete: emits rowsDeleted event', async () => {
    const { comp } = createComponent();
    const emitSpy = vi.spyOn(comp.rowsDeleted, 'emit');
    await getAction(comp, 'bulkDelete').execute({ ids: ['1', '3'] });
    expect(emitSpy).toHaveBeenCalledWith(['1', '3']);
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

  it('clearFilter: clears an active table filter', async () => {
    const { comp } = createComponent();
    await getAction(comp, 'filterBy').execute({ column: 'team', value: 'Frontend' });

    const result = await getAction(comp, 'clearFilter').execute({});

    expect(result.success).toBe(true);
    expect(comp['filterColumn']()).toBe('');
    expect(comp['filterText']()).toBe('');
    expect(comp['filteredData']().length).toBe(5);
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

  it('emits selectionChange when a row is toggled', () => {
    const { comp } = createComponent();
    const emitSpy = vi.spyOn(comp.selectionChange, 'emit');

    comp.toggleSelect('1');

    expect(emitSpy).toHaveBeenCalledWith(['1']);
  });

  it('replaces selection through setSelection', () => {
    const { comp } = createComponent();

    comp.setSelection(['2', '4']);

    expect([...comp.selectedIds()]).toEqual(['2', '4']);
  });

  it('clears selection through clearSelection', () => {
    const { comp } = createComponent();

    comp.setSelection(['1', '3']);
    comp.clearSelection();

    expect([...comp.selectedIds()]).toEqual([]);
  });

  it('renders an Actions column when showEditButton is true', () => {
    createService();
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('agenticId', 'tbl');
    fixture.componentRef.setInput('columns', ['name']);
    fixture.componentRef.setInput('data', [{ id: '1', name: 'Alice' }]);
    fixture.componentRef.setInput('idField', 'id');
    fixture.componentRef.setInput('showEditButton', true);
    fixture.detectChanges();

    const headers = fixture.nativeElement.querySelectorAll('th');
    const headerTexts = Array.from(headers).map((h: any) => h.textContent.trim());
    expect(headerTexts).toContain('Actions');
  });

  it('does NOT render an Actions column when showEditButton is false (default)', () => {
    const { fixture } = createComponent();
    const headers = fixture.nativeElement.querySelectorAll('th');
    const headerTexts = Array.from(headers).map((h: any) => h.textContent.trim());
    expect(headerTexts).not.toContain('Actions');
  });

  it('emits rowEdit with the row data when Edit button is clicked', () => {
    createService();
    const fixture = TestBed.createComponent(DataTableComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('agenticId', 'tbl');
    fixture.componentRef.setInput('columns', ['name']);
    fixture.componentRef.setInput('data', [{ id: '1', name: 'Alice' }]);
    fixture.componentRef.setInput('idField', 'id');
    fixture.componentRef.setInput('showEditButton', true);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(comp.rowEdit, 'emit');
    const editBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.row-edit-btn');
    editBtn.click();
    expect(emitSpy).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });

  it('editRow action: emits rowEdit for a valid id', async () => {
    createService();
    const fixture = TestBed.createComponent(DataTableComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('agenticId', 'tbl');
    fixture.componentRef.setInput('columns', ['name']);
    fixture.componentRef.setInput('data', [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
    fixture.componentRef.setInput('idField', 'id');
    fixture.componentRef.setInput('showEditButton', true);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(comp.rowEdit, 'emit');
    const result = await getAction(comp, 'editRow').execute({ id: '2' });
    expect(result.success).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith({ id: '2', name: 'Bob' });
  });

  it('editRow action: returns failure for unknown id', async () => {
    const { comp } = createComponent();
    const result = await getAction(comp, 'editRow').execute({ id: '999' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
