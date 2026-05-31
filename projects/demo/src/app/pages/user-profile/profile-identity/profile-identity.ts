import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT } from 'agentic-ui';
import { ActivityService } from '../../../services/activity.service';

export interface UserProfileData {
  name: string;
  email: string;
  bio: string;
  role: string;
  department: string;
}

const MOCK_PROFILE: UserProfileData = {
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  bio: 'Full-stack engineer passionate about developer tooling and AI-augmented workflows.',
  role: 'Senior Engineer',
  department: 'Platform',
};

@Component({
  selector: 'app-profile-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './profile-identity.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileIdentity }],
  styles: [
    `
      .identity-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
      }
      .identity-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }
      .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #238636;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: 600;
      }
      .identity-name {
        font-size: 18px;
        font-weight: 600;
        color: #e6edf3;
      }
      .identity-role {
        font-size: 13px;
        color: #8b949e;
      }
      .section-heading {
        margin: 0 0 16px;
        font-size: 18px;
        color: #e6edf3;
      }
      .field-row {
        margin-bottom: 14px;
      }
      .field-label {
        font-size: 11px;
        color: #8b949e;
        text-transform: uppercase;
        display: block;
        margin-bottom: 4px;
      }
      .field-value {
        font-size: 14px;
        color: #e6edf3;
      }
      input,
      textarea {
        width: 100%;
        padding: 8px 10px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: #e6edf3;
        font-size: 13px;
        box-sizing: border-box;
      }
      textarea {
        resize: vertical;
        min-height: 72px;
      }
      .actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 16px;
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
export class ProfileIdentity implements AgenticComponent {
  readonly agenticId = 'profile-identity';
  readonly agenticRole = 'User Identity';

  private activityService = inject(ActivityService);

  readonly profile = signal<UserProfileData>({ ...MOCK_PROFILE });
  readonly isEditing = signal(false);
  readonly editName = signal('');
  readonly editEmail = signal('');
  readonly editBio = signal('');
  readonly editRole = signal('');
  readonly editDepartment = signal('');

  readonly agenticActions: AgentAction[] = [
    {
      name: 'getProfile',
      description: 'Retrieve the current user profile data.',
      execute: async () => ({
        success: true,
        data: { ...this.profile() },
        message: 'Profile retrieved successfully.',
      }),
    } satisfies AgentAction,
    {
      name: 'startEdit',
      description: 'Enter edit mode for the profile.',
      execute: async () => {
        this.initEditFields();
        this.isEditing.set(true);
        return { success: true, message: 'Edit mode enabled.' };
      },
    } satisfies AgentAction,
    {
      name: 'updateField',
      description: 'Update a specific profile field while in edit mode.',
      parameters: [
        {
          name: 'field',
          type: 'string',
          description: 'Field name: name, email, bio, role, or department',
          required: true,
          enum: ['name', 'email', 'bio', 'role', 'department'],
        },
        { name: 'value', type: 'string', description: 'New field value', required: true },
      ],
      execute: async (params) => {
        if (!this.isEditing()) {
          return { success: false, message: 'Must be in edit mode to update fields.' };
        }
        const field = typeof params?.['field'] === 'string' ? params['field'] : null;
        const value = typeof params?.['value'] === 'string' ? params['value'] : null;
        if (!field || value === null) {
          return { success: false, message: 'Invalid parameters.' };
        }

        switch (field) {
          case 'name':
            this.editName.set(value);
            break;
          case 'email':
            this.editEmail.set(value);
            break;
          case 'bio':
            this.editBio.set(value);
            break;
          case 'role':
            this.editRole.set(value);
            break;
          case 'department':
            this.editDepartment.set(value);
            break;
          default:
            return { success: false, message: `Unknown field: ${field}` };
        }
        return { success: true, message: `Field ${field} updated.` };
      },
    } satisfies AgentAction,
    {
      name: 'saveProfile',
      description: 'Save profile changes and exit edit mode.',
      execute: async () => {
        if (!this.editName().trim()) {
          return { success: false, message: 'Name cannot be empty.' };
        }
        this.profile.set({
          name: this.editName(),
          email: this.editEmail(),
          bio: this.editBio(),
          role: this.editRole(),
          department: this.editDepartment(),
        });
        this.isEditing.set(false);
        this.activityService.log({
          type: 'profile_updated',
          description: `Profile updated: name is now "${this.profile().name}"`,
        });
        return { success: true, message: 'Profile saved successfully.' };
      },
    } satisfies AgentAction,
    {
      name: 'cancelEdit',
      description: 'Discard changes and exit edit mode.',
      execute: async () => {
        this.initEditFields();
        this.isEditing.set(false);
        return { success: true, message: 'Edit cancelled.' };
      },
    } satisfies AgentAction,
  ];

  get initials(): string {
    const names = this.profile().name.split(' ');
    return names
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  onEditClick(): void {
    this.initEditFields();
    this.isEditing.set(true);
  }

  onSaveClick(): void {
    this.agenticActions.find((a) => a.name === 'saveProfile')?.execute({});
  }

  onCancelClick(): void {
    this.initEditFields();
    this.isEditing.set(false);
  }

  private initEditFields(): void {
    const p = this.profile();
    this.editName.set(p.name);
    this.editEmail.set(p.email);
    this.editBio.set(p.bio);
    this.editRole.set(p.role);
    this.editDepartment.set(p.department);
  }
}
