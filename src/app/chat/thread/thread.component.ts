import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp, updateDoc } from '@angular/fire/firestore';
import { Message as FirebaseMessage } from './../../models/message.model';
import { ChatService } from './../../services/chat.service';
import { Auth } from '@angular/fire/auth';

interface MessageGroup {
  date: string;
  messages: Message[];
  isOriginalMessage: boolean;
}

interface Reaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface Message extends FirebaseMessage {
  showReactions?: boolean;
  showEmojiPicker?: boolean;
  isEditing?: boolean;
  editText?: string;
}

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, FormsModule],
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss']
})
export class ThreadComponent implements OnInit {
  @Input() message: Message | null = null;
  @Output() closeThread = new EventEmitter<void>();
  
  replies: Message[] = [];
  replyText: string = '';
  showEmojiPicker = false;
  currentUser: any;
  
  emojis: string[] = ['😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔'];
  messageGroups: MessageGroup[] = [];
  tooltipVisibility: { [key: string]: boolean } = {};
  tooltipData: { [key: string]: { emoji: string, users: string[] } } = {};

  constructor(
    private chatService: ChatService,
    private auth: Auth,
    private firestore: Firestore,
    private cdr: ChangeDetectorRef
  ) {
    this.chatService.getCurrentUser().then(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    this.loadReplies();
  }

  // Methode für die Anzeige des Benutzernamens
  getDisplayName(message: any): string {
    return message?.username || 'Unbekannter Benutzer';
  }

  // Hilfsmethode für die Timestamp-Konvertierung
  convertTimestamp(timestamp: any): Date {
    if (timestamp && timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date();
  }

  isCurrentUser(userId: string | undefined): boolean {
    return userId === this.auth.currentUser?.uid;
  }

  groupMessagesByDate(messages: Message[]) {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = this.convertTimestamp(message.timestamp);
      const dateStr = date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(message);
    });

    this.messageGroups = Object.keys(groups).map(date => ({
      date,
      messages: groups[date],
      isOriginalMessage: false
    }));
  }

  async loadReplies() {
    if (this.message) {
      try {
        // Echtzeit-Listener für die Original-Nachricht
        const originalMessageRef = doc(this.firestore, 'messages', this.message.id);
        onSnapshot(originalMessageRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const originalMessageData = {
              id: docSnapshot.id,
              ...docSnapshot.data()
            } as Message;
            
            // Update die Original-Nachricht
            this.message = originalMessageData;
            
            // Aktualisiere die MessageGroups mit der neuen Original-Nachricht
            if (this.messageGroups.length > 0) {
              this.messageGroups[0] = {
                date: this.convertTimestamp(this.message.timestamp).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                }),
                messages: [this.message],
                isOriginalMessage: true
              };
            }
            
            this.cdr.detectChanges();
          }
        });

        // Echtzeit-Listener für die Antworten
        const messagesRef = collection(this.firestore, 'messages');
        const q = query(
          messagesRef,
          where('threadId', '==', this.message.id),
          orderBy('timestamp', 'asc')
        );

        onSnapshot(q, (snapshot) => {
          this.replies = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Message));

          // Gruppiere Original-Nachricht und Antworten
          const originalMessageGroup = {
            date: this.convertTimestamp(this.message?.timestamp).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            }),
            messages: [this.message],
            isOriginalMessage: true
          };

          const replyGroups = this.groupRepliesByDate(this.replies);
          this.messageGroups = [originalMessageGroup as MessageGroup, ...replyGroups];
          
          this.cdr.detectChanges();
        });

      } catch (error) {
        console.error('Error loading thread:', error);
      }
    }
  }

  private groupRepliesByDate(replies: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {};
    
    replies.forEach(message => {
      const date = this.convertTimestamp(message.timestamp);
      const dateStr = date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(message);
    });

    return Object.keys(groups).map(date => ({
      date,
      messages: groups[date],
      isOriginalMessage: false
    }));
  }

  async sendReply() {
    if (this.message && this.replyText.trim() && this.currentUser) {
      try {
        // Hole den aktuellen User aus Firestore um die korrekten Daten zu haben
        const userRef = doc(this.firestore, 'users', this.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const replyData = {
          text: this.replyText.trim(),
          userId: this.currentUser.uid,
          // Verwende die richtige Reihenfolge für den Username mit Index-Notation
          username: userData?.['displayName'] || 
                   userData?.['username'] || 
                   this.currentUser['username'] || 
                   this.currentUser.email,
          channelId: this.message.channelId,
          threadId: this.message.id,
          timestamp: new Date(),
          avatar: userData?.['avatar'] || 
                  this.currentUser['avatar'] || 
                  'default-avatar.png'
        };

        await this.chatService.sendMessage(replyData);
        this.replyText = '';
      } catch (error) {
        console.error('Error sending reply:', error);
      }
    }
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    this.replyText += emoji;
    this.showEmojiPicker = false;
  }

  close() {
    this.closeThread.emit();
  }

  // Reaktions-Methoden
  showReactionOptions(event: MouseEvent, message: Message) {
    event.stopPropagation();
    message.showReactions = true;
  }

  hideReactionOptions(event: MouseEvent, message: Message) {
    const target = event.currentTarget as HTMLElement;
    if (!target.querySelector('.message-emoji-picker:hover')) {
      message.showReactions = false;
      message.showEmojiPicker = false;
    }
  }

  async addReaction(message: Message, emoji: string) {
    try {
      const messageRef = doc(this.firestore, 'messages', message.id);
      const reactions = message.reactions || [];
      
      const existingReaction = reactions.find(
        r => r.userId === this.currentUser.uid && r.emoji === emoji
      );

      if (existingReaction) {
        await updateDoc(messageRef, {
          reactions: reactions.filter(r => 
            !(r.userId === this.currentUser.uid && r.emoji === emoji)
          )
        });
      } else {
        await updateDoc(messageRef, {
          reactions: [...reactions, {
            userId: this.currentUser.uid,
            emoji: emoji,
            timestamp: new Date()
          }]
        });
      }

      message.showReactions = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  }

  groupReactions(reactions: Reaction[]): GroupedReaction[] {
    if (!reactions) return [];
    
    const grouped = reactions.reduce((acc: { [key: string]: GroupedReaction }, reaction: Reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push(reaction.userId);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  hasUserReacted(message: Message, emoji: string) {
    return message.reactions?.some(r => 
      r.userId === this.currentUser.uid && r.emoji === emoji
    );
  }

  handleReactionHover(event: MouseEvent, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    const reactionKey = `${message.id}-${reaction.emoji}`;
    this.tooltipVisibility[reactionKey] = true;
    this.tooltipData[reactionKey] = {
      emoji: reaction.emoji,
      users: reaction.users
    };
  }

  handleReactionLeave(event: MouseEvent, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    const reactionKey = `${message.id}-${reaction.emoji}`;
    setTimeout(() => {
      const target = event.relatedTarget as HTMLElement;
      const isOverTooltip = target?.closest('.reaction-tooltip');
      
      if (!isOverTooltip) {
        this.tooltipVisibility[reactionKey] = false;
        delete this.tooltipData[reactionKey];
      }
    }, 100);
  }
}
