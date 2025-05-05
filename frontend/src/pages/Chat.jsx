import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_URL } from '../config';
import io from 'socket.io-client';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import CreateGroupOrChannelModal from '../components/CreateGroupOrChannelModal';
import AddMemberModal from '../components/AddMemberModal';

const typeIcon = {
  private: '💬',
  group: '👥',
  channel: '📢',
};

const Chat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [search, setSearch] = useState('');
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef();
  const [members, setMembers] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateGroupOrChannel, setShowCreateGroupOrChannel] = useState(false);
  const [createType, setCreateType] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const emojiList = ['👍', '😂', '❤️', '😮', '😢', '🔥'];
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [userStatuses, setUserStatuses] = useState({});
  const [messageReads, setMessageReads] = useState({});
  const [showReadReceipts, setShowReadReceipts] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [notificationSettings, setNotificationSettings] = useState({});
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const notificationSound = new Audio('/sounds/notification.mp3');
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageArrived, setNewMessageArrived] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [mobileView, setMobileView] = useState('chats'); // 'chats' arba 'chat'
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      // Request permission if not granted
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError('Failed to connect to chat server. Retrying...');
      setIsReconnecting(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
      setIsReconnecting(true);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      setConnectionError('Failed to reconnect to chat server');
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setConnectionError('Failed to reconnect to chat server. Please refresh the page.');
    });

    newSocket.on('new-message', (message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setChats(prev => prev.map(chat =>
        chat.id === message.chatId ? { ...chat, lastMessage: message } : chat
      ));

      // Show notification if permission granted and message is from another user
      if (notificationPermission === 'granted' && message.senderId !== user.id) {
        new Notification('New Message', {
          body: `${message.senderName}: ${message.content}`,
          icon: '/favicon.ico'
        });
      }
    });

    newSocket.on('user-typing', ({ userId, chatId }) => {
      if (chatId === selectedChat?.id) {
        setTypingUsers(prev => ({ ...prev, [userId]: true }));
      }
    });

    newSocket.on('user-stop-typing', ({ userId, chatId }) => {
      if (chatId === selectedChat?.id) {
        setTypingUsers(prev => ({ ...prev, [userId]: false }));
      }
    });

    newSocket.on('user-status-changed', ({ userId, status, lastSeen }) => {
      setUserStatuses(prev => ({
        ...prev,
        [userId]: { status, lastSeen }
      }));
    });

    setSocket(newSocket);

    // Load previous messages (use correct endpoint and Authorization)
    fetch(`${API_URL}/api/chat/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setMessages(data);
      })
      .catch(error => {
        console.error('Failed to load messages:', error);
      });

    return () => {
      newSocket.disconnect();
    };
  }, [user, notificationPermission]);

  useEffect(() => {
    // Fetch chats and join rooms when chats change
    const fetchChats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const chatsWithLast = await Promise.all(response.data.map(async (chat) => {
          try {
            const msgRes = await axios.get(`${API_URL}/api/chat/${chat.id}/messages`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const lastMsg = msgRes.data[msgRes.data.length - 1];
            return { ...chat, lastMessage: lastMsg };
          } catch {
            return { ...chat, lastMessage: null };
          }
        }));
        setChats(chatsWithLast);
        if (chatsWithLast.length > 0) {
          const stillExists = chatsWithLast.find(chat => chat.id === selectedChat?.id);
          if (stillExists) {
            setSelectedChat(stillExists);
          } else {
            setSelectedChat(chatsWithLast[0]);
          }
          if (socket) {
            socket.emit('join-chats', chatsWithLast.map(chat => chat.id));
          }
        }
      } catch (error) {
        toast.error('Failed to load chats');
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, [selectedChat?.id]);

  useEffect(() => {
    // Fetch messages when selectedChat changes
    const fetchMessages = async () => {
      if (selectedChat) {
        try {
          const response = await axios.get(`${API_URL}/api/chat/${selectedChat.id}/messages`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setMessages(response.data);
        } catch (error) {
          toast.error('Failed to load messages');
        }
      }
    };
    fetchMessages();

    // Fetch members for group/channel
    const fetchMembers = async () => {
      if (selectedChat && selectedChat.type !== 'private') {
        try {
          const response = await axios.get(`${API_URL}/api/group/${selectedChat.id}/members`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setMembers(response.data);
        } catch (error) {
          setMembers([]);
        }
      } else {
        setMembers([]);
      }
    };
    fetchMembers();
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        // Filter out only current user
        const filteredUsers = response.data.filter(u => u.id !== user.id);
        setUsers(filteredUsers);
      } catch (error) {
        setUsers([]);
      }
    };
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (message) => {
      if (message.chatId === selectedChat?.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
      setChats(prev => prev.map(chat =>
        chat.id === message.chatId ? { ...chat, lastMessage: message } : chat
      ));
    };
    socket.on('new-message', handleNewMessage);
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    if (!socket) return;
    const handleMessageEdited = ({ messageId, chatId, content, edited }) => {
      if (chatId === selectedChat?.id) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, content, edited } : msg
        ));
        setEditingMessage(null);
        setEditContent('');
      }
    };
    socket.on('message-edited', handleMessageEdited);
    return () => {
      socket.off('message-edited', handleMessageEdited);
    };
  }, [socket, selectedChat]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      try {
        await axios.post(`${API_URL}/api/chat/${selectedChat.id}/messages`, {
          content: newMessage
        });
        setNewMessage('');
        // Nebeatnaujiname žinučių sąrašo čia, nes žinutė ateina per socket
      } catch (error) {
        toast.error('Nepavyko išsiųsti žinutės');
      }
    }
  };

  const handleTyping = () => {
    if (selectedChat) {
      socket.emit('typing', { chatId: selectedChat.id });
    }
  };

  const handleStopTyping = () => {
    if (selectedChat) {
      socket.emit('stop-typing', { chatId: selectedChat.id });
    }
  };

  const handleCreatePrivateChat = async (userId) => {
    const existing = chats.find(c => c.type === 'private' && c.members?.some(m => m.id === userId));
    if (existing) {
      setSelectedChat(existing);
      setShowUserSelect(false);
      setShowNewModal(false);
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/chat/private`, 
        { userId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      // Add new chat to the list and select it
      const newChat = {
        id: response.data.chatId,
        type: 'private',
        display_name: users.find(u => u.id === userId)?.name || 'Privatus',
        lastMessage: null
      };
      setChats(prev => [...prev, newChat]);
      setSelectedChat(newChat);
      // Close modals
      setShowUserSelect(false);
      setShowNewModal(false);
      toast.success('Private chat created');
    } catch (error) {
      toast.error('Failed to create private chat');
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    
    try {
      await axios.delete(`${API_URL}/api/chat/${selectedChat.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Remove chat from list
      setChats(prev => prev.filter(chat => chat.id !== selectedChat.id));
      setSelectedChat(null);
      setShowDeleteConfirm(false);
      toast.success('Chat deleted successfully');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const myRole = members.find(m => m.id === user?.id)?.role;

  const canLeave = selectedChat && selectedChat.type !== 'private' && myRole && myRole !== 'owner';

  const isChannel = selectedChat && selectedChat.type === 'channel';
  const canSend = !isChannel || (myRole === 'owner' || myRole === 'admin');

  // Group members by role
  const ownerMembers = members.filter(m => m.role === 'owner');
  const adminMembers = members.filter(m => m.role === 'admin');
  const memberMembers = members.filter(m => m.role === 'member');

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setSidebarOpen(false);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await axios.delete(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      // UI bus atnaujintas per socket eventą
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to delete message');
      }
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim() || !selectedChat) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/chat/${selectedChat.id}/messages/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Failed to search messages');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!selectedChat) return;
    
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API_URL}/api/chat/${selectedChat.id}/messages/file`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  // Fetch user statuses periodically
  useEffect(() => {
    const fetchUserStatuses = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/statuses`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const statuses = {};
        response.data.forEach(user => {
          statuses[user.id] = {
            status: user.status,
            lastSeen: user.last_seen
          };
        });
        setUserStatuses(statuses);
      } catch (error) {
        console.error('Failed to fetch user statuses:', error);
      }
    };

    fetchUserStatuses();
    const interval = setInterval(fetchUserStatuses, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Update user's own status
  useEffect(() => {
    if (!socket) return;

    const handleVisibilityChange = () => {
      const status = document.hidden ? 'away' : 'online';
      socket.emit('update-status', { status });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (!selectedChat) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleMessageIds = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => entry.target.dataset.messageId)
          .filter(Boolean);

        if (visibleMessageIds.length > 0) {
          axios.post(
            `${API_URL}/api/chat/${selectedChat.id}/messages/read`,
            { messageIds: visibleMessageIds },
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          ).catch(error => {
            console.error('Failed to mark messages as read:', error);
          });
        }
      },
      { threshold: 0.5 }
    );

    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach(element => observer.observe(element));

    return () => {
      messageElements.forEach(element => observer.unobserve(element));
    };
  }, [selectedChat, messages]);

  // Handle read receipt socket events
  useEffect(() => {
    if (!socket) return;

    const handleMessagesRead = ({ messageIds, userId, reads }) => {
      setMessageReads(prev => {
        const newReads = { ...prev };
        reads.forEach(read => {
          if (!newReads[read.message_id]) {
            newReads[read.message_id] = {};
          }
          newReads[read.message_id][read.user_id] = read;
        });
        return newReads;
      });
    };

    socket.on('messages-read', handleMessagesRead);

    return () => {
      socket.off('messages-read', handleMessagesRead);
    };
  }, [socket]);

  // Fetch unread counts periodically
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/unread-count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const counts = {};
        response.data.forEach(item => {
          counts[item.chat_id] = item.unread_count;
        });
        setUnreadCounts(counts);
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Fetch notification settings
  useEffect(() => {
    const fetchNotificationSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/notification-settings`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const settings = {};
        response.data.forEach(setting => {
          settings[setting.chat_id] = {
            sound: setting.sound,
            desktop: setting.desktop
          };
        });
        setNotificationSettings(settings);
      } catch (error) {
        console.error('Failed to fetch notification settings:', error);
      }
    };

    fetchNotificationSettings();
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  const updateNotificationSettings = async (chatId, settings) => {
    try {
      await axios.post(
        `${API_URL}/api/chat/notification-settings`,
        { chatId, ...settings },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNotificationSettings(prev => ({
        ...prev,
        [chatId]: settings
      }));
    } catch (error) {
      toast.error('Failed to update notification settings');
    }
  };

  // Fetch pinned message when chat changes
  useEffect(() => {
    const fetchPinnedMessage = async () => {
      if (!selectedChat) return;
      
      try {
        const response = await axios.get(
          `${API_URL}/api/chat/${selectedChat.id}/pinned-message`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setPinnedMessage(response.data);
      } catch (error) {
        console.error('Failed to fetch pinned message:', error);
      }
    };

    fetchPinnedMessage();
  }, [selectedChat]);

  // Handle pin/unpin socket events
  useEffect(() => {
    if (!socket) return;

    const handleMessagePinned = ({ chatId, message }) => {
      if (chatId === selectedChat?.id) {
        setPinnedMessage(message);
      }
    };

    const handleMessageUnpinned = ({ chatId, messageId }) => {
      if (chatId === selectedChat?.id) {
        setPinnedMessage(null);
      }
    };

    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);

    return () => {
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-unpinned', handleMessageUnpinned);
    };
  }, [socket, selectedChat]);

  const handlePinMessage = async (messageId) => {
    try {
      await axios.post(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/pin`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
    } catch (error) {
      toast.error('Failed to pin message');
    }
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      await axios.post(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/unpin`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
    } catch (error) {
      toast.error('Failed to unpin message');
    }
  };

  // Pridėsiu funkciją rolės keitimui
  const handleChangeRole = async (memberId, newRole) => {
    try {
      await axios.patch(
        `${API_URL}/api/group/${selectedChat.id}/members/${memberId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      toast.success('Rolė atnaujinta');
      // Atnaujinti narių sąrašą
      const response = await axios.get(`${API_URL}/api/group/${selectedChat.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMembers(response.data);
    } catch (error) {
      toast.error('Nepavyko pakeisti rolės');
    }
  };

  // 1. Emoji reakcijų siuntimas į backend (toggle)
  const handleAddReaction = async (messageId, emoji) => {
    try {
      const reactions = messageReactions[messageId] || [];
      const userId = user.id;
      const userReaction = reactions.find(r => r.user_id === userId);
      if (userReaction && userReaction.emoji === emoji) {
        await axios.post(
          `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/reaction`,
          { emoji },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: reactions.filter(r => !(r.user_id === userId && r.emoji === emoji))
        }));
      } else {
        if (userReaction) {
          await axios.post(
            `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/reaction`,
            { emoji: userReaction.emoji },
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          );
        }
        await axios.post(
          `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/reaction`,
          { emoji },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: [
            ...reactions.filter(r => r.user_id !== userId),
            { user_id: userId, emoji }
          ]
        }));
      }
      setShowEmojiPickerFor(null);
    } catch (error) {
      toast.error('Nepavyko pakeisti reakcijos');
    }
  };

  // 2. Socket eventas reakcijoms
  useEffect(() => {
    if (!socket) return;
    const handleNewReaction = ({ messageId, reactions }) => {
      setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
    };
    socket.on('new-reaction', handleNewReaction);
    return () => {
      socket.off('new-reaction', handleNewReaction);
    };
  }, [socket]);

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, [selectedChat]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPickerFor && !event.target.closest('.emoji-picker')) {
        setShowEmojiPickerFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPickerFor]);

  // Scroll į apačią kai ateina nauja žinutė
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMessageArrived(false);
    } else {
      setNewMessageArrived(true);
    }
  }, [messages]);

  // Stebėti scroll poziciją
  const handleScroll = useCallback((e) => {
    const el = e.target;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setIsAtBottom(atBottom);
    if (atBottom) setNewMessageArrived(false);
  }, []);

  // Long-press meniu logika
  let longPressTimer = null;
  const handleMessageTouchStart = (e, message) => {
    longPressTimer = setTimeout(() => {
      const rect = e.target.getBoundingClientRect();
      setShowMessageMenu({ id: message.id, x: rect.left + rect.width / 2, y: rect.top });
    }, 500);
  };
  const handleMessageTouchEnd = () => {
    clearTimeout(longPressTimer);
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;
    try {
      await axios.patch(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setEditingMessage(null);
      setEditContent('');
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to edit message');
      }
    }
  };

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        if (selectedChat && mobileView !== 'chat') setMobileView('chat');
        if (!selectedChat && mobileView !== 'chats') setMobileView('chats');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedChat, mobileView]);

  // Add error boundary
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Add loading state
  if (loading || isConnecting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Add reconnecting state
  if (isReconnecting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Reconnecting: </strong>
          <span className="block sm:inline">{connectionError || 'Attempting to reconnect...'}</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Add this effect to handle search
  useEffect(() => {
    if (!search) {
      setSearchResults([]);
      return;
    }

    const searchMessages = async () => {
      setIsSearching(true);
      try {
        const response = await axios.get(`${API_URL}/api/chat/search`, {
          params: { query: search },
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setSearchResults(response.data);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchMessages, 300);
    return () => clearTimeout(debounceTimer);
  }, [search]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900">
      {isMobile ? (
        mobileView === 'chats' ? (
          <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        ) : (
          <ChatComponent />
        )
      ) : (
        <>
          <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <ChatComponent />
        </>
      )}
    </div>
  );
};

const SidebarComponent = ({ sidebarOpen, setSidebarOpen }) => (
  <div className={`
    fixed z-50 inset-y-0 left-0 w-full max-w-xs 
    bg-white/20 dark:bg-slate-800/80 
    border-r border-slate-700 
    shadow-xl backdrop-blur-lg 
    rounded-r-3xl 
    transform transition-all duration-300 ease-in-out
    md:static md:translate-x-0 
    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:w-1/4 md:block
  `}>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Chats</h2>
          <button
            onClick={() => setShowNewModal(true)}
            className="p-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredChats.map(chat => (
          <motion.div
            key={chat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              p-4 rounded-xl cursor-pointer
              ${selectedChat?.id === chat.id 
                ? 'bg-primary-500/20 border-primary-500' 
                : 'bg-white/10 hover:bg-white/20 border-transparent'
              }
              border transition-all duration-200
            `}
            onClick={() => {
              handleSelectChat(chat);
              if (isMobile) setMobileView('chat');
            }}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center text-2xl">
                  {typeIcon[chat.type]}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{chat.display_name}</p>
                {chat.lastMessage && (
                  <p className="text-sm text-slate-400 truncate">
                    {chat.lastMessage.sender_name}: {chat.lastMessage.content}
                  </p>
                )}
              </div>
              {unreadCounts[chat.id] > 0 && (
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-primary-500 rounded-full">
                    {unreadCounts[chat.id]}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const ChatComponent = () => (
  <div className="flex-1 flex flex-col overflow-hidden">
    {isMobile && (
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        onClick={() => setMobileView('chats')}
        className="p-2 m-2 rounded-lg bg-white/30 dark:bg-slate-700/60 text-blue-700 dark:text-blue-200 font-bold shadow hover:bg-white/40 transition-colors duration-200"
      >
        ← Atgal
      </motion.button>
    )}
    
    {selectedChat ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex flex-col"
      >
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-700 bg-white/10 backdrop-blur-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-xl">
                {typeIcon[selectedChat.type]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{selectedChat.display_name}</h2>
                {selectedChat.type === 'private' && (
                  <p className="text-sm text-slate-400">
                    {userStatuses[selectedChat.members?.[0]?.id]?.status || 'offline'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 rounded-full hover:bg-white/10 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {selectedChat.type !== 'private' && (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="p-2 rounded-full hover:bg-white/10 text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          <AnimatePresence>
            {messages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`
                  flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}
                `}
              >
                <div
                  className={`
                    max-w-[70%] rounded-lg p-3
                    ${message.sender_id === user.id 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-white/10 text-white'
                    }
                  `}
                >
                  {message.sender_id !== user.id && (
                    <p className="text-sm font-medium mb-1">{message.sender_name}</p>
                  )}
                  <p className="break-words">{message.content}</p>
                  {message.is_edited && (
                    <p className="text-xs text-slate-400 mt-1">(edited)</p>
                  )}
                  <div className="flex items-center justify-end space-x-2 mt-1">
                    <span className="text-xs text-slate-400">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                    {messageReads[message.id] && (
                      <span className="text-xs text-slate-400">
                        {Object.keys(messageReads[message.id]).length} read
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-slate-700 bg-white/10 backdrop-blur-lg">
          <form onSubmit={sendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onFocus={handleTyping}
              onBlur={handleStopTyping}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 rounded-lg bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </motion.div>
    ) : (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">Select a chat to start messaging</p>
      </div>
    )}
  </div>
);

export default Chat; 