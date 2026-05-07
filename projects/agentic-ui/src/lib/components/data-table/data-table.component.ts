import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentWorldService } from '../../core/world/agent-world.service';
import { AgentAction, AgentActionResult } from '../../core/world/agent-action.model';
import { DataRow, RowQuery, BulkEditOp, DataTableResult } from './data-table.models';

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
  imports: [CommonModule],
  template: `
    <div class="data-table" [attr.data-agentic-id]="agenticId">
      <div class="data-table__toolbar">
        <span class="data-table__title">{{ title }}</span>
        <span class="data-table__count">{{ filteredData().length }} / {{ totalRows() }} rows</span>
      </div>

      <table class="data-table__table">
        <thead>
          <tr>
            @for (col of columns; track col) {
              <th (click)="toggleSort(col)">{{ col }}
                @if (sortColumn() === col) {
                  <span>{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
            }
            <th class="data-table__select-col">#</th>
          </tr>
        </thead>
        <tbody>
          @for (row of filteredData(); track row['id']) {
            <tr [class.selected]="isSelected(row['id'])">
              @for (col of columns; track col) {
                <td>{{ row[col] }}</td>
              }
              <td>
                <input
                  type="checkbox"
                  [checked]="isSelected(row['id'])"
                  (change)="toggleSelect(row['id'])"
                />
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (filteredData().length === 0) {
        <div class="data-table__empty">No rows match the current filter.</div>
      }
    </div>
  `,
  styles: [`
    .data-table {
      border: 1px solid #30363d;
      border-radius: 6px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      background: #0d1117;
      color: #e6edf3;
    }
    .data-table__toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }
    .data-table__title { font-weight: 600; }
    .data-table__count { color: #8b949e; font-size: 12px; }
    .data-table__table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 8px 14px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-weight: 600;
      color: #8b949e;
      cursor: pointer;
      user-select: none;
    }
    th:hover { color: #e6edf3; }
    td {
      padding: 8px 14px;
      border-bottom: 1px solid #21262d;
    }
    tr:hover { background: rgba(88, 166, 255, 0.05); }
    tr.selected { background: rgba(88, 166, 255, 0.12); }
    .data-table__select-col { width: 40px; }
    .data-table__empty {
      padding: 24px;
      text-align: center;
      color: #8b949e;
    }
  `],
})
export class DataTableComponent implements OnInit, OnDestroy {
  private readonly world: AgentWorldService;

  constructor(world?: AgentWorldService) {
    this.world = world ?? inject(AgentWorldService);
  }

  // ---- Inputs ----

  @Input({ required: true }) agenticId!: string;
  @Input() title: string = 'Data Table';
  @Input({ required: true }) columns!: string[];
  @Input({ required: true }) data!: DataRow[];
  @Input() idField: string = 'id';

  // ---- State ----

  readonly sortColumn = signal<string>('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly filterText = signal<string>('');
  readonly filterColumn = signal<string>('');
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly totalRows = computed(() => this.data?.length ?? 0);

  // ---- Computed filtered & sorted data ----

  readonly filteredData = computed(() => {
    let rows = [...(this.data ?? [])];

    // Filter
    const col = this.filterColumn();
    const text = this.filterText().toLowerCase();
    if (col && text) {
      rows = rows.filter(row => {
        const val = row[col];
        return val != null && String(val).toLowerCase().includes(text);
      });
    }

    // Sort
    const sc = this.sortColumn();
    if (sc) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const va = a[sc], vb = b[sc];
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

  private readonly agenticActions: AgentAction[] = [
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
        { name: 'changes', type: 'object', description: 'Key-value changes to apply', required: true },
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
      execute: (params) => this.doSortBy(params as unknown as { column: string; direction?: string }),
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
      name: 'selectRow',
      description: 'Select a row by ID for subsequent operations.',
      parameters: [
        { name: 'id', type: 'string', description: 'Row ID', required: true },
      ],
      execute: (params) => this.doSelectRow(params as unknown as { id: string }),
    },
    {
      name: 'getSnapshot',
      description: 'Get a summary of the current data (column names, row count, selected rows).',
      execute: () => this.doGetSnapshot(),
    },
  ];

  // ---- Lifecycle ----

  ngOnInit(): void {
    this.world.register({
      id: this.agenticId,
      role: 'DataTable',
      actions: this.agenticActions,
      metadata: {
        columns: this.columns,
        totalRows: this.data?.length ?? 0,
        idField: this.idField,
        facadeType: 'DataTable',
      },
    });
  }

  ngOnDestroy(): void {
    this.world.unregister(this.agenticId);
  }

  // ---- UI helpers ----

  toggleSort(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  isSelected(rowId: unknown): boolean {
    return this.selectedIds().has(String(rowId));
  }

  toggleSelect(rowId: unknown): void {
    this.selectedIds.update(s => {
      const next = new Set(s);
      const id = String(rowId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Agentic action implementations ----

  private async doFindRow(query: RowQuery): Promise<AgentActionResult> {
    const column = query.column ?? this.columns[0];
    const value = query.value?.toLowerCase();
    if (!value) {
      return { success: false, message: 'No search value provided.' };
    }

    const matches = this.data.filter(row => {
      const val = row[column];
      return val != null && String(val).toLowerCase().includes(value);
    });

    // Set filter to show matches
    this.filterColumn.set(column);
    this.filterText.set(value);

    if (matches.length === 0) {
      return { success: true, message: `No rows found matching "${query.value}" in column "${column}".` };
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

    let affected = 0;
    const idSet = new Set(op.ids.map(String));
    for (const row of this.data) {
      if (idSet.has(String(row[this.idField]))) {
        Object.assign(row, op.changes);
        affected++;
      }
    }

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
    const before = this.data.length;
    const newData = this.data.filter(row => !idSet.has(String(row[this.idField])));
    this.data.length = 0;
    this.data.push(...newData);
    const affected = before - this.data.length;

    // Clear selections for deleted rows
    this.selectedIds.update(s => {
      const next = new Set(s);
      for (const id of params.ids) next.delete(id);
      return next;
    });

    return {
      success: true,
      message: `Deleted ${affected} row(s).`,
      data: { affectedRows: affected },
    };
  }

  private async doSortBy(params: { column: string; direction?: string }): Promise<AgentActionResult> {
    if (!this.columns.includes(params.column)) {
      return {
        success: false,
        message: `Column "${params.column}" not found. Available: ${this.columns.join(', ')}`,
      };
    }
    this.sortColumn.set(params.column);
    this.sortDirection.set(params.direction === 'desc' ? 'desc' : 'asc');
    return { success: true, message: `Sorted by "${params.column}" ${this.sortDirection()}.` };
  }

  private async doFilterBy(params: { column: string; value: string }): Promise<AgentActionResult> {
    if (!this.columns.includes(params.column)) {
      return {
        success: false,
        message: `Column "${params.column}" not found. Available: ${this.columns.join(', ')}`,
      };
    }
    this.filterColumn.set(params.column);
    this.filterText.set(params.value);
    const count = this.filteredData().length;
    return { success: true, message: `Filtered by "${params.column}" = "${params.value}". ${count} row(s) visible.` };
  }

  private async doSelectRow(params: { id: string }): Promise<AgentActionResult> {
    const row = this.data.find(r => String(r[this.idField]) === params.id);
    if (!row) {
      return { success: false, message: `Row with ID "${params.id}" not found.` };
    }
    this.selectedIds.update(s => new Set(s).add(params.id));
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
      message: `Table "${this.title}": ${this.filteredData().length} rows visible (${this.totalRows()} total)`,
      data: {
        title: this.title,
        columns: this.columns,
        visibleRows: this.filteredData().length,
        totalRows: this.totalRows(),
        selectedIds: selIds,
        isFiltered: !!this.filterText(),
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
      },
    };
  }
}
