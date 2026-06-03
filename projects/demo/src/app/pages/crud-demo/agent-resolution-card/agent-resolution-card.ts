import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-agent-resolution-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="agent-card agent-card--warn">
      <h3>Resolution Needed</h3>
      <p>
        {{ matchCount() }} tasks matched <strong>{{ column() }}</strong> =
        <strong>{{ value() }}</strong>.
      </p>
      <p class="agent-card__summary">{{ matchesSummary() }}</p>
      <p class="agent-card__hint">Use chooser modal to confirm one or more rows.</p>
    </article>
  `,
  styles: [
    `
      .agent-card {
        background: linear-gradient(180deg, #161b22 0%, #0d1117 100%);
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 16px;
        color: #e6edf3;
      }
      .agent-card--warn { border-color: #d29922; }
      h3 { margin: 0 0 12px; font-size: 16px; }
      p { margin: 0 0 10px; }
      .agent-card__summary { color: #8b949e; }
      .agent-card__hint { color: #d29922; margin-bottom: 0; }
    `,
  ],
})
export class AgentResolutionCardComponent {
  readonly column = input('');
  readonly value = input('');
  readonly matchCount = input(0);
  readonly matchesSummary = input('');
}
