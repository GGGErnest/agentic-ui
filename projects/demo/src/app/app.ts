import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentShellComponent, TelemetryOverlayComponent } from 'agentic-ui';
import { AppNav } from './nav/app-nav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgentShellComponent, TelemetryOverlayComponent, AppNav],
  template: `
    <app-nav />
    <router-outlet />
    <agui-agent-shell />
    <agui-telemetry-overlay />
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
