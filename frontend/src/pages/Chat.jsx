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
      toast.error('Failed to connect to chat server');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('new-message', (message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900">
      {isMobile ? (
        mobileView === 'chats' ? (
          <SidebarComponent />
        ) : (
          <ChatComponent />
        )
      ) : (
        <>
          <SidebarComponent />
          <ChatComponent />
        </>
      )}
    </div>
  );
};

const SidebarComponent = () => (
  <div className={`fixed z-50 inset-y-0 left-0 w-full max-w-xs bg-white/20 dark:bg-slate-800/80 border-r border-slate-700 shadow-xl backdrop-blur-lg rounded-r-3xl transform transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:w-1/4 md:block`}>
    {/* ...sidebar turinys kaip buvo... */}
    {filteredChats.map(chat => (
      <motion.div
        key={chat.id}
        // ...
        onClick={() => {
          handleSelectChat(chat);
          if (isMobile) setMobileView('chat');
        }}
      >
        {/* ... */}
      </motion.div>
    ))}
    {/* ... */}
  </div>
);

const ChatComponent = () => (
  <div className="flex-1 flex flex-col overflow-hidden">
    {isMobile && (
      <button onClick={() => setMobileView('chats')} className="p-2 m-2 rounded-lg bg-white/30 dark:bg-slate-700/60 text-blue-700 dark:text-blue-200 font-bold shadow">← Atgal</button>
    )}
    {/* ...chat lango turinys... */}
  </div>
);

export default Chat; 