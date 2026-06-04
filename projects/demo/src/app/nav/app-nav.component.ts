import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AgenticComponent, AgentAction, AGENTIC_COMPONENT, AgenticDirective } from 'agentic-ui';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, AgenticDirective],
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: AppNav }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-nav.component.html',
  styleUrl: './app-nav.component.scss',
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
