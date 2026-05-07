import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentShellComponent, TelemetryOverlayComponent } from 'agentic-ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgentShellComponent, TelemetryOverlayComponent],
  template: `
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
