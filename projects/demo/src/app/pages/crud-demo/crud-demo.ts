import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AgenticDirective,
  DataTableComponent,
  AgentAction,
  AgentActionResult,
  AgentWorldService,
  DataRow,
} from 'agentic-ui';

import { TaskToolbarComponent } from './task-toolbar/task-toolbar';
import { TaskFilterChipsComponent } from './task-filter-chips/task-filter-chips';
import { TaskFormModalComponent, TaskFormValue } from './task-form-modal/task-form-modal';
import { TaskChooserModalComponent } from './task-chooser-modal/task-chooser-modal';

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
  imports: [
    CommonModule,
    AgenticDirective,
    DataTableComponent,
    TaskToolbarComponent,
    TaskFilterChipsComponent,
    TaskFormModalComponent,
    TaskChooserModalComponent,
  ],
  templateUrl: './crud-demo.html',
  styleUrls: ['./crud-demo.scss'],
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
  readonly formStatus = signal<Task['status']>('todo');

  // ---- Filter state ----
  readonly activeFilter = signal<string | null>(null);

  // ---- Selection state ----
  readonly selectedTaskIds = signal<string[]>([]);
  readonly selectedCount = computed(() => this.selectedTaskIds().length);
  readonly pendingMatchRequest = signal<PendingMatchRequest | null>(null);
  readonly pendingChoiceIds = signal<Set<string>>(new Set());

  // ---- Agentic Actions ----

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
  readonly deleteSelectedAction: AgentAction[] = [
    {
      name: 'deleteSelected',
      description: 'Delete all currently selected tasks.',
      requiresApproval: true,
      execute: async () => this.deleteSelected(),
    },
  ];

  // ---- Methods ----
  openAddModal(): void {
    this.editId.set(null);
    this.formTitle.set('');
    this.formPriority.set('medium');
    this.formAssignee.set('');
    this.formStatus.set('todo');
    this.showModal.set(true);
  }

  openEditModal(row: DataRow): void {
    const task = this.tasks().find((t) => t.id === String(row['id']));
    if (!task) {
      return;
    }
    this.editId.set(task.id);
    this.formTitle.set(task.title);
    this.formPriority.set(task.priority);
    this.formAssignee.set(task.assignee);
    this.formStatus.set(task.status);
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

  onFormSaved(value: TaskFormValue): void {
    if (this.editId()) {
      this.tasks.update((list) =>
        list.map((t) =>
          t.id === this.editId()
            ? {
                ...t,
                title: value.title,
                priority: value.priority,
                assignee: value.assignee,
                status: value.status,
              }
            : t,
        ),
      );
    } else {
      const newTask: Task = {
        id: crypto.randomUUID().slice(0, 8),
        title: value.title,
        priority: value.priority,
        status: 'todo',
        assignee: value.assignee || 'Unassigned',
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
