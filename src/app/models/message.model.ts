export interface Message {
  id: string;
  text: string;
  timestamp: any;
  userId: string;
  username: string;
  avatar?: string;
  channelId?: string;
  recipientId?: string;
  reactions?: {
    userId: string;
    emoji: string;
    timestamp: Date;
  }[];
  edited?: boolean;
  editedAt?: any;
  parentId?: string; // Für Thread-Nachrichten
  isThread?: boolean;
  showReactions?: boolean;
  showEmojiPicker?: boolean;
  isEditing?: boolean;
  editText?: string;
} 