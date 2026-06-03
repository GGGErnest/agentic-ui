import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DropzoneDirective } from './dropzone.directive';
import { ComponentRegistry } from './component-registry.service';

@Component({
  selector: 'integration-test-host',
  template: `
    <div aguiDropzone #zone></div>
  `,
  standalone: true,
  imports: [DropzoneDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class IntegrationTestHostComponent {}

@Component({
  selector: 'integration-component-a',
  template: '<div class="component-a">{{ message() }}</div>',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class IntegrationComponentA {
  message = input('Hello from A');
}

@Component({
  selector: 'integration-component-b',
  template: '<div class="component-b">{{ value() }}</div>',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class IntegrationComponentB {
  value = input(0);
}

describe('Dropzone Integration', () => {
  let fixture: ComponentFixture<IntegrationTestHostComponent>;
  let registry: ComponentRegistry;
  let directive: DropzoneDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        IntegrationTestHostComponent,
        IntegrationComponentA,
        IntegrationComponentB,
      ],
      providers: [ComponentRegistry],
    });

    registry = TestBed.inject(ComponentRegistry);
    registry.register('componentA', IntegrationComponentA);
    registry.register('componentB', IntegrationComponentB);

    fixture = TestBed.createComponent(IntegrationTestHostComponent);
    const directiveElem = fixture.debugElement.children[0];
    directive = directiveElem.injector.get(DropzoneDirective);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders multiple components in sequence (append mode)', () => {
    directive.render('componentA', { message: 'First' });
    directive.render('componentB', { value: 1 });
    directive.render('componentA', { message: 'Second' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(1);
  });

  it('replaces all previous renders when mode=replace', () => {
    directive.render('componentA', { message: 'First' });
    directive.render('componentB', { value: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(1);

    directive.render('componentA', { message: 'Replaced' }, 'replace');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(0);
  });

  it('clears all renders when mode=clear', () => {
    directive.render('componentA');
    directive.render('componentB');
    directive.render('componentA');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(1);

    directive.render('componentA', {}, 'clear');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(0);
  });

  it('returns null for unregistered component id', () => {
    const ref = directive.render('unregistered');
    expect(ref).toBeNull();
  });

  it('cleans up all component refs on destroy', () => {
    const ref1 = directive.render('componentA');
    const ref2 = directive.render('componentB');
    directive.render('componentA');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(1);
    fixture.destroy();
    expect(ref1?.hostView.destroyed).toBeTruthy();
    expect(ref2?.hostView.destroyed).toBeTruthy();
  });

  it('works with empty registry', () => {
    const emptyRegistry = new ComponentRegistry();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [IntegrationTestHostComponent],
      providers: [{ provide: ComponentRegistry, useValue: emptyRegistry }],
    });

    fixture = TestBed.createComponent(IntegrationTestHostComponent);
    const directiveElem = fixture.debugElement.children[0];
    directive = directiveElem.injector.get(DropzoneDirective);

    const ref = directive.render('nonexistent');
    expect(ref).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('integration-component-a').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('integration-component-b').length).toBe(0);
  });
});
