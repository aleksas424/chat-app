import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';
import axios from 'axios';

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

// Set up a global axios response interceptor to handle 401 Unauthorized
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Optionally, show a toast or message here
      window.location = '/login'; // Redirect to login page
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Unauthorized');
          }
          return res.json();
        })
        .then(data => {
          if (data.user) {
            setUser(data.user);
          }
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, code) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('token', data.token);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Prisijungimas nepavyko' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  const sendLoginCode = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/send-login-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Nepavyko išsiųsti kodo' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firstName: name.firstName,
          lastName: name.lastName,
          email, 
          password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Registracija nepavyko' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('token', data.token);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Verifikacija nepavyko' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  const forgotPassword = async (email) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Nepavyko išsiųsti kodo' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Nepavyko atnaujinti slaptažodžio' };
      }
    } catch (error) {
      return { success: false, error: 'Tinklo klaida' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, verifyEmail, sendLoginCode, logout, loading, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 