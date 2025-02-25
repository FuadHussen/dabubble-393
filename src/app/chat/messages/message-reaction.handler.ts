import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Message, Reaction, GroupedReaction } from '../../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class MessageReactionHandler {
  // Cache für gruppierte Reaktionen
  private reactionCache: { [key: string]: GroupedReaction[] } = {};

  constructor(private firestore: Firestore) {}

  // Optimierte groupReactions Methode
  groupReactions(reactions: Reaction[], messageId: string): GroupedReaction[] {
    const cacheKey = `${messageId}-${JSON.stringify(reactions)}`;
    
    // Prüfe Cache
    if (this.reactionCache[cacheKey]) {
      return this.reactionCache[cacheKey];
    }

    if (!reactions || reactions.length === 0) return [];

    const grouped = reactions.reduce((acc: { [key: string]: GroupedReaction }, reaction: Reaction) => {
      if (!reaction.emoji || !reaction.userId) return acc;

      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }
      
      if (!acc[reaction.emoji].users.includes(reaction.userId)) {
        acc[reaction.emoji].users.push(reaction.userId);
        acc[reaction.emoji].count++;
      }
      
      return acc;
    }, {});

    const result = Object.values(grouped);
    this.reactionCache[cacheKey] = result;
    return result;
  }

  hasUserReacted(message: Message, emoji: string, currentUserId: string): boolean {
    if (!currentUserId || !message.reactions) return false;
    
    return message.reactions.some(
      r => r.userId === currentUserId && r.emoji === emoji
    );
  }

  async handleReactionClick(message: Message, reaction: GroupedReaction, currentUserId: string): Promise<void> {
    if (!currentUserId) return;

    try {
      const messageRef = doc(this.firestore, 'messages', message.id);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) return;

      const currentReactions: Reaction[] = messageDoc.data()?.['reactions'] || [];
      const existingReactionIndex = currentReactions.findIndex(r => 
        r.userId === currentUserId && r.emoji === reaction.emoji
      );

      let updatedReactions: Reaction[];
      if (existingReactionIndex !== -1) {
        updatedReactions = currentReactions.filter((_, index) => index !== existingReactionIndex);
      } else {
        updatedReactions = [...currentReactions, {
          userId: currentUserId,
          emoji: reaction.emoji,
          timestamp: new Date()
        }];
      }

      await updateDoc(messageRef, { reactions: updatedReactions });
      
      // Cache für diese Nachricht zurücksetzen
      Object.keys(this.reactionCache).forEach(key => {
        if (key.startsWith(message.id)) {
          delete this.reactionCache[key];
        }
      });
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  }

  clearReactionCache(messageId: string): void {
    Object.keys(this.reactionCache).forEach(key => {
      if (key.startsWith(messageId)) {
        delete this.reactionCache[key];
      }
    });
  }
} 