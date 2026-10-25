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
    // Only a rejected session (401) signs the user out. A network blip or a
    // server restart at start-up keeps the token and retries until the server answers.
    let cancelled = false;
    let timer;
    function load() {
      api
        .me()
        .then(({ user }) => {
          if (cancelled) return;
          setUser(user);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.status === 401) {
            setToken(null);
            setLoading(false);
          } else {
            timer = setTimeout(load, 2000);
          }
        });
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
