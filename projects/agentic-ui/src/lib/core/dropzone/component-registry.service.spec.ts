import { ComponentRegistry } from './component-registry.service';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

@Component({
  selector: 'test-component',
  template: '<div>Test</div>',
  standalone: true,
})
class TestComponent {}

@Component({
  selector: 'another-test',
  template: '<div>Another</div>',
  standalone: true,
})
class AnotherTestComponent {}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  describe('register', () => {
    it('registers a component by id', () => {
      registry.register('test', TestComponent);
      expect(registry.get('test')).toBe(TestComponent);
    });

    it('stores metadata with component', () => {
      registry.register('test', TestComponent, { label: 'Test Label' });
      expect(registry.get('test')).toBe(TestComponent);
      expect(registry.getMetadata('test')).toEqual({ label: 'Test Label' });
    });

    it('allows overwriting existing registration', () => {
      registry.register('test', TestComponent);
      registry.register('test', AnotherTestComponent);
      expect(registry.get('test')).toBe(AnotherTestComponent);
    });

    it('throws on null or undefined component', () => {
      expect(() => {
        registry.register('test', null as unknown as never);
      }).toThrow();
      expect(() => {
        registry.register('test', undefined as unknown as never);
      }).toThrow();
    });

    it('throws on empty id', () => {
      expect(() => {
        registry.register('', TestComponent);
      }).toThrow();
    });

    it('throws on null id', () => {
      expect(() => {
        registry.register(null as unknown as string, TestComponent);
      }).toThrow();
    });
  });

  describe('get', () => {
    it('returns null for unregistered id', () => {
      expect(registry.get('nonexistent')).toBeNull();
    });

    it('returns registered component', () => {
      registry.register('test', TestComponent);
      expect(registry.get('test')).toBe(TestComponent);
    });
  });

  describe('getMetadata', () => {
    it('returns null for unregistered id', () => {
      expect(registry.getMetadata('nonexistent')).toBeNull();
    });

    it('returns metadata for registered component', () => {
      const metadata = { label: 'My Component' };
      registry.register('test', TestComponent, metadata);
      expect(registry.getMetadata('test')).toEqual(metadata);
    });

    it('returns empty object if no metadata provided', () => {
      registry.register('test', TestComponent);
      expect(registry.getMetadata('test')).toEqual({});
    });
  });

  describe('list', () => {
    it('returns empty array when no components registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('returns all registered component ids', () => {
      registry.register('test1', TestComponent);
      registry.register('test2', AnotherTestComponent);
      const ids = registry.list();
      expect(ids).toContain('test1');
      expect(ids).toContain('test2');
      expect(ids.length).toBe(2);
    });
  });

  describe('unregister', () => {
    it('removes registered component', () => {
      registry.register('test', TestComponent);
      registry.unregister('test');
      expect(registry.get('test')).toBeNull();
    });

    it('does not throw if unregistering nonexistent id', () => {
      expect(() => {
        registry.unregister('nonexistent');
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    it('removes all registrations', () => {
      registry.register('test1', TestComponent);
      registry.register('test2', AnotherTestComponent);
      registry.clear();
      expect(registry.list()).toEqual([]);
      expect(registry.get('test1')).toBeNull();
    });
  });

  describe('registerScoped (#M1)', () => {
    @Component({ selector: 'scoped-host', template: '', standalone: true })
    class ScopedHost {
      constructor() {
        const reg = inject(ComponentRegistry);
        reg.registerScoped('scoped-id', TestComponent);
      }
    }

    it('auto-unregisters when the consuming component is destroyed', () => {
      TestBed.configureTestingModule({ imports: [ScopedHost] });
      const sharedRegistry = TestBed.inject(ComponentRegistry);

      const fixture = TestBed.createComponent(ScopedHost);
      fixture.detectChanges();
      expect(sharedRegistry.get('scoped-id')).toBe(TestComponent);

      fixture.destroy();
      expect(sharedRegistry.get('scoped-id')).toBeNull();
    });
  });
});
