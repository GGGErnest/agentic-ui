import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LLM_PROVIDER, AgentAction } from 'agentic-ui';
import { UserProfile } from './user-profile';
import { ProfileIdentity } from './profile-identity/profile-identity';
import { ProfilePreferences } from './profile-preferences/profile-preferences';
import { ProfileActivity } from './profile-activity/profile-activity';

const mockLlmProvider = {
  chat: async () => ({ content: '', role: 'assistant' as const }),
};

describe('UserProfile', () => {
  let component: UserProfile;
  let fixture: ComponentFixture<UserProfile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfile, ProfileIdentity, ProfilePreferences, ProfileActivity],
      providers: [provideRouter([]), { provide: LLM_PROVIDER, useValue: mockLlmProvider }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and default to identity tab', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('identity');
  });

  it('should render identity tab content by default', () => {
    const identity = fixture.nativeElement.querySelector('app-profile-identity');
    expect(identity).toBeTruthy();
  });

  it('switchTab action should change active tab', async () => {
    const action = component.agenticActions.find((a: AgentAction) => a.name === 'switchTab');
    expect(action).toBeTruthy();

    const result = await action?.execute?.({ tab: 'preferences' });
    expect(result?.success).toBe(true);
    expect(component.activeTab()).toBe('preferences');
  });

  it('switchTab should return error for invalid tab', async () => {
    const action = component.agenticActions.find((a: AgentAction) => a.name === 'switchTab');
    const result = await action?.execute?.({ tab: 'invalid' });
    expect(result?.success).toBe(false);
  });

  it('should render preferences tab after switchTab to preferences', async () => {
    component.activeTab.set('preferences');
    fixture.detectChanges();

    const preferences = fixture.nativeElement.querySelector('app-profile-preferences');
    const identity = fixture.nativeElement.querySelector('app-profile-identity');
    expect(preferences).toBeTruthy();
    expect(identity).toBeFalsy();
  });

  it('should render activity tab after switchTab to activity', async () => {
    component.activeTab.set('activity');
    fixture.detectChanges();

    const activity = fixture.nativeElement.querySelector('app-profile-activity');
    const identity = fixture.nativeElement.querySelector('app-profile-identity');
    expect(activity).toBeTruthy();
    expect(identity).toBeFalsy();
  });

  it('getCurrentTab action should return current tab name', async () => {
    component.activeTab.set('preferences');

    const action = component.agenticActions.find((a: AgentAction) => a.name === 'getCurrentTab');
    expect(action).toBeTruthy();

    const result = await action?.execute?.();
    expect(result?.data).toBe('preferences');
  });
});
