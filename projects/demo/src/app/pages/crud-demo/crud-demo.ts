import { Component, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgenticDirective, DataTableComponent, AgentAction, AgentActionResult } from 'agentic-ui';

interface Task {
  [key: string]: unknown;
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  assignee: string;
}

@Component({
  selector: 'app-crud-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, AgenticDirective, DataTableComponent],
  template: `
    <div class="demo-container">
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
        >
          🗑 Delete Selected
        </button>

        <button
          class="btn btn-secondary"
          agentic
          agenticId="clear-filter-btn"
          role="Toolbar Action"
          [actions]="clearFilterAction"
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
      />

      <!-- Add/Edit Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editId() ? '✏️ Edit Task' : '➕ New Task' }}</h2>

            <label>Title</label>
            <input [(ngModel)]="formTitle" placeholder="Task title..." />

            <label>Priority</label>
            <select [(ngModel)]="formPriority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <label>Assignee</label>
            <input [(ngModel)]="formAssignee" placeholder="Assignee name..." />

            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
              <button
                class="btn btn-primary"
                agentic
                [agenticId]="editId() ? 'save-edit-btn' : 'save-add-btn'"
                [role]="editId() ? 'Modal - Edit' : 'Modal - Add'"
                [actions]="saveAction"
                (click)="save()"
              >
                {{ editId() ? 'Save Changes' : 'Create Task' }}
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
    `,
  ],
})
export class CrudDemo {
  // ---- View refs ----
  readonly table = viewChild(DataTableComponent);

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
  formTitle = '';
  formPriority: Task['priority'] = 'medium';
  formAssignee = '';

  // ---- Filter state ----
  readonly activeFilter = signal<string | null>(null);

  // ---- Agentic Actions ----

  /** Add button action */
  readonly addAction: AgentAction[] = [
    {
      name: 'createTask',
      description:
        'Create a new task directly. Provide title and optionally priority and assignee.',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title to create', required: true },
        {
          name: 'priority',
          type: 'string',
          description: 'Task priority',
          enum: ['low', 'medium', 'high'],
        },
        { name: 'assignee', type: 'string', description: 'Assignee name' },
      ],
      execute: async (params: Record<string, unknown> = {}) => {
        const title = typeof params['title'] === 'string' ? params['title'].trim() : '';
        if (!title) {
          this.openAddModal();
          return { success: false, message: 'Task title is required.' };
        }

        const priority = params['priority'];
        const assignee = typeof params['assignee'] === 'string' ? params['assignee'].trim() : '';

        const newTask: Task = {
          id: crypto.randomUUID().slice(0, 8),
          title,
          priority:
            priority === 'low' || priority === 'medium' || priority === 'high'
              ? priority
              : 'medium',
          status: 'todo',
          assignee: assignee || 'Unassigned',
        };

        this.tasks.update((list) => [...list, newTask]);
        return {
          success: true,
          message: `Created task "${newTask.title}" with ${newTask.priority} priority for ${newTask.assignee}.`,
        };
      },
    },
  ];

  /** Delete selected action */
  readonly deleteSelectedAction = [
    {
      name: 'deleteSelected',
      description: 'Delete all currently selected tasks.',
      requiresApproval: true,
      execute: async () => {
        const ids = this.table()?.selectedIds();
        if (!ids || ids.size === 0) {
          return { success: false, message: 'No rows selected.' };
        }
        this.tasks.update((list) => list.filter((t) => !ids.has(t.id)));
        return { success: true, message: `Deleted ${ids.size} task(s).` };
      },
    },
  ];

  /** Clear filter action */
  readonly clearFilterAction = [
    {
      name: 'clearFilters',
      description: 'Clear all active filters and show all tasks.',
      execute: async () => {
        this.activeFilter.set(null);
        return { success: true, message: 'All filters cleared.' };
      },
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
        execute: async () => {
          this.activeFilter.set(this.activeFilter() === p ? null : p);
          return {
            success: true,
            message: this.activeFilter() ? `Filtered by ${p} priority.` : 'Filter cleared.',
          };
        },
      },
    ],
  }));

  /** Save action — shared between Add and Edit modals.
   *  Uses a getter so name/description update when editId changes. */
  get saveAction(): AgentAction[] {
    return [
      {
        name: this.editId() ? 'saveEdit' : 'saveAdd',
        description: this.editId() ? 'Save changes to the current task.' : 'Create the new task.',
        parameters: [
          { name: 'title', type: 'string', description: 'Task title' },
          {
            name: 'priority',
            type: 'string',
            description: 'Task priority',
            enum: ['low', 'medium', 'high'],
          },
          { name: 'assignee', type: 'string', description: 'Assignee name' },
        ],
        execute: async (params: Record<string, unknown> = {}) => {
          if (typeof params['title'] === 'string') {
            this.formTitle = params['title'];
          }
          if (
            params['priority'] === 'low' ||
            params['priority'] === 'medium' ||
            params['priority'] === 'high'
          ) {
            this.formPriority = params['priority'];
          }
          if (typeof params['assignee'] === 'string') {
            this.formAssignee = params['assignee'];
          }

          const saved = this.save();
          return saved
            ? { success: true, message: this.editId() ? 'Task updated.' : 'Task saved.' }
            : { success: false, message: 'Task title is required.' };
        },
      },
    ];
  }

  // ---- Computed ----
  readonly selectedCount = computed(() => this.table()?.selectedIds().size ?? 0);

  // ---- Methods ----
  openAddModal(): void {
    this.editId.set(null);
    this.formTitle = '';
    this.formPriority = 'medium';
    this.formAssignee = '';
    this.showModal.set(true);
  }

  save(): boolean {
    if (!this.formTitle.trim()) return false;

    if (this.editId()) {
      this.tasks.update((list) =>
        list.map((t) =>
          t.id === this.editId()
            ? {
                ...t,
                title: this.formTitle,
                priority: this.formPriority,
                assignee: this.formAssignee,
              }
            : t,
        ),
      );
    } else {
      const newTask: Task = {
        id: crypto.randomUUID().slice(0, 8),
        title: this.formTitle,
        priority: this.formPriority,
        status: 'todo',
        assignee: this.formAssignee || 'Unassigned',
      };
      this.tasks.update((list) => [...list, newTask]);
    }
    this.closeModal();
    return true;
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editId.set(null);
  }
}
