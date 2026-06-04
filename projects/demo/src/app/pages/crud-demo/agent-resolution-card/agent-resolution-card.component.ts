import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-agent-resolution-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-resolution-card.component.html',
  styleUrl: './agent-resolution-card.component.scss',
})
export class AgentResolutionCardComponent {
  readonly column = input('');
  readonly value = input('');
  readonly matchCount = input(0);
  readonly matchesSummary = input('');
}
