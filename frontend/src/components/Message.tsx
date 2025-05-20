import React, { useState } from 'react';
import { format } from 'date-fns';
import type { Message as MessageType } from '../types';
import { useMessageEdit } from '../hooks/useMessageEdit';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../config';

interface MessageProps {
  message: MessageType;
  chatId: number;
  onMessageUpdate?: (updatedMessage: MessageType) => void;
  onReactionUpdate?: (messageId: number, reactions: Record<string, number>) => void;
}

export const Message: React.FC<MessageProps> = ({ 
  message, 
  chatId, 
  onMessageUpdate,
  onReactionUpdate 
}) => {
  const { user } = useAuth();
  const isOwnMessage = user?.id === message.senderId;
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

  const handleEmojiReaction = async (emoji: string) => {
    if (!chatId) return;
    
    try {
      await axios.post(
        `${API_URL}/api/chat/${chatId}/messages/${message.id}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      // Update local state
      const reactions = message.reactions || {};
      const count = reactions[emoji] || 0;
      onReactionUpdate?.(message.id, { ...reactions, [emoji]: count + 1 });
      
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast.error('Failed to add reaction');
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
        
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            {['👍', '😂', '❤️', '😮', '😢', '🔥'].map(emoji => {
              const count = message.reactions?.[emoji] || 0;
              return (
                <button
                  key={emoji}
                  onClick={() => handleEmojiReaction(emoji)}
                  className={`text-xl text-gray-500 hover:text-blue-500 transition-colors`}
                  title={`${count} ${count === 1 ? 'person' : 'people'} reacted with ${emoji}`}
                >
                  {emoji}
                  {count > 0 && (
                    <span className="ml-1 text-sm">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-gray-500 hover:text-gray-700"
          >
            Add reaction
          </button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            {['👍', '😂', '❤️', '😮', '😢', '🔥'].map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiReaction(emoji)}
                className={`p-2 text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        <span className="text-xs text-gray-500 mt-1">
          {format(new Date(message.createdAt), 'HH:mm')}
          {message.updatedAt !== message.createdAt && ' (edited)'}
        </span>
      </div>
    </div>
  );
};

interface MessageProps {
  message: MessageType;
  chatId: number;
  onMessageUpdate?: (updatedMessage: MessageType) => void;
  onReactionUpdate?: (messageId: number, reactions: Record<string, number>) => void;
}

export const Message: React.FC<MessageProps> = ({ message, chatId, onMessageUpdate }) => {
  const { user } = useAuth();
  const isOwnMessage = user?.id === message.senderId;
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
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

  const handleEmojiReaction = async (emoji: string) => {
    if (!chatId) return;
    
    try {
      await axios.post(
        `${API_URL}/api/chat/${chatId}/messages/${message.id}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      // Update local state
      const reactions = message.reactions || {};
      const count = reactions[emoji] || 0;
      setMessage({ ...message, reactions: { ...reactions, [emoji]: count + 1 } });
      
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast.error('Failed to add reaction');
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
        
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            {['👍', '😂', '❤️', '😮', '😢', '🔥'].map(emoji => {
              const hasReacted = selectedEmoji === emoji;
              const count = message.reactions?.[emoji] || 0;
              
              return (
                <button
                  key={emoji}
                  onClick={() => handleEmojiReaction(emoji)}
                  className={`text-xl ${hasReacted ? 'text-blue-500' : 'text-gray-500'} hover:text-blue-500 transition-colors`}
                  title={`${count} ${count === 1 ? 'person' : 'people'} reacted with ${emoji}`}
                >
                  {emoji}
                  {count > 0 && (
                    <span className="ml-1 text-sm">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-gray-500 hover:text-gray-700"
          >
            Add reaction
          </button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            {['👍', '😂', '❤️', '😮', '😢', '🔥'].map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiReaction(emoji)}
                className={`p-2 text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        <span className="text-xs text-gray-500 mt-1">
          {format(new Date(message.createdAt), 'HH:mm')}
          {message.updatedAt !== message.createdAt && ' (edited)'}
        </span>
      </div>
    </div>
  );
};