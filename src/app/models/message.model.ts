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
  
  // UI-Zustände
  showReactions?: boolean;
  showEmojiPicker?: boolean;
  isEditing?: boolean;
  editText?: string;
  showEditMenu?: boolean;
  threadId?: string; // ID der übergeordneten Nachricht für Thread-Antworten
}

export interface Reaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface TooltipData {
  emoji: string;
  users: string[];
  position: {
    left: string;
    bottom: string;
  };
} 