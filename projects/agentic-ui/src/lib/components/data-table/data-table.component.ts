import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AgentAction, AgentActionResult } from '../../core/world/agent-action.model';
import { AGENTIC_COMPONENT } from '../../core/world/agentic-component.token';
import { AgenticDirective } from '../../directives/agentic.directive';
import { DataRow, RowQuery, BulkEditOp } from './data-table.models';

/**
 * DataTableFacade — reference implementation of the Facade Pattern.
 *
 * Instead of instrumenting every row/cell with [agentic], the DataTable
 * acts as a "Gatekeeper" that exposes high-level API methods to the agent:
 *   - findRow(query) — search by column value
 *   - bulkEdit(ids, changes) — update multiple rows atomically
 *   - bulkDelete(ids) — remove multiple rows
 *   - sortBy(column, direction) — sort the table
 *   - filterBy(column, value) — filter rows
 *
 * This transforms the agent from a "DOM clicker" into a "power user"
 * calling a semantic API. If the agent needs to drill into a specific
 * row, the component can emit an event that opens a detail modal, which
 * then registers its own internal components.
 */
@Component({
  selector: 'agui-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: DataTableComponent }],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent {
  // ---- Inputs ----

  readonly agenticId = input.required<string>();
  readonly agenticRole = 'DataTable';

  get agenticActions(): AgentAction[] {
    return this._agenticActions;
  }

  get agenticMetadata(): Record<string, unknown> {
    return {
      columns: this.columns(),
      totalRows: this.data().length,
      idField: this.idField(),
      facadeType: 'DataTable',
    };
  }

  readonly title = input('Data Table');
  readonly columns = input.required<string[]>();
  readonly data = input.required<DataRow[]>();
  readonly idField = input('id');
  readonly showEditButton = input(false);

  // ---- Outputs ----

  readonly selectionChange = output<string[]>();
  readonly rowsDeleted = output<string[]>();
  readonly bulkEdited = output<BulkEditOp>();
  readonly rowEdit = output<DataRow>();

  // ---- State ----

  readonly sortColumn = signal<string>('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly filterText = signal<string>('');
  readonly filterColumn = signal<string>('');
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly totalRows = computed(() => this.data().length);

  // ---- Computed filtered & sorted data ----

  readonly filteredData = computed(() => {
    let rows = [...this.data()];

    // Filter
    const col = this.filterColumn();
    const text = this.filterText().toLowerCase();
    if (col && text) {
      rows = rows.filter((row) => {
        const val = row[col];
        return val != null && String(val).toLowerCase().includes(text);
      });
    }

    // Sort
    const sc = this.sortColumn();
    if (sc) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const va = a[sc],
          vb = b[sc];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'string' && typeof vb === 'string') {
          return va.localeCompare(vb) * dir;
        }
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
      });
    }

    return rows;
  });

  // ---- Agentic Actions (Facade API) ----

  private readonly _agenticActions: AgentAction[] = [
    {
      name: 'findRow',
      description: 'Find rows matching a column value. Returns matching rows.',
      parameters: [
        { name: 'column', type: 'string', description: 'Column to search in' },
        { name: 'value', type: 'string', description: 'Value to match' },
      ],
      execute: (params) => this.doFindRow(params as unknown as RowQuery),
    },
    {
      name: 'bulkEdit',
      description: 'Edit multiple rows at once. Pass an array of IDs and the changes to apply.',
      parameters: [
        { name: 'ids', type: 'array', description: 'Array of row IDs to edit', required: true },
        {
          name: 'changes',
          type: 'object',
          description: 'Key-value changes to apply',
          required: true,
        },
      ],
      requiresApproval: true,
      execute: (params) => this.doBulkEdit(params as unknown as BulkEditOp),
    },
    {
      name: 'bulkDelete',
      description: 'Delete multiple rows at once. Pass an array of row IDs.',
      parameters: [
        { name: 'ids', type: 'array', description: 'Array of row IDs to delete', required: true },
      ],
      requiresApproval: true,
      execute: (params) => this.doBulkDelete(params as unknown as { ids: string[] }),
    },
    {
      name: 'sortBy',
      description: 'Sort the table by a column.',
      parameters: [
        { name: 'column', type: 'string', description: 'Column name to sort by', required: true },
        { name: 'direction', type: 'string', description: 'asc or desc', enum: ['asc', 'desc'] },
      ],
      execute: (params) =>
        this.doSortBy(params as unknown as { column: string; direction?: string }),
    },
    {
      name: 'filterBy',
      description: 'Filter rows by column value (partial match).',
      parameters: [
        { name: 'column', type: 'string', description: 'Column to filter', required: true },
        { name: 'value', type: 'string', description: 'Value to filter by', required: true },
      ],
      execute: (params) => this.doFilterBy(params as unknown as { column: string; value: string }),
    },
    {
      name: 'clearFilter',
      description: 'Clear the current table filter and show all rows.',
      execute: () => this.doClearFilter(),
    },
    {
      name: 'selectRow',
      description: 'Select a row by ID for subsequent operations.',
      parameters: [{ name: 'id', type: 'string', description: 'Row ID', required: true }],
      execute: (params) => this.doSelectRow(params as unknown as { id: string }),
    },
    {
      name: 'getSnapshot',
      description: 'Get a summary of the current data (column names, row count, selected rows).',
      execute: () => this.doGetSnapshot(),
    },
    {
      name: 'editRow',
      description: 'Open the edit form for a row by its ID.',
      parameters: [{ name: 'id', type: 'string', description: 'Row ID to edit', required: true }],
      execute: (params) => this.doEditRow(params as unknown as { id: string }),
    },
  ];

  // ---- UI helpers ----

  toggleSort(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  isSelected(rowId: unknown): boolean {
    return this.selectedIds().has(String(rowId));
  }

  setSelection(ids: string[]): void {
    this.selectedIds.set(new Set(ids.map(String)));
    this.emitSelectionChange();
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    this.selectionChange.emit([...this.selectedIds()]);
  }

  toggleSelect(rowId: unknown): void {
    this.selectedIds.update((s) => {
      const next = new Set(s);
      const id = String(rowId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.emitSelectionChange();
  }

  // ---- Agentic action implementations ----

  private async doFindRow(query: RowQuery): Promise<AgentActionResult> {
    const column = query.column ?? this.columns()[0];
    const rawValue = query.value;
    const value = rawValue?.toLowerCase();
    if (!value) {
      return { success: false, message: 'No search value provided.' };
    }

    const matches = this.data().filter((row) => {
      const val = row[column];
      return val != null && String(val).toLowerCase().includes(value);
    });

    // Set filter to show matches. Store the original (non-lowercased) value;
    // filteredData lowercases for comparison so display stays faithful.
    this.filterColumn.set(column);
    this.filterText.set(rawValue ?? '');

    if (matches.length === 0) {
      return {
        success: true,
        message: `No rows found matching "${query.value}" in column "${column}".`,
      };
    }

    return {
      success: true,
      message: `Found ${matches.length} row(s) matching "${query.value}" in column "${column}".`,
      data: { foundRows: matches.slice(0, 10), totalMatches: matches.length },
    };
  }

  private async doBulkEdit(op: BulkEditOp): Promise<AgentActionResult> {
    if (!op.ids?.length) {
      return { success: false, message: 'No row IDs provided for bulk edit.' };
    }
    if (!op.changes || Object.keys(op.changes).length === 0) {
      return { success: false, message: 'No changes provided.' };
    }

    const idSet = new Set(op.ids.map(String));
    const affected = this.data().filter((row) => idSet.has(String(row[this.idField()]))).length;
    if (affected === 0) {
      return {
        success: false,
        message: `No rows matched the provided IDs (${op.ids.join(', ')}); nothing was edited.`,
        data: { affectedRows: 0 },
      };
    }
    this.bulkEdited.emit({ ids: op.ids, changes: op.changes });

    return {
      success: true,
      message: `Updated ${affected} row(s) with changes: ${JSON.stringify(op.changes)}`,
      data: { affectedRows: affected },
    };
  }

  private async doBulkDelete(params: { ids: string[] }): Promise<AgentActionResult> {
    if (!params.ids?.length) {
      return { success: false, message: 'No row IDs provided for deletion.' };
    }

    const idSet = new Set(params.ids.map(String));
    const deletedCount = this.data().filter((row) => idSet.has(String(row[this.idField()]))).length;
    if (deletedCount === 0) {
      return {
        success: false,
        message: `No rows matched the provided IDs (${params.ids.join(', ')}); nothing was deleted.`,
        data: { affectedRows: 0 },
      };
    }

    this.selectedIds.update((s) => {
      const next = new Set(s);
      for (const id of params.ids) next.delete(id);
      return next;
    });
    this.emitSelectionChange();

    // Emit rowsDeleted event so parent can update its data
    this.rowsDeleted.emit(params.ids);

    return {
      success: true,
      message: `Deleted ${deletedCount} row(s).`,
      data: { affectedRows: deletedCount },
    };
  }

  private async doSortBy(params: {
    column: string;
    direction?: string;
  }): Promise<AgentActionResult> {
    if (!this.columns().includes(params.column)) {
      return {
        success: false,
        message: `Column "${params.column}" not found. Available: ${this.columns().join(', ')}`,
      };
    }
    this.sortColumn.set(params.column);
    this.sortDirection.set(params.direction === 'desc' ? 'desc' : 'asc');
    return { success: true, message: `Sorted by "${params.column}" ${this.sortDirection()}.` };
  }

  private async doFilterBy(params: { column: string; value: string }): Promise<AgentActionResult> {
    if (!this.columns().includes(params.column)) {
      return {
        success: false,
        message: `Column "${params.column}" not found. Available: ${this.columns().join(', ')}`,
      };
    }
    this.filterColumn.set(params.column);
    this.filterText.set(params.value);
    const count = this.filteredData().length;
    return {
      success: true,
      message: `Filtered by "${params.column}" = "${params.value}". ${count} row(s) visible.`,
    };
  }

  private async doClearFilter(): Promise<AgentActionResult> {
    this.filterColumn.set('');
    this.filterText.set('');
    return { success: true, message: 'Table filter cleared.' };
  }

  private async doSelectRow(params: { id: string }): Promise<AgentActionResult> {
    const row = this.data().find((r) => String(r[this.idField()]) === params.id);
    if (!row) {
      return { success: false, message: `Row with ID "${params.id}" not found.` };
    }
    this.selectedIds.update((s) => new Set(s).add(params.id));
    this.emitSelectionChange();
    return {
      success: true,
      message: `Selected row "${params.id}". Row data: ${JSON.stringify(row)}`,
      data: { row },
    };
  }

  private async doGetSnapshot(): Promise<AgentActionResult> {
    const selIds = [...this.selectedIds()];
    return {
      success: true,
      message: `Table "${this.title()}": ${this.filteredData().length} rows visible (${this.totalRows()} total)`,
      data: {
        title: this.title(),
        columns: this.columns(),
        visibleRows: this.filteredData().length,
        totalRows: this.totalRows(),
        selectedIds: selIds,
        isFiltered: !!this.filterText(),
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
      },
    };
  }

  private async doEditRow(params: { id: string }): Promise<AgentActionResult> {
    const row = this.data().find((r) => String(r[this.idField()]) === String(params.id));
    if (!row) {
      return { success: false, message: `Row with ID "${params.id}" not found.` };
    }
    this.rowEdit.emit(row);
    return { success: true, message: `Opened edit form for row "${params.id}".`, data: { row } };
  }
}
