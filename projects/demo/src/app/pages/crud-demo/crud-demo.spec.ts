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
});
