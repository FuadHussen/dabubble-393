import { Injectable, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { ChatService } from '../services/chat.service';
import { UserService } from '../services/user.service';
import { ChatChannelHandler } from './chat-channel.handler';

@Injectable({
  providedIn: 'root'
})
export class ChatSubscriptionHandler {
  private subscriptions: Subscription[] = [];

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService,
    private ngZone: NgZone,
    private channelHandler: ChatChannelHandler
  ) {}

  initUserSubscriptions(component: any) {
    // User Subscription
    this.subscriptions.push(
      this.userService.currentUser$.subscribe(user => {
        if (user) component.currentUserId = user.uid;
      })
    );

    // Channel Subscription
    this.subscriptions.push(
      this.chatService.selectedChannel$.subscribe(async channelName => {
        if (channelName) {
          const channelDetails = await this.channelHandler.loadChannelDetails(channelName);
          if (channelDetails) {
            component.currentChannelId = channelDetails.currentChannelId;
            component.channelName = channelDetails.channelName;
            component.channelDescription = channelDetails.channelDescription;
            component.createdBy = channelDetails.createdBy || '';
            component.channelMembers = await this.channelHandler.loadChannelMembers(component.currentChannelId);
          }
        }
      })
    );

    // Direct Message Subscription
    this.subscriptions.push(
      this.chatService.selectedUser$.subscribe(this.handleSelectedUserChange.bind(this, component))
    );

    // UI State Subscriptions
    this.subscriptions.push(
      this.chatService.hasMessages$.subscribe(hasMessages => component.hasMessages = hasMessages),
      this.chatService.isDirectMessage$.subscribe(isDM => component.isDirectMessage = isDM)
    );
  }

  initRouteSubscriptions(component: any, route: ActivatedRoute) {
    this.subscriptions.push(
      route.params.subscribe(params => this.handleRouteParams(component, params)),
      this.chatService.selectedChannel$.subscribe(channel => this.handleSelectedChannel(component, channel)),
      this.chatService.isNewChatMode$.subscribe(isNewChat => this.handleNewChatMode(component, isNewChat))
    );

    return this.subscriptions;
  }

  private async handleSelectedUserChange(component: any, userId: string | null) {
    if (!userId) return;
    
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('uid', '==', userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      component.selectedUserDisplayName = userData['username'] || 'Unbekannt';
      component.selectedUserEmail = userData['email'] || '';
      component.selectedUserAvatar = userData['avatar'];
      component.isCurrentUser = userId === component.currentUserId;
    }
  }

  private handleRouteParams(component: any, params: any) {
    this.ngZone.run(() => {
      if (params['userId'] || params['channelId']) {
        component.showChat = true;
        setTimeout(() => {
          if (params['userId']) {
            this.chatService.setIsDirectMessage(true);
            this.chatService.selectUser(params['userId']);
          } else if (params['channelId']) {
            this.chatService.setIsDirectMessage(false);
            this.chatService.selectChannel(params['channelId']);
          }
        });
      }
    });
  }

  private async handleSelectedChannel(component: any, channel: string | null) {
    if (channel) {
      component.showChat = true;
      component.selectedChannel = channel;
      const channelDetails = await this.channelHandler.loadChannelDetails(channel);
      if (channelDetails) {
        component.currentChannelId = channelDetails.currentChannelId;
        component.channelName = channelDetails.channelName;
        component.channelDescription = channelDetails.channelDescription;
        component.createdBy = channelDetails.createdBy || '';
        component.channelCreatedAt = channelDetails.createdAt || null;
        
        // Channel-Mitglieder laden
        const members = await this.channelHandler.loadChannelMembers(channelDetails.currentChannelId);
        component.channelMembers = members;
        component.channelMemberIds = members.map(member => member.uid); // IDs extrahieren
      }
    }
  }

  private handleNewChatMode(component: any, isNewChat: boolean) {
    component.isNewChat = isNewChat;
    if (isNewChat) {
      component.showWelcomeMessage = false;
      component.selectedChannel = '';
      component.selectedUserDisplayName = '';
    }
  }

  addSubscription(subscription: Subscription) {
    this.subscriptions.push(subscription);
  }

  dispose() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
} 