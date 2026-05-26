import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // swallow
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  // On mount, attempt a silent refresh to restore session
  useEffect(() => {
    api
      .post('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return api.get('/auth/me');
      })
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for forced logout emitted by the axios interceptor
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, referralCode) => {
    const { data } = await api.post('/auth/register', { name, email, password, referralCode });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
