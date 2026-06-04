import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgenticDirective, AgentAction } from 'agentic-ui';

export interface ChooserTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  assignee: string;
}

@Component({
  selector: 'app-task-chooser-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  templateUrl: './task-chooser-modal.component.html',
  styleUrl: './task-chooser-modal.component.scss',
})
export class TaskChooserModalComponent {
  readonly matches = input.required<ChooserTask[]>();
  readonly chosenIds = input.required<Set<string>>();
  readonly choiceToggled = output<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly chooserActions: AgentAction[] = [
    {
      name: 'selectRow',
      description: 'Select a row by id for deletion.',
      parameters: [{ name: 'id', type: 'string', description: 'Row id to select', required: true }],
      execute: async (params) => {
        const id = params?.['id'] as string | undefined;
        if (!id) {
          return { success: false, message: 'No id provided.' };
        }
        if (this.chosenIds().has(id)) {
          return { success: false, message: 'Row is already selected.' };
        }
        this.choiceToggled.emit(id);
        return { success: true, message: `Row ${id} selected.` };
      },
    } satisfies AgentAction,
    {
      name: 'deselectRow',
      description: 'Deselect a previously selected row by id.',
      parameters: [{ name: 'id', type: 'string', description: 'Row id to deselect', required: true }],
      execute: async (params) => {
        const id = params?.['id'] as string | undefined;
        if (!id) {
          return { success: false, message: 'No id provided.' };
        }
        if (!this.chosenIds().has(id)) {
          return { success: false, message: 'Row is not selected.' };
        }
        this.choiceToggled.emit(id);
        return { success: true, message: `Row ${id} deselected.` };
      },
    } satisfies AgentAction,
    {
      name: 'selectAllRows',
      description: 'Select all matched rows for deletion.',
      execute: async () => {
        for (const match of this.matches()) {
          if (!this.chosenIds().has(match.id)) {
            this.choiceToggled.emit(match.id);
          }
        }
        return { success: true, message: 'All rows selected.' };
      },
    } satisfies AgentAction,
    {
      name: 'confirmDeletion',
      description: 'Confirm deletion of the chosen rows.',
      requiresApproval: true,
      execute: async () => {
        this.confirmed.emit();
        return { success: true, message: 'Deletion confirmed.' };
      },
    } satisfies AgentAction,
    {
      name: 'cancelDeletion',
      description: 'Cancel deletion and close the chooser modal.',
      execute: async () => {
        this.cancelled.emit();
        return { success: true, message: 'Deletion cancelled.' };
      },
    } satisfies AgentAction,
  ];
}
