import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNewChannelComponent } from './add-new-channel.component';

describe('AddNewChannelComponent', () => {
  let component: AddNewChannelComponent;
  let fixture: ComponentFixture<AddNewChannelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNewChannelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddNewChannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
