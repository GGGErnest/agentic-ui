import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgenticDirective, AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-task-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  templateUrl: './task-filter-chips.component.html',
  styleUrl: './task-filter-chips.component.scss',
})
export class TaskFilterChipsComponent {
  readonly activeFilter = input<string | null>(null);
  readonly filterToggled = output<string>();

  readonly chips = [
    {
      priority: 'high',
      label: 'High',
      actions: [
        {
          name: 'filterByHigh',
          description: 'Show only high priority tasks.',
          execute: async (): Promise<{ success: boolean; message: string }> => {
            this.filterToggled.emit('high');
            return { success: true, message: 'Filtered to high priority tasks.' };
          },
        } satisfies AgentAction,
      ],
    },
    {
      priority: 'medium',
      label: 'Medium',
      actions: [
        {
          name: 'filterByMedium',
          description: 'Show only medium priority tasks.',
          execute: async (): Promise<{ success: boolean; message: string }> => {
            this.filterToggled.emit('medium');
            return { success: true, message: 'Filtered to medium priority tasks.' };
          },
        } satisfies AgentAction,
      ],
    },
    {
      priority: 'low',
      label: 'Low',
      actions: [
        {
          name: 'filterByLow',
          description: 'Show only low priority tasks.',
          execute: async (): Promise<{ success: boolean; message: string }> => {
            this.filterToggled.emit('low');
            return { success: true, message: 'Filtered to low priority tasks.' };
          },
        } satisfies AgentAction,
      ],
    },
  ];
}
