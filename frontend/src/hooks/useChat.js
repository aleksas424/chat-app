import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../config';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const useChat = (user) => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChats = useCallback(async () => {
    try {
      const response = await axios.get(`${getApiUrl()}api/chat`);
      const chatsWithLast = await Promise.all(response.data.map(async (chat) => {
        try {
          const msgRes = await axios.get(`${getApiUrl()}api/chat/${chat.id}/messages`);
          const lastMsg = Array.isArray(msgRes.data) && msgRes.data.length > 0 ? msgRes.data[msgRes.data.length - 1] : null;
          return { ...chat, lastMessage: lastMsg };
        } catch {
          return { ...chat, lastMessage: null };
        }
      }));
      setChats(chatsWithLast);
      setError(null);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats');
      toast.error('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (chatId) => {
    if (!chatId) return;
    try {
      const response = await axios.get(`${getApiUrl()}api/chat/${chatId}/messages`);
      setMessages(response.data);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load messages');
    }
  }, []);

  const fetchMembers = useCallback(async (chatId) => {
    if (!chatId) return;
    try {
      const response = await axios.get(`${getApiUrl()}api/chat/${chatId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Error loading members:', err);
      toast.error('Failed to load members');
    }
  }, []);

  const createPrivateChat = useCallback(async (userId) => {
    try {
      const response = await axios.post(`${getApiUrl()}api/chat/private`, { userId });
      const newChat = response.data;
      setChats(prev => [...prev, newChat]);
      setSelectedChat(newChat);
      return newChat;
    } catch (err) {
      console.error('Error creating private chat:', err);
      toast.error('Failed to create private chat');
      return null;
    }
  }, []);

  const createGroupChat = useCallback(async (name, userIds) => {
    try {
      const response = await axios.post(`${getApiUrl()}api/chat/group`, { name, userIds });
      const newChat = response.data;
      setChats(prev => [...prev, newChat]);
      setSelectedChat(newChat);
      return newChat;
    } catch (err) {
      console.error('Error creating group chat:', err);
      toast.error('Failed to create group chat');
      return null;
    }
  }, []);

  const addMember = useCallback(async (chatId, userId) => {
    try {
      const response = await axios.post(`${getApiUrl()}api/chat/${chatId}/members`, { userId });
      setMembers(prev => [...prev, response.data]);
      toast.success('Member added successfully');
      return response.data;
    } catch (err) {
      console.error('Error adding member:', err);
      toast.error('Failed to add member');
      return null;
    }
  }, []);

  const removeMember = useCallback(async (chatId, userId) => {
    try {
      await axios.delete(`${getApiUrl()}api/chat/${chatId}/members/${userId}`);
      setMembers(prev => prev.filter(member => member.id !== userId));
      toast.success('Member removed successfully');
      return true;
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error('Failed to remove member');
      return false;
    }
  }, []);

  const updateChat = useCallback((chatId, updates) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, ...updates } : chat
    ));
    if (selectedChat?.id === chatId) {
      setSelectedChat(prev => ({ ...prev, ...updates }));
    }
  }, [selectedChat]);

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    setChats(prev => prev.map(chat =>
      chat.id === message.chatId ? { ...chat, lastMessage: message } : chat
    ));
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      if (selectedChat.type !== 'private') {
        fetchMembers(selectedChat.id);
      }
    }
  }, [selectedChat, fetchMessages, fetchMembers]);

  return {
    chats,
    selectedChat,
    setSelectedChat,
    messages,
    members,
    isLoading,
    error,
    createPrivateChat,
    createGroupChat,
    addMember,
    removeMember,
    updateChat,
    addMessage,
    refreshChats: fetchChats
  };
}; 