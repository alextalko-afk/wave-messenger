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
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  googleAuth: (idToken) => request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  linkGoogle: (idToken) => request('/auth/link-google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getConversations: () => request('/conversations'),
  createDirect: (userId) => request('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) }),
  createGroup: (name, memberIds) =>
    request('/conversations/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) }),
  getMessages: (conversationId, before) =>
    request(`/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`),
  markRead: (conversationId) => request(`/conversations/${conversationId}/read`, { method: 'POST' }),
  getConversationStats: (conversationId) => request(`/conversations/${conversationId}/stats`),
  getConversationMedia: (conversationId, type) => request(`/conversations/${conversationId}/media?type=${type}`),
  getSharedGroups: (conversationId) => request(`/conversations/${conversationId}/shared-groups`),
  pinConversation: (conversationId, pinned) =>
    request(`/conversations/${conversationId}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) }),
  muteConversation: (conversationId, muted) =>
    request(`/conversations/${conversationId}/mute`, { method: 'POST', body: JSON.stringify({ muted }) }),
  markUnread: (conversationId, unread) =>
    request(`/conversations/${conversationId}/mark-unread`, { method: 'POST', body: JSON.stringify({ unread }) }),
  clearHistory: (conversationId) => request(`/conversations/${conversationId}/clear`, { method: 'POST' }),
  deleteConversation: (conversationId) => request(`/conversations/${conversationId}`, { method: 'DELETE' }),
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/upload', { method: 'POST', body: form });
  },
  getCalls: () => request('/calls'),
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
