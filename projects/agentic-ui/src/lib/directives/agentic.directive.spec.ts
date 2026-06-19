import { Component, Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgenticDirective } from './agentic.directive';
import { AgentWorldService } from '../core/world/agent-world.service';
import { AGENTIC_COMPONENT, AgenticComponent } from '../core/world/agentic-component.token';
import { AgentAction } from '../core/world/agent-action.model';

function makeAction(name: string): AgentAction {
  return { name, description: 'test', execute: async () => ({ success: true, message: 'ok' }) };
}

@Component({
  selector: 'test-host',
  standalone: true,
  imports: [AgenticDirective],
  template: `<div agentic></div>`,
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: TestHostComponent }],
})
class TestHostComponent implements AgenticComponent {
  agenticId = 'host-id';
  agenticRole = 'TestHost';
  agenticActions: AgentAction[] = [makeAction('doSomething')];
}

@Component({
  selector: 'test-signal-host',
  standalone: true,
  imports: [AgenticDirective],
  template: `<div agentic></div>`,
  providers: [{ provide: AGENTIC_COMPONENT, useExisting: TestSignalHostComponent }],
})
class TestSignalHostComponent implements AgenticComponent {
  agenticId: Signal<string> = signal('signal-host-id');
  agenticRole = 'SignalHost';
  agenticActions: AgentAction[] = [makeAction('run')];
}

@Component({
  selector: 'test-native',
  standalone: true,
  imports: [AgenticDirective],
  template: `<button agentic agenticId="btn-id" [actions]="acts">Click</button>`,
})
class TestNativeComponent {
  acts: AgentAction[] = [makeAction('click')];
}

@Component({
  selector: 'test-no-id',
  standalone: true,
  imports: [AgenticDirective],
  template: `<button agentic [actions]="acts">Click</button>`,
})
class TestNoIdComponent {
  acts: AgentAction[] = [makeAction('click')];
}

@Component({
  selector: 'test-agentic-element',
  standalone: true,
  imports: [AgenticDirective],
  template: `
    <div agentic agenticId="override-element" [agenticElement]="innerRef">
      <div #innerRef class="inner-target">inner</div>
    </div>
  `,
})
class TestAgenticElementComponent {}

describe('AgenticDirective', () => {
  let world: AgentWorldService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AgentWorldService] });
    world = TestBed.inject(AgentWorldService);
  });

  it('registers host component via AGENTIC_COMPONENT token', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const entry = world.entries().get('host-id');
    expect(entry).toBeDefined();
    expect(entry!.role).toBe('TestHost');
    expect(entry!.actions[0].name).toBe('doSomething');
  });

  it('registers host component when token agenticId is a signal', () => {
    const fixture = TestBed.createComponent(TestSignalHostComponent);
    fixture.detectChanges();

    const entry = world.entries().get('signal-host-id');
    expect(entry).toBeDefined();
    expect(entry!.role).toBe('SignalHost');
  });

  it('unregisters host component on destroy', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    fixture.destroy();
    expect(world.entries().has('host-id')).toBe(false);
  });

  it('registers native element via template inputs', () => {
    const fixture = TestBed.createComponent(TestNativeComponent);
    fixture.detectChanges();
    const entry = world.entries().get('btn-id');
    expect(entry).toBeDefined();
    expect(entry!.actions[0].name).toBe('click');
  });

  it('removes the data-agentic-id attribute on destroy (#M)', () => {
    const fixture = TestBed.createComponent(TestNativeComponent);
    fixture.detectChanges();
    const tagged = fixture.nativeElement.querySelector('[data-agentic-id]');
    expect(tagged).not.toBeNull();
    fixture.destroy();
    expect(fixture.nativeElement.querySelector('[data-agentic-id]')).toBeNull();
  });

  it('auto-generates UUID when agenticId input and token are absent', () => {
    const fixture = TestBed.createComponent(TestNoIdComponent);
    fixture.detectChanges();
    const entries = [...world.entries().keys()];
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('agenticId input overrides token agenticId', () => {
    @Component({
      selector: 'test-override',
      standalone: true,
      imports: [AgenticDirective],
      template: `<div agentic agenticId="override-id"></div>`,
      providers: [{ provide: AGENTIC_COMPONENT, useExisting: TestOverrideComponent }],
    })
    class TestOverrideComponent implements AgenticComponent {
      agenticId = 'token-id';
      agenticActions: AgentAction[] = [];
    }
    const fixture = TestBed.createComponent(TestOverrideComponent);
    fixture.detectChanges();
    expect(world.entries().has('override-id')).toBe(true);
    expect(world.entries().has('token-id')).toBe(false);
  });

  it('uses agenticElement when provided', () => {
    const fixture = TestBed.createComponent(TestAgenticElementComponent);
    fixture.detectChanges();
    const entry = world.entries().get('override-element');
    expect(entry).toBeDefined();
    const innerEl = (fixture.nativeElement as HTMLElement).querySelector('.inner-target');
    expect(entry!.element).toBe(innerEl);
  });
});
