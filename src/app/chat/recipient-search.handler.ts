import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { UserService } from '../services/user.service';

@Injectable()
export class RecipientSearchHandler {
  filteredResults: any[] = [];
  showResults = false;

  constructor(
    private firestore: Firestore,
    private userService: UserService
  ) {
    // Subscribe to user data changes to update search results
    this.userService.userData$.subscribe(userData => {
      if (userData && userData.uid && this.filteredResults.length > 0) {
        // Update matching search results
        this.updateUserInResults(userData);
      }
    });
  }

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

  // Add this new method
  private updateUserInResults(userData: any) {
    const index = this.filteredResults.findIndex(result => 
      result.type === 'user' && result.id === userData.uid
    );
    
    if (index !== -1) {
      this.filteredResults[index] = {
        ...this.filteredResults[index],
        name: userData.username,
        avatar: userData.avatar
      };
    }
  }
} 