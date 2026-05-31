import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppNav } from './app-nav';

describe('AppNav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppNav],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AppNav);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render Tasks link to /tasks', () => {
    const fixture = TestBed.createComponent(AppNav);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const tasksLink = compiled.querySelector('a[routerLink="/tasks"]');
    expect(tasksLink).toBeTruthy();
    expect(tasksLink?.textContent).toContain('Tasks');
  });

  it('should render Profile link to /profile', () => {
    const fixture = TestBed.createComponent(AppNav);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const profileLink = compiled.querySelector('a[routerLink="/profile"]');
    expect(profileLink).toBeTruthy();
    expect(profileLink?.textContent).toContain('Profile');
  });

  it('exposes a navigateTo agentic action', () => {
    const fixture = TestBed.createComponent(AppNav);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.agenticActions.find((a) => a.name === 'navigateTo')).toBeTruthy();
  });

  it('navigateTo tasks calls router.navigate', async () => {
    const fixture = TestBed.createComponent(AppNav);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const action = component.agenticActions.find((a) => a.name === 'navigateTo')!;
    await action.execute({ route: 'tasks' });
    expect(spy).toHaveBeenCalledWith(['/tasks']);
  });

  it('navigateTo profile calls router.navigate', async () => {
    const fixture = TestBed.createComponent(AppNav);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const action = component.agenticActions.find((a) => a.name === 'navigateTo')!;
    await action.execute({ route: 'profile' });
    expect(spy).toHaveBeenCalledWith(['/profile']);
  });

  it('navigateTo unknown route returns success: false', async () => {
    const fixture = TestBed.createComponent(AppNav);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const action = component.agenticActions.find((a) => a.name === 'navigateTo')!;
    const result = await action.execute({ route: 'admin' });
    expect(result.success).toBe(false);
  });
});
