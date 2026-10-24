import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';
import { removePushToken } from '../lib/push.js';

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

  // With two-step verification on, the server answers with a challenge instead
  // of a session. Both sign-ins return that challenge ({ challengeToken }) so
  // the page can ask for the code, or null once the user is signed in.
  function startSession({ token, user, twoFactorRequired, challengeToken }) {
    if (twoFactorRequired) return { challengeToken };
    setToken(token);
    setUser(user);
    return null;
  }

  async function login(username, password) {
    return startSession(await api.login({ username, password }));
  }

  async function loginWithGoogle(idToken) {
    return startSession(await api.googleAuth(idToken));
  }

  async function verifyTwoFactor(challengeToken, code) {
    const { token, user } = await api.twoFactorVerify(challengeToken, code);
    setToken(token);
    setUser(user);
  }

  async function linkGoogle(idToken) {
    const { user: updated } = await api.linkGoogle(idToken);
    setUser(updated);
  }

  function logout() {
    removePushToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, loginWithGoogle, verifyTwoFactor, linkGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
