import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_URL } from '../config';
import io from 'socket.io-client';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import CreateGroupOrChannelModal from '../components/CreateGroupOrChannelModal';
import AddMemberModal from '../components/AddMemberModal';
import EmojiPicker from '../components/EmojiPicker';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageForEmoji, setSelectedMessageForEmoji] = useState(null);
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef();
  const messageInputRef = useRef();

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
    let cancelled = false;
    const fetchChats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (cancelled) return;
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
        if (cancelled) return;
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
        } else {
          setSelectedChat(null);
        }
      } catch (error) {
        if (!cancelled) toast.error('Nepavyko įkelti pokalbių');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchChats();
    return () => { cancelled = true; };
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
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        chatId: selectedChat.id,
        sender_id: user.id,
        senderId: user.id,
        sender_name: user.first_name + ' ' + user.last_name,
        content: newMessage,
        created_at: new Date().toISOString(),
        edited: false,
        reactions: [],
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      try {
        const res = await axios.post(`${API_URL}/api/chat/${selectedChat.id}/messages`, {
          content: newMessage
        });
        setMessages(prev => prev.map(m => m.id === tempId ? res.data : m));
      } catch (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
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
        display_name: users.find(u => u.id === userId)?.first_name + ' ' + users.find(u => u.id === userId)?.last_name || 'Privatus',
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
    if (!selectedChat) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/group/${selectedChat.id}/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      // Atnaujinti žinutes
      const response = await axios.get(
        `${API_URL}/api/chat/${selectedChat.id}/messages`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMessages(response.data);
      toast.success('Žinutė ištrinta');
    } catch (error) {
      toast.error('Nepavyko ištrinti žinutės');
    }
  };

  const handleDeleteAllMessages = async () => {
    if (!selectedChat) return;
    
    if (!window.confirm('Ar tikrai norite ištrinti visas žinutes?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/group/${selectedChat.id}/messages`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMessages([]);
      toast.success('Visos žinutės ištrintos');
    } catch (error) {
      toast.error('Nepavyko ištrinti žinučių');
    }
  };

  const handleSearch = async (query) => {
    if (!selectedChat) return;
    if (!query.trim()) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/chat/${selectedChat.id}/messages/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Nepavyko ieškoti žinučių');
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

  // 1. Emoji reakcijų siuntimas į backend (viena reakcija per vartotoją)
  const handleAddReaction = async (messageId, emoji) => {
    const userId = user.id;
    const reactions = messageReactions[messageId] || [];
    const userReaction = reactions.find(r => r.user_id === userId);
    if (userReaction && userReaction.emoji === emoji) {
      setShowEmojiPicker(false);
      setSelectedMessageForEmoji(null);
      return;
    }
    try {
      await axios.post(
        `${API_URL}/api/chat/${selectedChat.id}/messages/${messageId}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setShowEmojiPicker(false);
      setSelectedMessageForEmoji(null);
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

  const handleAddEmoji = (emoji) => {
    if (selectedMessageForEmoji) {
      handleAddReaction(selectedMessageForEmoji, emoji);
    }
    setShowEmojiPicker(false);
    setSelectedMessageForEmoji(null);
  };

  const renderMessage = (message) => {
    const isOwner = message.sender_id === user?.id || message.senderId === user?.id;
    let canDelete = false;
    if (myRole === 'owner') canDelete = true;
    else if (myRole === 'admin') canDelete = true;
    else if (isOwner) canDelete = true;
    const canEdit = isOwner;
    const userReaction = messageReactions[message.id]?.find(r => r.user_id === user?.id);
    const isEditing = editingMessage === message.id;
    return (
      <div key={message.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[90vw] md:max-w-[70%] ${isOwner ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'} rounded-2xl p-4 relative shadow-lg break-words transition-all`} style={{minWidth: 120}}>
          {!isOwner && (
            <div className="text-xs text-gray-400 dark:text-gray-300 mb-2 font-semibold tracking-wide">
              {message.sender_name}
            </div>
          )}
          {isEditing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                handleEditMessage(message.id, editContent);
              }}
              className="flex flex-col gap-2"
            >
              <input
                type="text"
                className="p-2 rounded border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">Išsaugoti</button>
                <button type="button" className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold hover:bg-gray-400 dark:hover:bg-gray-600" onClick={() => { setEditingMessage(null); setEditContent(''); }}>Atšaukti</button>
              </div>
            </form>
          ) : (
            <>
              <div className="text-base md:text-lg font-medium mb-2 whitespace-pre-line">{message.content}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {canEdit && (
                  <button
                    onClick={() => { setEditingMessage(message.id); setEditContent(message.content); }}
                    className="text-xs text-blue-600 hover:text-white px-2 py-1 rounded bg-blue-100 dark:bg-blue-700/40 hover:bg-blue-500/80 transition"
                  >Redaguoti</button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="text-xs text-red-600 hover:text-white px-2 py-1 rounded bg-red-100 dark:bg-red-700/30 hover:bg-red-500/80 transition"
                  >Ištrinti</button>
                )}
                <button
                  onClick={() => {
                    setSelectedMessageForEmoji(message.id);
                    setShowEmojiPicker(true);
                  }}
                  className={`text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-700 transition ${userReaction ? 'ring-2 ring-blue-400' : ''}`}
                  title="Pridėti reakciją"
                  style={{fontSize: '1.2em'}}
                >{userReaction ? userReaction.emoji : '😊'}</button>
                {/* Rodyti emoji reakcijas */}
                {messageReactions[message.id]?.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {Object.entries(
                      messageReactions[message.id].reduce((acc, reaction) => {
                        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emoji, count]) => (
                      <span key={emoji} className="text-sm">
                        {emoji} {count > 1 ? count : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!selectedChat && window.innerWidth < 768) {
      setSidebarOpen(true);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat && chats.length > 0 && window.innerWidth >= 768) {
      setSelectedChat(chats[0]);
    }
  }, [selectedChat, chats]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedChat && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [selectedChat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen max-w-full max-h-screen overflow-x-hidden flex flex-col bg-gray-100 dark:bg-slate-900">
      {/* Search overlay at the END of the main return */}
      {showSearchInput && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mt-24 bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col items-center">
            <form
              className="w-full flex items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                handleSearch(searchQuery);
                setShowSearchInput(false);
              }}
            >
              <input
                ref={searchInputRef}
                type="text"
                className="flex-1 rounded-lg px-4 py-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-base shadow"
                placeholder="Ieškoti žinutės..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Ieškoti žinutės"
                autoFocus
              />
              <button
                type="submit"
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Ieškoti"
              >
                Ieškoti
              </button>
              <button
                type="button"
                onClick={() => setShowSearchInput(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Uždaryti paiešką"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0 w-full max-w-full">
        {/* Sidebar: Only show on mobile if sidebarOpen, always show on desktop */}
        <div
          className={`
            ${sidebarOpen ? '' : 'hidden'}
            fixed z-50 inset-y-0 left-0 w-4/5 max-w-xs bg-slate-800/90 border-r border-slate-700 shadow-xl backdrop-blur-lg rounded-r-3xl
            transform transition-transform duration-200 md:static md:translate-x-0 md:w-72 md:max-w-xs md:block h-full flex flex-col z-20
          `}
        >
          <div className="p-4 md:p-6 flex flex-col h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow">Pokalbiai</h2>
              <button
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow hover:from-blue-600 hover:to-indigo-700 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 font-semibold text-sm md:text-base"
                onClick={() => setShowCreateTypeModal(true)}
                aria-label="Naujas pokalbis"
                title="Naujas pokalbis"
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
              aria-label="Ieškoti pokalbių"
            />
            <div className="space-y-2 md:space-y-3 flex-1 min-h-0 overflow-y-auto">
              {filteredChats.length === 0 && (
                <div className="text-slate-400 text-center py-4 md:py-8 text-sm md:text-base">No chats found</div>
              )}
              <div className="flex flex-col gap-2 md:gap-3">
                {filteredChats.length === 0 && chats.length === 0 && (
                  <div className="text-center text-gray-400 py-8">No chats available</div>
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
                    tabIndex={0}
                    aria-label={`Pasirinkti pokalbį: ${chat.display_name}`}
                    title={chat.display_name}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg md:text-xl shadow-lg">
                      {(() => {
                        const parts = (chat.display_name || '').split(' ');
                        const first = (parts[0] && parts[0][0]) ? parts[0][0].toUpperCase() : '';
                        const last = (parts[1] && parts[1][0]) ? parts[1][0].toUpperCase() : '';
                        return first + last;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className="font-semibold truncate text-sm md:text-base" title={chat.display_name}>
                          {chat.display_name}
                        </span>
                        <span className="text-xs text-blue-200">{chat.type}</span>
                      </div>
                      <div className="text-xs md:text-sm text-blue-100 truncate" title={chat.lastMessage ? `${chat.lastMessage.senderName || ''}: ${chat.lastMessage.content}` : 'No messages yet'}>
                        {chat.lastMessage ? `${chat.lastMessage.senderName || ''}: ${chat.lastMessage.content}` : 'No messages yet'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Chat area: Only show on mobile if sidebarOpen is false, always show on desktop */}
        <div className={`flex-1 flex flex-col h-full min-h-0 max-w-full ${sidebarOpen ? 'hidden' : ''} md:block overflow-y-auto`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="flex-none p-2 md:p-4 border-b border-slate-700/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between w-full max-w-full" style={{backdropFilter: 'blur(8px)'}}>
                {/* Burger menu button on mobile */}
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 mr-2"
                  aria-label="Atidaryti/uždaryti pokalbių sąrašą"
                  title="Atidaryti/uždaryti pokalbių sąrašą"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg md:text-xl shadow-lg">
                    {(() => {
                      const parts = (selectedChat.display_name || '').split(' ');
                      const first = (parts[0] && parts[0][0]) ? parts[0][0].toUpperCase() : '';
                      const last = (parts[1] && parts[1][0]) ? parts[1][0].toUpperCase() : '';
                      return first + last;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white truncate max-w-[120px] md:max-w-xs" title={selectedChat.display_name}>
                      {selectedChat.display_name}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                      {selectedChat.type}
                    </p>
                  </div>
                </div>
                {/* Search Button and Input */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchInput(!showSearchInput);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    className="p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Ieškoti žinutės"
                    aria-label="Ieškoti žinutės"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                  </button>
                </div>
                {selectedChat.type === 'private' ? (
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
                    className="p-1.5 md:p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm md:text-base transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    title="Ištrinti pokalbį"
                    aria-label="Ištrinti pokalbį"
                  >
                    🗑️
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="p-1.5 md:p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Rodyti narius"
                    aria-label="Rodyti narius"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Messages + input */}
              <div className="flex flex-col flex-1 min-h-0 max-w-full">
                <div className="flex-1 min-h-0 overflow-y-auto p-1 md:p-4 space-y-2 md:space-y-4 bg-white/10 dark:bg-slate-800/40 rounded-2xl md:rounded-3xl shadow-xl backdrop-blur-md w-full max-w-full">
                  {/* Show 'Grįžti į žinutes' button when search results are shown */}
                  {(searchQuery && searchResults.length > 0) && (
                    <div className="flex justify-center mb-4">
                      <button
                        className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      >
                        Grįžti į žinutes
                      </button>
                    </div>
                  )}
                  <AnimatePresence>
                    {(searchQuery && searchResults.length > 0
                      ? searchResults
                      : !searchQuery && messages.length > 0
                        ? messages
                        : []
                    ).map(message => (
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
                        {renderMessage(message)}
                      </motion.div>
                    ))}
                    {(searchQuery && searchResults.length === 0) && (
                      <div className="text-center text-gray-400 py-8">Nerasta žinučių pagal paiešką</div>
                    )}
                  </AnimatePresence>
                </div>
                <form
                  onSubmit={sendMessage}
                  className="flex-none flex items-center gap-2 p-2 md:p-4 border-t bg-white/30 dark:bg-slate-800/60 backdrop-blur-md w-full max-w-full"
                >
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    id="file-upload"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                    aria-label="Prisegti failą"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer p-2 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800" title="Prisegti failą" aria-label="Prisegti failą">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 00-5.657-5.657l-7.071 7.07a6 6 0 108.485 8.485l6.364-6.364" /></svg>
                  </label>
                  <input
                    type="text"
                    className="flex-1 p-2 rounded border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Įveskite žinutę..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    inputMode="text"
                    autoComplete="on"
                    ref={messageInputRef}
                    aria-label="Įveskite žinutę"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    disabled={!newMessage.trim()}
                    aria-label="Siųsti žinutę"
                    title="Siųsti žinutę"
                  >
                    Siųsti
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-lg">
              Pasirinkite pokalbį
            </div>
          )}
        </div>
      </div>
      
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleAddEmoji}
          onClose={() => {
            setShowEmojiPicker(false);
            setSelectedMessageForEmoji(null);
          }}
        />
      )}

      {showCreateTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 w-full max-w-xs flex flex-col gap-4 items-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Ką norite sukurti?</h3>
            <button
              className="w-full py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
              onClick={() => { setCreateType('group'); setShowCreateTypeModal(false); setShowNewModal(true); }}
            >Sukurti grupę</button>
            <button
              className="w-full py-2 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              onClick={() => { setCreateType('channel'); setShowCreateTypeModal(false); setShowNewModal(true); }}
            >Sukurti kanalą</button>
            <button
              className="w-full py-2 rounded bg-green-600 text-white font-medium hover:bg-green-700"
              onClick={() => { setCreateType('private'); setShowCreateTypeModal(false); setShowUserSelect(true); }}
            >Sukurti privatų pokalbį</button>
            <button
              className="mt-2 w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600"
              onClick={() => setShowCreateTypeModal(false)}
            >Atšaukti</button>
          </div>
        </div>
      )}

      {/* Modalas vartotojo pasirinkimui privačiam pokalbiui */}
      {showUserSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 w-full max-w-xs flex flex-col gap-4 items-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Pasirinkite vartotoją</h3>
            <input
              type="text"
              placeholder="Ieškoti vartotojo..."
              className="w-full mb-2 px-3 py-2 rounded-xl border-none bg-white/40 dark:bg-slate-700/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 shadow text-sm"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <div className="w-full max-h-48 overflow-y-auto space-y-2">
              {users.filter(u =>
                (u.first_name + ' ' + u.last_name).toLowerCase().includes(userSearch.toLowerCase())
              ).map(u => (
                <button
                  key={u.id}
                  className="w-full text-left py-2 px-3 rounded hover:bg-blue-100 dark:hover:bg-blue-800"
                  onClick={() => handleCreatePrivateChat(u.id)}
                >
                  {u.first_name} {u.last_name} ({u.email})
                </button>
              ))}
              {users.filter(u =>
                (u.first_name + ' ' + u.last_name).toLowerCase().includes(userSearch.toLowerCase())
              ).length === 0 && (
                <div className="text-gray-400 text-center">Nėra vartotojų</div>
              )}
            </div>
            <button
              className="mt-2 w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600"
              onClick={() => setShowUserSelect(false)}
            >Atšaukti</button>
          </div>
        </div>
      )}

      {showNewModal && createType !== 'private' && (
        <CreateGroupOrChannelModal
          type={createType}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            // Atnaujinti pokalbių sąrašą
            window.location.reload();
          }}
        />
      )}

      {/* Modalas grupės/kanalo nariams su rolėmis ir valdymu */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Nariai</h3>
            <div className="overflow-y-auto max-h-80 divide-y divide-gray-200 dark:divide-gray-700">
              {members.length === 0 && (
                <div className="text-gray-400 text-center py-4">Nėra narių</div>
              )}
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 px-1 gap-2">
                  <div className="font-medium text-gray-900 dark:text-white">{m.first_name} {m.last_name}</div>
                  <div className="flex items-center gap-2">
                    {/* Rodyti rolės keitimą ir šalinimą tik jei esi savininkas ir ne pats */}
                    {myRole === 'owner' && m.id !== user.id && (
                      <>
                        <select
                          className="rounded px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          value={m.role}
                          onChange={e => handleChangeRole(m.id, e.target.value)}
                        >
                          <option value="admin">Administratorius</option>
                          <option value="member">Narys</option>
                        </select>
                        <button
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 dark:border-red-500"
                          onClick={() => handleRemoveMember(m.id)}
                        >Pašalinti</button>
                      </>
                    )}
                    {/* Rodyti rolę */}
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${m.role === 'owner' ? 'bg-yellow-200 text-yellow-800' : m.role === 'admin' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                      {m.role === 'owner' ? 'Savininkas' : m.role === 'admin' ? 'Administratorius' : 'Narys'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {/* Pridėti narį tik savininkui */}
              {myRole === 'owner' && (
                <button
                  className="w-full py-2 rounded bg-green-600 text-white font-medium hover:bg-green-700"
                  onClick={() => { setShowAddMember(true); setShowMembersModal(false); }}
                >Pridėti narį</button>
              )}
              {/* Ištrinti grupę/kanalą tik savininkui */}
              {myRole === 'owner' && (
                <button
                  className="w-full py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700"
                  onClick={async () => {
                    if (window.confirm('Ar tikrai norite ištrinti šią grupę/kanalą?')) {
                      await handleDeleteChat();
                      setShowMembersModal(false);
                    }
                  }}
                >Ištrinti grupę/kanalą</button>
              )}
              {/* Palikti grupę/kanalą adminui ar nariui */}
              {myRole !== 'owner' && (
                <button
                  className="w-full py-2 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600"
                  onClick={async () => {
                    if (window.confirm('Ar tikrai norite palikti šią grupę/kanalą?')) {
                      await handleLeaveChat();
                      setShowMembersModal(false);
                    }
                  }}
                >Palikti grupę/kanalą</button>
              )}
              <button
                className="w-full py-2 rounded bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 font-medium hover:bg-blue-300 dark:hover:bg-blue-700"
                onClick={() => setShowMembersModal(false)}
              >Uždaryti</button>
            </div>
          </div>
        </div>
      )}

      {/* Modalas nario pridėjimui */}
      {showAddMember && (
        <AddMemberModal
          chatId={selectedChat?.id}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false);
            // Atnaujinti narių sąrašą
            if (selectedChat) {
              axios.get(`${API_URL}/api/group/${selectedChat.id}/members`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              }).then(res => setMembers(res.data));
            }
          }}
          existingMembers={members}
        />
      )}
    </div>
  );
};


export default Chat;