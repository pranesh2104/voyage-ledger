import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyJourney } from './my-journey';

describe('MyJourney', () => {
  let component: MyJourney;
  let fixture: ComponentFixture<MyJourney>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyJourney]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyJourney);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
