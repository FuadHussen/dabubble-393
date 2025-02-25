import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, getDoc, addDoc } from '@angular/fire/firestore';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class ChatChannelHandler {
  constructor(
    private firestore: Firestore,
    private userService: UserService
  ) {}

  async loadChannelDetails(channelName: string): Promise<any> {
    try {
      const channelsRef = collection(this.firestore, 'channels');
      const q = query(channelsRef, where('name', '==', channelName));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const channelDoc = querySnapshot.docs[0];
        const channelData = channelDoc.data();
        
        return {
          currentChannelId: channelDoc.id,
          channelName: channelData['name'],
          channelDescription: channelData['description'] || '',
          createdBy: channelData['createdBy'] || '',
          createdAt: channelData['createdAt'] ? channelData['createdAt'].toDate() : null
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading channel details:', error);
      return null;
    }
  }

  async loadChannelMembers(currentChannelId: string): Promise<any[]> {
    try {
      if (!currentChannelId) return [];

      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const q = query(channelMembersRef, where('channelId', '==', currentChannelId));
      const memberSnapshot = await getDocs(q);
      
      const memberIds = memberSnapshot.docs.map(doc => doc.data()['userId']);

      const members = [];
      for (const memberId of memberIds) {
        const userData = await this.userService.getUserById(memberId);
        if (userData) {
          members.push({
            ...userData,
            uid: memberId
          });
        }
      }
      
      return members;
    } catch (error) {
      console.error('Error loading channel members:', error);
      return [];
    }
  }

  async addExistingMessageAuthorsAsMembers(currentChannelId: string, selectedChannel: string): Promise<void> {
    if (!currentChannelId) return;

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(messagesRef, where('channelId', '==', selectedChannel));
      const messageSnapshot = await getDocs(q);

      const channelMembersRef = collection(this.firestore, 'channelMembers');

      for (const messageDoc of messageSnapshot.docs) {
        const messageData = messageDoc.data();
        const userId = messageData['userId'];

        if (userId) {
          const memberQuery = query(channelMembersRef,
            where('channelId', '==', currentChannelId),
            where('userId', '==', userId)
          );
          const memberSnapshot = await getDocs(memberQuery);

          if (memberSnapshot.empty) {
            await addDoc(channelMembersRef, {
              channelId: currentChannelId,
              userId: userId,
              joinedAt: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error adding message authors as members:', error);
    }
  }
}