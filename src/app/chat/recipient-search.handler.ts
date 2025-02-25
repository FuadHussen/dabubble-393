import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Injectable()
export class RecipientSearchHandler {
  filteredResults: any[] = [];
  showResults = false;

  constructor(private firestore: Firestore) {}

  async handleRecipientInput(input: string, currentUserId: string): Promise<void> {
    const trimmedInput = input.trim();
    this.showResults = trimmedInput.length > 0;

    if (!trimmedInput || trimmedInput.length < 2) {
      this.filteredResults = [];
      return;
    }

    try {
      if (trimmedInput.startsWith('#')) {
        // Suche nach Channels
        const channelsRef = collection(this.firestore, 'channels');
        const querySnapshot = await getDocs(channelsRef);
        this.filteredResults = querySnapshot.docs
          .filter(doc => {
            const channelName = doc.data()['name'].toLowerCase();
            const searchTerm = trimmedInput.substring(1).toLowerCase();
            return channelName.includes(searchTerm);
          })
          .map(doc => ({
            type: 'channel',
            id: doc.id,
            name: doc.data()['name'],
            icon: 'tag'
          }));
      } else if (trimmedInput.startsWith('@')) {
        // Suche nach Benutzern - NUR wenn es mit @ beginnt
        const usersRef = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        const searchTerm = trimmedInput.substring(1).toLowerCase();
        
        this.filteredResults = querySnapshot.docs
          .filter(doc => {
            const username = (doc.data()['username'] || '').toLowerCase();
            return username.includes(searchTerm);
          })
          .map(doc => ({
            type: 'user',
            id: doc.id,
            name: doc.data()['username'],
            email: doc.data()['email'],
            avatar: doc.data()['avatar'],
            icon: 'person'
          }))
          .filter(user => user.id !== currentUserId);
      } else {
        // Wenn kein Präfix (@, #) vorhanden ist, keine Ergebnisse zurückgeben
        this.filteredResults = [];
      }
    } catch (error) {
      console.error('Error searching for recipients:', error);
      this.filteredResults = [];
    }
  }
} 