import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { Message } from '../../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class MessageGroupHandler {
  constructor() {}

  groupMessagesByDate(messages: Message[]): { date: string, messages: Message[], showDateDivider: boolean }[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    
    const groups = new Map<string, Message[]>();

    messages.forEach(message => {
      let date: Date;

      if (message.timestamp instanceof Timestamp) {
        date = message.timestamp.toDate();
      } else if (message.timestamp?.toDate) {
        date = message.timestamp.toDate();
      } else if (message.timestamp?.seconds) {
        // Firestore Timestamp als Objekt
        date = new Date(message.timestamp.seconds * 1000);
      } else {
        date = new Date();
      }

      const dateStr = this.formatDate(date);

      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)?.push({
        ...message,
        timestamp: date
      });
    });

    return Array.from(groups.entries()).map(([date, messages]) => ({
      date,
      messages,
      showDateDivider: true
    }));
  }

  formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return 'Heute';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear();
  }

  getThreadRepliesCount(messageId: string, threadReplies: Message[]): number {
    return threadReplies.filter(reply => reply.threadId === messageId).length;
  }
} 