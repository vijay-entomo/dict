import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InteractiveGrid } from './interactive-grid';

describe('InteractiveGrid', () => {
  let component: InteractiveGrid;
  let fixture: ComponentFixture<InteractiveGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(InteractiveGrid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
