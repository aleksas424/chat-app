import React, { useState } from 'react';
import { format } from 'date-fns';
import type { Message as MessageType } from '../types';
import { useMessageEdit } from '../hooks/useMessageEdit';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface MessageProps {
  message: MessageType;
  chatId: number;
  onMessageUpdate?: (updatedMessage: MessageType) => void;
}

export const Message: React.FC<MessageProps> = ({ message, chatId, onMessageUpdate }) => {
  const { user } = useAuth();
  const isOwnMessage = user?.id === message.senderId;
  const [showActions, setShowActions] = useState(false);
  const {
    isEditing,
    editingMessageId,
    editContent,
    setEditContent,
    startEditing,
    cancelEditing,
    editMessage
  } = useMessageEdit();

  const handleEdit = async () => {
    try {
      const updatedMessage = await editMessage(chatId, message.id, editContent);
      onMessageUpdate?.(updatedMessage);
    } catch (error) {
      console.error('Error updating message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {!isOwnMessage && message.sender && (
          <span className="text-sm text-gray-500 mb-1">{message.sender.username}</span>
        )}
        
        <div className={`relative group ${isOwnMessage ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-lg px-4 py-2`}>
          {isEditing && editingMessageId === message.id ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full bg-transparent border-none focus:ring-0 resize-none"
              rows={1}
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
          
          {showActions && isOwnMessage && !isEditing && (
            <div className="absolute right-0 top-0 transform translate-x-full ml-2 flex space-x-1">
              <button
                onClick={() => startEditing(message)}
                className="p-1 text-gray-500 hover:text-gray-700"
                title="Edit message"
              >
                ✏️
              </button>
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-500 mt-1">
          {format(new Date(message.createdAt), 'HH:mm')}
          {message.updatedAt !== message.createdAt && ' (edited)'}
        </span>
      </div>
    </div>
  );
}; 