import { Injectable } from '@angular/core';
import { AvatarService } from '../services/avatar.service';

@Injectable({
  providedIn: 'root'
})
export class ChatUIHandler {
  constructor(private avatarService: AvatarService) {}

  insertMention(messageText: string, user: any, selectedMentions: string[]): {
    messageText: string;
    selectedMentions: string[];
  } {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = messageText.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const beforeMention = messageText.substring(0, lastAtSymbol);
      const afterMention = messageText.substring(cursorPos);
      messageText = beforeMention + '@' + user.username + ' ' + afterMention;
      
      if (!selectedMentions.includes(user.id)) {
        selectedMentions.push(user.id);
      }
    }
    
    requestAnimationFrame(() => {
      textarea.focus();
    });

    return { messageText, selectedMentions };
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    return this.avatarService.isGoogleAvatar(avatar) 
      ? this.avatarService.transformGooglePhotoUrl(avatar)
      : 'assets/img/avatars/' + avatar;
  }

  toggleEmojiPicker(showEmojiPicker: boolean): boolean {
    return !showEmojiPicker;
  }

  addEmoji(messageText: string, emoji: string): string {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart || 0;
    const textBefore = messageText.substring(0, cursorPos);
    const textAfter = messageText.substring(cursorPos);
    
    const newText = textBefore + emoji + textAfter;
    
    // Setze Cursor nach dem Emoji
    const newCursorPos = cursorPos + emoji.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
    
    return newText;
  }

  checkScreenSize(): boolean {
    return window.innerWidth <= 1100;
  }
} 