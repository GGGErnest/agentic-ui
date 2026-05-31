import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT, AgenticDirective } from 'agentic-ui';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, AgenticDirective],
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: AppNav }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nav-bar" agentic>
      <div class="nav-content">
        <a
          routerLink="/tasks"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="nav-link"
        >
          Tasks
        </a>
        <a
          routerLink="/profile"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="nav-link"
        >
          Profile
        </a>
      </div>
    </nav>
  `,
  styles: [
    `
      .nav-bar {
        background: #161b22;
        border-bottom: 1px solid #30363d;
        padding: 0;
      }

      .nav-content {
        display: flex;
        gap: 1rem;
        padding: 0.75rem 1rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .nav-link {
        color: #c9d1d9;
        text-decoration: none;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .nav-link:hover {
        background-color: #30363d;
      }

      .nav-link.active {
        background-color: #238636;
        color: #ffffff;
      }
    `,
  ],
})
export class AppNav implements AgenticComponent {
  readonly agenticId = 'app-nav';
  readonly agenticRole = 'App Navigation';

  private readonly router = inject(Router);

  readonly agenticActions: AgentAction[] = [
    {
      name: 'navigateTo',
      description: 'Navigate to a page in the application.',
      parameters: [
        {
          name: 'route',
          type: 'string',
          description: 'The page to navigate to',
          enum: ['tasks', 'profile'],
          required: true,
        },
      ],
      execute: async (params) => {
        const route = typeof params?.['route'] === 'string' ? params['route'] : null;
        const valid = ['tasks', 'profile'];
        if (!route || !valid.includes(route)) {
          return { success: false, message: `Unknown route "${route}". Valid: ${valid.join(', ')}` };
        }
        await this.router.navigate([`/${route}`]);
        return { success: true, message: `Navigated to ${route}.` };
      },
    },
  ];
}
