import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-agent-status-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-status-card.component.html',
  styleUrl: './agent-status-card.component.scss',
})
export class AgentStatusCardComponent {
  readonly activeFilter = input<string | null>(null);
  readonly selectedCount = input(0);
  readonly selectedIdsLabel = input('none');
  readonly showModal = input(false);
  readonly editId = input<string | null>(null);
  readonly pendingMatchLabel = input('none');
}
