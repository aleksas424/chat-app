import { useState, useCallback } from 'react';
import type { Message } from '../types';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

export const useMessageEdit = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const startEditing = useCallback((message: Message) => {
    setIsEditing(true);
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  const editMessage = useCallback(async (chatId: number, messageId: number, content: string) => {
    try {
      const response = await api.patch(`/chat/${chatId}/messages/${messageId}`, {
        content
      });
      
      setIsEditing(false);
      setEditingMessageId(null);
      setEditContent('');
      
      toast.success('Message updated successfully');
      return response.data;
    } catch (error: any) {
      console.error('Error editing message:', error);
      toast.error(error.response?.data?.message || 'Failed to edit message');
      throw error;
    }
  }, []);

  return {
    isEditing,
    editingMessageId,
    editContent,
    setEditContent,
    startEditing,
    cancelEditing,
    editMessage
  };
}; 