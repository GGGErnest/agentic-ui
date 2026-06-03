import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DropzoneDirective } from './dropzone.directive';
import { ComponentRegistry } from './component-registry.service';

@Component({
  selector: 'test-host',
  template: '<div aguiDropzone></div>',
  standalone: true,
  imports: [DropzoneDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

@Component({
  selector: 'test-renderable',
  template: '<div>{{ content() }}</div>',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestRenderableComponent {
  content = input('Default');
}

describe('DropzoneDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let registry: ComponentRegistry;
  let directive: DropzoneDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent, TestRenderableComponent],
    });

    registry = TestBed.inject(ComponentRegistry);
    registry.register('testRenderable', TestRenderableComponent);

    fixture = TestBed.createComponent(TestHostComponent);
    const directiveElem = fixture.debugElement.children[0];
    directive = directiveElem.injector.get(DropzoneDirective);
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('render', () => {
    it('renders a registered component by id', () => {
      const ref = directive.render('testRenderable');
      expect(ref).toBeDefined();
      fixture.detectChanges();
      const compiled = fixture.nativeElement.querySelector('test-renderable');
      expect(compiled).toBeTruthy();
    });

    it('returns null for unregistered component id', () => {
      const ref = directive.render('nonexistent');
      expect(ref).toBeNull();
    });

    it('sets input on rendered component', () => {
      const ref = directive.render('testRenderable', { content: 'Custom' });
      expect((ref?.instance as TestRenderableComponent | undefined)?.content()).toBe('Custom');
    });

    it('appends component in append mode (default)', () => {
      directive.render('testRenderable');
      fixture.detectChanges();
      directive.render('testRenderable');
      fixture.detectChanges();
      const components = fixture.nativeElement.querySelectorAll('test-renderable');
      expect(components.length).toBe(2);
    });

    it('replaces component in replace mode', () => {
      directive.render('testRenderable');
      fixture.detectChanges();
      directive.render('testRenderable', {}, 'replace');
      fixture.detectChanges();
      const components = fixture.nativeElement.querySelectorAll('test-renderable');
      expect(components.length).toBe(1);
    });

    it('clears all when mode is clear', () => {
      directive.render('testRenderable');
      fixture.detectChanges();
      directive.render('testRenderable');
      fixture.detectChanges();
      directive.render('testRenderable', {}, 'clear');
      fixture.detectChanges();
      const components = fixture.nativeElement.querySelectorAll('test-renderable');
      expect(components.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('removes all rendered components on destroy', () => {
      directive.render('testRenderable');
      directive.render('testRenderable');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('test-renderable').length).toBe(2);
      fixture.destroy();
      expect(fixture.nativeElement.querySelectorAll('test-renderable').length).toBe(0);
    });

    it('detaches all component refs on destroy', () => {
      const ref1 = directive.render('testRenderable');
      const ref2 = directive.render('testRenderable');
      fixture.detectChanges();
      expect(ref1?.hostView.destroyed).toBeFalsy();
      expect(ref2?.hostView.destroyed).toBeFalsy();
      fixture.destroy();
      expect(ref1?.hostView.destroyed).toBeTruthy();
      expect(ref2?.hostView.destroyed).toBeTruthy();
    });
  });
});
