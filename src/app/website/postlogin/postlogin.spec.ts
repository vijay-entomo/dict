import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Postlogin } from './postlogin';

describe('Postlogin', () => {
  let component: Postlogin;
  let fixture: ComponentFixture<Postlogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Postlogin],
    }).compileComponents();

    fixture = TestBed.createComponent(Postlogin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
