import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { AgentWorldService } from '../../../core/world/agent-world.service';

/**
 * TelemetryOverlayComponent — renders a fixed-position SVG/HTML overlay
 * that highlights the agent's currently focused component.
 *
 * Live mode:  Neon Green border (#00ff88)
 * Shadow mode: Neon Purple border (#bf00ff)
 */
@Component({
  selector: 'agui-telemetry-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './telemetry-overlay.component.html',
  styleUrl: './telemetry-overlay.component.scss',
})
export class TelemetryOverlayComponent {
  private readonly world = inject(AgentWorldService);

  readonly focusedId = this.world.focusedEntryId;
  readonly shadowActive = this.world.shadowMode;

  readonly rect = computed(() => {
    const id = this.focusedId();
    if (!id) return null;

    const entry = this.world.entries().get(id);
    if (!entry?.element) return null;

    const rect = entry.element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
}
