import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal, Type } from '@angular/core';
import { AgentToolRendererComponent } from './agent-tool-renderer.component';
import { ToolRenderContext } from '../world/agent-action.model';

@Component({
  selector: 'agui-stub',
  standalone: true,
  template: '<div class="stub">stub: {{ value }}</div>',
})
class StubComponent {
  value = '';
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
    component.componentType = StubComponent as Type<unknown>;
    component.context = signal<ToolRenderContext>({
      entryId: 'e1',
      actionName: 'a',
      args: { foo: 'bar' },
      status: 'executing',
    });
    component.renderInputs = (ctx) => ({ value: `${ctx.args['foo']}-${ctx.status}` });
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
    component.componentType = StubComponent as Type<unknown>;
    component.context = ctx;
    component.renderInputs = (c) => ({ value: c.status });
    fixture.detectChanges();
    ctx.set({ ...ctx(), status: 'complete', result: 'ok' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stub')?.textContent).toContain('complete');
  });
});
