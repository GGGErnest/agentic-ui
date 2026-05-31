import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
