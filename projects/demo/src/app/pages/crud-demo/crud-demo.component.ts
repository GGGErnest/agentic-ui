import { Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  AgenticDirective,
  DataTableComponent,
  AgentAction,
  AgentActionResult,
  AgentWorldService,
  BulkEditOp,
  DataRow,
  AgentJsonSchema,
  AgentReadable,
  DropzoneDirective,
  ComponentRegistry,
  RenderMode,
} from 'agentic-ui';

import { ActivityService } from '../../services/activity.service';
import { TaskToolbarComponent } from './task-toolbar/task-toolbar.component';
import { TaskFilterChipsComponent } from './task-filter-chips/task-filter-chips.component';
import { TaskFormModalComponent, TaskFormValue } from './task-form-modal/task-form-modal.component';
import { TaskChooserModalComponent } from './task-chooser-modal/task-chooser-modal.component';
import { AgentStatusCardComponent } from './agent-status-card/agent-status-card.component';
import { AgentResolutionCardComponent } from './agent-resolution-card/agent-resolution-card.component';

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
    AgenticDirective,
    DropzoneDirective,
    DataTableComponent,
    TaskToolbarComponent,
    TaskFilterChipsComponent,
    TaskFormModalComponent,
    TaskChooserModalComponent,
  ],
  templateUrl: './crud-demo.component.html',
  styleUrl: './crud-demo.component.scss',
})
export class CrudDemo {
  // ---- Injections ----
  private readonly world = inject(AgentWorldService);
  private readonly activity = inject(ActivityService);
  private readonly registry = inject(ComponentRegistry);

  private readonly agentZone = viewChild(DropzoneDirective);
  readonly taskTable = viewChild(DataTableComponent);

  constructor() {
    this.registry.register('agentStatusCard', AgentStatusCardComponent);
    this.registry.register('agentResolutionCard', AgentResolutionCardComponent);
  }

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
  readonly filteredTasks = computed(() => {
    const filter = this.activeFilter();
    if (!filter) return this.tasks();
    return this.tasks().filter((t) => t.priority === filter);
  });
  readonly pendingMatchRequest = signal<PendingMatchRequest | null>(null);
  readonly pendingChoiceIds = signal<Set<string>>(new Set());

  // ---- Agentic Actions & Readables ----

  readonly deleteRowsByCriteriaSchema: AgentJsonSchema = {
    type: 'object',
    properties: {
      column: {
        type: 'string',
        enum: ['title', 'priority', 'status', 'assignee'],
        description: 'Task field to match',
      },
      value: {
        type: 'string',
        description: 'Value to match',
      },
    },
    required: ['column', 'value'],
    additionalProperties: false,
  };

  readonly renderModeSchema: AgentJsonSchema = {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['append', 'replace'],
        description: 'How to render into showcase zone',
        default: 'replace',
      },
    },
    additionalProperties: false,
  };

  readonly pageActions: AgentAction[] = [
    {
      name: 'deleteRowsByCriteria',
      description:
        'Delete task rows by matching a column value. If multiple rows match, open a chooser so the user can pick one or more rows.',
      inputSchema: this.deleteRowsByCriteriaSchema,
      execute: async (params: unknown) =>
        this.deleteRowsByCriteria(params as { column: string; value: string }),
    },
    {
      name: 'deleteSelected',
      description: 'Delete all currently selected tasks.',
      requiresApproval: true,
      execute: async () => this.deleteSelected(),
    },
    {
      name: 'showAgentStatusCard',
      description: 'Render the current CRUD page status into the Agent Showcase panel.',
      inputSchema: this.renderModeSchema,
      execute: async (params) => this.showAgentStatusCard(params),
    },
    {
      name: 'showResolutionCard',
      description: 'Render the current pending match summary into the Agent Showcase panel.',
      inputSchema: this.renderModeSchema,
      execute: async (params) => this.showResolutionCard(params),
    },
    {
      name: 'clearAgentZone',
      description: 'Clear all rendered helper cards from the Agent Showcase panel.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => this.clearAgentZone(),
    },
  ];

  private createValueReadable<T>(
    name: string,
    description: string,
    readValue: () => T,
    valueSchema: AgentJsonSchema['properties'][string],
    writeValue?: (value: T) => void,
  ): AgentReadable {
    return {
      name,
      description,
      schema: {
        type: 'object',
        properties: { value: valueSchema },
        required: ['value'],
        additionalProperties: false,
      },
      writable: !!writeValue,
      read: async () => ({
        success: true,
        message: `Readable ${name} retrieved.`,
        value: readValue(),
      }),
      write: writeValue
        ? async (value) => {
            writeValue(value as T);
            return { success: true, message: `Readable ${name} updated.` };
          }
        : undefined,
    };
  }

  readonly pageReadables: AgentReadable[] = [
    this.createValueReadable(
      'activeFilter',
      'Current task priority filter.',
      () => this.activeFilter(),
      {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      (value) => this.activeFilter.set(typeof value === 'string' ? value : null),
    ),
    this.createValueReadable(
      'selectedTaskIds',
      'Current selected task ids.',
      () => this.selectedTaskIds(),
      {
        type: 'array',
        items: { type: 'string' },
      },
    ),
    this.createValueReadable(
      'selectedCount',
      'Current selected task count.',
      () => this.selectedCount(),
      {
        type: 'number',
      },
    ),
    this.createValueReadable(
      'showModal',
      'Whether the task form modal is visible.',
      () => this.showModal(),
      {
        type: 'boolean',
      },
    ),
    this.createValueReadable(
      'editId',
      'Current task id being edited.',
      () => this.editId(),
      {
        type: 'string',
      },
    ),
    this.createValueReadable(
      'pendingMatchRequest',
      'Current pending delete-match resolution payload.',
      () => this.pendingMatchRequest(),
      { type: 'object' },
    ),
    this.createValueReadable(
      'pendingChoiceIds',
      'Current selected ids in chooser modal.',
      () => [...this.pendingChoiceIds()],
      {
        type: 'array',
        items: { type: 'string' },
      },
    ),
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
      this.activity.log({ type: 'task_edited', description: `Edited task "${value.title}"` });
    } else {
      const newTask: Task = {
        id: crypto.randomUUID().slice(0, 8),
        title: value.title,
        priority: value.priority,
        status: 'todo',
        assignee: value.assignee || 'Unassigned',
      };
      this.tasks.update((list) => [...list, newTask]);
      this.activity.log({ type: 'task_created', description: `Created task "${value.title}"` });
    }
    this.closeModal();
  }

  onTableSelectionChange(ids: string[]): void {
    this.selectedTaskIds.set(ids);
  }

  onRowsEdited(edit: BulkEditOp): void {
    const editedSet = new Set(edit.ids.map(String));
    this.tasks.update((list) =>
      list.map((task) => (editedSet.has(task.id) ? { ...task, ...edit.changes } : task)),
    );
    this.activity.log({
      type: 'task_edited',
      description: `Edited ${edit.ids.length} task(s)`,
      metadata: { ids: edit.ids, changes: edit.changes },
    });
  }

  onRowsDeleted(deletedIds: string[]): void {
    const deletedSet = new Set(deletedIds);
    this.tasks.update((list) => list.filter((task) => !deletedSet.has(task.id)));
    this.activity.log({
      type: 'task_deleted',
      description: `Deleted ${deletedIds.length} task(s)`,
      metadata: { ids: deletedIds },
    });
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

  private getRenderMode(params: unknown): RenderMode {
    return params && typeof (params as Record<string, unknown>)['mode'] === 'string'
      ? ((params as Record<string, unknown>)['mode'] as RenderMode)
      : 'replace';
  }

  private getPendingMatchSummary(): string {
    const request = this.pendingMatchRequest();
    if (!request) return 'none';
    return request.matches.map((task) => `${task.id}:${task.title}`).join(', ');
  }

  async showAgentStatusCard(params: unknown): Promise<AgentActionResult> {
    if (!this.agentZone()) {
      return { success: false, message: 'Agent showcase zone is not available.' };
    }

    this.agentZone()!.render(
      'agentStatusCard',
      {
        activeFilter: this.activeFilter(),
        selectedCount: this.selectedCount(),
        selectedIdsLabel: this.selectedTaskIds().join(', ') || 'none',
        showModal: this.showModal(),
        editId: this.editId(),
        pendingMatchLabel: this.getPendingMatchSummary(),
      },
      this.getRenderMode(params),
    );

    return { success: true, message: 'Agent status card rendered.' };
  }

  async showResolutionCard(params: unknown): Promise<AgentActionResult> {
    const request = this.pendingMatchRequest();
    if (!request) {
      return { success: false, message: 'No pending match request available.' };
    }
    if (!this.agentZone()) {
      return { success: false, message: 'Agent showcase zone is not available.' };
    }

    this.agentZone()!.render(
      'agentResolutionCard',
      {
        column: request.column,
        value: request.value,
        matchCount: request.matches.length,
        matchesSummary: request.matches.map((task) => `${task.id}:${task.title}`).join(', '),
      },
      this.getRenderMode(params),
    );

    return { success: true, message: 'Resolution card rendered.' };
  }

  async clearAgentZone(): Promise<AgentActionResult> {
    if (!this.agentZone()) {
      return { success: true, message: 'Agent showcase zone already clear.' };
    }

    this.agentZone()!.render('agentStatusCard', {}, 'clear');
    return { success: true, message: 'Agent showcase zone cleared.' };
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
