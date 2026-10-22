import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = (e) => {
      setUser(null);
      if (e.detail) setNotice(e.detail);
    };
    window.addEventListener('ssis:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ssis:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = async (username, password) => {
    const { user } = await api.post('/auth/login', { username, password });
    setNotice('');
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const can = (perm) => !!user?.permissions?.includes(perm);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, can, notice, setNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
