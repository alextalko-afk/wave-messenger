import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { token, user } = await api.login({ username, password });
    setToken(token);
    setUser(user);
  }

  async function loginWithGoogle(idToken) {
    const { token, user } = await api.googleAuth(idToken);
    setToken(token);
    setUser(user);
  }

  async function linkGoogle(idToken) {
    const { user: updated } = await api.linkGoogle(idToken);
    setUser(updated);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, loginWithGoogle, linkGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
