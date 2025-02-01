import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { collection, query, where, collectionData } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';

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

  constructor(private firestore: Firestore) {}

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

  getCurrentChannelId(): Observable<string> {
    return this.selectedChannel$.pipe(
      switchMap(channelName => {
        const channelsRef = collection(this.firestore, 'channels');
        const q = query(channelsRef, where('name', '==', channelName));
        return collectionData(q, { idField: 'id' }).pipe(
          map(channels => channels[0]?.id || '')
        );
      })
    );
  }

  selectNextAvailableChannel() {
    const channelsRef = collection(this.firestore, 'channels');
    collectionData(channelsRef, { idField: 'id' }).pipe(
      take(1)
    ).subscribe(channels => {
      if (channels.length > 0) {
        // Wähle den ersten verfügbaren Channel
        const nextChannel = channels[0] as any;  // Type assertion hinzufügen
        this.selectedChannelSource.next(nextChannel['name']);  // Bracket notation verwenden
      } else {
        // Falls keine Channels mehr existieren
        this.selectedChannelSource.next('');  // Leeren String statt null
      }
    });
  }
} 