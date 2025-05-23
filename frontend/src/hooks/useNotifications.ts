import { useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useNotifications = () => {
  const requestPermission = useCallback(async () => {
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        return true;
      } else if (permission === 'denied') {
        toast.error(
          'Notifications are blocked. To enable them, click the lock icon in your browser\'s address bar and allow notifications.',
          { duration: 5000 }
        );
        return false;
      } else {
        toast.error(
          'Please allow notifications to receive chat updates',
          { duration: 3000 }
        );
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      if (Notification.permission === 'default') {
        const granted = await requestPermission();
        if (!granted) return;
      }

      if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          ...options
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [requestPermission]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestPermission();
    }
  }, [requestPermission]);

  return { showNotification, requestPermission };
}; 