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
    expect(fixture.nativeElement.querySelector('.stub')?.textContent).toContain(
      'bar-executing',
    );
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
});
