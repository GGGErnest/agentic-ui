import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, input, signal, Type } from '@angular/core';
import { AgentToolRendererComponent } from './agent-tool-renderer.component';
import { ToolRenderContext } from '../world/agent-action.model';

@Component({
  selector: 'agui-stub',
  template: '<div class="stub">stub: {{ value() }}</div>',
})
class StubComponent {
  readonly value = input('');
}

@Component({
  selector: 'agui-stub-two',
  template: '<div class="stub-two">two: {{ label() }}</div>',
})
class StubTwoComponent {
  readonly label = input('');
}

describe('AgentToolRendererComponent', () => {
  let fixture: ComponentFixture<AgentToolRendererComponent>;
  let component: AgentToolRendererComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AgentToolRendererComponent] });
    fixture = TestBed.createComponent(AgentToolRendererComponent);
    component = fixture.componentInstance;
  });

  it('mounts the provided component with computed inputs', () => {
    const ctx = signal<ToolRenderContext>({
      entryId: 'e1',
      actionName: 'a',
      args: { foo: 'bar' },
      status: 'executing',
    });
    fixture.componentRef.setInput('componentType', StubComponent as Type<unknown>);
    fixture.componentRef.setInput('context', ctx);
    fixture.componentRef.setInput('renderInputs', (c: ToolRenderContext) => ({
      value: `${c.args['foo']}-${c.status}`,
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')?.textContent).toContain('bar-executing');
  });

  it('updates inputs when context changes', () => {
    const ctx = signal<ToolRenderContext>({
      entryId: 'e1',
      actionName: 'a',
      args: {},
      status: 'executing',
    });
    fixture.componentRef.setInput('componentType', StubComponent as Type<unknown>);
    fixture.componentRef.setInput('context', ctx);
    fixture.componentRef.setInput('renderInputs', (c: ToolRenderContext) => ({
      value: c.status,
    }));
    fixture.detectChanges();
    ctx.set({ ...ctx(), status: 'complete', result: 'ok' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')?.textContent).toContain('complete');
  });

  it('swaps the mounted component when componentType changes (#H1)', () => {
    const ctx = signal<ToolRenderContext>({
      entryId: 'e1',
      actionName: 'a',
      args: {},
      status: 'executing',
    });
    fixture.componentRef.setInput('componentType', StubComponent as Type<unknown>);
    fixture.componentRef.setInput('context', ctx);
    fixture.componentRef.setInput('renderInputs', () => ({ value: 'one' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')).toBeTruthy();

    // Change to a different component type (and the inputs it accepts).
    fixture.componentRef.setInput('renderInputs', () => ({ label: 'one' }));
    fixture.componentRef.setInput('componentType', StubTwoComponent as Type<unknown>);
    fixture.detectChanges();

    // Old component removed, new one mounted.
    expect(fixture.nativeElement.querySelector('.stub')).toBeNull();
    expect(fixture.nativeElement.querySelector('.stub-two')?.textContent).toContain('two: one');
  });

  it('tears down the mounted component when componentType becomes null (#H1)', () => {
    const ctx = signal<ToolRenderContext>({
      entryId: 'e1',
      actionName: 'a',
      args: {},
      status: 'executing',
    });
    fixture.componentRef.setInput('componentType', StubComponent as Type<unknown>);
    fixture.componentRef.setInput('context', ctx);
    fixture.componentRef.setInput('renderInputs', () => ({ value: 'x' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')).toBeTruthy();

    fixture.componentRef.setInput('componentType', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')).toBeNull();
  });
});
