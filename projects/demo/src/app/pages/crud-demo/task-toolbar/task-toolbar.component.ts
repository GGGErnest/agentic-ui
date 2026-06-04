import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgenticDirective, AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-task-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  templateUrl: './task-toolbar.component.html',
  styleUrl: './task-toolbar.component.scss',
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
