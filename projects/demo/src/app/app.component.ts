import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentShellComponent } from 'agentic-ui';
import { AppNav } from './nav/app-nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgentShellComponent, AppNav],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {}
