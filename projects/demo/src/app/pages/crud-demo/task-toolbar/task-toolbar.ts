import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgenticDirective, AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-task-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  templateUrl: './task-toolbar.html',
  styles: [
    `
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
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
    `,
  ],
})
export class TaskToolbarComponent {
  readonly taskCount = input.required<number>();
  readonly selectedCount = input.required<number>();
  readonly addClicked = output<void>();
  readonly deleteSelectedClicked = output<void>();
  readonly clearFiltersClicked = output<void>();

  readonly toolbarActions: AgentAction[] = [
    {
      name: 'openAddTaskModal',
      description: 'Open the form modal to add a new task.',
      execute: async () => {
        this.addClicked.emit();
        return { success: true, message: 'Opened add task modal.' };
      },
    },
    {
      name: 'deleteSelectedTasks',
      description: 'Delete all currently selected tasks.',
      requiresApproval: true,
      execute: async () => {
        this.deleteSelectedClicked.emit();
        return { success: true, message: 'Deleted selected tasks.' };
      },
    },
    {
      name: 'clearFilters',
      description: 'Clear all active filters and show all tasks.',
      execute: async () => {
        this.clearFiltersClicked.emit();
        return { success: true, message: 'Cleared all filters.' };
      },
    },
  ];
}
