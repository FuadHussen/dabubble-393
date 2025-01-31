import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private selectedChannelSource = new BehaviorSubject<string>('');
  private isDirectMessageSource = new BehaviorSubject<boolean>(false);
  private selectedUserSource = new BehaviorSubject<string>('');

  selectedChannel$ = this.selectedChannelSource.asObservable();
  isDirectMessage$ = this.isDirectMessageSource.asObservable();
  selectedUser$ = this.selectedUserSource.asObservable();

  selectChannel(channelName: string) {
    this.selectedChannelSource.next(channelName);
    this.isDirectMessageSource.next(false);
    this.selectedUserSource.next('');
  }

  selectUser(userName: string) {
    this.selectedUserSource.next(userName);
    this.isDirectMessageSource.next(true);
    this.selectedChannelSource.next('');
  }
} 