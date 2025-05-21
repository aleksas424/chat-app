import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useChat } from '../hooks/useChat';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import CreateGroupOrChannelModal from '../components/CreateGroupOrChannelModal';
import AddMemberModal from '../components/AddMemberModal';

// This file is deprecated and not used. See Chat.jsx for the main chat implementation.
/*
  All previous contents have been commented out to prevent build errors.
*/
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
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
    refreshChats
  } = useChat(user);

  const handleNewMessage = useCallback((message) => {
    addMessage(message);
    scrollToBottom();
    
    if (message.senderId !== user.id && notificationPermission === 'granted') {
      new Notification('New Message', {
        body: message.content,
        icon: '/favicon.ico'
      });
    }
  }, [addMessage, user.id, notificationPermission]);

  const {
    socket,
    isConnecting,
    isReconnecting,
    connectionError,
    sendMessage,
    joinChat,
    leaveChat,
    typing,
    stopTyping
  } = useSocket(user, handleNewMessage);

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationPermission('granted');
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (selectedChat) {
      joinChat(selectedChat.id);
      return () => leaveChat(selectedChat.id);
    }
  }, [selectedChat, joinChat, leaveChat]);

  useEffect(() => {
    if (search.trim()) {
      const searchMessages = async () => {
        try {
          setIsSearching(true);
          const response = await axios.get(`${getApiUrl()}api/chat/search?q=${encodeURIComponent(search)}`);
          setSearchResults(response.data);
        } catch (err) {
          console.error('Search failed:', err);
          toast.error('Search failed');
        } finally {
          setIsSearching(false);
        }
      };

      const timeoutId = setTimeout(searchMessages, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const success = sendMessage(selectedChat.id, newMessage.trim());
      if (success) {
        setNewMessage('');
        stopTyping(selectedChat.id);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typing(selectedChat.id);

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(selectedChat.id);
    }, 2000);
  };

  const handleCreatePrivateChat = async (userId) => {
    const chat = await createPrivateChat(userId);
    if (chat) {
      setShowCreateModal(false);
    }
  };

  const handleCreateGroupChat = async (name, userIds) => {
    const chat = await createGroupChat(name, userIds);
    if (chat) {
      setShowCreateModal(false);
    }
  };

  const handleAddMember = async (userId) => {
    if (selectedChat) {
      const success = await addMember(selectedChat.id, userId);
      if (success) {
        setShowAddMemberModal(false);
      }
    }
  };

  const handleRemoveMember = async (userId) => {
    if (selectedChat) {
      await removeMember(selectedChat.id, userId);
    }
  };

  if (isLoading || isConnecting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Reconnecting: </strong>
          <span className="block sm:inline">{connectionError || 'Attempting to reconnect...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Chat list */}
      <div className="w-1/4 bg-white border-r">
        <div className="p-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            New Chat
          </button>
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="overflow-y-auto h-[calc(100vh-8rem)]">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedChat?.id === chat.id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="font-semibold">{chat.name}</div>
              <div className="text-sm text-gray-500">
                {chat.lastMessage?.content || 'No messages yet'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 border-b bg-white flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedChat.name}</h2>
              {selectedChat.type !== 'private' && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Member
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`mb-4 ${
                    message.senderId === user.id ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block p-3 rounded-lg ${
                      message.senderId === user.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200'
                    }`}
                  >
                    {message.content}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 p-2 border rounded"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="w-1/4 bg-white border-l p-4">
          <h3 className="font-semibold mb-4">Search Results</h3>
          <div className="overflow-y-auto h-[calc(100vh-4rem)]">
            {searchResults.map(result => (
              <div key={result.id} className="mb-4">
                <div className="text-sm text-gray-500">
                  {new Date(result.createdAt).toLocaleString()}
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  {result.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateGroupOrChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreatePrivate={handleCreatePrivateChat}
        onCreateGroup={handleCreateGroupChat}
      />

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onAddMember={handleAddMember}
        existingMembers={members}
      />
    </div>
  );
} 