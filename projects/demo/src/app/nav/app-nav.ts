import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="nav-bar">
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
  styles: [`
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppNav {}
