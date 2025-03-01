import { Injectable } from '@angular/core';
import { AvatarService } from '../../services/avatar.service';
import { GroupedReaction, Message, TooltipData } from '../../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class MessageUIHandler {
  constructor(private avatarService: AvatarService) {}

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return 'assets/img/avatars/default-avatar.png';
    
    // If it's a Google avatar or a full URL already
    if (this.avatarService.isGoogleAvatar(avatar) || avatar.startsWith('http')) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    // If it's a Firebase Storage path
    if (avatar.startsWith('avatars/')) {
      // Get the download URL from Firebase Storage
      return 'assets/img/avatars/default-avatar.png'; // Temporary fallback while URL loads
      // You should implement logic to get actual Firebase storage URL
    }
    
    // For local assets
    return 'assets/img/avatars/' + avatar;
  }

  showReactionOptions(message: Message): void {
    message.showReactions = true;
  }

  hideReactionOptions(event: MouseEvent, message: Message): void {
    const target = event.currentTarget as HTMLElement;
    if (!target.querySelector('.message-emoji-picker:hover')) {
      message.showReactions = false;
      message.showEmojiPicker = false;
      message.showEditMenu = false;
    }
  }

  showEmojiPickerForMessage(event: Event, message: Message): void {
    event.stopPropagation();
    message.showEmojiPicker = !message.showEmojiPicker;
  }

  toggleEditMenu(event: Event, message: Message): void {
    event.stopPropagation();
    if (message.showEditMenu === undefined) {
      message.showEditMenu = false;
    }
    message.showEditMenu = !message.showEditMenu;
  }

  startEditingMessage(message: Message): void {
    if (message.isEditing === undefined) {
      message.isEditing = false;
    }
    if (message.showEditMenu === undefined) {
      message.showEditMenu = false;
    }
    
    message.isEditing = true;
    message.editText = message.text;
    message.showEditMenu = false;
  }

  cancelEdit(message: Message): void {
    message.isEditing = false;
    message.editText = '';
    message.showEditMenu = false;
  }

  // Tooltip handling
  handleReactionHover(
    message: Message, 
    reaction: GroupedReaction, 
    tooltipData: { [key: string]: TooltipData }, 
    tooltipVisibility: { [key: string]: boolean }
  ): { tooltipData: any, tooltipVisibility: any } {
    const tooltipKey = `${message.id}-${reaction.emoji}`;
    tooltipVisibility[tooltipKey] = true;
    
    return { tooltipData, tooltipVisibility };
  }

  hideTooltip(tooltipKey: string, tooltipVisibility: { [key: string]: boolean }): { [key: string]: boolean } {
    tooltipVisibility[tooltipKey] = false;
    return tooltipVisibility;
  }

  hideAllTooltips(): { [key: string]: boolean } {
    return {};
  }
} 