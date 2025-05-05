import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL, getApiUrl } from '../config';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();

// Set up a global axios interceptor to attach the token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Set up a global axios response interceptor to handle errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token');
          window.location.href = '/login';
          toast.error('Session expired. Please login again.');
          break;
        case 403:
          toast.error('You do not have permission to perform this action.');
          break;
        case 404:
          toast.error('Resource not found.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error(error.response.data?.message || 'An error occurred.');
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred.');
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${getApiUrl()}api/auth/me`);
      if (response.data.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${getApiUrl()}api/auth/login`, {
        email,
        password,
      });

      const { user, token } = response.data;
      setUser(user);
      localStorage.setItem('token', token);
      toast.success('Logged in successfully');
      return { success: true };
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${getApiUrl()}api/auth/register`, {
        name,
        email,
        password,
      });

      const { user, token } = response.data;
      setUser(user);
      localStorage.setItem('token', token);
      toast.success('Registration successful');
      return { success: true };
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed');
      return { success: false, error: error.response?.data?.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
  }, []);

  const updateProfile = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.put(`${getApiUrl()}api/auth/profile`, data);
      setUser(response.data.user);
      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update profile');
      return { success: false, error: error.response?.data?.message || 'Failed to update profile' };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    refreshUser: fetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 