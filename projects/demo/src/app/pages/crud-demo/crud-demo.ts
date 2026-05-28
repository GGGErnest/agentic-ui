import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AgenticDirective,
  DataTableComponent,
  AgentActionResult,
  AgentWorldService,
} from 'agentic-ui';

interface Task {
  [key: string]: unknown;
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  assignee: string;
}

interface PendingMatchRequest {
  intent: 'delete';
  column: keyof Pick<Task, 'title' | 'priority' | 'status' | 'assignee'>;
  value: string;
  matches: Task[];
}

@Component({
  selector: 'app-crud-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, AgenticDirective, DataTableComponent],
  template: `
    <div
      class="demo-container"
      agentic
      agenticId="task-ops"
      role="Task Operations"
      [actions]="taskResolverActions"
    >
      <header class="demo-header">
        <h1>🧪 Agentic-UI Demo</h1>
        <p class="demo-subtitle">
          This page is instrumented for AI agents. Every button and the data table expose their
          capabilities through the World Registry — no DOM scraping needed.
        </p>
      </header>

      <!-- Toolbar: instrumented buttons -->
      <div class="demo-toolbar">
        <button
          class="btn btn-primary"
          agentic
          agenticId="add-btn"
          role="Toolbar Action"
          [actions]="addAction"
          (click)="openAddModal()"
        >
          ➕ Add Task
        </button>

        <button
          class="btn btn-danger"
          agentic
          agenticId="delete-selected-btn"
          role="Toolbar Action"
          [actions]="deleteSelectedAction"
          (click)="deleteSelected()"
        >
          🗑 Delete Selected
        </button>

        <button
          class="btn btn-secondary"
          agentic
          agenticId="clear-filter-btn"
          role="Toolbar Action"
          [actions]="clearFilterAction"
          (click)="clearFilters()"
        >
          🔄 Clear Filters
        </button>

        <span class="demo-stats">
          {{ tasks().length }} tasks · {{ selectedCount() }} selected
        </span>
      </div>

      <!-- Quick filter chips -->
      <div class="demo-filters">
        @for (filter of filters; track filter.label) {
          <button
            class="chip"
            [class.chip--active]="activeFilter() === filter.priority"
            agentic
            [agenticId]="'filter-' + filter.priority"
            role="Filter"
            [actions]="filter.actions"
            (click)="togglePriorityFilter(filter.priority)"
          >
            {{ filter.label }}
          </button>
        }
      </div>

      <!-- Facade DataTable -->
      <agui-data-table
        agenticId="task-table"
        title="Tasks"
        [columns]="['title', 'priority', 'status', 'assignee']"
        [data]="tasks()"
        idField="id"
        (selectionChange)="onTableSelectionChange($event)"
        (rowsDeleted)="onRowsDeleted($event)"
      />

      <!-- Add/Edit Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editId() ? '✏️ Edit Task' : '➕ New Task' }}</h2>

            <label>Title</label>
            <input
              [ngModel]="formTitle()"
              (ngModelChange)="formTitle.set($event)"
              placeholder="Task title..."
            />

            <label>Priority</label>
            <select [ngModel]="formPriority()" (ngModelChange)="formPriority.set($event)">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <label>Assignee</label>
            <input
              [ngModel]="formAssignee()"
              (ngModelChange)="formAssignee.set($event)"
              placeholder="Assignee name..."
            />

            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
              <button
                class="btn btn-primary"
                agentic
                [agenticId]="editId() ? 'save-edit-btn' : 'save-add-btn'"
                [role]="editId() ? 'Modal - Edit' : 'Modal - Add'"
                [actions]="saveAction()"
                (click)="save()"
              >
                {{ editId() ? 'Save Changes' : 'Create Task' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Chooser Modal -->
      @if (pendingMatchRequest(); as request) {
        <div class="modal-backdrop" (click)="cancelPendingMatch()">
          <div class="modal match-chooser" (click)="$event.stopPropagation()">
            <h2>Choose rows to delete</h2>
            <p class="demo-subtitle">
              {{ request.matches.length }} rows matched {{ request.column }} = "{{
                request.value
              }}".
            </p>

            <div class="match-chooser__list">
              @for (task of request.matches; track task.id) {
                <label class="match-chooser__row">
                  <input
                    type="checkbox"
                    [checked]="pendingChoiceIds().has(task.id)"
                    (change)="togglePendingChoice(task.id)"
                  />
                  <span>{{ task.title }}</span>
                  <span>{{ task.priority }}</span>
                  <span>{{ task.status }}</span>
                  <span>{{ task.assignee }}</span>
                </label>
              }
            </div>

            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="cancelPendingMatch()">Cancel</button>
              <button
                class="btn btn-danger"
                [disabled]="pendingChoiceIds().size === 0"
                (click)="confirmPendingMatch()"
              >
                Delete Chosen Rows
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Status bar -->
      <footer class="demo-footer">
        <span class="demo-hint">
          💡 Open the Agent Shell (bottom-right) to interact with this page via AI.
        </span>
      </footer>
    </div>
  `,
  styles: [
    `
      .demo-container {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        color: #e6edf3;
        background: #0d1117;
        min-height: 100vh;
      }
      .demo-header h1 {
        font-size: 24px;
        margin-bottom: 4px;
      }
      .demo-subtitle {
        color: #8b949e;
        font-size: 14px;
        margin-bottom: 20px;
      }
      .demo-toolbar {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .demo-stats {
        margin-left: auto;
        color: #8b949e;
        font-size: 13px;
      }
      .demo-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .demo-footer {
        margin-top: 24px;
        padding: 12px;
        border-top: 1px solid #30363d;
      }
      .demo-hint {
        color: #8b949e;
        font-size: 13px;
      }

      .btn {
        padding: 8px 16px;
        border: 1px solid #30363d;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        background: #161b22;
        color: #e6edf3;
      }
      .btn:hover {
        background: #1c2530;
      }
      .btn-primary {
        background: #238636;
        border-color: #238636;
        color: #fff;
      }
      .btn-primary:hover {
        background: #2ea043;
      }
      .btn-danger {
        color: #f85149;
      }
      .btn-danger:hover {
        background: #490202;
        border-color: #f85149;
      }
      .btn-secondary {
        color: #8b949e;
      }

      .chip {
        padding: 4px 12px;
        border: 1px solid #30363d;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        background: #161b22;
        color: #8b949e;
      }
      .chip:hover {
        color: #e6edf3;
      }
      .chip--active {
        background: #1f6feb;
        border-color: #1f6feb;
        color: #fff;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
        width: 400px;
        max-width: 90vw;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .modal h2 {
        font-size: 18px;
        margin: 0 0 8px;
      }
      .modal label {
        font-size: 12px;
        color: #8b949e;
        text-transform: uppercase;
      }
      .modal input,
      .modal select {
        padding: 8px 10px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: #e6edf3;
        font-size: 13px;
      }
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 10px;
      }
      .match-chooser__list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 280px;
        overflow: auto;
        margin-top: 8px;
      }
      .match-chooser__row {
        display: grid;
        grid-template-columns: auto 1.8fr 0.8fr 1fr 1fr;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border: 1px solid #30363d;
        border-radius: 8px;
        background: #0d1117;
        color: #e6edf3;
        font-size: 13px;
      }
    `,
  ],
})
export class CrudDemo {
  // ---- Injections ----
  private readonly world = inject(AgentWorldService);

  @ViewChild(DataTableComponent) taskTable?: DataTableComponent;

  // ---- Data ----
  readonly tasks = signal<Task[]>([
    { id: '1', title: 'Fix login bug', priority: 'high', status: 'in-progress', assignee: 'Alice' },
    { id: '2', title: 'Add dark mode', priority: 'medium', status: 'todo', assignee: 'Bob' },
    { id: '3', title: 'Update docs', priority: 'low', status: 'done', assignee: 'Charlie' },
    { id: '4', title: 'Refactor auth module', priority: 'high', status: 'todo', assignee: 'Alice' },
    {
      id: '5',
      title: 'Add unit tests',
      priority: 'medium',
      status: 'in-progress',
      assignee: 'Diana',
    },
  ]);

  // ---- Modal state ----
  readonly showModal = signal(false);
  readonly editId = signal<string | null>(null);
  readonly formTitle = signal('');
  readonly formPriority = signal<Task['priority']>('medium');
  readonly formAssignee = signal('');

  // ---- Filter state ----
  readonly activeFilter = signal<string | null>(null);

  // ---- Selection state ----
  readonly selectedTaskIds = signal<string[]>([]);
  readonly selectedCount = computed(() => this.selectedTaskIds().length);
  readonly pendingMatchRequest = signal<PendingMatchRequest | null>(null);
  readonly pendingChoiceIds = signal<Set<string>>(new Set());

  // ---- Agentic Actions ----

  /** Add button action */
  readonly addAction = [
    {
      name: 'openAddModal',
      description: 'Open the modal to add a new task.',
      execute: async () => {
        this.openAddModal();
        return { success: true, message: 'Opened add task modal.' };
      },
    },
  ];

  /** Task resolver action */
  readonly taskResolverActions = [
    {
      name: 'deleteRowsByCriteria',
      description:
        'Delete task rows by matching a column value. If multiple rows match, open a chooser so the user can pick one or more rows.',
      parameters: [
        {
          name: 'column',
          type: 'string' as const,
          description: 'One of: title, priority, status, assignee',
          required: true,
        },
        {
          name: 'value',
          type: 'string' as const,
          description: 'The value to match in that column',
          required: true,
        },
      ],
      execute: async (params: unknown) =>
        this.deleteRowsByCriteria(params as { column: string; value: string }),
    },
  ];

  /** Delete selected action */
  readonly deleteSelectedAction = [
    {
      name: 'deleteSelected',
      description: 'Delete all currently selected tasks.',
      requiresApproval: true,
      execute: async () => this.deleteSelected(),
    },
  ];

  /** Clear filter action */
  readonly clearFilterAction = [
    {
      name: 'clearFilters',
      description: 'Clear all active filters and show all tasks.',
      execute: async () => this.clearFilters(),
    },
  ];

  /** Filter chip actions */
  readonly filters = ['high', 'medium', 'low'].map((p) => ({
    priority: p,
    label: p.charAt(0).toUpperCase() + p.slice(1),
    actions: [
      {
        name: `filterBy${p.charAt(0).toUpperCase() + p.slice(1)}`,
        description: `Show only ${p} priority tasks.`,
        execute: async () => this.togglePriorityFilter(p),
      },
    ],
  }));

  /** Save action — shared between Add and Edit modals */
  readonly saveAction = computed(() => [
    {
      name: this.editId() ? 'saveEdit' : 'saveAdd',
      description: this.editId() ? 'Save changes to the current task.' : 'Create the new task.',
      execute: async () => {
        this.save();
        return { success: true, message: 'Task saved.' };
      },
    },
  ]);

  // ---- Computed ----

  // ---- Methods ----
  openAddModal(): void {
    this.editId.set(null);
    this.formTitle.set('');
    this.formPriority.set('medium');
    this.formAssignee.set('');
    this.showModal.set(true);
  }

  async deleteSelected(): Promise<AgentActionResult> {
    const ids = this.selectedTaskIds();
    if (ids.length === 0) {
      return { success: false, message: 'No selected rows to delete.' };
    }

    return this.world.executeAction('task-table', 'bulkDelete', { ids });
  }

  clearFilters(): AgentActionResult {
    this.activeFilter.set(null);
    return { success: true, message: 'All filters cleared.' };
  }

  togglePriorityFilter(priority: string): AgentActionResult {
    this.activeFilter.set(this.activeFilter() === priority ? null : priority);

    return {
      success: true,
      message: this.activeFilter() ? `Filtered by ${priority} priority.` : 'Filter cleared.',
    };
  }

  save(): void {
    if (!this.formTitle().trim()) return;

    if (this.editId()) {
      this.tasks.update((list) =>
        list.map((t) =>
          t.id === this.editId()
            ? {
                ...t,
                title: this.formTitle(),
                priority: this.formPriority(),
                assignee: this.formAssignee(),
              }
            : t,
        ),
      );
    } else {
      const newTask: Task = {
        id: crypto.randomUUID().slice(0, 8),
        title: this.formTitle(),
        priority: this.formPriority(),
        status: 'todo',
        assignee: this.formAssignee() || 'Unassigned',
      };
      this.tasks.update((list) => [...list, newTask]);
    }
    this.closeModal();
  }

  onTableSelectionChange(ids: string[]): void {
    this.selectedTaskIds.set(ids);
  }

  onRowsDeleted(deletedIds: string[]): void {
    const deletedSet = new Set(deletedIds);
    this.tasks.update((list) => list.filter((task) => !deletedSet.has(task.id)));
  }

  togglePendingChoice(id: string): void {
    this.pendingChoiceIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  cancelPendingMatch(): void {
    this.pendingMatchRequest.set(null);
    this.pendingChoiceIds.set(new Set());
  }

  private async deleteRowsByCriteria(params: {
    column: string;
    value: string;
  }): Promise<AgentActionResult> {
    // Validate params before using them
    if (typeof params?.column !== 'string' || typeof params?.value !== 'string') {
      return {
        success: false,
        message: 'Invalid parameters: column and value are required strings.',
      };
    }

    const column = params.column as PendingMatchRequest['column'];
    const allowedColumns = ['title', 'priority', 'status', 'assignee'];
    if (!allowedColumns.includes(column)) {
      return {
        success: false,
        message: `Column "${params.column}" not found. Available: ${allowedColumns.join(', ')}`,
      };
    }

    const value = params.value.trim().toLowerCase();
    if (!value) {
      return { success: false, message: 'No search value provided.' };
    }

    const matches = this.tasks().filter((task) => {
      const candidate = task[column];
      return String(candidate).toLowerCase().includes(value);
    });

    if (matches.length === 0) {
      return {
        success: true,
        message: `No rows found matching "${params.value}" in column "${column}".`,
      };
    }

    if (matches.length === 1) {
      const ids = [matches[0].id];
      return this.world.executeAction('task-table', 'bulkDelete', { ids });
    }

    this.pendingMatchRequest.set({ intent: 'delete', column, value: params.value, matches });
    this.pendingChoiceIds.set(new Set());

    return {
      success: true,
      message: `Multiple rows matched "${params.value}" in column "${column}". Choose one or more rows in the page to continue.`,
      data: { matches },
    };
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editId.set(null);
  }

  async confirmPendingMatch(): Promise<void> {
    const request = this.pendingMatchRequest();
    if (!request) return;

    const chosenIds = [...this.pendingChoiceIds()];
    const validIds = request.matches
      .map((task) => task.id)
      .filter((id) => chosenIds.includes(id) && this.tasks().some((task) => task.id === id));

    if (validIds.length === 0) {
      this.cancelPendingMatch();
      return;
    }

    this.cancelPendingMatch();

    if (request.intent === 'delete') {
      await this.world.executeAction('task-table', 'bulkDelete', { ids: validIds });
    }
  }
}
