export interface Message {
  id: number;
  content: string;
  senderId: number;
  chatId: number;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  sender?: {
    id: number;
    username: string;
    avatar?: string;
  };
} 