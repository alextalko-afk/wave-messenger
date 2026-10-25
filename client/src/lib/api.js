const TOKEN_KEY = 'wave_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ошибка запроса');
    err.status = res.status; // lets callers tell a rejected session (401) from a flaky server
    throw err;
  }
  return data;
}

function cursorQuery(cursor, prefix = '?') {
  if (!cursor) return '';
  return `${prefix}before=${encodeURIComponent(cursor.before)}&beforeId=${encodeURIComponent(cursor.beforeId)}`;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
  // Changing the password revokes every older token; the response carries the
  // replacement that keeps this device signed in.
  changePassword: async (body) => {
    const data = await request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) });
    if (data.token) setToken(data.token);
    return data;
  },
  twoFactorSetup: () => request('/auth/2fa/setup', { method: 'POST' }),
  twoFactorEnable: (code) => request('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  twoFactorDisable: (code) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  twoFactorRecoveryCodes: (code) => request('/auth/2fa/recovery-codes', { method: 'POST', body: JSON.stringify({ code }) }),
  twoFactorRemaining: () => request('/auth/2fa/recovery-codes/remaining'),
  twoFactorVerify: (challengeToken, code) =>
    request('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ challengeToken, code }) }),
  revokeOtherSessions: async () => {
    const data = await request('/auth/revoke-sessions', { method: 'POST' });
    if (data.token) setToken(data.token);
    return data;
  },
  googleAuth: (idToken) => request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  linkGoogle: (idToken) => request('/auth/link-google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getConversations: () => request('/conversations'),
  createDirect: (userId) => request('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) }),
  createGroup: (name, memberIds) =>
    request('/conversations/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) }),
  // `cursor` is the previous page's nextCursor ({ before, beforeId }).
  getMessages: (conversationId, cursor) =>
    request(`/conversations/${conversationId}/messages${cursorQuery(cursor)}`),
  markRead: (conversationId) => request(`/conversations/${conversationId}/read`, { method: 'POST' }),
  getConversationStats: (conversationId) => request(`/conversations/${conversationId}/stats`),
  getConversationMedia: (conversationId, type, cursor) =>
    request(`/conversations/${conversationId}/media?type=${type}${cursorQuery(cursor, '&')}`),
  getSharedGroups: (conversationId) => request(`/conversations/${conversationId}/shared-groups`),
  pinConversation: (conversationId, pinned) =>
    request(`/conversations/${conversationId}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) }),
  muteConversation: (conversationId, muted) =>
    request(`/conversations/${conversationId}/mute`, { method: 'POST', body: JSON.stringify({ muted }) }),
  markUnread: (conversationId, unread) =>
    request(`/conversations/${conversationId}/mark-unread`, { method: 'POST', body: JSON.stringify({ unread }) }),
  clearHistory: (conversationId) => request(`/conversations/${conversationId}/clear`, { method: 'POST' }),
  deleteConversation: (conversationId) => request(`/conversations/${conversationId}`, { method: 'DELETE' }),
  renameGroup: (conversationId, name) =>
    request(`/conversations/${conversationId}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  addGroupMembers: (conversationId, userIds) =>
    request(`/conversations/${conversationId}/members`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  removeGroupMember: (conversationId, userId) =>
    request(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
  setGroupMemberRole: (conversationId, userId, role) =>
    request(`/conversations/${conversationId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/upload', { method: 'POST', body: form });
  },
  getCalls: () => request('/calls'),
  getIceServers: () => request('/calls/ice-servers'),
  searchMessages: (q, conversationId) =>
    request(`/search/messages?q=${encodeURIComponent(q)}${conversationId ? `&conversationId=${conversationId}` : ''}`),
  pushRegister: (token, platform) =>
    request('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  pushUnregister: (token) => request('/push/unregister', { method: 'POST', body: JSON.stringify({ token }) }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/upload/avatar', { method: 'POST', body: form });
  },
  deleteAvatar: () => request('/upload/avatar', { method: 'DELETE' }),
  uploadGroupAvatar: (conversationId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/conversations/${conversationId}/avatar`, { method: 'POST', body: form });
  },
  deleteGroupAvatar: (conversationId) => request(`/conversations/${conversationId}/avatar`, { method: 'DELETE' }),
};
