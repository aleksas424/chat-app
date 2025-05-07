import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../config';
import { toast } from 'react-hot-toast';

export const useSocket = (user, onMessage) => {
  const [socket, setSocket] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const connect = useCallback(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const newSocket = io(getSocketUrl(), {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError('Nepavyko prisijungti prie chat serverio');
      setIsReconnecting(true);
      toast.error('Nepavyko prisijungti. Patikrinkite savo ryšį.');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
      setIsReconnecting(true);
      toast.error('Disconnected from server. Attempting to reconnect...');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsReconnecting(false);
      setConnectionError(null);
      toast.success('Reconnected to server');
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      setConnectionError('Nepavyko prisijungti prie chat serverio');
      toast.error('Nepavyko prisijungti. Patikrinkite savo ryšį.');
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setConnectionError('Nepavyko prisijungti prie chat serverio. Prašome atnaujinti puslapį.');
      toast.error('Ryšys nepavyko. Prašome atnaujinti puslapį.');
    });

    if (onMessage) {
      newSocket.on('new-message', onMessage);
    }

    setSocket(newSocket);

    return () => {
      if (onMessage) {
        newSocket.off('new-message', onMessage);
      }
      newSocket.disconnect();
    };
  }, [user, onMessage]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);

  const sendMessage = useCallback((chatId, content) => {
    if (!socket) {
      toast.error('Neprisijungta prie serverio');
      return false;
    }
    socket.emit('message', { chatId, content });
    return true;
  }, [socket]);

  const joinChat = useCallback((chatId) => {
    if (!socket) {
      toast.error('Not connected to server');
      return false;
    }
    socket.emit('join-chat', chatId);
    return true;
  }, [socket]);

  const leaveChat = useCallback((chatId) => {
    if (!socket) {
      toast.error('Not connected to server');
      return false;
    }
    socket.emit('leave-chat', chatId);
    return true;
  }, [socket]);

  const typing = useCallback((chatId) => {
    if (!socket) return false;
    socket.emit('typing', { chatId });
    return true;
  }, [socket]);

  const stopTyping = useCallback((chatId) => {
    if (!socket) return false;
    socket.emit('stop-typing', { chatId });
    return true;
  }, [socket]);

  return {
    socket,
    isConnecting,
    isReconnecting,
    connectionError,
    sendMessage,
    joinChat,
    leaveChat,
    typing,
    stopTyping
  };
}; 