import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentShellComponent } from 'agentic-ui';
import { AppNav } from './nav/app-nav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgentShellComponent, AppNav],
  template: `
    <app-nav />
    <router-outlet />
    <agui-agent-shell />
  `,
  styles: [`
    :host {
      display: block;
      background: #0d1117;
      min-height: 100vh;
    }
  `],
})
export class App {}
