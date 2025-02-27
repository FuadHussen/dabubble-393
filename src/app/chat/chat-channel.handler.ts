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
  ) {
    // Subscribe to user data changes to update cached member data
    this.userService.userData$.subscribe(userData => {
      if (userData && userData.uid) {
        // This will trigger an update in any components using this handler
        this.updateCachedMemberData(userData);
      }
    });
  }

  // Add this new field and method
  private cachedMembers: { [channelId: string]: any[] } = {};

  private updateCachedMemberData(userData: any) {
    // Update members in cache for each channel
    Object.keys(this.cachedMembers).forEach(channelId => {
      const members = this.cachedMembers[channelId];
      const index = members.findIndex(m => m.uid === userData.uid);
      
      if (index !== -1) {
        members[index] = {
          ...members[index],
          username: userData.username,
          avatar: userData.avatar
        };
        
        // Update cache
        this.cachedMembers[channelId] = [...members];
      }
    });
  }

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
      
      // Update cache
      this.cachedMembers[currentChannelId] = members;
      
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