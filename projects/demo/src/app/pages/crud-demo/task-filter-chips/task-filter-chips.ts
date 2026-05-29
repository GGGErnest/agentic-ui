import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgenticDirective, AgentAction } from 'agentic-ui';

@Component({
  selector: 'app-task-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective],
  templateUrl: './task-filter-chips.html',
  styles: [
    `
      .demo-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
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
    `,
  ],
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
