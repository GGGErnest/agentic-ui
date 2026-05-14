import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrudDemo } from './crud-demo';

describe('CrudDemo', () => {
  let component: CrudDemo;
  let fixture: ComponentFixture<CrudDemo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrudDemo],
    }).compileComponents();

    fixture = TestBed.createComponent(CrudDemo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a task directly from the add action parameters', async () => {
    const before = component.tasks().length;

    const result = await component.addAction[0].execute({
      title: 'Ship release notes',
      priority: 'high',
      assignee: 'Erin',
    });

    expect(result.success).toBe(true);
    expect(component.tasks()).toHaveLength(before + 1);
    expect(component.tasks().at(-1)).toMatchObject({
      title: 'Ship release notes',
      priority: 'high',
      status: 'todo',
      assignee: 'Erin',
    });
  });
});
