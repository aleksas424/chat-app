import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: {
        token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast.error('Nepavyko prisijungti prie chat serverio');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('new-message', (message) => {
      if ((message.senderId !== user.id) && (message.sender_id !== user.id)) {
        notificationSound.play().catch(error => {
          console.error('Failed to play notification sound:', error);
        });
      }
      if (message.chatId === selectedChat?.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
      setChats(prev => prev.map(chat =>
        chat.id === message.chatId ? { ...chat, lastMessage: message } : chat
      ));
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
  }, [user]);

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
        toast.error('Nepavyko įkelti pokalbių');
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
          toast.error('Nepavyko įkelti žinutės');
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
      } else {
        // Show notification for messages in other chats
        const settings = notificationSettings[message.chatId] || { sound: true, desktop: true };
        
        if (settings.desktop && document.hidden) {
          new Notification('New Message', {
            body: `${message.senderName}: ${message.content}`,
            icon: '/icon.png'
          });
        }

        if (settings.sound) {
          notificationSound.play().catch(error => {
            console.error('Failed to play notification sound:', error);
          });
        }
      }
    };
    socket.on('new-message', handleNewMessage);
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, selectedChat, notificationSettings]);

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

  useEffect(() => {
    if (!socket) return;

    const handleMessageEdited = ({ messageId, content, edited }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content, edited } : msg
      ));
      setEditingMessage(null);
      setEditContent('');
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    };

    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [socket]);

  const handleEditMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;
    
    // Optimistinis atnaujinimas - iškart atnaujinti UI
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
    ));
    
    try {
      const response = await axios.patch(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      // Jei sėkminga, atnaujinti su serverio duomenimis
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
      ));
      
      // Uždaryti redagavimo režimą
      setEditingMessage(null);
      setEditContent('');
      
      toast.success('Žinutė atnaujinta');
    } catch (error) {
      // Jei klaida, grąžinti seną žinutę
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: msg.content } : msg
      ));
      
      if (error.response) {
        if (error.response.status === 403) {
          toast.error('Neturite teisės redaguoti šios žinutės');
        } else if (error.response.status === 404) {
          toast.error('Žinutė nerasta');
        } else {
          toast.error(error.response.data.message || 'Nepavyko redaguoti žinutės');
        }
      } else {
        toast.error('Nepavyko prisijungti prie serverio');
      }
    }
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
      toast.error('Nepavyko ieškoti žinutžių');
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
      if (response.data.chatId === selectedChat.id) {
        setMessages(prev => [...prev, response.data]);
      }
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
    // Tik mobilioje versijoje ribojam 1 emoji per user
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const reactions = messageReactions[messageId] || [];
      const userId = user.id;
      // Jei jau yra bent viena reakcija nuo šio userio, neleidžiam daugiau
      if (reactions.some(r => r.user_id === userId)) {
        toast.error('Mobilioje versijoje galima tik 1 reakcija!');
        setShowEmojiPickerFor(null);
        return;
      }
    }
    try {
      await axios.post(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
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

  // Pridėsiu handleRemoveMember funkciją
  const handleRemoveMember = async (memberId) => {
    if (!selectedChat) return;
    if (!window.confirm('Ar tikrai norite pašalinti šį narį?')) return;
    try {
      await axios.delete(`${API_URL}/api/group/${selectedChat.id}/members/${memberId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Narys pašalintas');
    } catch (error) {
      toast.error('Nepavyko pašalinti nario');
    }
  };

  const handleLeaveChat = async () => {
    if (!selectedChat) return;
    if (!window.confirm('Ar tikrai norite palikti šį pokalbį?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/group/${selectedChat.id}/leave`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Remove chat from list
      setChats(prev => prev.filter(chat => chat.id !== selectedChat.id));
      setSelectedChat(null);
      toast.success('Sėkmingai palikote pokalbį');
    } catch (error) {
      toast.error('Nepavyko palikti pokalbio');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-hidden overflow-x-hidden bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900">
      {/* Sidebar overlay for mobile */}
      <div className={`fixed inset-0 z-40 bg-black bg-opacity-30 backdrop-blur-sm transition-opacity md:hidden ${sidebarOpen || chats.length === 0 ? '' : 'hidden'}`} onClick={() => setSidebarOpen(false)} />
      {/* Sidebar */}
      <div className={`fixed z-50 inset-y-0 left-0 w-full max-w-xs bg-white/20 dark:bg-slate-800/80 border-r border-slate-700 shadow-xl backdrop-blur-lg rounded-r-3xl transform transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen || chats.length === 0 ? 'translate-x-0' : '-translate-x-full'} md:w-1/4 md:block h-full min-h-0 overflow-x-hidden`}>
        <div className="p-4 md:p-6 flex flex-col h-full min-h-0 overflow-x-hidden">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow">Pokalbiai</h2>
            <button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow hover:from-blue-600 hover:to-indigo-700 transition font-semibold text-sm md:text-base"
              onClick={() => setShowNewModal(true)}
            >
              + Naujas
            </button>
          </div>
          <input
            type="text"
            placeholder="Ieškoti pokalbių..."
            className="w-full mb-4 md:mb-6 px-3 py-2 md:px-4 md:py-3 rounded-xl border-none bg-white/40 dark:bg-slate-700/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 shadow text-sm md:text-base"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="space-y-2 md:space-y-3 flex-1 overflow-y-auto min-h-0">
            {filteredChats.length === 0 && (
              <div className="text-slate-400 text-center py-4 md:py-8 text-sm md:text-base">No chats found</div>
            )}
            {filteredChats.map(chat => (
              <motion.div
                key={chat.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-2xl cursor-pointer transition-colors duration-100 shadow-md ${
                  selectedChat?.id === chat.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white'
                    : 'bg-white/30 dark:bg-slate-700/60 hover:bg-blue-500/20 dark:hover:bg-blue-700/40 text-slate-900 dark:text-white'
                }`}
                onClick={() => handleSelectChat(chat)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg md:text-xl shadow-lg">
                  {typeIcon[chat.type] || '💬'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="font-semibold truncate text-sm md:text-base">
                      {chat.display_name}
                    </span>
                    <span className="text-xs text-blue-200">{chat.type}</span>
                  </div>
                  <div className="text-xs md:text-sm text-blue-100 truncate">
                    {chat.lastMessage ? `${chat.lastMessage.senderName || ''}: ${chat.lastMessage.content}` : 'No messages yet'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0 overflow-x-hidden">
        <div className="flex-1 flex flex-col overflow-hidden px-2 py-2 md:px-8 md:py-8 h-full min-h-0 overflow-x-hidden">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-3 md:p-4 border-b border-slate-700/20 bg-white/30 dark:bg-slate-800/60 backdrop-blur-md flex items-center justify-between overflow-x-hidden">
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="md:hidden p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg md:text-xl shadow-lg">
                    {typeIcon[selectedChat.type] || '💬'}
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
                      {selectedChat.display_name}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                      {selectedChat.type}
                    </p>
                  </div>
                </div>
                
                {/* Search Bar */}
                <div className="relative">
                  <button
                    onClick={() => {
                      const query = prompt('Ieškoti žinutės:');
                      if (query !== null) {
                        setSearchQuery(query);
                        handleSearch(query);
                      }
                    }}
                    className="p-2 rounded-lg bg-white/60 dark:bg-slate-700/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Ieškoti žinutės"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                  </button>
                </div>

                {/* Members or Delete Chat Button */}
                {selectedChat && (
                  selectedChat.type === 'private' ? (
                    <button
                      onClick={async () => {
                        if (window.confirm('Ar tikrai norite ištrinti šį pokalbį?')) {
                          try {
                            await axios.delete(`${API_URL}/api/chat/${selectedChat.id}`, {
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            });
                            setChats(prev => prev.filter(chat => chat.id !== selectedChat.id));
                            setSelectedChat(null);
                            toast.success('Pokalbis ištrintas');
                          } catch (error) {
                            toast.error('Nepavyko ištrinti pokalbio');
                          }
                        }
                      }}
                      className="p-1.5 md:p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm md:text-base"
                      title="Ištrinti pokalbį"
                    >
                      🗑️
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowMembersModal(true)}
                      className="p-1.5 md:p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                  )
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 bg-white/10 dark:bg-slate-800/40 rounded-3xl shadow-xl backdrop-blur-md max-h-full min-h-0 overflow-x-hidden">
                <AnimatePresence>
                  {messages.map(message => (
                    <motion.div
                      key={message.id}
                      id={`message-${message.id}`}
                      data-message-id={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`flex ${
                        (message.sender_id || message.senderId) === user.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] md:max-w-xs rounded-2xl px-3 py-2 md:px-5 md:py-3 shadow-lg backdrop-blur-md ${
                          (message.sender_id || message.senderId) === user.id
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                            : 'bg-white/60 dark:bg-slate-700/80 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1 md:gap-2">
                          <div className="text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-200">
                            {message.sender_name || message.senderName || message.user}
                          </div>
                          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                            userStatuses[message.sender_id || message.senderId]?.status === 'online' ? 'bg-green-500' :
                            userStatuses[message.sender_id || message.senderId]?.status === 'away' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`} />
                        </div>
                        {editingMessage === message.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleEditMessage(message.id, editContent);
                                } else if (e.key === 'Escape') {
                                  setEditingMessage(null);
                                  setEditContent('');
                                }
                              }}
                              className="bg-white/20 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-white text-sm md:text-base w-full"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleEditMessage(message.id, editContent)}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-xs md:text-sm transition-colors"
                              >
                                Išsaugoti
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMessage(null);
                                  setEditContent('');
                                }}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs md:text-sm transition-colors"
                              >
                                Atšaukti
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {message.file_name ? (
                              <div className="space-y-2">
                                {message.file_type && message.file_type.startsWith('image/') ? (
                                  <img
                                    src={`${API_URL}/uploads/${message.file_path}`}
                                    alt={message.file_name}
                                    className="max-w-full rounded-lg shadow-md"
                                    style={{ maxHeight: 200 }}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 p-2 bg-white/20 dark:bg-slate-800/60 rounded-lg">
                                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs md:text-sm font-medium truncate">{message.file_name}</div>
                                      <div className="text-xs text-slate-400">{message.file_type}</div>
                                    </div>
                                    <a
                                      href={`${API_URL}/uploads/${message.file_path}`}
                                      download={message.file_name}
                                      className="p-1 rounded-full hover:bg-white/20"
                                    >
                                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </a>
                                  </div>
                                )}
                                <div className="text-xs md:text-sm">{message.content}</div>
                              </div>
                            ) : (
                              <div className="text-xs md:text-sm">{message.content}</div>
                            )}
                            <div className="flex items-center gap-1 md:gap-2 mt-1 md:mt-2">
                              <div className={`text-xs ${((message.sender_id || message.senderId) === user.id) ? 'text-white/80 drop-shadow' : 'text-slate-500 dark:text-slate-400'}`}>
                                {new Date(message.created_at || message.createdAt).toLocaleString()}
                              </div>
                              {(message.sender_id || message.senderId) === user.id && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMessage(message.id);
                                      setEditContent(message.content);
                                    }}
                                    className="text-xs hover:text-blue-200 transition-colors"
                                    title="Redaguoti žinutę"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="text-xs hover:text-blue-200 transition-colors"
                                    title="Ištrinti žinutę"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                              {(selectedChat?.role === 'owner' || selectedChat?.role === 'admin') && (
                                <button
                                  onClick={() => message.pinned ? handleUnpinMessage(message.id) : handlePinMessage(message.id)}
                                  className="text-xs hover:text-blue-200"
                                  title={message.pinned ? "Unpin message" : "Pin message"}
                                >
                                  {message.pinned ? "📌" : "📍"}
                                </button>
                              )}
                              {/* Emoji reactions */}
                              <button
                                className="ml-1 md:ml-2 text-lg md:text-xl hover:scale-110 transition-transform"
                                onClick={() => setShowEmojiPickerFor(message.id)}
                                title="Pridėti reakciją"
                              >
                                😊
                              </button>
                              {showEmojiPickerFor === message.id && (
                                <div className="absolute z-50 mt-8 bg-white dark:bg-slate-800 rounded shadow p-2 flex gap-1 emoji-picker">
                                  {emojiList.map(emoji => (
                                    <button
                                      key={emoji}
                                      className="text-lg md:text-xl hover:scale-125 transition-transform"
                                      onClick={() => handleAddReaction(message.id, emoji)}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Display reactions */}
                              {Array.isArray(messageReactions[message.id]) && messageReactions[message.id].length > 0 && (
                                <span className="ml-1 md:ml-2 flex gap-1">
                                  {emojiList.filter(e => messageReactions[message.id].some(r => r.emoji === e)).map(emoji => {
                                    const count = messageReactions[message.id].filter(r => r.emoji === emoji).length;
                                    return (
                                      <span key={emoji} className="text-lg md:text-xl">
                                        {emoji}{count > 1 ? ` x${count}` : ''}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
              {/* Message Input */}
              {canSend && (
                <form onSubmit={sendMessage} className="p-2 md:p-4 border-t border-slate-700 bg-white/20 dark:bg-slate-800/60 flex items-center gap-2 sticky bottom-0 rounded-b-3xl shadow-xl backdrop-blur-md">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onFocus={handleTyping}
                    onBlur={handleStopTyping}
                    className="flex-1 rounded-xl border-none px-3 py-2 md:px-4 md:py-3 text-sm md:text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/60 dark:bg-slate-700/80 text-slate-900 dark:text-white shadow"
                    placeholder="Rašyti žinutę..."
                  />
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <label
                    htmlFor="file-upload"
                    className="p-2 md:p-3 rounded-xl bg-white/60 dark:bg-slate-700/80 hover:bg-white/80 dark:hover:bg-slate-700 cursor-pointer"
                    title="Įkelti failą"
                  >
                    {uploadingFile ? (
                      <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-blue-500"></div>
                    ) : (
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </label>
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm md:text-lg font-semibold shadow-lg hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </form>
              )}
            </>
          ) : null}
        </div>
      </div>
      {/* Members modal for mobile */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-xs">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold focus:outline-none"
              onClick={() => setShowMembersModal(false)}
              aria-label="Uždaryti"
            >
              ×
            </button>
            <h3 className="text-md font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
              Members <span className="text-xs text-gray-400">({members.length})</span>
            </h3>
            {(myRole === 'owner' || myRole === 'admin') && (
              <button
                onClick={() => {
                  setShowAddMember(true);
                  setShowMembersModal(false);
                }}
                className="w-full mb-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Add Member
              </button>
            )}
            <div>
              {ownerMembers.length > 0 && <div className="font-bold text-xs text-gray-500 dark:text-gray-300 mb-1 mt-2">Owner</div>}
              <ul className="space-y-2">
                {ownerMembers.map(member => (
                  <li key={member.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-400 text-white font-bold">{member.name[0].toUpperCase()}</div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">{member.role}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {adminMembers.length > 0 && <div className="font-bold text-xs text-gray-500 dark:text-gray-300 mb-1 mt-2">Adminai</div>}
              <ul className="space-y-2">
                {adminMembers.map(member => (
                  <li key={member.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-400 text-white font-bold">{member.name[0].toUpperCase()}</div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">{member.role}</div>
                    </div>
                    {myRole === 'owner' && member.id !== user.id && (
                      <select value={member.role} onChange={e => handleChangeRole(member.id, e.target.value)} className="ml-2 rounded px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-700">
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    )}
                  </li>
                ))}
              </ul>
              {memberMembers.length > 0 && <div className="font-bold text-xs text-gray-500 dark:text-gray-300 mb-1 mt-2">Nariai</div>}
              <ul className="space-y-2">
                {memberMembers.map(member => (
                  <li key={member.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-400 text-white font-bold">{member.name[0].toUpperCase()}</div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">{member.role}</div>
                    </div>
                    {(myRole === 'owner' || (myRole === 'admin' && member.role === 'member')) && member.id !== user.id && (
                      <>
                        <select value={member.role} onChange={e => handleChangeRole(member.id, e.target.value)} className="ml-2 rounded px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-700">
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          className="ml-2 px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-700"
                          onClick={() => handleRemoveMember(member.id)}
                          title="Pašalinti narį"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {/* Delete buttons below members list */}
            {selectedChat && (
              <div className="mt-6 flex flex-col gap-2">
                {/* Leave chat button for members */}
                {selectedChat.type !== 'private' && myRole !== 'owner' && (
                  <button
                    className="w-full py-2 rounded bg-yellow-600 text-white font-medium hover:bg-yellow-700"
                    onClick={handleLeaveChat}
                  >
                    Palikti pokalbį
                  </button>
                )}
                
                {/* Group/Channel delete (only for owner) */}
                {selectedChat.type !== 'private' && myRole === 'owner' && (
                  <button
                    className="w-full py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700"
                    onClick={async () => {
                      if (window.confirm(`Ar tikrai norite ištrinti šį ${selectedChat.type === 'group' ? 'grupę' : 'kanalą'}?`)) {
                        try {
                          await axios.delete(`${API_URL}/api/group/${selectedChat.id}`, {
                            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                          });
                          setChats(prev => prev.filter(chat => chat.id !== selectedChat.id));
                          setSelectedChat(null);
                          setShowMembersModal(false);
                          toast.success(`${selectedChat.type === 'group' ? 'Grupė' : 'Kanalas'} ištrintas`);
                        } catch (error) {
                          toast.error('Nepavyko ištrinti');
                        }
                      }
                    }}
                  >
                    Ištrinti {selectedChat.type === 'group' ? 'grupę' : 'kanalą'}
                  </button>
                )}
                
                {/* Private chat delete (all users) */}
                {selectedChat.type === 'private' && (
                  <button
                    className="w-full py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700"
                    onClick={async () => {
                      if (window.confirm('Ar tikrai norite ištrinti šį pokalbį?')) {
                        try {
                          await axios.delete(`${API_URL}/api/chat/${selectedChat.id}`, {
                            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                          });
                          setChats(prev => prev.filter(chat => chat.id !== selectedChat.id));
                          setSelectedChat(null);
                          setShowMembersModal(false);
                          toast.success('Pokalbis ištrintas');
                        } catch (error) {
                          toast.error('Nepavyko ištrinti pokalbio');
                        }
                      }
                    }}
                  >
                    Ištrinti pokalbį
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Naujas pokalbis modalas */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-xs">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold focus:outline-none"
              onClick={() => setShowNewModal(false)}
              aria-label="Uždaryti"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Sukurti naują</h3>
            <div className="space-y-3">
              <button
                className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700" 
                onClick={() => { setShowUserSelect(true); setShowNewModal(false); }}
              >
                Privatus pokalbis
              </button>
              <button 
                className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700" 
                onClick={() => { setCreateType('group'); setShowCreateGroupOrChannel(true); setShowNewModal(false); }}
              >
                Grupė
              </button>
              <button 
                className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700" 
                onClick={() => { setCreateType('channel'); setShowCreateGroupOrChannel(true); setShowNewModal(false); }}
              >
                Kanalo kūrimas
              </button>
            </div>
            <button className="mt-6 w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600" onClick={() => setShowNewModal(false)}>
              Atšaukti
            </button>
          </div>
        </div>
      )}
      {/* Žinučių paieškos rezultatai */}
      {searchQuery && searchResults.length > 0 && (
        <div className="p-4 bg-white/30 dark:bg-slate-800/60 backdrop-blur-md border-b border-slate-700/20 relative">
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl font-bold focus:outline-none"
            title="Uždaryti paieškos rezultatus"
          >
            ×
          </button>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Search Results
          </h3>
          <div className="space-y-2">
            {searchResults.map(message => (
              <div
                key={message.id}
                className="p-3 rounded-lg bg-white/40 dark:bg-slate-700/40 hover:bg-white/60 dark:hover:bg-slate-700/60 cursor-pointer"
                onClick={() => {
                  // Scroll to the message
                  const messageElement = document.getElementById(`message-${message.id}`);
                  if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth' });
                    messageElement.classList.add('highlight');
                    setTimeout(() => messageElement.classList.remove('highlight'), 2000);
                  }
                }}
              >
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {message.sender_name || message.senderName}
                </div>
                <div className="text-slate-900 dark:text-white">
                  {message.content}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  {new Date(message.created_at || message.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Modalas: pasirinkti vartotoją privačiam pokalbiui */}
      {showUserSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold focus:outline-none"
              onClick={() => setShowUserSelect(false)}
              aria-label="Uždaryti"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Pasirinkite vartotoją</h3>
            <input
              type="text"
              className="w-full mb-2 px-4 py-2 rounded bg-white/60 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ieškoti narių..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              aria-label="Ieškoti narių"
            />
            <div className="max-h-48 overflow-y-auto mb-2">
              {users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-2 hover:bg-blue-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  onClick={async () => {
                    await handleCreatePrivateChat(u.id);
                    setShowUserSelect(false);
                  }}
                  tabIndex={0}
                  aria-label={`Sukurti pokalbį su ${u.name}`}
                >
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-400 text-white font-bold">
                    {u.name[0].toUpperCase()}
                  </span>
                  <span className="text-gray-900 dark:text-white">{u.name}</span>
                </div>
              ))}
            </div>
            <button
              className="mt-3 w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600"
              onClick={() => setShowUserSelect(false)}
            >
              Atšaukti
            </button>
          </div>
        </div>
      )}
      {/* Modalas: sukurti grupę ar kanalą */}
      {showCreateGroupOrChannel && (
        <CreateGroupOrChannelModal
          type={createType}
          onClose={() => setShowCreateGroupOrChannel(false)}
          onCreated={(newChat) => {
            setChats(prev => [...prev, {
              id: newChat.chatId,
              type: newChat.type,
              display_name: newChat.name,
              lastMessage: null
            }]);
            setSelectedChat({
              id: newChat.chatId,
              type: newChat.type,
              display_name: newChat.name,
              lastMessage: null
            });
            setShowCreateGroupOrChannel(false);
          }}
        />
      )}
      {/* Modalas narių pridėjimui */}
      {showAddMember && (
        <AddMemberModal
          chatId={selectedChat?.id}
          onClose={() => setShowAddMember(false)}
          onAdded={async () => {
            // Po pridėjimo atnaujinti narių sąrašą
            try {
              const response = await axios.get(`${API_URL}/api/group/${selectedChat.id}/members`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              setMembers(response.data);
            } catch {}
          }}
          existingMembers={members}
        />
      )}
    </div>
  );
};

export default Chat; 