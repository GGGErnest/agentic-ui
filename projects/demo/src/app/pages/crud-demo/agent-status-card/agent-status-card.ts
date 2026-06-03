import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-agent-status-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="agent-card">
      <h3>Agent Status</h3>
      <dl>
        <div><dt>Filter</dt><dd>{{ activeFilter() ?? 'none' }}</dd></div>
        <div><dt>Selected</dt><dd>{{ selectedCount() }}</dd></div>
        <div><dt>Selection</dt><dd>{{ selectedIdsLabel() }}</dd></div>
        <div><dt>Modal</dt><dd>{{ showModal() ? 'open' : 'closed' }}</dd></div>
        <div><dt>Edit Target</dt><dd>{{ editId() ?? 'none' }}</dd></div>
        <div><dt>Pending Match</dt><dd>{{ pendingMatchLabel() }}</dd></div>
      </dl>
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
      h3 { margin: 0 0 12px; font-size: 16px; }
      dl { display: grid; gap: 10px; margin: 0; }
      div { display: flex; justify-content: space-between; gap: 12px; }
      dt { color: #8b949e; }
      dd { margin: 0; text-align: right; }
    `,
  ],
})
export class AgentStatusCardComponent {
  readonly activeFilter = input<string | null>(null);
  readonly selectedCount = input(0);
  readonly selectedIdsLabel = input('none');
  readonly showModal = input(false);
  readonly editId = input<string | null>(null);
  readonly pendingMatchLabel = input('none');
}
