import { Injectable } from '@angular/core';
import { collection, Firestore, getDocs, query, where } from '@angular/fire/firestore';
import { ChatService } from '../services/chat.service';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class ChatMessageHandler {
  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService
  ) {}

  async sendMessage(messageText: string, selectedMentions: string[], isDirectMessage: boolean, selectedChannel: string | null): Promise<boolean> {
    if (!messageText.trim()) return false;

    try {
      const currentUser = await this.chatService.getCurrentUser();
      const userDoc = await this.userService.getUserById(currentUser.uid);

      const messageData = {
        text: messageText.trim(),
        userId: currentUser.uid,
        username: userDoc?.username || 'Unbekannt',
        channelId: isDirectMessage ? null : selectedChannel,
        recipientId: isDirectMessage ? this.chatService.selectedUser : null,
        mentions: selectedMentions
      };

      return await this.chatService.sendMessage(messageData);
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return false;
    }
  }

  async searchUsers(searchTerm: string, currentUserId: string, messageText: string): Promise<any[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      let q = searchTerm ? 
        query(
          usersRef,
          where('username', '>=', searchTerm),
          where('username', '<=', searchTerm + '\uf8ff')
        ) : 
        query(usersRef);

      const querySnapshot = await getDocs(q);
      
      const currentMentions = messageText.match(/@(\w+\s\w+)/g) || [];
      const mentionedUsernames = currentMentions.map(mention => 
        mention.substring(1).trim()
      );

      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          username: doc.data()['username'],
          avatar: doc.data()['avatar']
        }))
        .filter(user => {
          const isCurrentUser = user.id === currentUserId;
          const isAlreadyMentioned = mentionedUsernames.some(mention => 
            mention === user.username
          );
          return !isCurrentUser && !isAlreadyMentioned;
        });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  getPlaceholderText(isDirectMessage: boolean, selectedUserDisplayName: string, selectedChannel: string | null): string {
    if (isDirectMessage) {
      return selectedUserDisplayName ?
        `Nachricht an @${selectedUserDisplayName}` :
        'Nachricht schreiben...';
    }
    return selectedChannel ?
      `Nachricht an #${selectedChannel}` :
      'Nachricht schreiben...';
  }

  getWelcomeText(isDirectMessage: boolean, selectedUserDisplayName: string, selectedChannel: string | null): string {
    if (isDirectMessage) {
      return selectedUserDisplayName ?
        `Dies ist der Beginn deiner Direktnachricht mit @${selectedUserDisplayName}` :
        'Wähle einen Benutzer aus, um eine Direktnachricht zu beginnen';
    }
    return selectedChannel ?
      `Willkommen im Channel #${selectedChannel}` :
      'Wähle einen Channel aus, um die Unterhaltung zu beginnen';
  }
} 