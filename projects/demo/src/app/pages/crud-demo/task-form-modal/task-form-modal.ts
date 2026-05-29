import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenticDirective, AgentAction } from 'agentic-ui';

export interface TaskFormValue {
  title: string;
  priority: 'low' | 'medium' | 'high';
  assignee: string;
}

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgenticDirective, FormsModule],
  templateUrl: './task-form-modal.html',
  styles: [
    `
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
      .btn {
        padding: 8px 16px;
        border: 1px solid #30363d;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        background: #161b22;
        color: #e6edf3;
      }
      .btn-primary {
        background: #238636;
        border-color: #238636;
        color: #fff;
      }
      .btn-secondary {
        color: #8b949e;
      }
    `,
  ],
})
export class TaskFormModalComponent {
  readonly editId = input<string | null>(null);
  readonly initialTitle = input('');
  readonly initialPriority = input<'low' | 'medium' | 'high'>('medium');
  readonly initialAssignee = input('');
  readonly saved = output<TaskFormValue>();
  readonly cancelled = output<void>();

  readonly formTitle = linkedSignal(() => this.initialTitle());
  readonly formPriority = linkedSignal(() => this.initialPriority());
  readonly formAssignee = linkedSignal(() => this.initialAssignee());

  readonly modalActions: AgentAction[] = [
    {
      name: 'fillForm',
      description: 'Fill the task form with provided values.',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: false },
        {
          name: 'priority',
          type: 'string',
          description: 'Task priority',
          enum: ['low', 'medium', 'high'],
          required: false,
        },
        { name: 'assignee', type: 'string', description: 'Task assignee', required: false },
      ],
      execute: async (params) => {
        if (params?.['title']) this.formTitle.set(params['title'] as string);
        if (params?.['priority']) this.formPriority.set(params['priority'] as 'low' | 'medium' | 'high');
        if (params?.['assignee']) this.formAssignee.set(params['assignee'] as string);
        return { success: true, message: 'Form filled successfully.' };
      },
    } satisfies AgentAction,
    {
      name: 'submitForm',
      description: 'Submit and save the current form data.',
      execute: async () => {
        const result = this.submit();
        if (result) {
          return { success: true, message: 'Form submitted successfully.' };
        }
        return { success: false, message: 'Form validation failed.' };
      },
    } satisfies AgentAction,
    {
      name: 'closeModal',
      description: 'Close the modal without saving.',
      execute: async () => {
        this.cancelled.emit();
        return { success: true, message: 'Modal closed.' };
      },
    } satisfies AgentAction,
  ];

  readonly saveButtonActions: AgentAction[] = [
    {
      name: 'clickSaveButton',
      description: 'Click the save button to submit and persist the current form data.',
      execute: async () => {
        const result = this.submit();
        if (result) {
          return { success: true, message: 'Form submitted successfully.' };
        }
        return { success: false, message: 'Form validation failed.' };
      },
    } satisfies AgentAction,
  ];

  submit(): boolean {
    if (!this.formTitle()?.trim()) {
      return false;
    }
    this.saved.emit({
      title: this.formTitle(),
      priority: this.formPriority(),
      assignee: this.formAssignee(),
    });
    return true;
  }
}
