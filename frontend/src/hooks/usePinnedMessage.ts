import { useState, useEffect, useCallback } from 'react';
import { Message } from '../types';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

export const usePinnedMessage = (chatId: number | null) => {
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  const fetchPinnedMessage = useCallback(async () => {
    if (!chatId) {
      setPinnedMessage(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/chat/${chatId}/pinned-message`);
      setPinnedMessage(response.data);
      setRetryCount(0); // Reset retry count on success
    } catch (err: any) {
      console.error('Error fetching pinned message:', err);
      
      // Only show error toast if we've exhausted retries
      if (retryCount >= MAX_RETRIES) {
        if (err.response?.status === 404) {
          setPinnedMessage(null);
        } else {
          setError('Failed to load pinned message');
          toast.error('Failed to load pinned message');
        }
      } else {
        // Increment retry count and try again
        setRetryCount(prev => prev + 1);
        setTimeout(fetchPinnedMessage, 1000 * (retryCount + 1)); // Exponential backoff
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatId, retryCount]);

  useEffect(() => {
    fetchPinnedMessage();
  }, [fetchPinnedMessage]);

  const updatePinnedMessage = useCallback((message: Message | null) => {
    setPinnedMessage(message);
  }, []);

  return {
    pinnedMessage,
    isLoading,
    error,
    updatePinnedMessage,
    refreshPinnedMessage: fetchPinnedMessage
  };
}; 