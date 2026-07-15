import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgenticComponent,
  AgentAction,
  AgentActionResult,
  AGENTIC_COMPONENT,
  AgentTool,
  collectAgentTools,
} from 'agentic-ui';
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
  templateUrl: './profile-identity.component.html',
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: ProfileIdentity }],
  styleUrl: './profile-identity.component.scss',
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

  private _agenticActions?: AgentAction[];

  get agenticActions(): AgentAction[] {
    return (this._agenticActions ??= collectAgentTools(this));
  }

  @AgentTool({
    name: 'getProfile',
    description: 'Retrieve the current user profile data.',
  })
  private async doGetProfile(): Promise<AgentActionResult> {
    return {
      success: true,
      data: { ...this.profile() },
      message: 'Profile retrieved successfully.',
    };
  }

  @AgentTool({
    name: 'startEdit',
    description: 'Enter edit mode for the profile.',
  })
  private async doStartEdit(): Promise<AgentActionResult> {
    this.initEditFields();
    this.isEditing.set(true);
    return { success: true, message: 'Edit mode enabled.' };
  }

  @AgentTool({
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
  })
  private async doUpdateField(params?: Record<string, unknown>): Promise<AgentActionResult> {
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
  }

  @AgentTool({
    name: 'saveProfile',
    description: 'Save profile changes and exit edit mode.',
  })
  private async doSaveProfile(): Promise<AgentActionResult> {
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
  }

  @AgentTool({
    name: 'cancelEdit',
    description: 'Discard changes and exit edit mode.',
  })
  private async doCancelEdit(): Promise<AgentActionResult> {
    this.initEditFields();
    this.isEditing.set(false);
    return { success: true, message: 'Edit cancelled.' };
  }

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
    this.doSaveProfile();
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
