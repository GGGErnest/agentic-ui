import { Component, inject, computed } from '@angular/core';
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
  template: `
    @if (rect(); as r) {
      <div
        class="telemetry-frame"
        [style.left.px]="r.left"
        [style.top.px]="r.top"
        [style.width.px]="r.width"
        [style.height.px]="r.height"
        [class.telemetry-frame--live]="!shadowActive()"
        [class.telemetry-frame--shadow]="shadowActive()"
      >
        <div class="telemetry-label">
          {{ focusedId() }}
        </div>
      </div>
    }
  `,
  styles: [`
    .telemetry-frame {
      position: fixed;
      z-index: 99998;
      pointer-events: none;
      border: 2px solid transparent;
      border-radius: 4px;
      transition: all 0.15s ease-out;
    }
    .telemetry-frame--live {
      border-color: #00ff88;
      box-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
    }
    .telemetry-frame--shadow {
      border-color: #bf00ff;
      box-shadow: 0 0 12px rgba(191, 0, 255, 0.4);
    }
    .telemetry-label {
      position: absolute;
      top: -22px;
      left: 0;
      background: #0d1117;
      color: #e6edf3;
      font-size: 10px;
      font-family: 'SF Mono', monospace;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
    }
  `],
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
