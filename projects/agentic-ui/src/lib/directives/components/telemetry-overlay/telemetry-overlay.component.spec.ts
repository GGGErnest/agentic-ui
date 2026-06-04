import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TelemetryOverlayComponent } from './telemetry-overlay.component';
import { AgentWorldService } from '../../../core/world/agent-world.service';

describe('TelemetryOverlayComponent', () => {
  let fixture: ComponentFixture<TelemetryOverlayComponent>;
  let component: TelemetryOverlayComponent;
  let world: AgentWorldService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetryOverlayComponent],
      providers: [AgentWorldService],
    }).compileComponents();

    fixture = TestBed.createComponent(TelemetryOverlayComponent);
    component = fixture.componentInstance;
    world = TestBed.inject(AgentWorldService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not render the frame when no entry is focused', () => {
    expect(fixture.nativeElement.querySelector('.telemetry-frame')).toBeNull();
  });

  it('exposes focusedId from the world service', () => {
    expect(component.focusedId()).toBeNull();
    expect(world).toBeDefined();
  });
});
