import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelSettingsComponent } from './channel-settings.component';

describe('ChannelSettingsComponent', () => {
  let component: ChannelSettingsComponent;
  let fixture: ComponentFixture<ChannelSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
